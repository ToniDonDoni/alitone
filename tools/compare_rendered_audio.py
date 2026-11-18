#!/usr/bin/env python3
"""Compare rendered audio output of Revised and Tone.js, without reference MP3."""
from pathlib import Path
import csv
import json
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from scipy.fft import rfft, rfftfreq
from scipy.signal import butter, sosfilt, welch

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "output" / "renders"
OUT = ROOT / "output" / "analysis"
RATE = 48000
SPAN = 7.4
BANDS = [(20, 95), (95, 520), (520, 4000), (4000, 18000)]


def load(filename, channels, leading_seconds):
    raw = np.fromfile(INPUT / filename, dtype="<f4")
    if raw.size % channels:
        raise ValueError(f"Invalid channel count for {filename}")
    audio = raw.reshape(-1, channels).mean(axis=1).astype(np.float64)
    first = round(leading_seconds * RATE)
    last = first + round(SPAN * RATE)
    if len(audio) < last:
        raise ValueError(f"{filename} is too short")
    return audio[first:last]


def rms(audio):
    return float(np.sqrt(np.mean(audio * audio)))


def filtered(audio, low, high):
    return sosfilt(butter(3, [low, high], fs=RATE,
                         btype="bandpass", output="sos"), audio)


def section(audio, start, duration):
    return audio[round(start * RATE):round((start + duration) * RATE)]


def metrics(audio):
    frequencies, power = welch(audio, fs=RATE, nperseg=16384)
    band_total = power[(frequencies >= 20) & (frequencies < 18000)].sum()
    shares = {f"{low}-{high}Hz": round(float(
        100 * power[(frequencies >= low) & (frequencies < high)].sum() / band_total), 4)
              for low, high in BANDS}
    onsets = [n * 0.75 for n in range(4)]
    low = filtered(audio, 24, 95)
    texture = filtered(audio, 520, 4000)
    early = np.mean([rms(section(low, onset + .09, .21)) for onset in onsets])
    late = np.mean([rms(section(low, onset + .37, .23)) for onset in onsets])
    attack = np.mean([rms(section(texture, onset, .035)) for onset in onsets])
    quiet = np.mean([rms(section(texture, onset + .115, .115)) for onset in onsets])
    pitch = []
    for offset in (.11, .24, .42, .56):
        sample = section(audio, offset - .045, .09)
        spec = np.abs(rfft(sample * np.hanning(len(sample)), n=65536))
        hz = rfftfreq(65536, 1 / RATE)
        valid = np.where((hz >= 25) & (hz <= 85))[0]
        pitch.append(round(float(hz[valid[np.argmax(spec[valid])]]), 2))
    return {
        "rms": round(rms(audio), 6),
        "peak_mono": round(float(np.max(np.abs(audio))), 6),
        "bands_percent": shares,
        "low_tail_late_early": round(float(late / early), 4),
        "quiet_to_attack_520_4000": round(float(quiet / attack), 4),
        "first_strike_peaks_hz": pitch,
    }, frequencies, power, low


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sources = {
        "Revised": load("revision-80-full.f32", 1, 0.0),
        "Tone.js": load("tone-80-boundary-full-stereo.f32", 2, 0.02),
    }
    results, powers, lows = {}, {}, {}
    for name, audio in sources.items():
        stats, hz, power, low = metrics(audio)
        results[name] = stats
        powers[name] = power
        lows[name] = low
    results["method"] = {
        "sample_rate": RATE,
        "window_seconds": SPAN,
        "revised_onset_seconds": 0.0,
        "tone_onset_seconds": 0.02,
        "welch_nperseg": 16384,
        "downmix": "stereo averaged to mono",
        "method_warning": "PSD of rendered music, not filter transfer response",
        "github_commit": os.environ.get("GITHUB_SHA", ""),
    }
    (OUT / "comparison.json").write_text(json.dumps(results, indent=2) + "\n")
    with (OUT / "spectrum.csv").open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["hz", "revised_psd", "tone_psd"])
        writer.writerows(zip(hz, powers["Revised"], powers["Tone.js"]))

    plt.figure(figsize=(12, 6))
    for label, spec in powers.items():
        normalized = np.maximum(spec / spec[(hz >= 20) & (hz < 18000)].sum(), 1e-16)
        plt.semilogx(hz[1:], 10 * np.log10(normalized[1:]), label=label)
    for bound in (95, 520, 4000):
        plt.axvline(bound, color="gray", linewidth=.8, linestyle=":")
    plt.xlim(20, 18000)
    plt.ylim(-115, 0)
    plt.xlabel("Frequency (Hz)")
    plt.ylabel("Normalized PSD, dB")
    plt.title("Revised vs Tone.js at 80 BPM, 7.4 s onset-aligned")
    plt.legend()
    plt.grid(alpha=.25, which="both")
    plt.tight_layout()
    plt.savefig(OUT / "spectrum.png", dpi=160)
    plt.close()

    plt.figure(figsize=(12, 5))
    for name, low in lows.items():
        block = 960
        count = len(low) // block
        time = (np.arange(count) + .5) * block / RATE
        curve = np.sqrt((low[:count*block].reshape(count,block)**2).mean(axis=1))
        plt.plot(time, curve, label=name)
    plt.xlabel("Seconds after first strike")
    plt.ylabel("24-95 Hz RMS (20 ms windows)")
    plt.title("Low-end envelope, 80 BPM")
    plt.grid(alpha=.25)
    plt.legend()
    plt.tight_layout()
    plt.savefig(OUT / "envelope.png", dpi=160)
    plt.close()
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
