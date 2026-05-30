#!/usr/bin/env python3
"""Regenerate Equipify Sales panel wordmark with true alpha transparency."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".cursor-source/equipify-sales-logo-source.png"
OUTPUTS = [
    ROOT / "extensions/growth-browser-intake/assets/equipify-sales-wordmark.png",
    ROOT / "public/brand/equipify-sales-wordmark.png",
]

NEUTRAL_MAX = 95
NEUTRAL_DELTA = 22
SUM_CUT = 42


def is_background_pixel(red: int, green: int, blue: int) -> bool:
    total = red + green + blue
    neutral = max(red, green, blue) - min(red, green, blue) <= NEUTRAL_DELTA
    return total <= SUM_CUT or (neutral and max(red, green, blue) <= NEUTRAL_MAX)


def flood_remove_border_background(img: Image.Image) -> Image.Image:
    out = img.convert("RGBA")
    px = out.load()
    width, height = out.size
    visited: set[tuple[int, int]] = set()
    seeds: list[tuple[int, int]] = []

    for x in range(width):
        seeds.append((x, 0))
        seeds.append((x, height - 1))
    for y in range(height):
        seeds.append((0, y))
        seeds.append((width - 1, y))

    for sx, sy in seeds:
        if (sx, sy) in visited:
            continue
        red, green, blue, _alpha = px[sx, sy]
        if not is_background_pixel(red, green, blue):
            continue
        queue: deque[tuple[int, int]] = deque([(sx, sy)])
        while queue:
            x, y = queue.popleft()
            if (x, y) in visited:
                continue
            if x < 0 or x >= width or y < 0 or y >= height:
                continue
            red, green, blue, alpha = px[x, y]
            if not is_background_pixel(red, green, blue):
                continue
            visited.add((x, y))
            px[x, y] = (red, green, blue, 0)
            queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    return out


def verify_transparency(path: Path) -> dict[str, int | bool]:
    img = Image.open(path).convert("RGBA")
    width, height = img.size
    transparent = 0
    neutral_dark_opaque = 0

    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = img.getpixel((x, y))
            if alpha < 10:
                transparent += 1
                continue
            if (
                alpha > 200
                and max(red, green, blue) < 90
                and abs(red - green) < 20
                and abs(green - blue) < 20
            ):
                neutral_dark_opaque += 1

    corners = [
        img.getpixel(point)[3]
        for point in ((0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1))
    ]

    return {
        "width": width,
        "height": height,
        "corners_transparent": all(alpha < 10 for alpha in corners),
        "transparent_pixels": transparent,
        "neutral_dark_opaque_pixels": neutral_dark_opaque,
    }


def remove_baked_background(img: Image.Image) -> Image.Image:
    out = flood_remove_border_background(img)
    px = out.load()
    width, height = out.size
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = px[x, y]
            if alpha < 10:
                continue
            total = red + green + blue
            neutral = max(red, green, blue) - min(red, green, blue) <= NEUTRAL_DELTA
            if total <= SUM_CUT or (neutral and max(red, green, blue) <= NEUTRAL_MAX):
                px[x, y] = (red, green, blue, 0)
    return out


def main() -> None:
    source_candidates = [
        SOURCE,
        Path(
            "/Users/blitz/.cursor/projects/Users-blitz-Projects-equipify-equipify-app/assets/Equipify-sales-logo-b6138b6c-c8ac-4e39-8bfa-df53f0615133.png"
        ),
        ROOT / "extensions/growth-browser-intake/assets/equipify-sales-logo.png",
    ]
    source = next((path for path in source_candidates if path.exists()), None)
    if source is None:
        raise SystemExit("Equipify Sales logo source image not found")

    logo = remove_baked_background(Image.open(source))
    for output in OUTPUTS:
        output.parent.mkdir(parents=True, exist_ok=True)
        logo.save(output, format="PNG", optimize=True)

    stats = verify_transparency(OUTPUTS[0])
    if not stats["corners_transparent"]:
        raise SystemExit("Generated logo corners are not transparent")
    if int(stats["neutral_dark_opaque_pixels"]) > 500:
        raise SystemExit(
            f"Generated logo still has dark matte box pixels: {stats['neutral_dark_opaque_pixels']}"
        )

    print("Generated transparent Equipify Sales wordmark")
    for output in OUTPUTS:
        print(f"  {output}")
    print(f"  stats={stats}")


if __name__ == "__main__":
    main()
