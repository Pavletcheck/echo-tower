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
    "cinematic chiaroscuro, volumetric dust, "
)
NEG = (
    "lowres, bad anatomy, bad hands, extra fingers, fewer fingers, text, error, cropped, worst quality, "
    "low quality, signature, watermark, username, blurry, artist name, multiple girls, multiple boys, "
    "photorealistic, 3d render, child, loli, nsfw"
)


async def one(client, hero, attempt: int):
    seed = 5000 + int(hero["id"].split("-")[1])
    parts = [STYLE]
    if hero["gender"]:
        parts.append(hero["gender"] + ", ")
    parts.append("solo, " + hero["prompt"] + ", full body, hero card, centered composition, dark background")
    prompt = "".join(parts)

    started = time.monotonic()
    res = json.loads(
        (
            await client.call_tool(
                "generate_image",
                {
                    "prompt": prompt,
                    "negative_prompt": NEG,
                    "width": 832,
                    "height": 1216,
                    "steps": 8,
                    "cfg": 1.5,
                    "seed": seed,
                    "batch_size": 1,
                    "checkpoint": "animagine-xl-3.1.safetensors",
                    "lora": "sdxl_lightning_4step_lora.safetensors",
                    "lora_strength": 1.0,
                    "sampler_name": "euler",
                    "scheduler": "sgm_uniform",
                    "filename_prefix": f"{hero['folder']}_card",
                },
            )
        ).content[0].text
    )
    gen_secs = round(time.monotonic() - started, 1)
    if not res.get("ok"):
        return None, gen_secs, res.get("error", "unknown")

    source = res["files"][0]["path"]
    card_dir = CWD / "Echo Tower" / "public" / "assets" / "heroes" / hero["folder"]
    card_dir.mkdir(parents=True, exist_ok=True)
    master = MASTERS / f"{hero['folder']}-card-1024x1536.png"
    master.parent.mkdir(parents=True, exist_ok=True)

    resize = json.loads(
        (
            await client.call_tool(
                "resize_image",
                {"image_path": source, "width": 1024, "height": 1536, "destination": str(master)},
            )
        ).content[0].text
    )
    if not resize.get("ok"):
        return None, gen_secs, resize.get("error", "resize failed")

    webp = json.loads(
        (
            await client.call_tool(
                "to_webp",
                {"image_path": str(master), "destination": str(card_dir / "card.webp"), "quality": 84},
            )
        ).content[0].text
    )
    if not webp.get("ok"):
        return None, gen_secs, webp.get("error", "webp failed")
    return str(card_dir / "card.webp"), gen_secs, None


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
    print(f"START heroes={total}", flush=True)

    async with Client(params) as client:
        for index, hero in enumerate(heroes, start=1):
            for attempt in (1, 2):
                path, secs, error = await one(client, hero, attempt)
                if path:
                    print(f"DONE {index}/{total} {hero['id']} {hero['folder']} {secs}s {path}", flush=True)
                    break
                print(f"RETRY {index}/{total} {hero['id']} attempt={attempt} {secs}s {error}", flush=True)
                await asyncio.sleep(5)
            else:
                print(f"FAIL {index}/{total} {hero['id']} {hero['folder']}", flush=True)

    print("ALL FINISHED", flush=True)


asyncio.run(main())
