from __future__ import annotations

from difflib import SequenceMatcher

try:
    from rapidfuzz import fuzz, process
except Exception:  # pragma: no cover - fallback when rapidfuzz missing
    fuzz = None
    process = None


def score_similarity(left: str, right: str) -> int:
    if not left or not right:
        return 0
    if fuzz is not None:
        return int(fuzz.WRatio(left, right))
    return int(SequenceMatcher(None, left.lower(), right.lower()).ratio() * 100)


def best_match(query: str, choices: list[str], threshold: int = 70) -> tuple[str, int] | None:
    if not query or not choices:
        return None

    if process is not None:
        result = process.extractOne(query, choices, scorer=fuzz.WRatio)
        if result and int(result[1]) >= threshold:
            return str(result[0]), int(result[1])
        return None

    ranked = sorted(
        ((choice, score_similarity(query, choice)) for choice in choices),
        key=lambda item: item[1],
        reverse=True,
    )
    if not ranked or ranked[0][1] < threshold:
        return None
    return ranked[0][0], ranked[0][1]


def top_matches(query: str, choices: list[str], limit: int = 5) -> list[tuple[str, int]]:
    if not query or not choices:
        return []

    if process is not None:
        extracted = process.extract(query, choices, scorer=fuzz.WRatio, limit=limit)
        return [(str(item[0]), int(item[1])) for item in extracted]

    ranked = sorted(
        ((choice, score_similarity(query, choice)) for choice in choices),
        key=lambda item: item[1],
        reverse=True,
    )
    return ranked[:limit]
