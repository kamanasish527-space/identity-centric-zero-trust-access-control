import re

CONTROL_CHAR_PATTERN = re.compile(r"[\x00-\x1f\x7f]")


def sanitize_text(value: str) -> str:
    cleaned = value.strip()
    if CONTROL_CHAR_PATTERN.search(cleaned):
        raise ValueError("Input contains invalid control characters")
    return cleaned
