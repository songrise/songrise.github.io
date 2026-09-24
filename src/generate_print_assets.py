"""Regenerate the bookish illustration edge and printed-ink textures.

Run ``python src/generate_print_assets.py`` from any directory. The default
output is the repository's ``images/bookish`` folder. Use ``--check`` to
compare generated assets with the checked-in files without changing them.
"""

from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
PAPER_RGB = (242, 235, 221)
ILLUSTRATION_SIZE = (960, 720)
INK_TILE_SIZE = 256


def illustration_overlay() -> Image.Image:
    """Add fibers at the edge without making the image depend on a raster mask."""
    width, height = ILLUSTRATION_SIZE
    rng = np.random.default_rng(53192)

    def noise_grid(columns: int, rows: int) -> np.ndarray:
        cells = rng.integers(0, 256, (rows, columns), dtype=np.uint8)
        image = Image.fromarray(cells, "L").resize((width, height), Image.Resampling.BICUBIC)
        return (np.asarray(image, dtype=np.float32) - 127.5) / 127.5

    y, x = np.mgrid[:height, :width].astype(np.float32)
    distance_x = np.minimum(x, width - 1 - x)
    distance_y = np.minimum(y, height - 1 - y)
    jitter = noise_grid(34, 26) * 4.2 + noise_grid(190, 143) * 1.4
    fade_x = np.clip((distance_x + jitter) / 69.0, 0, 1)
    fade_y = np.clip((distance_y + jitter) / 57.0, 0, 1)
    smooth_x = fade_x * fade_x * (3 - 2 * fade_x)
    smooth_y = fade_y * fade_y * (3 - 2 * fade_y)
    alpha = smooth_x * smooth_y

    grain = rng.random((height, width), dtype=np.float32)
    edge_band = 1 - np.minimum(smooth_x, smooth_y)
    fibers = np.clip((grain - 0.62) / 0.38, 0, 1)
    alpha *= 1 - edge_band * fibers * 0.075
    target_alpha = np.uint8(np.round(np.clip(alpha, 0, 1) * 255)).astype(np.float32) / 255

    # The CSS gradients remain the reliable primary feather. This image only
    # adds paper-colored erasure where the irregular fade should be lighter.
    base_alpha = np.clip(distance_x / 67.2, 0, 1) * np.clip(distance_y / 57.6, 0, 1)
    with np.errstate(divide="ignore", invalid="ignore"):
        erasure = np.where(base_alpha > 0.015, 1 - target_alpha / base_alpha, 0)
    erasure = np.clip(erasure, 0, 0.58)

    overlay = np.zeros((height, width, 4), dtype=np.uint8)
    overlay[:, :, :3] = PAPER_RGB
    overlay[:, :, 3] = np.uint8(np.round(erasure * 255))
    return Image.fromarray(overlay, "RGBA")


def ink_tiles() -> dict[str, Image.Image]:
    """Create seamless, colored ink tiles with sparse dry-ink flecks."""
    size = INK_TILE_SIZE
    rng = np.random.default_rng(9241)

    def periodic_noise(scale: float) -> np.ndarray:
        white = rng.standard_normal((size, size))
        frequency = np.fft.fftfreq(size)
        fx, fy = np.meshgrid(frequency, frequency)
        low_pass = np.exp(-0.5 * (fx * fx + fy * fy) / (scale * scale))
        field = np.fft.ifft2(np.fft.fft2(white) * low_pass).real
        return (field - field.mean()) / field.std()

    coarse = periodic_noise(0.038)
    fine = periodic_noise(0.17)
    grain = rng.standard_normal((size, size))
    variation = 0.69 * coarse + 0.28 * fine + 0.11 * grain
    variation /= np.percentile(np.abs(variation), 95)
    variation = np.clip(variation, -1.25, 1.25)

    fleck_image = Image.new("L", (size, size))
    draw = ImageDraw.Draw(fleck_image)
    for _ in range(145):
        x = int(rng.integers(0, size))
        y = int(rng.integers(0, size))
        rx = int(rng.integers(1, 4))
        ry = int(rng.integers(1, 3))
        value = int(rng.integers(120, 225))
        draw.ellipse((x - rx, y - ry, x + rx, y + ry), fill=value)
    flecks = np.asarray(fleck_image.filter(ImageFilter.GaussianBlur(0.45)), dtype=np.float32) / 255

    tiles = {}
    for name, color, strength in (
        ("ink-print-display.png", (81, 72, 63), 0.15),
        ("ink-print-accent.png", (146, 87, 76), 0.13),
    ):
        rgb = np.asarray(color, dtype=np.float32)[None, None, :] * (1 + strength * variation[:, :, None])
        paper = np.asarray(PAPER_RGB, dtype=np.float32)[None, None, :]
        rgb += (paper - rgb) * (0.38 * flecks[:, :, None])
        tiles[name] = Image.fromarray(np.uint8(np.round(np.clip(rgb, 0, 255))), "RGB")
    return tiles


def png_bytes(image: Image.Image) -> bytes:
    stream = BytesIO()
    image.save(stream, format="PNG", optimize=True)
    return stream.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "images" / "bookish")
    parser.add_argument("--check", action="store_true", help="Compare outputs without writing files")
    args = parser.parse_args()

    assets = {"illustration-fiber-overlay.png": illustration_overlay(), **ink_tiles()}
    if not args.check:
        args.output_dir.mkdir(parents=True, exist_ok=True)

    changed = False
    for name, image in assets.items():
        path = args.output_dir / name
        data = png_bytes(image)
        if args.check:
            matches = path.is_file() and path.read_bytes() == data
            print(f"{'OK' if matches else 'DIFF'} {path}")
            changed |= not matches
        else:
            path.write_bytes(data)
            print(f"Wrote {path}")
    return int(changed)


if __name__ == "__main__":
    raise SystemExit(main())
