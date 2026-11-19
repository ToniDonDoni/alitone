#!/usr/bin/env python3
"""Compare the felt boot/wood impact in the two browser-rendered marches."""
from pathlib import Path
import json
import numpy as np
from scipy.signal import butter, sosfiltfilt

ROOT = Path(__file__).resolve().parents[1]
RATE = 48000
RENDERS = ROOT / "output" / "renders"
OUT = ROOT / "output" / "analysis"
BANDS = ((95, 200), (200, 520), (520, 1400), (1400, 4000))
ONSETS = (0.0, 0.75, 1.5)
WINDOW = (0.05, 0.15)


def read_pcm(path, channels, offset):
    pcm = np.fromfile(path, dtype="<f4")
    assert pcm.size % channels == 0, f"Wrong channel count: {path}"
    mono = pcm.reshape(-1, channels).mean(axis=1)
    return mono[round(offset * RATE):]


def band_rms(signal, lo, hi):
    sos = butter(3, (lo, hi), fs=RATE, btype="bandpass", output="sos")
    filtered = sosfiltfilt(sos, signal)
    return float(np.mean([
        np.sqrt(np.mean(filtered[round((onset+WINDOW[0])*RATE):
                                 round((onset+WINDOW[1])*RATE)]**2))
        for onset in ONSETS
    ]))


def main():
    OUT.mkdir(exist_ok=True, parents=True)
    revised = read_pcm(RENDERS / "revision-80-drums.f32", 1, 0.0)
    tone = read_pcm(RENDERS / "tone-80-2bars-drums-stereo.f32", 2, 0.02)
    results = {
        "method": "Three strikes at 80 BPM; 50-150 ms after strike; 48 kHz mono; RMS by band",
        "revised": {},
        "tone": {},
        "ratios_tone_to_revised": {}
    }
    for lo, hi in BANDS:
        key = f"{lo}-{hi}Hz"
        a = band_rms(revised, lo, hi)
        b = band_rms(tone, lo, hi)
        results["revised"][key] = round(a, 6)
        results["tone"][key] = round(b, 6)
        results["ratios_tone_to_revised"][key] = round(b / a, 3) if a > 0 else None
    (OUT / "step-transients.json").write_text(json.dumps(results, indent=2) + "\n")
    print("Reference vs Tone step transients:", json.dumps(results))


if __name__ == "__main__":
    main()
