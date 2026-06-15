"""Helpers that turn ORM objects into response schemas with derived fields."""
from app.models.variant import Variant
from app.schemas.variant import VariantSummary
from app.services import variant_quality


def variant_summary(v: Variant) -> VariantSummary:
    return VariantSummary(
        id=v.id,
        track_id=v.track_id,
        library_id=v.library_id,
        library_name=v.library.name if v.library else None,
        codec=v.codec,
        container=v.container,
        bitrate=v.bitrate,
        bit_depth=v.bit_depth,
        sample_rate=v.sample_rate,
        channels=v.channels,
        duration=v.duration,
        file_size=v.file_size,
        format_label=variant_quality.format_label(v),
        quality_tier=variant_quality.quality_tier(v),
        lossless=variant_quality.is_lossless(v.codec),
    )
