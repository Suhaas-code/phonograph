"""Centralized variant quality ranking (Phase 6).

Ordering priority (highest quality first):
    1. Higher bit depth
    2. Higher sample rate
    3. Lossless before lossy
    4. Higher bitrate

This single comparison key is reused by variant ordering, missing-variant
detection, comparison views, and quality-distribution analytics so every part
of the system agrees on what "better" means.
"""
from app.models.variant import Variant

LOSSLESS_CODECS = {"flac", "alac", "wav", "ape", "wavpack", "aiff", "pcm"}


def is_lossless(codec: str | None) -> bool:
    if not codec:
        return False
    return codec.strip().lower() in LOSSLESS_CODECS


def quality_key(variant: Variant) -> tuple:
    """Sort key; descending sort puts the highest quality variant first."""
    return (
        variant.bit_depth or 0,
        variant.sample_rate or 0,
        1 if is_lossless(variant.codec) else 0,
        variant.bitrate or 0,
    )


def sort_variants(variants: list[Variant]) -> list[Variant]:
    """Return variants ordered best-quality first."""
    return sorted(variants, key=quality_key, reverse=True)


def quality_tier(variant: Variant) -> str:
    """Human-readable tier label for quality-distribution analytics."""
    if is_lossless(variant.codec):
        if (variant.bit_depth or 0) >= 24 or (variant.sample_rate or 0) > 48000:
            return "Hi-Res Lossless"
        return "Lossless"
    bitrate = variant.bitrate or 0
    if bitrate >= 256:
        return "High Bitrate Lossy"
    if bitrate > 0:
        return "Low Bitrate Lossy"
    return "Unknown"


def format_label(variant: Variant) -> str:
    """Short label like 'FLAC 24-bit 96kHz' or 'MP3 320kbps'."""
    codec = (variant.codec or "Unknown").upper()
    if is_lossless(variant.codec):
        parts = [codec]
        if variant.bit_depth:
            parts.append(f"{variant.bit_depth}-bit")
        if variant.sample_rate:
            parts.append(f"{variant.sample_rate / 1000:g}kHz")
        return " ".join(parts)
    if variant.bitrate:
        return f"{codec} {variant.bitrate}kbps"
    return codec
