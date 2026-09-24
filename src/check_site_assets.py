"""Check that local references in the site's HTML and CSS resolve to files."""

from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
CSS_URL = re.compile(r"url\(\s*['\"]?([^)'\"]+)")
EXTERNAL_PREFIXES = ("#", "data:", "mailto:", "tel:", "http:", "https:", "//")


def local_path(source: Path, reference: str) -> Path | None:
    if reference.startswith(EXTERNAL_PREFIXES):
        return None
    path = reference.split("#", 1)[0].split("?", 1)[0]
    return source.parent / path if path else None


class HTMLReferences(HTMLParser):
    def __init__(self, source: Path):
        super().__init__()
        self.source = source
        self.references: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in {"href", "src", "poster"} and value:
                self.references.append(value)


def missing_assets(root: Path) -> list[tuple[Path, str]]:
    missing = []
    for source in root.glob("*.html"):
        parser = HTMLReferences(source)
        parser.feed(source.read_text(encoding="utf-8"))
        for reference in parser.references:
            target = local_path(source, reference)
            if target is not None and not target.is_file():
                missing.append((source, reference))

    for source in root.glob("*.css"):
        for reference in CSS_URL.findall(source.read_text(encoding="utf-8")):
            target = local_path(source, reference)
            if target is not None and not target.is_file():
                missing.append((source, reference))
    return missing


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="Site root (defaults to the parent of src)")
    args = parser.parse_args()
    root = args.root.resolve()
    missing = missing_assets(root)
    for source, reference in missing:
        print(f"MISSING {source.relative_to(root)}: {reference}")
    if missing:
        return 1
    print("All local HTML/CSS asset references exist.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
