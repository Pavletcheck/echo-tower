"""Сводит треки gen_audio.py в OGG через ffmpeg (libvorbis) — обход бага soundfile на длинных файлах."""

import subprocess
import sys
import tempfile
from pathlib import Path

import imageio_ffmpeg
import soundfile as sf

import gen_audio as g

OUT = Path(r"C:\Users\pasha\Desktop\Echo Tower\public\assets\audio")
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def export(data, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav = Path(tmp.name)
    sf.write(wav, g.stereo(data), g.SR, subtype="PCM_16")
    subprocess.run(
        [FFMPEG, "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav), "-c:a", "libvorbis", "-q:a", "4", str(out_path)],
        check=True,
    )
    wav.unlink(missing_ok=True)
    print(f"{out_path.name}: {out_path.stat().st_size / 1e6:.2f} MB")


def main(which: str) -> None:
    if which == "lobby":
        export(g.lobby_track(120), OUT / "music/lobby.ogg")
    elif which == "battle":
        export(g.battle_track(90), OUT / "music/battle.ogg")
    elif which == "boss":
        export(g.boss_track(105), OUT / "music/boss.ogg")
    elif which == "sfx":
        sfx = {
            "ui-click": g.sfx_click(),
            "ui-error": g.sfx_error(),
            "coin": g.sfx_coin(),
            "hit": g.sfx_hit(),
            "crit": g.sfx_crit(),
            "ult": g.sfx_ult(),
            "heal": g.sfx_heal(),
            "shatter": g.sfx_shatter(),
            "star-up": g.sfx_star_up(),
            "summon": g.sfx_summon(),
        }
        for name, data in sfx.items():
            export(data, OUT / f"sfx/{name}.ogg")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "sfx")
