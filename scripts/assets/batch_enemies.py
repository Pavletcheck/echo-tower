import asyncio
import json
import os
import sys
import time
from pathlib import Path

from mcp import Client, StdioServerParameters
from PIL import Image
from rembg import new_session, remove

PY = r"C:\Users\pasha\Desktop\Prompt\tools\comfyui-mcp\.venv\Scripts\python.exe"
SERVER = r"C:\Users\pasha\Desktop\Prompt\tools\comfyui-mcp\server.py"
CWD = Path(r"C:\Users\pasha\Desktop\Prompt")
ENEMIES = Path(r"C:\Users\pasha\AppData\Local\Temp\opencode\enemies.json")
ASSETS = CWD / "Echo Tower" / "public" / "assets"
MASTERS = CWD / "assets" / "generated" / "masters"

STYLE = (
    "masterpiece, best quality, very aesthetic, absurdres, dark fantasy, korean manhwa style, "
    "semi-realistic anime, obsidian and violet palette, ornate gothic details, painterly rendering, "
    "cinematic chiaroscuro, game enemy character design, full body, centered, plain dark background, "
)
NEG = (
    "lowres, bad anatomy, bad hands, extra fingers, text, error, cropped, worst quality, low quality, "
    "signature, watermark, username, blurry, artist name, multiple characters, group, photorealistic, "
    "3d render, child, loli, nsfw, scenery, landscape"
)

_session = None


def session():
    global _session
    if _session is None:
        _session = new_session("u2net")
    return _session

def fit_alpha(image: Image.Image, size: int = 512, margin: float = 0.06) -> Image.Image:
    """Crop to the visible pixels and center them on a transparent square canvas."""
    bbox = image.getbbox()
    if bbox:
        image = image.crop(bbox)
    inner = int(size * (1 - margin * 2))
    scale = min(inner / image.width, inner / image.height)
    new_size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    image = image.resize(new_size, Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(image, ((size - image.width) // 2, (size - image.height) // 2), image)
    return canvas


async def one(client, entry):
    slug = f"{entry['family']}_{entry['variant']}"
    seed = 8000 + sum(ord(c) for c in slug) % 900

    started = time.monotonic()
    res = json.loads(
        (
            await client.call_tool(
                "generate_image",
                {
                    "prompt": STYLE + entry["prompt"],
                    "negative_prompt": NEG,
                    "width": 768,
                    "height": 768,
                    "steps": 8,
                    "cfg": 1.5,
                    "seed": seed,
                    "batch_size": 1,
                    "checkpoint": "animagine-xl-3.1.safetensors",
                    "lora": "sdxl_lightning_4step_lora.safetensors",
                    "lora_strength": 1.0,
                    "sampler_name": "euler",
                    "scheduler": "sgm_uniform",
                    "filename_prefix": f"enemy_{slug}",
                },
            )
        ).content[0].text
    )
    if not res.get("ok"):
        return None, res.get("error", "generate failed")

    source = Path(res["files"][0]["path"])
    with Image.open(source) as opened:
        cut = remove(opened.convert("RGB"), session=session())
        cut = fit_alpha(cut, 512)
        out_dir = ASSETS / "enemies" / entry["family"]
        out_dir.mkdir(parents=True, exist_ok=True)
        out = out_dir / f"{entry['variant']}.webp"
        cut.save(out, format="WEBP", quality=86, method=6)

    return out, round(time.monotonic() - started, 1)


async def main() -> None:
    entries = json.loads(ENEMIES.read_text(encoding="utf-8"))
    if len(sys.argv) > 1:
        wanted = {x.strip() for x in sys.argv[1].split(",")}
        entries = [e for e in entries if f"{e['family']}_{e['variant']}" in wanted]

    env = dict(os.environ)
    env.update(
        {
            "COMFYUI_URL": "http://127.0.0.1:8188",
            "COMFYUI_OUTPUT_DIR": "./assets/generated",
            "DEFAULT_CHECKPOINT": "DreamShaper8_pruned.safetensors",
            "COMFYUI_TIMEOUT": "1800",
        }
    )
    params = StdioServerParameters(command=PY, args=[SERVER], env=env, cwd=str(CWD))
    total = len(entries)
    print(f"START enemies={total}", flush=True)

    async with Client(params) as client:
        for index, entry in enumerate(entries, start=1):
            slug = f"{entry['family']}_{entry['variant']}"
            path, info = await one(client, entry)
            if path:
                print(f"DONE {index}/{total} {slug} {info}s {path.stat().st_size}b", flush=True)
            else:
                print(f"FAIL {index}/{total} {slug} {info}", flush=True)

    print("ALL FINISHED", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
