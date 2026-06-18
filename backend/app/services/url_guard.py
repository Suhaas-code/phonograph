"""SSRF-safe outbound HTTP for the extension framework.

Every call an extension causes Phonograph to make — fetching a manifest, hitting
an extension endpoint — goes through this module, so the network egress policy
lives in exactly one place:

* https only (http allowed only when ``extension_allow_http`` is set, for dev);
* the host must not resolve to a private, loopback, link-local, or otherwise
  internal address (blocks SSRF to the metadata service, the DB, localhost, …);
* redirects are disabled (a 30x would bypass the pre-flight host check);
* responses are size-capped, time-bounded, and must be JSON.

Nothing returned here is ever executed — callers parse it into strict Pydantic
models. This is the structural guarantee behind "extensions never run code in
the Phonograph process".
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlsplit

import httpx

from app.config import settings


class OutboundURLError(ValueError):
    """A URL was rejected before any request was made (bad scheme/host/IP)."""


class ExtensionHTTPError(RuntimeError):
    """An outbound call failed or returned an unusable response."""


class RateLimitError(ExtensionHTTPError):
    """The external service returned HTTP 429 (rate limit). Transient — the
    extension should not be marked as errored."""

    def __init__(self, message: str, retry_after: int | None = None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


def _is_blocked_ip(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
        # Cloud metadata endpoint (link_local already covers 169.254/16, but be
        # explicit so the intent survives refactors).
        or str(addr) == "169.254.169.254"
    )


def validate_outbound_url(url: str) -> None:
    """Raise OutboundURLError unless *url* is safe to call.

    Resolves the host and rejects it if *any* resolved address is internal, so a
    DNS name that points at a private IP cannot slip through.
    """
    parts = urlsplit(url)
    scheme = parts.scheme.lower()
    allowed = {"https"} | ({"http"} if settings.extension_allow_http else set())
    if scheme not in allowed:
        raise OutboundURLError(
            f"URL scheme '{parts.scheme}' is not allowed (use https)"
        )

    host = parts.hostname
    if not host:
        raise OutboundURLError("URL has no host")

    # If the host is already a literal IP, check it directly; otherwise resolve.
    try:
        ipaddress.ip_address(host)
        candidates = [host]
    except ValueError:
        try:
            infos = socket.getaddrinfo(host, parts.port or None, proto=socket.IPPROTO_TCP)
        except socket.gaierror as exc:
            raise OutboundURLError(f"Could not resolve host '{host}'") from exc
        candidates = [info[4][0] for info in infos]

    if not candidates:
        raise OutboundURLError(f"Could not resolve host '{host}'")
    for ip in candidates:
        if _is_blocked_ip(ip):
            raise OutboundURLError(
                f"Host '{host}' resolves to a blocked address ({ip})"
            )


def _read_capped_json(response: httpx.Response) -> dict:
    content_type = response.headers.get("content-type", "")
    if "application/json" not in content_type.lower():
        raise ExtensionHTTPError(
            f"Expected a JSON response, got '{content_type or 'unknown'}'"
        )
    body = response.content
    if len(body) > settings.extension_max_response_bytes:
        raise ExtensionHTTPError("Response body exceeds the allowed size")
    try:
        data = response.json()
    except ValueError as exc:
        raise ExtensionHTTPError("Response body was not valid JSON") from exc
    if not isinstance(data, dict):
        raise ExtensionHTTPError("Response body must be a JSON object")
    return data


def _parse_retry_after(value: str | None) -> int | None:
    """Return the integer seconds from a Retry-After header value, or None."""
    if not value:
        return None
    stripped = value.strip()
    return int(stripped) if stripped.isdigit() else None


def safe_get_json(url: str) -> dict:
    """GET *url* (SSRF-checked) and return a JSON object, or raise."""
    validate_outbound_url(url)
    try:
        with httpx.Client(
            timeout=settings.extension_http_timeout, follow_redirects=False
        ) as client:
            response = client.get(url, headers={"Accept": "application/json"})
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 429:
            raise RateLimitError(
                "Service returned HTTP 429 (rate limited)",
                retry_after=_parse_retry_after(exc.response.headers.get("Retry-After")),
            ) from exc
        raise ExtensionHTTPError(
            f"Service returned HTTP {exc.response.status_code}"
        ) from exc
    except httpx.HTTPError as exc:
        raise ExtensionHTTPError(f"Request failed: {exc}") from exc
    return _read_capped_json(response)


def safe_post_json(
    url: str, *, body: str, headers: dict[str, str] | None = None
) -> dict:
    """POST a pre-serialized JSON *body* to *url* (SSRF-checked) and return a JSON
    object, or raise.

    The caller passes the exact JSON string it serialized so request signing can
    be computed over the same bytes that go on the wire.
    """
    validate_outbound_url(url)
    try:
        with httpx.Client(
            timeout=settings.extension_http_timeout, follow_redirects=False
        ) as client:
            response = client.post(
                url,
                content=body.encode("utf-8"),
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    **(headers or {}),
                },
            )
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 429:
            raise RateLimitError(
                "Service returned HTTP 429 (rate limited)",
                retry_after=_parse_retry_after(exc.response.headers.get("Retry-After")),
            ) from exc
        raise ExtensionHTTPError(
            f"Service returned HTTP {exc.response.status_code}"
        ) from exc
    except httpx.HTTPError as exc:
        raise ExtensionHTTPError(f"Request failed: {exc}") from exc
    return _read_capped_json(response)
