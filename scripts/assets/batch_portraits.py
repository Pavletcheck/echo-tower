import asyncio
import json
import os
import sys
import time
from pathlib import Path

from mcp import Client, StdioServerParameters

PY = r"C:\Users\pasha\Desktop\Prompt\tools\comfyui-mcp\.venv\Scripts\python.exe"
SERVER = r"C:\Users\pasha\Desktop\Prompt\tools\comfyui-mcp\server.py"
CWD = Path(r"C:\Users\pasha\Desktop\Prompt")
HEROES = Path(r"C:\Users\pasha\AppData\Local\Temp\opencode\heroes.json")
MASTERS = CWD / "assets" / "generated" / "masters"

STYLE = (
    "masterpiece, best quality, very aesthetic, absurdres, dark fantasy, korean manhwa style, "
    "semi-realistic anime, obsidian and violet palette, ornate gothic details, painterly rendering, "
    "cinematic chiaroscuro, "
)
NEG = (
    "lowres, bad anatomy, bad hands, extra fingers, fewer fingers, text, error, cropped, worst quality, "
    "low quality, signature, watermark, username, blurry, artist name, multiple girls, multiple boys, "
    "photorealistic, 3d render, child, loli, nsfw, full body"
)
PORTRAIT_SUFFIX = "head and shoulders portrait, facing viewer, centered, plain dark background, looking at camera"


def portrait_prompt(hero) -> str:
    base = hero["prompt"].replace("three-quarter pose", "").strip().rstrip(",")
    parts = [STYLE]
    if hero["gender"]:
        parts.append(hero["gender"] + ", ")
    parts.append("solo, " + base + ", " + PORTRAIT_SUFFIX)
    return "".join(parts)


async def one(client, hero):
    seed = 7000 + int(hero["id"].split("-")[1])
    started = time.monotonic()
    res = json.loads(
        (
            await client.call_tool(
                "generate_image",
                {
                    "prompt": portrait_prompt(hero),
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
                    "filename_prefix": f"{hero['folder']}_portrait",
                },
            )
        ).content[0].text
    )
    gen_secs = round(time.monotonic() - started, 1)
    if not res.get("ok"):
        return None, gen_secs, res.get("error", "unknown")

    source = res["files"][0]["path"]
    hero_dir = CWD / "Echo Tower" / "public" / "assets" / "heroes" / hero["folder"]
    hero_dir.mkdir(parents=True, exist_ok=True)
    master = MASTERS / f"{hero['folder']}-portrait-512.png"
    master.parent.mkdir(parents=True, exist_ok=True)

    resize = json.loads(
        (
            await client.call_tool(
                "resize_image",
                {"image_path": source, "width": 512, "height": 512, "destination": str(master)},
            )
        ).content[0].text
    )
    if not resize.get("ok"):
        return None, gen_secs, resize.get("error", "resize failed")

    webp = json.loads(
        (
            await client.call_tool(
                "to_webp",
                {"image_path": str(master), "destination": str(hero_dir / "portrait.webp"), "quality": 86},
            )
        ).content[0].text
    )
    if not webp.get("ok"):
        return None, gen_secs, webp.get("error", "webp failed")
    return str(hero_dir / "portrait.webp"), gen_secs, None


async def main() -> None:
    heroes = json.loads(HEROES.read_text(encoding="utf-8"))
    if len(sys.argv) > 1:
        wanted = {x.strip().upper() for x in sys.argv[1].split(",")}
        heroes = [h for h in heroes if h["id"].upper() in wanted]

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
    total = len(heroes)
    print(f"START portraits={total}", flush=True)

    async with Client(params) as client:
        for index, hero in enumerate(heroes, start=1):
            for attempt in (1, 2):
                path, secs, error = await one(client, hero)
                if path:
                    print(f"DONE {index}/{total} {hero['id']} {hero['folder']} {secs}s", flush=True)
                    break
                print(f"RETRY {index}/{total} {hero['id']} attempt={attempt} {secs}s {error}", flush=True)
                await asyncio.sleep(4)
            else:
                print(f"FAIL {index}/{total} {hero['id']} {hero['folder']}", flush=True)

    print("ALL FINISHED", flush=True)


asyncio.run(main())
