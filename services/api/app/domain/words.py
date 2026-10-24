"""Amount in words (Indian numbering) to a number, for the figures-versus-words check."""

import re

_UNITS = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
    "seventy": 70,
    "eighty": 80,
    "ninety": 90,
}
_SCALES = {
    "hundred": 100,
    "thousand": 1_000,
    "lakh": 100_000,
    "lakhs": 100_000,
    "lac": 100_000,
    "crore": 10_000_000,
    "crores": 10_000_000,
}
_IGNORE = {"rupees", "rupee", "rs", "only", "and", "inr"}


_VOCAB = sorted({*_UNITS, *_SCALES, *_IGNORE}, key=len, reverse=True)


def _segment(chunk: str) -> list[str]:
    """Splits run-together words ("rupeesfifteenlakhonly") by longest match against the amount
    vocabulary. An unknown remainder is returned as one token, which makes the parse fail safely."""
    out: list[str] = []
    i = 0
    while i < len(chunk):
        word = next((w for w in _VOCAB if chunk.startswith(w, i)), None)
        if word is None:
            return [*out, chunk[i:]]
        out.append(word)
        i += len(word)
    return out


def words_to_rupees(text: str) -> int | None:
    """Parses phrases such as "Rupees Thirty Five Lakh Fifty Thousand Only". Returns None when the
    text contains words that are not part of an amount, so OCR noise never yields a false value."""
    tokens = [t for chunk in re.findall(r"[a-z]+", text.lower()) for t in _segment(chunk)]
    if not tokens:
        return None
    total = 0
    current = 0
    seen_number = False
    for tok in tokens:
        if tok in _IGNORE:
            continue
        if tok in _UNITS:
            current += _UNITS[tok]
            seen_number = True
        elif tok == "hundred":
            current = max(current, 1) * 100
        elif tok in _SCALES:
            total += max(current, 1) * _SCALES[tok]
            current = 0
            seen_number = True
        else:
            return None
    return total + current if seen_number else None
