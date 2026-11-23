"""Конвертация сгенерированного арта в WebP и раскладка по путям проекта.

Запуск: python scripts/prepare_art.py
Требует: pip install pillow
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public" / "assets"
SOURCE = ROOT / "art-source"

# исходник -> (назначение, максимальная ширина)
JOBS = [
    ("Generated Image November 14, 2026 - 10_42PM.png", "bg/lobby-tower.webp", 1440),
    ("Generated Image November 14, 2026 - 10_45PM.png", "heroes/belquist/card.webp", 1024),
    ("Generated Image November 14, 2026 - 10_46PM.png", "marketing/keyart-main.webp", 1920),
    ("EN-02.png", "bg/title.webp", 1440),
    ("BG-01.png", "bg/battle/ch01.webp", 1920),
    ("BG-02.png", "bg/battle/ch02.webp", 1920),
    ("BG-03.png", "bg/battle/ch03.webp", 1920),
    ("BG-04.png", "bg/battle/ch04.webp", 1920),
    ("BG-05.png", "bg/battle/ch05.webp", 1920),
    ("BG-06.png", "bg/battle/ch06.webp", 1920),
    ("BG-07.png", "bg/battle/ch07.webp", 1920),
    ("BG-08.png", "bg/battle/ch08.webp", 1920),
    ("BG-09.png", "bg/battle/ch09.webp", 1920),
    ("BG-10.png", "bg/battle/ch10.webp", 1920),
    ("KA-02.png", "marketing/keyart-portrait.webp", 1080),
    ("KA-03.png", "marketing/cover-yandex.webp", 1920),
    ("EN-03.png", "bg/altar.webp", 1440),
    ("EN-04.png", "bg/barracks.webp", 1440),
    ("EN-05.png", "bg/forge.webp", 1440),
    ("EN-06.png", "bg/archive.webp", 1440),
    ("EN-07.png", "bg/rift-map.webp", 1440),
    ("EN-08.png", "bg/arena.webp", 1440),
]

# исходники, для которых дополнительно делаем квадратный портрет
PORTRAITS = [
    ("Generated Image November 14, 2026 - 10_45PM.png", "heroes/belquist/portrait.webp"),
]


def convert(src: Path, dst: Path, max_w: int) -> None:
    img = Image.open(src).convert("RGB")
    if img.width > max_w:
        ratio = max_w / img.width
        img = img.resize((max_w, round(img.height * ratio)), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, "WEBP", quality=86, method=6)
    print(f"{src.name} -> {dst.relative_to(ROOT)}  {img.width}x{img.height}  {dst.stat().st_size // 1024} KB")


def make_portrait(src: Path, dst: Path, size: int = 512) -> None:
    img = Image.open(src).convert("RGB")
    side = min(img.width, img.height)
    left = (img.width - side) // 2
    img = img.crop((left, 0, left + side, side)).resize((size, size), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    img.save(dst, "WEBP", quality=86, method=6)
    print(f"portrait -> {dst.relative_to(ROOT)}  {dst.stat().st_size // 1024} KB")


def main() -> None:
    for name, out, width in JOBS:
        candidates = [SOURCE / name, ROOT / name]
        src = next((path for path in candidates if path.exists()), None)
        if src is None:
            print(f"skip, not found: {name}")
            continue
        convert(src, PUBLIC / out, width)

    for name, out in PORTRAITS:
        candidates = [SOURCE / name, ROOT / name]
        src = next((path for path in candidates if path.exists()), None)
        if src is not None:
            make_portrait(src, PUBLIC / out)


if __name__ == "__main__":
    main()
