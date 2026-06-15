"""Metadata normalization for track grouping (Phase 4).

The browser scanner also normalizes client-side, but the server re-normalizes
every value it receives so grouping is consistent regardless of client version.
"""
import re
import unicodedata

# Leading articles stripped from titles/artists for grouping purposes.
_LEADING_ARTICLES = ("the ", "a ", "an ")
# Featured-artist noise removed from artist strings.
_FEAT_PATTERN = re.compile(r"\s*[\(\[]?\s*(feat\.?|featuring|ft\.?|with)\s+.*$", re.IGNORECASE)
# Parenthetical/bracketed qualifiers removed from titles (remaster, live, etc.).
_QUALIFIER_PATTERN = re.compile(r"\s*[\(\[][^\)\]]*[\)\]]")
_WHITESPACE = re.compile(r"\s+")
_NON_ALNUM_EDGE = re.compile(r"^[^\w]+|[^\w]+$")


def _strip_accents(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def _base_normalize(value: str) -> str:
    value = _strip_accents(value)
    value = value.lower().strip()
    value = _WHITESPACE.sub(" ", value)
    return value


def normalize_artist(artist: str | None) -> str:
    if not artist:
        return ""
    value = _base_normalize(artist)
    value = _FEAT_PATTERN.sub("", value)
    value = _QUALIFIER_PATTERN.sub("", value)
    for article in _LEADING_ARTICLES:
        if value.startswith(article):
            value = value[len(article):]
            break
    value = _NON_ALNUM_EDGE.sub("", value)
    return value.strip()


def normalize_title(title: str | None) -> str:
    if not title:
        return ""
    value = _base_normalize(title)
    value = _QUALIFIER_PATTERN.sub("", value)
    for article in _LEADING_ARTICLES:
        if value.startswith(article):
            value = value[len(article):]
            break
    value = _NON_ALNUM_EDGE.sub("", value)
    return value.strip()


def grouping_key(normalized_artist: str, normalized_title: str) -> str:
    return f"{normalized_artist}\x1f{normalized_title}"
