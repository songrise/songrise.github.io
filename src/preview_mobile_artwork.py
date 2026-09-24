"""Render a contact sheet of publication artwork at common phone widths.

The sheet approximates the site's CSS feather and fiber overlay. It is useful
for checking that the artwork and the 90%-width NeRF-Art treatment stay aligned.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PAPER_RGB = (242, 235, 221)
IMAGE_SIZE = (960, 720)


def faded_artwork(source: Path, overlay: Image.Image) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    if image.size != IMAGE_SIZE:
        raise ValueError(f"Expected a 4:3, 960 × 720 illustration: {source}")
    y, x = np.mgrid[:720, :960].astype(np.float32)
    fade = np.clip(np.minimum(x, 959 - x) / 67.2, 0, 1) * np.clip(np.minimum(y, 719 - y) / 57.6, 0, 1)
    source_alpha = np.asarray(image.getchannel("A"), dtype=np.float32)
    image.putalpha(Image.fromarray(np.uint8(np.round(source_alpha * fade)), "L"))
    paper = Image.new("RGBA", IMAGE_SIZE, PAPER_RGB)
    paper.alpha_composite(image)
    paper.alpha_composite(overlay)
    return paper.convert("RGB")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="Where to save the contact sheet")
    parser.add_argument("--root", type=Path, default=ROOT, help="Site root (defaults to the parent of src)")
    parser.add_argument("--viewport-widths", type=int, nargs="+", default=[320, 375, 430])
    args = parser.parse_args()
    if any(width < 320 or width > 760 for width in args.viewport_widths):
        parser.error("viewport widths must be between 320 and 760 CSS pixels")

    root = args.root.resolve()
    overlay = Image.open(root / "images/bookish/illustration-fiber-overlay.png").convert("RGBA")
    first = faded_artwork(root / "images/papers/before-the-shutter.webp", overlay)
    nerf = faded_artwork(root / "images/papers/nerf-art-proteus.webp", overlay)

    widths = [viewport - 44 for viewport in args.viewport_widths]  # home.css mobile content inset
    gap = 22
    top = 44
    second_top = top + round(max(widths) * .75) + 40
    height = second_top + round(max(widths) * .9 * .75) + 32
    sheet = Image.new("RGB", (sum(widths) + gap * (len(widths) + 1), height), PAPER_RGB)
    draw = ImageDraw.Draw(sheet)

    left = gap
    for viewport, width in zip(args.viewport_widths, widths):
        draw.text((left, 12), f"{viewport}px viewport / {width}px content", fill="#51483f")
        first_thumb = first.resize((width, round(width * .75)), Image.Resampling.LANCZOS)
        sheet.paste(first_thumb, (left, top))
        nerf_width = round(width * .9)
        nerf_thumb = nerf.resize((nerf_width, round(nerf_width * .75)), Image.Resampling.LANCZOS)
        sheet.paste(nerf_thumb, (left + round(width * .05), second_top))
        left += width + gap

    args.output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.output)
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
