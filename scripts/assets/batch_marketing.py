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
OUT = Path(r"C:\Users\pasha\Desktop\Prompt\assets\generated\marketing")

STYLE = (
    "masterpiece, best quality, very aesthetic, absurdres, dark fantasy, korean manhwa illustration, "
    "semi-realistic anime, obsidian and violet palette, ornate gothic details, hexagonal filigree, "
    "cinematic chiaroscuro, volumetric dust, high contrast, "
)
NEG = (
    "lowres, bad anatomy, text, letters, watermark, logo, signature, ui, worst quality, low quality, "
    "cropped, blurry, photorealistic, 3d render, nsfw, child, comic panel, split screen, collage, grid, "
    "borders, frames, multiple panels, abstract pattern, kaleidoscope, mandala, six characters, "
    "seven characters, many characters, crowd, duplicate figures, clones, sunset, orange sky, face closeup"
)

JOBS = [
    {
        "id": "cover-crazy",
        "w": 1216,
        "h": 688,
        "target": (1920, 1080),
        "prompt": "close dynamic shot of a blade-wielding hero clashing with a glass hound, sparks, hexagonal debris, motion blur, high contrast, dark background, arcane teal rim light",
    },
    {
        "id": "cover-poki",
        "w": 896,
        "h": 896,
        "target": (1024, 1024),
        "prompt": "exactly three heroes standing apart in a triangle, left an armored knight with a tower shield, right a hooded archer with a bow, center a mage with a glowing staff, full body, dark violet backdrop, glowing hexagonal emblem behind them",
    },
    {
        "id": "app-icon",
        "w": 832,
        "h": 832,
        "target": (512, 512),
        "prompt": "hexagonal obsidian crystal containing a tiny tower silhouette, three gold stars at the base, teal inner glow, minimal bold icon, centered, plain dark background, readable at 64 px",
    },
    {
        "id": "tg-avatar",
        "w": 832,
        "h": 832,
        "target": (512, 512),
        "prompt": "circular emblem, white flame crown above a black hexagon with a violet tower, gold accents, flat shaded with subtle gradient, high contrast, centered",
    },
    {
        "id": "season-banner",
        "w": 1344,
        "h": 512,
        "target": (1600, 600),
        "prompt": "five heroes seen from behind, weapons raised toward a shattered violet sky, teal and gold light, storm clouds, silhouettes only, no faces, wide panoramic scene",
    },
    {
        "id": "store-bg-portrait",
        "w": 768,
        "h": 1216,
        "target": (1080, 1920),
        "prompt": "abstract hexagonal sea fading into darkness, floating glass shards, distant tower silhouette, very low contrast background for ui text",
    },
    {
        "id": "poster-choice",
        "w": 896,
        "h": 1216,
        "target": (1200, 1600),
        "prompt": "a hero kneeling and offering a glowing star to an unseen giant hand descending from darkness, theatrical poster composition, dramatic god rays, gold and violet",
    },
    {
        "id": "emblem",
        "w": 832,
        "h": 832,
        "target": (512, 512),
        "prompt": "heraldic emblem, obsidian hexagon with a white tower and a violet crystal core, gold filigree border, symmetric game logo mark, centered, plain dark background",
    },
]


def fit(image: Image.Image, target: tuple[int, int]) -> Image.Image:
    tw, th = target
    scale = max(tw / image.width, th / image.height)
    resized = image.resize((max(tw, round(image.width * scale)), max(th, round(image.height * scale))), Image.LANCZOS)
    left = (resized.width - tw) // 2
    top = (resized.height - th) // 2
    return resized.crop((left, top, left + tw, top + th))


async def one(client, job):
    started = time.monotonic()
    res = json.loads(
        (
            await client.call_tool(
                "generate_image",
                {
                    "prompt": STYLE + job["prompt"],
                    "negative_prompt": NEG,
                    "width": job["w"],
                    "height": job["h"],
                    "steps": 8,
                    "cfg": 1.5,
                    "seed": 12_000 + sum(ord(c) for c in job["id"]),
                    "batch_size": 1,
                    "checkpoint": "animagine-xl-3.1.safetensors",
                    "lora": "sdxl_lightning_4step_lora.safetensors",
                    "lora_strength": 1.0,
                    "sampler_name": "euler",
                    "scheduler": "sgm_uniform",
                    "filename_prefix": f"ka_{job['id']}",
                },
            )
        ).content[0].text
    )
    if not res.get("ok"):
        return None, res.get("error", "generate failed")

    source = Path(res["files"][0]["path"])
    up = json.loads(
        (
            await client.call_tool(
                "upscale_image",
                {"image_path": str(source), "filename_prefix": f"ka_{job['id']}_up"},
            )
        ).content[0].text
    )
    if not up.get("ok"):
        return None, up.get("error", "upscale failed")

    OUT.mkdir(parents=True, exist_ok=True)
    with Image.open(up["files"][0]["path"]) as opened:
        final = fit(opened.convert("RGB"), job["target"])
        out = OUT / f"{job['id']}.webp"
        final.save(out, format="WEBP", quality=86, method=6)
    return out, round(time.monotonic() - started, 1)


async def main() -> None:
    wanted = {x.strip() for x in sys.argv[1].split(",")} if len(sys.argv) > 1 else None
    jobs = [j for j in JOBS if not wanted or j["id"] in wanted]
    env = dict(os.environ)
    env.update(
        {
            "COMFYUI_URL": "http://127.0.0.1:8188",
            "COMFYUI_OUTPUT_DIR": "./assets/generated/marketing-src",
            "DEFAULT_CHECKPOINT": "DreamShaper8_pruned.safetensors",
            "COMFYUI_TIMEOUT": "1800",
        }
    )
    params = StdioServerParameters(command=PY, args=[SERVER], env=env, cwd=str(CWD))
    print(f"START marketing={len(jobs)}", flush=True)
    async with Client(params) as client:
        for index, job in enumerate(jobs, start=1):
            path, info = await one(client, job)
            if path:
                print(f"DONE {index}/{len(jobs)} {job['id']} {job['target'][0]}x{job['target'][1]} {info}s {path.stat().st_size // 1024}KB", flush=True)
            else:
                print(f"FAIL {index}/{len(jobs)} {job['id']} {info}", flush=True)
    print("ALL FINISHED", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
