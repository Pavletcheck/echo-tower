"""Иллюстрации зданий лобби: кадр целиком, без вырезания фона (гексагон обрежет сам)."""

import asyncio
import json
import os
from pathlib import Path

import numpy as np
from mcp import Client, StdioServerParameters
from PIL import Image

PY = r"C:\Users\pasha\Desktop\Prompt\tools\comfyui-mcp\.venv\Scripts\python.exe"
SERVER = r"C:\Users\pasha\Desktop\Prompt\tools\comfyui-mcp\server.py"
CWD = Path(r"C:\Users\pasha\Desktop\Prompt")
OUT = CWD / "Echo Tower" / "public" / "assets" / "buildings"

STYLE = (
    "masterpiece, best quality, very aesthetic, absurdres, dark fantasy game building interior, "
    "korean manhwa illustration, semi-realistic anime, obsidian and violet palette, gold trim, "
    "ornate gothic architecture, bright warm interior lighting, visible details, luminous, "
    "wide angle view of the whole room, centered composition, "
)
NEG = (
    "lowres, text, letters, watermark, logo, ui, worst quality, low quality, cropped, blurry, "
    "photorealistic, 3d render, characters, people, crowd, landscape, sky, multiple buildings, "
    "underexposed, black frame, empty room, darkness"
)

BUILDINGS = [
    ("altar", "hexagonal summoning altar of pale stone, floating runic slabs above it, teal glowing runes on the floor, violet light beams from tall gothic windows"),
    ("barracks", "stone barracks hall, weapon racks along the walls, five empty armor stands, hanging banners, bright torches blazing"),
    ("forge", "underground forge, glowing orange anvil in the center, sparks flying, hanging chains, runic engravings, molten metal glow on the walls"),
    ("dining", "dining hall, long wooden tables with candles, copper pots, a big roaring hearth, gothic vaulted ceiling"),
    ("training", "training hall, practice dummies and weapon racks around a sand circle, burning torches, teal banner on the wall"),
    ("archive", "endless library tower, floating books and glowing name tablets, hexagonal shelves, teal light beams, dust motes"),
]

MIN_BRIGHTNESS = 0.09
MIN_STD = 0.07


def stats(image: Image.Image) -> tuple[float, float]:
    arr = np.asarray(image.convert("L").resize((96, 96)), dtype=np.float32) / 255.0
    return float(arr.mean()), float(arr.std())


def fit(image: Image.Image, size: int = 512) -> Image.Image:
    return image.convert("RGB").resize((size, size), Image.LANCZOS)


async def one(client, key: str, prompt: str) -> None:
    base_seed = 61_000 + sum(ord(c) for c in key)
    for attempt in range(3):
        res = json.loads(
            (
                await client.call_tool(
                    "generate_image",
                    {
                        "prompt": STYLE + prompt,
                        "negative_prompt": NEG,
                        "width": 768,
                        "height": 768,
                        "steps": 8,
                        "cfg": 1.8,
                        "seed": base_seed + attempt * 23,
                        "batch_size": 1,
                        "checkpoint": "animagine-xl-3.1.safetensors",
                        "lora": "sdxl_lightning_4step_lora.safetensors",
                        "lora_strength": 1.0,
                        "sampler_name": "euler",
                        "scheduler": "sgm_uniform",
                        "filename_prefix": f"building_{key}",
                    },
                )
            ).content[0].text
        )
        if not res.get("ok"):
            print("FAIL", key, res.get("error"))
            continue
        source = Path(res["files"][0]["path"])
        with Image.open(source) as opened:
            image = opened.convert("RGB")
            mean, std = stats(image)
            if mean < MIN_BRIGHTNESS or std < MIN_STD:
                print("RETRY", key, f"brightness {mean:.2f} std {std:.2f}")
                continue
            OUT.mkdir(parents=True, exist_ok=True)
            fit(image).save(OUT / f"{key}.webp", format="WEBP", quality=88, method=6)
        print("DONE", key, f"{mean:.2f}/{std:.2f}", (OUT / f'{key}.webp').stat().st_size // 1024, "KB")
        return
    print("FAIL", key, "all attempts")


async def main() -> None:
    env = dict(os.environ)
    env.update(
        {
            "COMFYUI_URL": "http://127.0.0.1:8188",
            "COMFYUI_OUTPUT_DIR": "./assets/generated/buildings",
            "DEFAULT_CHECKPOINT": "DreamShaper8_pruned.safetensors",
            "COMFYUI_TIMEOUT": "1800",
        }
    )
    params = StdioServerParameters(command=PY, args=[SERVER], env=env, cwd=str(CWD))
    async with Client(params) as client:
        for key, prompt in BUILDINGS:
            await one(client, key, prompt)


if __name__ == "__main__":
    asyncio.run(main())
