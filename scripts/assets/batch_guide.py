import asyncio
import json
import os
from pathlib import Path

from mcp import Client, StdioServerParameters
from PIL import Image
from rembg import new_session, remove

PY = r"C:\Users\pasha\Desktop\Prompt\tools\comfyui-mcp\.venv\Scripts\python.exe"
SERVER = r"C:\Users\pasha\Desktop\Prompt\tools\comfyui-mcp\server.py"
CWD = Path(r"C:\Users\pasha\Desktop\Prompt")
OUT = CWD / "Echo Tower" / "public" / "assets" / "guide"

STYLE = (
    "masterpiece, best quality, very aesthetic, absurdres, dark fantasy, korean manhwa illustration, "
    "semi-realistic anime, obsidian and violet palette, gold filigree, cinematic glow, "
)
NEG = (
    "lowres, bad anatomy, text, letters, watermark, logo, signature, worst quality, low quality, "
    "cropped, blurry, photorealistic, 3d render, nsfw, child, loli, human body, armor, weapon"
)

BASE = (
    "small fairy spirit named Nim, body of translucent glass shards, glowing teal core in the chest, "
    "delicate wings made of broken glass, gold filigree circlet, calm friendly face, floating"
)

SESSION = None


def rembg_session():
    global SESSION
    if SESSION is None:
        SESSION = new_session("u2net")
    return SESSION


def fit_cut(image: Image.Image, size: int = 512, margin: float = 0.06) -> Image.Image:
    bbox = image.getbbox()
    if bbox:
        image = image.crop(bbox)
    inner = int(size * (1 - margin * 2))
    scale = min(inner / image.width, inner / image.height)
    image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(image, ((size - image.width) // 2, (size - image.height) // 2), image)
    return canvas


async def generate(client, prompt: str, prefix: str, seed: int, alpha: bool, out: Path) -> None:
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
                    "cfg": 1.5,
                    "seed": seed,
                    "batch_size": 1,
                    "checkpoint": "animagine-xl-3.1.safetensors",
                    "lora": "sdxl_lightning_4step_lora.safetensors",
                    "lora_strength": 1.0,
                    "sampler_name": "euler",
                    "scheduler": "sgm_uniform",
                    "filename_prefix": prefix,
                },
            )
        ).content[0].text
    )
    if not res.get("ok"):
        print("FAIL", prefix, res.get("error"))
        return
    source = Path(res["files"][0]["path"])
    OUT.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as opened:
        image = opened.convert("RGB")
        if alpha:
            cut = remove(image, session=rembg_session())
            fit_cut(cut, 512).save(out, format="WEBP", quality=88, method=6)
        else:
            image.resize((512, 512), Image.LANCZOS).save(out, format="WEBP", quality=90, method=6)
    print("DONE", out.name, out.stat().st_size // 1024, "KB")


async def main() -> None:
    env = dict(os.environ)
    env.update(
        {
            "COMFYUI_URL": "http://127.0.0.1:8188",
            "COMFYUI_OUTPUT_DIR": "./assets/generated/guide",
            "DEFAULT_CHECKPOINT": "DreamShaper8_pruned.safetensors",
            "COMFYUI_TIMEOUT": "1800",
        }
    )
    params = StdioServerParameters(command=PY, args=[SERVER], env=env, cwd=str(CWD))
    async with Client(params) as client:
        await generate(client, BASE + ", head and shoulders portrait, facing viewer, centered, plain dark background", "guide_portrait", 31_001, False, OUT / "portrait.webp")
        await generate(client, BASE + ", full body, centered, plain dark background", "guide_sprite", 31_002, True, OUT / "sprite.webp")


if __name__ == "__main__":
    asyncio.run(main())
