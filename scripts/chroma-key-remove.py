"""
Remove green chroma key background from PNG images.

Usage:
  python3 scripts/chroma-key-remove.py

Reads from:  apps/editor/assets/img/structures/*.png
Writes to:   packages/shared/assets/structures/*.png
"""

import colorsys
import sys
from pathlib import Path

from PIL import Image


def remove_chroma_key(
    img: Image.Image,
    hue_center: float = 0.333,  # 120/360 = pure green in [0,1]
    hue_range: float = 0.14,    # ~50 degrees / 360
    sat_min: float = 0.20,
    val_min: float = 0.15,
) -> Image.Image:
    """Remove green chroma key using per-pixel HSV detection."""
    rgb = img.convert("RGB")
    pixels = rgb.load()
    w, h = rgb.size

    result = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out_pixels = result.load()

    for y in range(h):
        for x in range(w):
            r, g, b = pixels[x, y]
            rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
            hue, sat, val = colorsys.rgb_to_hsv(rf, gf, bf)

            # Distance from target green hue (wrapping around 0/1 boundary)
            hue_dist = min(abs(hue - hue_center), 1.0 - abs(hue - hue_center))

            is_green = hue_dist < hue_range and sat > sat_min and val > val_min

            if is_green:
                # Fully transparent
                out_pixels[x, y] = (r, g, b, 0)
            else:
                # Check if pixel is near the green boundary for edge softening
                if hue_dist < hue_range * 1.4 and sat > sat_min * 0.7:
                    # Edge pixel: partial transparency + green spill suppression
                    edge_factor = (hue_dist - hue_range) / (hue_range * 0.4)
                    alpha = int(min(1.0, max(0.0, edge_factor)) * 255)

                    # Suppress green spill
                    green_excess = max(0, g - max(r, b))
                    corrected_g = max(0, g - int(green_excess * 0.6))

                    out_pixels[x, y] = (r, corrected_g, b, alpha)
                else:
                    out_pixels[x, y] = (r, g, b, 255)

    return result


def trim_transparent(img: Image.Image, padding: int = 4) -> Image.Image:
    """Crop to content bounding box with padding."""
    bbox = img.getbbox()
    if bbox is None:
        return img

    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(img.width, bbox[2] + padding)
    bottom = min(img.height, bbox[3] + padding)

    return img.crop((left, top, right, bottom))


def main():
    project_root = Path(__file__).resolve().parent.parent

    input_dir = project_root / "apps" / "editor" / "assets" / "img" / "structures"
    output_dir = project_root / "packages" / "shared" / "assets" / "structures"
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_dir.exists():
        print(f"Input directory not found: {input_dir}")
        sys.exit(1)

    png_files = sorted(input_dir.glob("*.png"))
    if not png_files:
        print(f"No PNG files found in {input_dir}")
        sys.exit(1)

    print(f"Processing {len(png_files)} images...")
    print(f"  Input:  {input_dir}")
    print(f"  Output: {output_dir}")
    print()

    for png_path in png_files:
        img = Image.open(png_path)
        print(f"  {png_path.name}  ({img.width}x{img.height} {img.mode}) ...", end=" ", flush=True)

        result = remove_chroma_key(img)
        result = trim_transparent(result)

        out_path = output_dir / png_path.name
        result.save(out_path, "PNG", optimize=True)
        print(f"-> {result.width}x{result.height} RGBA")

    print()
    print(f"Done. {len(png_files)} images saved to {output_dir}")


if __name__ == "__main__":
    main()
