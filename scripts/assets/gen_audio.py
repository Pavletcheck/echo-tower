"""Procedural audio for Echo Tower: 3 music loops + 10 SFX, written as OGG/Vorbis."""

import math
import random
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 32000
OUT = Path(r"C:\Users\pasha\Desktop\Echo Tower\public\assets\audio")
rng = np.random.default_rng(7)


def env(n: int, attack: float, decay: float, sr: int = SR) -> np.ndarray:
    a = max(1, int(attack * sr))
    d = max(1, int(decay * sr))
    out = np.zeros(n, dtype=np.float32)
    a = min(a, n)
    out[:a] = np.linspace(0, 1, a, dtype=np.float32)
    tail = min(d, n - a)
    if tail > 0:
        out[a : a + tail] = np.exp(-np.linspace(0, 5, tail, dtype=np.float32))
    return out


def sine(freq, n, sr=SR, phase=0.0):
    t = np.arange(n, dtype=np.float32) / sr
    return np.sin(2 * math.pi * freq * t + phase).astype(np.float32)


def saw(freq, n, sr=SR, harmonics=8):
    out = np.zeros(n, dtype=np.float32)
    for k in range(1, harmonics + 1):
        out += (1.0 / k) * sine(freq * k, n, sr)
    return out * (2 / math.pi)


def noise(n):
    return rng.standard_normal(n).astype(np.float32)


def lowpass(x, cutoff, sr=SR):
    a = math.exp(-2 * math.pi * cutoff / sr)
    out = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        out[i] = acc
    return out


def highpass(x, cutoff, sr=SR):
    return x - lowpass(x, cutoff, sr)


def reverb(x, decay=0.28, mix=0.3, sr=SR):
    """Дешёвый реверб: несколько затухающих задержек."""
    out = x.copy()
    for delay_ms, gain in ((37, 0.42), (53, 0.34), (71, 0.27), (97, 0.2), (131, 0.14)):
        d = int(delay_ms * sr / 1000)
        tap = np.zeros_like(x)
        tap[d:] = x[:-d] * gain * decay
        out += tap
    return (x * (1 - mix) + out * mix).astype(np.float32)


def bell(freq, dur, amp=0.5, sr=SR):
    n = int(dur * sr)
    partials = ((1.0, 1.0), (2.01, 0.5), (2.99, 0.28), (4.2, 0.16))
    out = np.zeros(n, dtype=np.float32)
    for ratio, level in partials:
        out += level * sine(freq * ratio, n, sr) * env(n, 0.004, dur * 0.9, sr)
    return out * amp


def pad(freqs, dur, amp=0.25, sr=SR, detune=0.004):
    n = int(dur * sr)
    out = np.zeros(n, dtype=np.float32)
    for f in freqs:
        for shift in (-detune, 0.0, detune):
            out += saw(f * (1 + shift), n, sr, harmonics=6)
    out /= max(1, len(freqs) * 3)
    lfo = 0.6 + 0.4 * np.sin(2 * math.pi * 0.05 * np.arange(n) / sr)
    return (out * lfo * env(n, dur * 0.25, dur * 0.6) * amp).astype(np.float32)


def kick(dur=0.32, amp=0.9, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    sweep = 120 * np.exp(-t * 18) + 42
    body = np.sin(2 * math.pi * np.cumsum(sweep) / sr)
    click = highpass(noise(n), 2500) * np.exp(-t * 90) * 0.5
    return ((body * np.exp(-t * 9) + click) * amp).astype(np.float32)


def snare(dur=0.22, amp=0.5, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    body = sine(185, n) * np.exp(-t * 26) * 0.5
    crisp = highpass(noise(n), 1400) * np.exp(-t * 18)
    return ((body + crisp) * amp).astype(np.float32)


def hat(dur=0.06, amp=0.22, sr=SR):
    n = int(dur * sr)
    t = np.arange(n) / sr
    return (highpass(noise(n), 6500) * np.exp(-t * 70) * amp).astype(np.float32)


def place(track, sample, at, gain=1.0):
    i = int(at * SR)
    end = min(len(track), i + len(sample))
    if i >= len(track):
        return
    track[i:end] += sample[: end - i] * gain


def normalize(x, peak=0.9):
    m = float(np.max(np.abs(x))) or 1.0
    return (x / m * peak).astype(np.float32)


def stereo(x, width=0.12):
    left = x
    right = np.roll(x, int(SR * 0.008)) * (1 - width) + x * width
    return np.stack([left, right], axis=1)


# ---------------------------------------------------------------- music

def lobby_track(seconds=120):
    n = int(seconds * SR)
    track = np.zeros(n, dtype=np.float32)
    prog = [
        (146.83, [146.83, 174.61, 220.00]),   # Dm
        (116.54, [116.54, 146.83, 174.61]),   # Bb
        (130.81, [130.81, 164.81, 196.00]),   # C
        (110.00, [110.00, 130.81, 164.81]),   # Am
    ]
    bar = 8.0
    for index in range(0, int(seconds / bar)):
        root, chord = prog[index % len(prog)]
        at = index * bar
        place(track, pad(chord, bar + 0.6, amp=0.22), at)
        place(track, sine(root / 2, int((bar + 0.4) * SR)) * env(int((bar + 0.4) * SR), 1.2, bar) * 0.16, at)
        if index % 2 == 0:
            note = random.choice([587.33, 698.46, 880.00, 1046.5])
            place(track, reverb(bell(note, 3.2, 0.16), 0.4, 0.5), at + 1.4)
        if index % 4 == 3:
            swell = lowpass(noise(int(3 * SR)), 900) * env(int(3 * SR), 1.8, 1.4) * 0.06
            place(track, swell, at + 4.5)

    track = reverb(track, decay=0.4, mix=0.34)
    return normalize(track, 0.75)


def battle_track(seconds=90, bpm=100):
    n = int(seconds * SR)
    track = np.zeros(n, dtype=np.float32)
    beat = 60 / bpm
    total_beats = int(seconds / beat)
    roots = [73.42, 73.42, 87.31, 65.41]  # D2 D2 F2 C2
    for b in range(total_beats):
        t = b * beat
        place(track, kick(), t, 0.85 if b % 4 == 0 else 0.5)
        if b % 4 == 2:
            place(track, snare(), t, 0.55)
        place(track, hat(), t + beat / 2, 0.5)
        if b % 2 == 0:
            root = roots[(b // 8) % len(roots)]
            bass = lowpass(saw(root, int(beat * 1.6 * SR), harmonics=6), 420)
            place(track, bass * env(int(beat * 1.6 * SR), 0.01, beat * 1.5) * 0.5, t, 0.9)

    bar = beat * 4
    pad_prog = [(146.83, [146.83, 174.61, 220.0]), (174.61, [174.61, 220.0, 261.63]),
                (130.81, [130.81, 164.81, 196.0]), (110.0, [110.0, 130.81, 164.81])]
    for index in range(0, int(seconds / (bar * 2))):
        root, chord = pad_prog[index % len(pad_prog)]
        place(track, pad(chord, bar * 2 + 0.4, amp=0.16), index * bar * 2)

    track = reverb(track, decay=0.22, mix=0.18)
    return normalize(track, 0.85)


def boss_track(seconds=105, bpm=120):
    n = int(seconds * SR)
    track = np.zeros(n, dtype=np.float32)
    beat = 60 / bpm
    total = int(seconds / beat)
    for b in range(total):
        t = b * beat
        if b % 4 == 0 or b % 8 == 7:
            place(track, kick(0.4, 1.0), t, 0.95)
        if b % 4 == 2:
            place(track, snare(0.26, 0.6), t, 0.7)
        if b % 8 == 6:
            place(track, snare(0.3, 0.75), t, 0.8)
        place(track, hat(), t + beat / 2, 0.35)

    # тритон-дрон D + Ab искажённый
    drone_n = int(bar_len := beat * 8) * SR
    drone = (sine(36.71, drone_n) * 0.5 + sine(51.91, drone_n) * 0.35)
    drone = np.tanh(drone * 2.2) * 0.22
    for k in range(0, int(seconds / bar_len)):
        place(track, drone, k * bar_len)

    for index in range(0, int(seconds / (beat * 16))):
        at = index * beat * 16
        chord = [73.42, 103.83, 146.83, 155.56]
        place(track, pad(chord, beat * 16 + 0.5, amp=0.18, detune=0.006), at)

    track = reverb(track, decay=0.3, mix=0.22)
    return normalize(track, 0.88)


# ---------------------------------------------------------------- sfx

def sfx_click():
    n = int(0.05 * SR)
    return normalize((sine(1250, n) * env(n, 0.001, 0.03) + highpass(noise(n), 3000) * env(n, 0.001, 0.012) * 0.5), 0.7)


def sfx_error():
    n = int(0.22 * SR)
    a = sine(320, n) * env(n, 0.005, 0.09)
    b = sine(210, n) * env(n, 0.005, 0.13)
    return normalize((a + np.roll(b, int(0.11 * SR))) * 0.6, 0.7)


def sfx_coin():
    n = int(0.3 * SR)
    first = bell(1568, 0.16, 0.5)
    second = np.concatenate([np.zeros(int(0.07 * SR), dtype=np.float32), bell(2093, 0.22, 0.45)])
    out = np.zeros(max(len(first), len(second)), dtype=np.float32)
    out[: len(first)] += first
    out[: len(second)] += second
    return normalize(out[:n], 0.65)


def sfx_hit():
    n = int(0.16 * SR)
    thump = sine(72, n) * np.exp(-np.arange(n) / SR * 22)
    body = lowpass(noise(n), 1800) * np.exp(-np.arange(n) / SR * 40)
    return normalize((thump * 0.9 + body * 0.6), 0.8)


def sfx_crit():
    n = int(0.45 * SR)
    out = np.zeros(n, dtype=np.float32)
    for freq, level in ((2093, 0.5), (3136, 0.35), (4186, 0.22)):
        tone = bell(freq, 0.4, level)
        out[: len(tone)] += tone
    out += highpass(noise(n), 5000) * np.exp(-np.arange(n) / SR * 18) * 0.35
    return normalize(out, 0.8)


def sfx_heal():
    n = int(0.55 * SR)
    out = np.zeros(n, dtype=np.float32)
    for i, freq in enumerate((523.25, 659.25, 783.99)):
        place(out, bell(freq, 0.5, 0.4), i * 0.09)
    return normalize(out, 0.6)


def sfx_shatter():
    n = int(0.7 * SR)
    out = np.zeros(n, dtype=np.float32)
    for _ in range(9):
        dur = random.uniform(0.03, 0.12)
        grain = highpass(noise(int(dur * SR)), random.uniform(2500, 6000))
        grain *= env(len(grain), 0.0005, dur)
        place(out, grain * random.uniform(0.3, 0.8), random.uniform(0, 0.45))
    return normalize(out, 0.75)


def sfx_ult():
    n = int(1.1 * SR)
    t = np.arange(n) / SR
    sub = sine(45, n) * np.exp(-t * 3) * 0.9
    swell_n = int(0.8 * SR)
    sweep = lowpass(noise(swell_n), 400) * np.linspace(0, 1, swell_n, dtype=np.float32) ** 2 * 0.5
    stab = np.concatenate([np.zeros(int(0.25 * SR), dtype=np.float32), bell(174.61, 0.8, 0.5)])
    layered = np.zeros(max(len(sub), len(stab)), dtype=np.float32)
    layered[: len(sub)] += sub
    layered[: len(stab)] += stab
    boom = np.tanh(layered[:n] * 1.6)
    out = np.zeros(n, dtype=np.float32)
    place(out, sweep, 0.0)
    place(out, boom[: int(0.9 * SR)], 0.2, 1.0)
    return normalize(out, 0.9)


def sfx_star_up():
    notes = (523.25, 659.25, 783.99, 1046.5)
    total = int(0.9 * SR)
    out = np.zeros(total, dtype=np.float32)
    for i, freq in enumerate(notes):
        place(out, bell(freq, 0.6, 0.45), i * 0.1)
    return normalize(out, 0.7)


def sfx_summon():
    total = int(1.0 * SR)
    out = np.zeros(total, dtype=np.float32)
    n = int(0.7 * SR)
    sweep = highpass(noise(n), 600)
    cutoff = np.linspace(0.02, 0.6, n, dtype=np.float32)
    whoosh = lowpass(sweep * cutoff, 2500) * env(n, 0.25, 0.3)
    place(out, whoosh * 0.8, 0.0)
    for i, freq in enumerate((880, 1108.73, 1318.51)):
        place(out, bell(freq, 0.7, 0.35), 0.25 + i * 0.07)
    return normalize(out, 0.75)


def main(which: str = "all"):
    music = OUT / "music"
    sfx_dir = OUT / "sfx"
    music.mkdir(parents=True, exist_ok=True)
    sfx_dir.mkdir(parents=True, exist_ok=True)

    if which in ("all", "lobby"):
        data = lobby_track()
        sf.write(music / "lobby.ogg", stereo(data), SR, format="OGG", subtype="VORBIS")
        print(f"lobby.ogg {len(data) / SR:.0f}s")
        del data

    if which in ("all", "battle"):
        data = battle_track()
        sf.write(music / "battle.ogg", stereo(data), SR, format="OGG", subtype="VORBIS")
        print(f"battle.ogg {len(data) / SR:.0f}s")
        del data

    if which in ("all", "boss"):
        data = boss_track()
        sf.write(music / "boss.ogg", stereo(data), SR, format="OGG", subtype="VORBIS")
        print(f"boss.ogg {len(data) / SR:.0f}s")
        del data

    sfx = {
        "ui-click": sfx_click(),
        "ui-error": sfx_error(),
        "coin": sfx_coin(),
        "hit": sfx_hit(),
        "crit": sfx_crit(),
        "ult": sfx_ult(),
        "heal": sfx_heal(),
        "shatter": sfx_shatter(),
        "star-up": sfx_star_up(),
        "summon": sfx_summon(),
    }
    for name, data in sfx.items():
        sf.write(sfx_dir / f"{name}.ogg", data, SR, format="OGG", subtype="VORBIS")
        print(f"sfx/{name}.ogg {len(data) / SR:.2f}s")


if __name__ == "__main__":
    import sys

    main(sys.argv[1] if len(sys.argv) > 1 else "all")
