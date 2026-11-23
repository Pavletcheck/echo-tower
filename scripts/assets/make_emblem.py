"""Рисует эмблему Echo Tower геометрией: гексагон, башня, кристалл, звёзды."""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SS = 4  # суперсэмплинг
SIZE = 1024
SRC = Path(r"C:\Users\pasha\Desktop\Prompt\assets\generated\marketing")
FONT = Path(r"C:\Users\pasha\AppData\Local\Temp\opencode\fonts\oswald.ttf")

GOLD = (233, 196, 106)
GOLD_DARK = (168, 132, 56)
TEAL = (55, 224, 200)
VIOLET = (155, 123, 255)
OBSIDIAN = (14, 10, 26)
OBSIDIAN_LIGHT = (34, 26, 58)


def hexagon(cx: float, cy: float, radius: float, rotation: float = 0.0) -> list[tuple[float, float]]:
    points = []
    for index in range(6):
        angle = math.radians(60 * index - 90 + rotation)
        points.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    return points


def glow(size: tuple[int, int], center: tuple[float, float], radius: float, color: tuple[int, int, int], strength: int) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    cx, cy = center
    steps = 14
    for step in range(steps, 0, -1):
        r = radius * step / steps
        alpha = int(strength * (1 - step / steps) ** 1.6)
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*color, alpha))
    return layer.filter(ImageFilter.GaussianBlur(radius * 0.08))


def tower(draw: ImageDraw.ImageDraw, cx: float, base_y: float, height: float, width: float, scale: float) -> None:
    top_y = base_y - height
    # корпус
    draw.polygon(
        [
            (cx - width * 0.42, base_y),
            (cx + width * 0.42, base_y),
            (cx + width * 0.3, top_y + height * 0.22),
            (cx - width * 0.3, top_y + height * 0.22),
        ],
        fill=(*OBSIDIAN_LIGHT, 255),
        outline=(*GOLD, 235),
        width=int(4 * scale),
    )
    # крыша-шпиль
    draw.polygon(
        [
            (cx - width * 0.34, top_y + height * 0.22),
            (cx + width * 0.34, top_y + height * 0.22),
            (cx, top_y),
        ],
        fill=(*OBSIDIAN, 255),
        outline=(*GOLD, 235),
        width=int(4 * scale),
    )
    # окна
    for row in range(3):
        y = base_y - height * (0.18 + row * 0.2)
        for offset in (-0.16, 0.16):
            w = width * 0.1
            h = height * 0.09
            x = cx + width * offset
            draw.rounded_rectangle(
                (x - w / 2, y - h / 2, x + w / 2, y + h / 2),
                radius=int(w * 0.4),
                fill=(*TEAL, 235),
            )
    # основание
    draw.rounded_rectangle(
        (cx - width * 0.55, base_y - height * 0.02, cx + width * 0.55, base_y + height * 0.05),
        radius=int(6 * scale),
        fill=(*OBSIDIAN, 255),
        outline=(*GOLD, 220),
        width=int(3 * scale),
    )


def star(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float, color: tuple[int, int, int]) -> None:
    points = []
    for index in range(10):
        angle = math.radians(36 * index - 90)
        radius = r if index % 2 == 0 else r * 0.42
        points.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    draw.polygon(points, fill=(*color, 255))


def render(size: int = SIZE) -> Image.Image:
    canvas_size = size * SS
    scale = SS
    image = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    cx = cy = canvas_size / 2

    # фон: без внешнего свечения, только мягкий градиент внутри гексагона
    draw = ImageDraw.Draw(image)
    outer = hexagon(cx, cy, canvas_size * 0.44)
    inner = hexagon(cx, cy, canvas_size * 0.36)

    draw.polygon(outer, fill=(*OBSIDIAN, 250))
    draw.polygon(inner, fill=(10, 7, 20, 255))

    # внутреннее свечение, обрезанное по гексагону
    inner_glow = glow((canvas_size, canvas_size), (cx, cy + canvas_size * 0.05), canvas_size * 0.28, TEAL, 60)
    violet_glow = glow((canvas_size, canvas_size), (cx, cy - canvas_size * 0.1), canvas_size * 0.3, VIOLET, 45)
    mask = Image.new("L", (canvas_size, canvas_size), 0)
    ImageDraw.Draw(mask).polygon(inner, fill=255)
    image.alpha_composite(Image.composite(inner_glow, Image.new("RGBA", image.size, (0, 0, 0, 0)), mask))
    image.alpha_composite(Image.composite(violet_glow, Image.new("RGBA", image.size, (0, 0, 0, 0)), mask))
    draw = ImageDraw.Draw(image)

    draw.line(outer + [outer[0]], fill=(*GOLD, 255), width=int(9 * scale), joint="curve")
    draw.line(inner + [inner[0]], fill=(*GOLD_DARK, 160), width=int(3 * scale), joint="curve")

    # кристалл за башней
    crystal_r = canvas_size * 0.1
    draw.polygon(
        [
            (cx, cy - crystal_r * 1.25),
            (cx + crystal_r * 0.72, cy),
            (cx, cy + crystal_r * 1.25),
            (cx - crystal_r * 0.72, cy),
        ],
        fill=(*TEAL, 55),
        outline=(*TEAL, 120),
        width=int(2 * scale),
    )

    tower(draw, cx, cy + canvas_size * 0.26, canvas_size * 0.44, canvas_size * 0.24, scale)

    # три звезды у основания
    for index, offset in enumerate((-1, 0, 1)):
        star(draw, cx + offset * canvas_size * 0.12, cy + canvas_size * 0.36, canvas_size * 0.026, GOLD)

    # блик-ромб в вершине шпиля
    gem_r = canvas_size * 0.026
    gem_y = cy + canvas_size * 0.26 - canvas_size * 0.44
    draw.polygon(
        [(cx, gem_y - gem_r), (cx + gem_r, gem_y), (cx, gem_y + gem_r), (cx - gem_r, gem_y)],
        fill=(*GOLD, 255),
        outline=(255, 255, 255, 200),
        width=int(2 * scale),
    )

    return image.resize((size, size), Image.LANCZOS)


def rounded_square(image: Image.Image, size: int, radius_ratio: float, background=(12, 9, 22, 255)) -> Image.Image:
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((0, 0, size, size), radius=int(size * radius_ratio), fill=background)
    scale = int(size * 0.86)
    mark = image.resize((scale, scale), Image.LANCZOS)
    offset = (size - scale) // 2
    base.alpha_composite(mark, (offset, offset))
    return base


def circle(image: Image.Image, size: int, background=(12, 9, 22, 255)) -> Image.Image:
    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(base)
    draw.ellipse((0, 0, size, size), fill=background)
    scale = int(size * 0.84)
    mark = image.resize((scale, scale), Image.LANCZOS)
    offset = (size - scale) // 2
    base.alpha_composite(mark, (offset, offset))
    return base


def main() -> None:
    SRC.mkdir(parents=True, exist_ok=True)
    master = render(1024)
    master.save(SRC / "emblem.webp", format="WEBP", quality=92, method=6)

    # квадратная иконка приложения и круглая аватарка
    square = rounded_square(master, 512, 0.22)
    square.save(SRC / "app-icon.webp", format="WEBP", quality=92, method=6)

    avatar = circle(master, 512)
    avatar.save(SRC / "tg-avatar.webp", format="WEBP", quality=92, method=6)

    favicon = rounded_square(master, 128, 0.22).resize((64, 64), Image.LANCZOS)
    favicon.save(SRC / "favicon.webp", format="WEBP", quality=92, method=6)

    print("emblem, app-icon, tg-avatar, favicon готовы")


if __name__ == "__main__":
    main()
