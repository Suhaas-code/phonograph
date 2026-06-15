"""Analytics response schemas (loosely typed; payloads are dict-based)."""
from pydantic import BaseModel


class TrackLabel(BaseModel):
    id: int
    artist: str
    title: str


class QualityDistribution(BaseModel):
    total_variants: int
    by_tier: dict[str, int]
    by_codec: dict[str, int]
