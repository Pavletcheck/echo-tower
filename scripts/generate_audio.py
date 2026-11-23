"""Генерирует WAV-ассеты для Echo Tower без внешних зависимостей.

Запуск: python scripts/generate_audio.py
Папка: public/assets/audio/{music,sfx}
"""

from __future__ import annotations

import math
import os
import random
import struct
import wave
from typing import Callable

SFX_RATE = 22050
MUSIC_RATE = 16000
ROOT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "assets", "audio")
RNG = random.Random(1337)


def write_wav(path: str, samples: list[float], rate: int) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    frames = bytearray()
    for sample in samples:
        value = max(-1.0, min(1.0, sample))
        frames += struct.pack("<h", int(value * 32767))
    with wave.open(path, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes(bytes(frames))


def normalize(samples: list[float], peak: float = 0.9) -> list[float]:
    high = max((abs(value) for value in samples), default=0.0)
    if high <= 0:
        return samples
    scale = peak / high
    return [value * scale for value in samples]


def fade_edges(samples: list[float], rate: int, seconds: float = 0.02) -> list[float]:
    count = min(len(samples), int(rate * seconds))
    for index in range(count):
        factor = index / max(1, count - 1)
        samples[index] *= factor
        samples[-1 - index] *= factor
    return samples


def envelope(index: int, total: int, attack: float = 0.01, release: float = 0.1) -> float:
    if total <= 0:
        return 0.0
    time = index / total
    attack_ratio = max(0.0001, attack)
    release_ratio = max(0.0001, release)
    if time < attack_ratio:
        return time / attack_ratio
    if time > 1 - release_ratio:
        return max(0.0, (1 - time) / release_ratio)
    return 1.0


def add_tone(
    buffer: list[float],
    start: float,
    duration: float,
    frequency: float,
    volume: float,
    rate: int,
    wave_kind: str = "sine",
    slide_to: float | None = None,
    attack: float = 0.01,
    release: float = 0.2,
) -> None:
    begin = int(start * rate)
    count = int(duration * rate)
    for offset in range(count):
        index = begin + offset
        if index >= len(buffer):
            break
        ratio = offset / count
        freq = frequency if slide_to is None else frequency + (slide_to - frequency) * ratio
        phase = 2 * math.pi * freq * (offset / rate)
        if wave_kind == "saw":
            raw = 2 * ((phase / (2 * math.pi)) % 1.0) - 1
        elif wave_kind == "square":
            raw = 1.0 if math.sin(phase) >= 0 else -1.0
        elif wave_kind == "triangle":
            raw = 2 * abs(2 * ((phase / (2 * math.pi)) % 1.0) - 1) - 1
        else:
            raw = math.sin(phase)
        buffer[index] += raw * volume * envelope(offset, count, attack, release)


def add_noise(
    buffer: list[float],
    start: float,
    duration: float,
    volume: float,
    rate: int,
    smoothing: float = 0.2,
    attack: float = 0.005,
    release: float = 0.4,
) -> None:
    begin = int(start * rate)
    count = int(duration * rate)
    previous = 0.0
    for offset in range(count):
        index = begin + offset
        if index >= len(buffer):
            break
        raw = RNG.uniform(-1.0, 1.0)
        previous += (raw - previous) * smoothing
        buffer[index] += previous * volume * envelope(offset, count, attack, release)


def make_sfx(name: str, duration: float, build: Callable[[list[float], int], None], rate: int = SFX_RATE) -> None:
    samples = [0.0] * int(duration * rate)
    build(samples, rate)
    samples = fade_edges(normalize(samples, 0.82), rate, 0.005)
    write_wav(os.path.join(ROOT, "sfx", f"{name}.wav"), samples, rate)


def sfx_click(samples: list[float], rate: int) -> None:
    add_tone(samples, 0.0, 0.055, 880, 0.45, rate, "triangle", 620, release=0.8)
    add_noise(samples, 0.0, 0.025, 0.12, rate, smoothing=0.7, release=0.9)


def sfx_error(samples: list[float], rate: int) -> None:
    add_tone(samples, 0.0, 0.22, 180, 0.5, rate, "square", 120, release=0.5)
    add_tone(samples, 0.03, 0.2, 140, 0.25, rate, "saw", 96, release=0.5)
    add_noise(samples, 0.0, 0.1, 0.12, rate, smoothing=0.12, release=0.8)


def sfx_coin(samples: list[float], rate: int) -> None:
    add_tone(samples, 0.0, 0.16, 1180, 0.42, rate, "sine", release=0.6)
    add_tone(samples, 0.07, 0.24, 1760, 0.34, rate, "sine", release=0.7)
    add_tone(samples, 0.14, 0.2, 2350, 0.18, rate, "triangle", release=0.8)


def sfx_hit(samples: list[float], rate: int) -> None:
    add_noise(samples, 0.0, 0.14, 0.5, rate, smoothing=0.32, release=0.9)
    add_tone(samples, 0.0, 0.12, 90, 0.4, rate, "sine", 55, release=0.7)


def sfx_crit(samples: list[float], rate: int) -> None:
    add_noise(samples, 0.0, 0.2, 0.45, rate, smoothing=0.45, release=0.8)
    add_tone(samples, 0.0, 0.24, 2400, 0.28, rate, "triangle", 1800, release=0.7)
    add_tone(samples, 0.02, 0.16, 120, 0.32, rate, "sine", 60, release=0.8)


def sfx_ult(samples: list[float], rate: int) -> None:
    add_tone(samples, 0.0, 0.65, 120, 0.36, rate, "saw", 520, attack=0.08, release=0.4)
    add_tone(samples, 0.08, 0.55, 240, 0.24, rate, "triangle", 780, attack=0.05, release=0.5)
    add_noise(samples, 0.0, 0.6, 0.18, rate, smoothing=0.18, attack=0.1, release=0.6)


def sfx_heal(samples: list[float], rate: int) -> None:
    for index, freq in enumerate((523.25, 659.25, 783.99)):
        add_tone(samples, index * 0.09, 0.42, freq, 0.24, rate, "sine", release=0.7)
    add_tone(samples, 0.0, 0.5, 1046.5, 0.08, rate, "triangle", release=0.8)


def sfx_shatter(samples: list[float], rate: int) -> None:
    add_noise(samples, 0.0, 0.75, 0.5, rate, smoothing=0.5, release=0.7)
    add_tone(samples, 0.0, 0.7, 880, 0.22, rate, "triangle", 110, release=0.8)
    add_tone(samples, 0.12, 0.45, 320, 0.16, rate, "saw", 90, release=0.8)


def sfx_star_up(samples: list[float], rate: int) -> None:
    for index, freq in enumerate((392.0, 523.25, 659.25, 783.99, 1046.5)):
        add_tone(samples, index * 0.12, 0.7, freq, 0.22, rate, "sine", release=0.7)
        add_tone(samples, index * 0.12, 0.5, freq * 2, 0.07, rate, "triangle", release=0.75)
    add_noise(samples, 0.4, 0.5, 0.06, rate, smoothing=0.1, release=0.7)


def sfx_summon(samples: list[float], rate: int) -> None:
    add_tone(samples, 0.0, 0.85, 180, 0.3, rate, "sine", 720, attack=0.15, release=0.4)
    add_tone(samples, 0.1, 0.7, 360, 0.18, rate, "triangle", 1080, attack=0.1, release=0.5)
    add_noise(samples, 0.0, 0.8, 0.12, rate, smoothing=0.08, attack=0.2, release=0.6)


def add_pad(buffer: list[float], start: float, duration: float, freqs: tuple[float, ...], volume: float, rate: int) -> None:
    count = int(duration * rate)
    begin = int(start * rate)
    for offset in range(count):
        index = begin + offset
        if index >= len(buffer):
            break
        ratio = offset / count
        attack = min(1.0, ratio / 0.18)
        release = min(1.0, (1 - ratio) / 0.22)
        env = attack * release
        time = offset / rate
        value = 0.0
        for order, freq in enumerate(freqs):
            value += math.sin(2 * math.pi * freq * time + order * 0.7) * (1.0 / (order + 1))
            value += math.sin(2 * math.pi * freq * 1.006 * time) * 0.35
        buffer[index] += (value / len(freqs)) * volume * env


def make_music(name: str, seconds: float, build: Callable[[list[float], int], None], rate: int = MUSIC_RATE) -> None:
    samples = [0.0] * int(seconds * rate)
    build(samples, rate)
    samples = fade_edges(normalize(samples, 0.7), rate, 0.4)
    write_wav(os.path.join(ROOT, "music", f"{name}.wav"), samples, rate)


def music_lobby(samples: list[float], rate: int) -> None:
    chords = (
        (220.0, 261.63, 329.63),
        (174.61, 220.0, 261.63),
        (130.81, 164.81, 196.0),
        (196.0, 246.94, 293.66),
    )
    for index, chord in enumerate(chords):
        add_pad(samples, index * 4.0, 4.4, chord, 0.22, rate)
    for index in range(8):
        add_tone(samples, index * 2.0 + 0.6, 1.8, 659.25 if index % 2 else 523.25, 0.035, rate, "sine", release=0.6)
    for index in range(16):
        add_noise(samples, index * 1.0, 0.08, 0.012, rate, smoothing=0.05, release=0.8)


def music_battle(samples: list[float], rate: int) -> None:
    beat = 0.6
    bass = (110.0, 110.0, 130.81, 98.0)
    arp = (220.0, 261.63, 329.63, 392.0, 329.63, 261.63)
    for index in range(20):
        start = index * beat
        add_tone(samples, start, 0.5, bass[index % len(bass)], 0.22, rate, "saw", release=0.45)
        add_noise(samples, start, 0.1, 0.14, rate, smoothing=0.55, release=0.85)
    for index in range(40):
        start = index * beat * 0.5
        freq = arp[index % len(arp)]
        add_tone(samples, start, 0.28, freq, 0.06, rate, "triangle", release=0.6)


def music_boss(samples: list[float], rate: int) -> None:
    for index in range(14):
        start = index * 1.0
        add_tone(samples, start, 0.9, 55.0, 0.22, rate, "sine", release=0.4)
        add_tone(samples, start, 0.9, 82.41, 0.12, rate, "saw", release=0.5)
    for index in range(20):
        start = index * 0.7
        add_noise(samples, start, 0.22, 0.22, rate, smoothing=0.35, release=0.7)
        add_tone(samples, start, 0.2, 73.42, 0.24, rate, "square", 55, release=0.8)
    for index in range(7):
        add_tone(samples, index * 2.0, 2.0, 440.0, 0.035, rate, "triangle", 415.3, attack=0.2, release=0.5)


def main() -> None:
    make_sfx("ui-click", 0.08, sfx_click)
    make_sfx("ui-error", 0.32, sfx_error)
    make_sfx("coin", 0.42, sfx_coin)
    make_sfx("hit", 0.2, sfx_hit)
    make_sfx("crit", 0.32, sfx_crit)
    make_sfx("ult", 0.85, sfx_ult)
    make_sfx("heal", 0.65, sfx_heal)
    make_sfx("shatter", 1.0, sfx_shatter)
    make_sfx("star-up", 1.45, sfx_star_up)
    make_sfx("summon", 1.2, sfx_summon)

    make_music("lobby", 16.0, music_lobby)
    make_music("battle", 12.0, music_battle)
    make_music("boss", 14.0, music_boss)

    total = 0
    for folder in ("sfx", "music"):
        for name in sorted(os.listdir(os.path.join(ROOT, folder))):
            path = os.path.join(ROOT, folder, name)
            total += os.path.getsize(path)
            print(f"{folder}/{name}: {os.path.getsize(path) / 1024:.1f} KB")
    print(f"total: {total / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main()
