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
BOSSES = Path(r"C:\Users\pasha\AppData\Local\Temp\opencode\bosses.json")
OUT_DIR = CWD / "Echo Tower" / "public" / "assets" / "enemies" / "boss"

STYLE = (
    "masterpiece, best quality, very aesthetic, absurdres, dark fantasy, korean manhwa style, "
    "semi-realistic anime, obsidian and violet palette, ornate gothic details, painterly rendering, "
    "cinematic chiaroscuro, strong rim light, bright teal edge glow, high contrast readable silhouette, "
    "dramatic boss key art, full body, centered, plain dark background, "
)
NEG = (
    "lowres, bad anatomy, text, error, cropped, worst quality, low quality, signature, watermark, "
    "username, blurry, artist name, multiple characters, group of heroes, scenery, landscape, ui, "
    "photorealistic, 3d render, child, loli, nsfw"
)

_session = None


def session():
    global _session
    if _session is None:
        _session = new_session("u2net")
    return _session


def fit_alpha(image: Image.Image, size: int = 1536, margin: float = 0.04) -> Image.Image:
    bbox = image.getbbox()
    if bbox:
        image = image.crop(bbox)
    inner = int(size * (1 - margin * 2))
    scale = min(inner / image.width, inner / image.height)
    image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(image, ((size - image.width) // 2, (size - image.height) // 2), image)
    return canvas


async def one(client, boss):
    seed = 11_000 + sum(ord(c) for c in boss["id"]) % 800
    last_error = "unknown"
    for attempt in range(3):
        started = time.monotonic()
        res = json.loads(
            (
                await client.call_tool(
                    "generate_image",
                    {
                        "prompt": STYLE + boss["prompt"],
                        "negative_prompt": NEG,
                        "width": 1024,
                        "height": 1024,
                        "steps": 8,
                        "cfg": 1.5,
                        "seed": seed + attempt * 37,
                        "batch_size": 1,
                        "checkpoint": "animagine-xl-3.1.safetensors",
                        "lora": "sdxl_lightning_4step_lora.safetensors",
                        "lora_strength": 1.0,
                        "sampler_name": "euler",
                        "scheduler": "sgm_uniform",
                        "filename_prefix": f"boss_{boss['id']}",
                    },
                )
            ).content[0].text
        )
        if not res.get("ok"):
            last_error = res.get("error", "generate failed")
            continue

        source = Path(res["files"][0]["path"])
        with Image.open(source) as opened:
            cut = remove(opened.convert("RGB"), session=session())
            alpha = cut.getchannel("A")
            bbox = alpha.getbbox()
            if not bbox:
                last_error = "empty alpha"
                continue
            coverage = ((bbox[2] - bbox[0]) * (bbox[3] - bbox[1])) / (cut.width * cut.height)
            if coverage < 0.08:
                last_error = f"low coverage {coverage:.3f}"
                continue
            cut = fit_alpha(cut, 1536)

        OUT_DIR.mkdir(parents=True, exist_ok=True)
        out = OUT_DIR / f"{boss['id']}.webp"
        cut.save(out, format="WEBP", quality=88, method=6)
        return out, round(time.monotonic() - started, 1)

    return None, last_error


async def main() -> None:
    bosses = json.loads(BOSSES.read_text(encoding="utf-8"))
    if len(sys.argv) > 1:
        wanted = {x.strip() for x in sys.argv[1].split(",")}
        bosses = [b for b in bosses if b["id"] in wanted]

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
    total = len(bosses)
    print(f"START bosses={total}", flush=True)

    async with Client(params) as client:
        for index, boss in enumerate(bosses, start=1):
            path, info = await one(client, boss)
            if path:
                print(f"DONE {index}/{total} {boss['id']} {info}s {path.stat().st_size}b", flush=True)
            else:
                print(f"FAIL {index}/{total} {boss['id']} {info}", flush=True)

    print("ALL FINISHED", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
