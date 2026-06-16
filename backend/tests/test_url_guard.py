"""Unit tests for the SSRF guard — the security-critical egress gate."""
import pytest

from app.config import settings
from app.services.url_guard import OutboundURLError, validate_outbound_url


@pytest.mark.parametrize(
    "url",
    [
        "http://example.com/manifest",  # http blocked by default
        "ftp://example.com/manifest",  # non-http scheme
        "https://127.0.0.1/manifest",  # loopback
        "https://localhost/manifest",  # resolves to loopback
        "https://10.0.0.5/manifest",  # private
        "https://192.168.1.10/manifest",  # private
        "https://169.254.169.254/latest/meta-data",  # cloud metadata
        "https://[::1]/manifest",  # ipv6 loopback
        "https://",  # no host
    ],
)
def test_blocked_urls(url: str) -> None:
    with pytest.raises(OutboundURLError):
        validate_outbound_url(url)


def test_https_public_host_allowed() -> None:
    # A well-known public host should pass (resolves to a public IP).
    validate_outbound_url("https://example.com/manifest")


def test_http_allowed_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "extension_allow_http", True)
    # http to a public host now allowed, but loopback still blocked.
    validate_outbound_url("http://example.com/manifest")
    with pytest.raises(OutboundURLError):
        validate_outbound_url("http://127.0.0.1/manifest")
