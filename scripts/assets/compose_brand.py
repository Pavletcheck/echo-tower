"""Собирает бренд-ассеты из сгенерированного эмблемы/фонов и шрифта Oswald."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC = Path(r"C:\Users\pasha\Desktop\Prompt\assets\generated\marketing")
PUB = Path(r"C:\Users\pasha\Desktop\Echo Tower\public")
FONT = Path(r"C:\Users\pasha\AppData\Local\Temp\opencode\fonts\oswald.ttf")
GOLD = (233, 196, 106)
VIOLET = (155, 123, 255)


def oswald(size: int, weight: int = 700) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(FONT), size)
    try:
        font.set_variation_by_axes([weight])
    except Exception:
        pass
    return font


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    tw, th = size
    scale = max(tw / image.width, th / image.height)
    resized = image.resize((max(tw, round(image.width * scale)), max(th, round(image.height * scale))), Image.LANCZOS)
    left = (resized.width - tw) // 2
    top = (resized.height - th) // 2
    return resized.crop((left, top, left + tw, top + th))


def glow(base: Image.Image, box: tuple[int, int, int, int], color: tuple[int, int, int], radius: int = 28) -> None:
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse(box, fill=(*color, 90))
    layer = layer.filter(ImageFilter.GaussianBlur(radius))
    base.alpha_composite(layer)


def wordmark(text: str, size: int, tracking: int) -> Image.Image:
    font = oswald(size, 700)
    widths = [font.getbbox(ch)[2] - font.getbbox(ch)[0] for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    height = size * 1.35
    layer = Image.new("RGBA", (int(total) + 20, int(height)), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x = 10
    for ch, w in zip(text, widths):
        draw.text((x, height * 0.08), ch, font=font, fill=(*GOLD, 255))
        x += w + tracking
    return layer


def compose_logo(text: str, out: Path, width: int = 1600, height: int = 600) -> None:
    base = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    emblem_source = SRC / "emblem.webp"
    mark_size = int(height * 0.62)
    mark = Image.open(emblem_source).convert("RGBA")
    mark = cover(mark, (mark_size, mark_size))
    mask = Image.new("L", (mark_size, mark_size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, mark_size, mark_size), radius=int(mark_size * 0.22), fill=255)
    mark.putalpha(mask)
    glow(base, (int(width * 0.05), int(height * 0.18), int(width * 0.05) + mark_size, int(height * 0.18) + mark_size), VIOLET, 40)

    mark_y = (height - mark_size) // 2
    base.alpha_composite(mark, (int(width * 0.06), mark_y))

    title = wordmark(text, int(height * 0.3), max(2, int(height * 0.012)))
    base.alpha_composite(title, (int(width * 0.06) + mark_size + int(width * 0.03), int(height * 0.3)))

    sub_font = oswald(int(height * 0.075), 600)
    draw = ImageDraw.Draw(base)
    draw.text(
        (int(width * 0.06) + mark_size + int(width * 0.03), int(height * 0.62)),
        "MASTER'S HAND",
        font=sub_font,
        fill=(230, 225, 245, 190),
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    base.save(out, format="WEBP", quality=90, method=6)
    print(out.name, out.stat().st_size // 1024, "KB")


def compose_social(out: Path) -> None:
    bg = Image.open(PUB / "assets/marketing/keyart-main.webp").convert("RGBA")
    base = cover(bg, (1200, 630))
    scrim = Image.new("RGBA", base.size, (7, 5, 13, 150))
    base.alpha_composite(scrim)
    mark = cover(Image.open(SRC / "emblem.webp").convert("RGBA"), (220, 220))
    base.alpha_composite(mark, (80, 205))
    title = wordmark("ECHO TOWER", 96, 4)
    base.alpha_composite(title, (330, 235))
    draw = ImageDraw.Draw(base)
    draw.text((332, 360), "AUTO-BATTLER · DARK FANTASY", font=oswald(30, 600), fill=(230, 225, 245, 200))
    out.parent.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(out, format="WEBP", quality=88, method=6)
    print(out.name, out.stat().st_size // 1024, "KB")


def compose_loading(out: Path) -> None:
    bg = Image.open(PUB / "assets/bg/lobby-tower.webp").convert("RGBA")
    base = cover(bg, (1080, 1920))
    base.alpha_composite(Image.new("RGBA", base.size, (7, 5, 13, 120)))
    mark = cover(Image.open(SRC / "emblem.webp").convert("RGBA"), (420, 420))
    base.alpha_composite(mark, (330, 620))
    title = wordmark("ECHO TOWER", 92, 6)
    base.alpha_composite(title, ((1080 - title.width) // 2, 1090))
    draw = ImageDraw.Draw(base)
    draw.text((400, 1320), "ЗАГРУЗКА…", font=oswald(34, 600), fill=(230, 225, 245, 180))
    out.parent.mkdir(parents=True, exist_ok=True)
    base.convert("RGB").save(out, format="WEBP", quality=86, method=6)
    print(out.name, out.stat().st_size // 1024, "KB")


def main() -> None:
    marketing = PUB / "assets/marketing"
    brand = PUB / "assets/brand"
    brand.mkdir(parents=True, exist_ok=True)

    for name in ("cover-crazy", "cover-poki", "app-icon", "tg-avatar", "season-banner", "store-bg-portrait", "poster-choice", "emblem"):
        src = SRC / f"{name}.webp"
        if src.exists():
            target = marketing / f"{name}.webp"
            if name not in ("app-icon", "tg-avatar"):
                target = marketing / f"{name}.webp"
            Image.open(src).convert("RGB").save(target, format="WEBP", quality=88, method=6)
            print(f"marketing/{name}.webp")

    compose_logo("ECHO TOWER", brand / "logo.webp")
    compose_logo("ЭХО БАШНИ", brand / "logo-ru.webp")
    compose_social(brand / "social.webp")
    compose_loading(brand / "loading.webp")

    emblem = Image.open(SRC / "emblem.webp").convert("RGBA")
    emblem512 = cover(emblem, (512, 512))
    emblem512.save(brand / "emblem.webp", format="WEBP", quality=90, method=6)
    print("brand/emblem.webp")

    favicon = cover(emblem, (64, 64))
    favicon.save(brand / "favicon.webp", format="WEBP", quality=90, method=6)
    print("brand/favicon.webp")


if __name__ == "__main__":
    main()
