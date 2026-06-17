# Extension Developer Guide: `search.augment` capability

This document covers everything you need to add search augmentation to a Phonograph
extension. It is written for extension developers — Phonograph is the client, your
service is the server.

---

## Overview

The `search.augment` capability lets your extension contribute results to Phonograph's
track search. When a user types in the search box, Phonograph calls your `/search`
endpoint with the query and displays your results alongside the local library matches.

Your service must already be a registered Phonograph extension. If you have an existing
extension that uses `metadata.refresh`, the steps below show how to add `search.augment`
to the same manifest.

---

## 1. Update your manifest

Add `"search.augment"` to `capabilities`, and add `"read:query"` to
`required_permissions`.

```json
{
  "api_version": "1.0",
  "name": "My Extension",
  "version": "1.1.0",
  "author": "Your Name",
  "endpoint_url": "https://your-service.example.com",
  "capabilities": [
    "metadata.refresh",
    "search.augment"
  ],
  "required_permissions": [
    "read:tracks",
    "write:streaming_links",
    "read:query"
  ]
}
```

`read:query` is the only permission required for `search.augment`. Without it, Phonograph
will still call your `/search` endpoint but the `query` field will be omitted from the
request body.

After you update the manifest at its URL, go to your extension's settings in Phonograph
and press **Update**. Because you added a new permission (`read:query`), Phonograph will
ask you to re-approve the updated permission set before search calls are made.

---

## 2. Implement the `/search` endpoint

Phonograph sends a `POST` request to `{endpoint_url}/search`.

### Request

**Headers** (same signing scheme as `/refresh`):

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-Phonograph-Extension` | The numeric extension id |
| `X-Phonograph-Timestamp` | Unix timestamp (seconds, integer) |
| `X-Phonograph-Signature` | `HMAC-SHA256(shared_secret, "{timestamp}.{raw_body}")` — hex-encoded |

**Body:**

```json
{
  "api_version": "1.0",
  "extension_id": 4,
  "granted_permissions": ["read:query"],
  "query": "hotel california"
}
```

| Field | Type | Notes |
|---|---|---|
| `api_version` | string | Always `"1.0"` currently |
| `extension_id` | integer | Your extension's id in Phonograph |
| `granted_permissions` | string[] | The permissions the user approved |
| `query` | string | The user's search term — **only present when `read:query` is granted** |

If `read:query` is not in `granted_permissions`, the `query` field is absent. You should
return an empty results list in that case (or a prompt to request the permission).

### Signature verification

Compute the expected signature the same way as `/refresh`:

```python
import hashlib, hmac, time

def verify(shared_secret: str, timestamp: str, raw_body: bytes, given_sig: str) -> bool:
    # Reject stale timestamps (optional but recommended — allow ±60 s drift)
    if abs(time.time() - int(timestamp)) > 60:
        return False
    mac = hmac.new(shared_secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256)
    return hmac.compare_digest(mac.hexdigest(), given_sig)
```

### Response

Return `200 OK` with `Content-Type: application/json`.

```json
{
  "results": [
    {
      "label": "Hotel California (2013 Remaster)",
      "sublabel": "Eagles · Asylum Records · 1977",
      "url": "https://tidal.com/browse/track/1234567"
    },
    {
      "label": "Hotel California (Live)",
      "sublabel": "Eagles · 1995",
      "url": null
    }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `results` | array | yes | May be empty (`[]`) |
| `results[].label` | string | yes | Primary display text. 1–300 characters |
| `results[].sublabel` | string \| null | no | Secondary line (artist, year, source, etc.). Max 300 characters |
| `results[].url` | string \| null | no | If present, rendered as a clickable link. Max 2000 characters |

**Schema is strict** — unknown fields are rejected and the result item is skipped.
Return exactly the fields above, no extras.

---

## 3. Behaviour contract

| Concern | Behaviour |
|---|---|
| **Timeout** | Phonograph waits `EXTENSION_HTTP_TIMEOUT` seconds (default 10 s). Return early with partial results rather than failing. |
| **Partial results** | Each result item is validated independently. A malformed item is dropped; the rest are shown. |
| **Empty results** | Return `{"results": []}`. The UI hides the extension block when there are no results. |
| **No query permission** | The `query` field is absent. Return `{"results": []}` or a hint. |
| **HTTP errors** | A non-2xx response or timeout sets your extension status to `error` in Phonograph. The user must re-enable it before further calls. |
| **Frequency** | Fires on every search input change (client-side debounce is minimal). Design your handler to be fast. Cache aggressively on your end. |
| **No DB writes** | Search is read-only — Phonograph does not persist anything from your `/search` response. |

---

## 4. Minimal working example (Python / FastAPI)

```python
import hashlib, hmac, time
from fastapi import FastAPI, Header, Request, HTTPException
from pydantic import BaseModel

app = FastAPI()
SHARED_SECRET = "your-phonograph-shared-secret"

class SearchResult(BaseModel):
    label: str
    sublabel: str | None = None
    url: str | None = None

class SearchResponse(BaseModel):
    results: list[SearchResult]

@app.post("/search")
async def search(
    request: Request,
    x_phonograph_timestamp: str = Header(...),
    x_phonograph_signature: str = Header(...),
) -> SearchResponse:
    body = await request.body()

    # Verify signature
    if abs(time.time() - int(x_phonograph_timestamp)) > 60:
        raise HTTPException(401, "Stale timestamp")
    expected = hmac.new(
        SHARED_SECRET.encode(),
        f"{x_phonograph_timestamp}.".encode() + body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, x_phonograph_signature):
        raise HTTPException(401, "Invalid signature")

    payload = await request.json()
    query = payload.get("query", "")
    if not query:
        return SearchResponse(results=[])

    # Your lookup logic here
    results = await my_lookup(query)
    return SearchResponse(results=[
        SearchResult(label=r.title, sublabel=r.artist, url=r.url)
        for r in results
    ])
```

---

## 5. Quick checklist

- [ ] `search.augment` added to `capabilities` in manifest
- [ ] `read:query` added to `required_permissions` in manifest
- [ ] Manifest URL updated and **Update** pressed in Phonograph
- [ ] New permissions re-approved in Phonograph
- [ ] `POST {endpoint_url}/search` endpoint implemented
- [ ] Signature verification in place
- [ ] Response is `{"results": [...]}` with no extra fields
- [ ] Each result has `label` (required), `sublabel` (optional), `url` (optional)
- [ ] Handler returns within the timeout (default 10 s)
