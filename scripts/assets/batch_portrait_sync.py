"""Пересобирает портреты героев из их карточек через img2img — чтобы лица совпадали."""

import asyncio
import json
import os
import sys
import time
from pathlib import Path

from mcp import Client, StdioServerParameters
from PIL import Image

PY = r"C:\Users\pasha\Desktop\Prompt\tools\comfyui-mcp\.venv\Scripts\python.exe"
SERVER = r"C:\Users\pasha\Desktop\Prompt\tools\comfyui-mcp\server.py"
CWD = Path(r"C:\Users\pasha\Desktop\Prompt")
HEROES = Path(r"C:\Users\pasha\AppData\Local\Temp\opencode\heroes.json")
ASSETS = CWD / "Echo Tower" / "public" / "assets"
WORK = CWD / "assets" / "generated" / "portrait-src"

STYLE = (
    "masterpiece, best quality, very aesthetic, absurdres, dark fantasy, korean manhwa style, "
    "semi-realistic anime, obsidian and violet palette, ornate gothic details, cinematic chiaroscuro, "
    "head and shoulders portrait, facing viewer, centered, plain dark background, "
)
NEG = (
    "lowres, bad anatomy, bad hands, extra fingers, text, error, cropped, worst quality, low quality, "
    "signature, watermark, username, blurry, artist name, full body, scenery, photorealistic, "
    "3d render, child, loli, nsfw"
)


def crop_face(card: Path, out: Path, size: int = 768) -> None:
    with Image.open(card) as image:
        image = image.convert("RGB")
        width, height = image.size
        side = min(width, int(height * 0.62))
        left = (width - side) // 2
        top = int(height * 0.03)
        box = (left, top, left + side, top + side)
        face = image.crop(box).resize((size, size), Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    face.save(out, format="PNG")


def fit(image: Image.Image, size: int = 512) -> Image.Image:
    return image.convert("RGB").resize((size, size), Image.LANCZOS)


async def one(client, hero) -> tuple[Path | None, float]:
    card = ASSETS / "heroes" / hero["folder"] / "card.webp"
    if not card.exists():
        return None, 0.0
    work = WORK / f"{hero['folder']}.png"
    crop_face(card, work)

    body = hero["prompt"].replace("three-quarter pose", "").strip().rstrip(",")
    parts = [STYLE]
    if hero["gender"]:
        parts.append(hero["gender"] + ", ")
    parts.append(body)

    started = time.monotonic()
    res = json.loads(
        (
            await client.call_tool(
                "img2img",
                {
                    "image_path": str(work),
                    "prompt": "".join(parts),
                    "negative_prompt": NEG,
                    "strength": 0.45,
                    "steps": 8,
                    "cfg": 1.5,
                    "seed": 21_000 + int(hero["id"].split("-")[1]),
                    "checkpoint": "animagine-xl-3.1.safetensors",
                    "lora": "sdxl_lightning_4step_lora.safetensors",
                    "lora_strength": 1.0,
                    "sampler_name": "euler",
                    "scheduler": "sgm_uniform",
                    "filename_prefix": f"portrait_sync_{hero['folder']}",
                },
            )
        ).content[0].text
    )
    if not res.get("ok"):
        return None, 0.0

    source = Path(res["files"][0]["path"])
    out = ASSETS / "heroes" / hero["folder"] / "portrait.webp"
    out.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as opened:
        fit(opened).save(out, format="WEBP", quality=87, method=6)
    return out, round(time.monotonic() - started, 1)


async def main() -> None:
    heroes = json.loads(HEROES.read_text(encoding="utf-8"))
    if len(sys.argv) > 1:
        wanted = {x.strip().upper() for x in sys.argv[1].split(",")}
        heroes = [h for h in heroes if h["id"].upper() in wanted]

    env = dict(os.environ)
    env.update(
        {
            "COMFYUI_URL": "http://127.0.0.1:8188",
            "COMFYUI_OUTPUT_DIR": "./assets/generated/portrait-src/out",
            "DEFAULT_CHECKPOINT": "DreamShaper8_pruned.safetensors",
            "COMFYUI_TIMEOUT": "1800",
        }
    )
    params = StdioServerParameters(command=PY, args=[SERVER], env=env, cwd=str(CWD))
    print(f"START portraits={len(heroes)}", flush=True)
    async with Client(params) as client:
        for index, hero in enumerate(heroes, start=1):
            path, secs = await one(client, hero)
            if path:
                print(f"DONE {index}/{len(heroes)} {hero['folder']} {secs}s {path.stat().st_size // 1024}KB", flush=True)
            else:
                print(f"FAIL {index}/{len(heroes)} {hero['folder']}", flush=True)
    print("ALL FINISHED", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
