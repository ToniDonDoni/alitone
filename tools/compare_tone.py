"""Compare Tone.js renders with the reference using the project's established windows."""
import numpy as np
from scipy.signal import butter, sosfilt, welch
from scipy.fft import rfft, rfftfreq
from pathlib import Path
from subprocess import check_output

ROOT = Path(__file__).resolve().parents[1]
RENDERS = ROOT / "output" / "renders"
RATE = 48000
ref_bytes = check_output(["ffmpeg", "-v", "error", "-i", str(ROOT / "references" / "march_of_fallen.mp3"), "-ar", str(RATE), "-ac", "2", "-f", "f32le", "-"])
reference = np.frombuffer(ref_bytes, "<f4").reshape(-1, 2).mean(axis=1)


def render(name):
    stereo = np.fromfile(RENDERS / name, "<f4").reshape(-1, 2)
    return stereo.mean(axis=1), float(np.abs(stereo).max())


def section(signal, start, duration):
    return signal[round(start * RATE):round((start + duration) * RATE)]


def rms(signal):
    return float(np.sqrt(np.mean(signal ** 2)))


def band(signal, low, high):
    return sosfilt(butter(3, [low, high], fs=RATE, btype="bandpass", output="sos"), signal)


def metrics(signal, onsets):
    frequency, power = welch(signal[:round(7.4 * RATE)], fs=RATE, nperseg=16384)
    total = power[(frequency >= 20) & (frequency < 18000)].sum()
    shares = [100 * power[(frequency >= low) & (frequency < high)].sum() / total for low, high in [(20, 95), (95, 520), (520, 4000), (4000, 18000)]]
    texture = band(signal, 520, 4000)
    attack, quiet, rise = [np.mean([rms(section(texture, onset + offset, span)) for onset in onsets]) for offset, span in [(0, .035), (.115, .115), (.48, .15)]]
    low = band(signal, 24, 95)
    early, late = [np.mean([rms(section(low, onset + offset, span)) for onset in onsets]) for offset, span in [(.09, .21), (.37, .23)]]
    pitch = []
    for offset in [.11, .24, .42, .56]:
        sample = section(signal, onsets[0] + offset - .045, .09)
        magnitude = abs(rfft(sample * np.hanning(len(sample)), n=65536))
        hz = rfftfreq(65536, 1 / RATE)
        valid = np.where((hz >= 25) & (hz <= 85))[0]
        pitch.append(hz[valid[magnitude[valid].argmax()]])
    return shares, [1, quiet / attack, rise / attack], late / early, pitch


def report(label, signal, onsets, peak=None):
    shares, texture, tail, pitch = metrics(signal, onsets)
    print(label)
    print("  bands 20–95 / 95–520 / 520–4000 / 4000–18000 Hz:", np.round(shares, 2), "%")
    print("  attack:pre-step:rise:", np.round(texture, 2), "; low tail/early:", round(tail, 2))
    print("  first-strike low peaks:", np.round(pitch, 1), "Hz")
    if peak is not None:
        print("  stereo peak:", round(peak, 3))


report("Reference MP3", reference, [.052, .85, 1.594, 2.342])
for name in ["tone-80-boundary-full-stereo.f32", "tone-108-boundary-full-stereo.f32"]:
    signal, peak = render(name)
    onsets = [.02 + i * (60 / (80 if "108" not in name else 108)) for i in range(4)]
    report(name, signal, onsets, peak)
    boundary = 16 * 2 * 60 / (108 if "108" in name else 80)
    print("  loop-boundary RMS:", round(rms(section(signal, boundary - .4, .4)), 3), round(rms(section(signal, boundary, .4)), 3))
