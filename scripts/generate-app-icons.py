"""Generate Expo, iOS, and Android app icons from the Connect logo."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LOGO_PATH = ROOT / "src" / "assets" / "images" / "logo.png"
ASSETS = ROOT / "assets"
IOS_ICONSET = ROOT / "ios" / "Connect" / "Images.xcassets" / "AppIcon.appiconset"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"

WHITE = (255, 255, 255, 255)
TEAL = (41, 177, 169, 255)  # #29B1A9 splash background


def make_square(
    logo: Image.Image,
    size: int,
    fill_ratio: float = 0.94,
    bg: tuple[int, int, int, int] = WHITE,
    keep_alpha: bool = False,
) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), bg)
    lw, lh = logo.size
    target = max(1, int(size * fill_ratio))
    scale = target / max(lw, lh)
    nw, nh = max(1, round(lw * scale)), max(1, round(lh * scale))
    resized = logo.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (size - nw) // 2
    y = (size - nh) // 2
    canvas.paste(resized, (x, y), resized)
    if keep_alpha:
        return canvas
    out = Image.new("RGB", (size, size), bg[:3])
    out.paste(canvas, mask=canvas.split()[-1])
    return out


def main() -> None:
    logo = Image.open(LOGO_PATH).convert("RGBA")
    ASSETS.mkdir(parents=True, exist_ok=True)

    make_square(logo, 1024, fill_ratio=0.94, bg=WHITE, keep_alpha=False).save(
        ASSETS / "icon.png", "PNG"
    )
    make_square(logo, 1024, fill_ratio=0.70, bg=(255, 255, 255, 0), keep_alpha=True).save(
        ASSETS / "adaptive-icon.png", "PNG"
    )
    make_square(logo, 48, fill_ratio=0.94, bg=WHITE, keep_alpha=False).save(
        ASSETS / "favicon.png", "PNG"
    )
    make_square(logo, 1284, fill_ratio=0.42, bg=TEAL, keep_alpha=False).save(
        ASSETS / "splash.png", "PNG"
    )

    IOS_ICONSET.mkdir(parents=True, exist_ok=True)
    for old in IOS_ICONSET.glob("*.png"):
        old.unlink()

    ios_entries = [
        ("icon-20@2x.png", 40, "iphone", "2x", "20x20"),
        ("icon-20@3x.png", 60, "iphone", "3x", "20x20"),
        ("icon-29@2x.png", 58, "iphone", "2x", "29x29"),
        ("icon-29@3x.png", 87, "iphone", "3x", "29x29"),
        ("icon-40@2x.png", 80, "iphone", "2x", "40x40"),
        ("icon-40@3x.png", 120, "iphone", "3x", "40x40"),
        ("icon-60@2x.png", 120, "iphone", "2x", "60x60"),
        ("icon-60@3x.png", 180, "iphone", "3x", "60x60"),
        ("icon-20.png", 20, "ipad", "1x", "20x20"),
        ("icon-20@2x-ipad.png", 40, "ipad", "2x", "20x20"),
        ("icon-29.png", 29, "ipad", "1x", "29x29"),
        ("icon-29@2x-ipad.png", 58, "ipad", "2x", "29x29"),
        ("icon-40.png", 40, "ipad", "1x", "40x40"),
        ("icon-40@2x-ipad.png", 80, "ipad", "2x", "40x40"),
        ("icon-76.png", 76, "ipad", "1x", "76x76"),
        ("icon-76@2x.png", 152, "ipad", "2x", "76x76"),
        ("icon-83.5@2x.png", 167, "ipad", "2x", "83.5x83.5"),
        ("icon-1024.png", 1024, "ios-marketing", "1x", "1024x1024"),
    ]

    contents: dict = {"images": [], "info": {"author": "xcode", "version": 1}}
    for filename, px, idiom, scale, size in ios_entries:
        make_square(logo, px, fill_ratio=0.94, bg=WHITE, keep_alpha=False).save(
            IOS_ICONSET / filename, "PNG"
        )
        contents["images"].append(
            {
                "filename": filename,
                "idiom": idiom,
                "scale": scale,
                "size": size,
            }
        )
    (IOS_ICONSET / "Contents.json").write_text(
        json.dumps(contents, indent=2) + "\n", encoding="utf-8"
    )

    android_sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    for folder, px in android_sizes.items():
        dest = ANDROID_RES / folder
        dest.mkdir(parents=True, exist_ok=True)
        img = make_square(logo, px, fill_ratio=0.94, bg=WHITE, keep_alpha=False)
        img.save(dest / "ic_launcher.png", "PNG")
        img.save(dest / "ic_launcher_round.png", "PNG")

    drawable = ANDROID_RES / "drawable"
    drawable.mkdir(parents=True, exist_ok=True)
    make_square(logo, 1024, fill_ratio=0.70, bg=(255, 255, 255, 0), keep_alpha=True).save(
        drawable / "ic_launcher_foreground.png", "PNG"
    )

    (ANDROID_RES / "values" / "colors.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        '    <color name="iconBackground">#FFFFFF</color>\n'
        "</resources>\n",
        encoding="utf-8",
    )

    anydpi = ANDROID_RES / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    adaptive_xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/iconBackground"/>\n'
        '    <foreground android:drawable="@drawable/ic_launcher_foreground"/>\n'
        "</adaptive-icon>\n"
    )
    (anydpi / "ic_launcher.xml").write_text(adaptive_xml, encoding="utf-8")
    (anydpi / "ic_launcher_round.xml").write_text(adaptive_xml, encoding="utf-8")

    for path in [
        ASSETS / "icon.png",
        ASSETS / "adaptive-icon.png",
        IOS_ICONSET / "icon-1024.png",
        ANDROID_RES / "mipmap-xxxhdpi" / "ic_launcher.png",
    ]:
        im = Image.open(path)
        print(f"OK {path.relative_to(ROOT)} {im.size} {im.mode} {path.stat().st_size} bytes")


if __name__ == "__main__":
    main()
