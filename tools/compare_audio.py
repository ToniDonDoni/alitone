import numpy as np
from scipy.signal import butter, sosfilt, welch
from scipy.fft import rfft, rfftfreq
from pathlib import Path
from subprocess import check_output

root = Path(__file__).resolve().parents[1]
renders = root / 'output' / 'renders'
rate = 48000
reference_pcm = check_output([
    'ffmpeg', '-v', 'error', '-i', str(root / 'references' / 'march_of_fallen.mp3'),
    '-ar', str(rate), '-ac', '2', '-f', 'f32le', '-',
])
ref = np.frombuffer(reference_pcm, '<f4').reshape(-1, 2).mean(axis=1)
old = np.fromfile(renders / 'before-march.f32', '<f4')
new = np.fromfile(renders / 'revision-80-full.f32', '<f4')
drums = np.fromfile(renders / 'revision-80-drums.f32', '<f4')

def section(x, t, duration):
    return x[round(t * rate):round((t + duration) * rate)]

def rms(x):
    return np.sqrt(np.mean(x**2))

def band(x, lo, hi):
    return sosfilt(butter(3, [lo, hi], fs=rate, btype='bandpass', output='sos'), x)

def compare(x, onsets):
    f, p = welch(x[:round(7.4 * rate)], fs=rate, nperseg=16384)
    total = p[(f >= 20) & (f < 18000)].sum()
    proportions = [100 * p[(f >= l) & (f < h)].sum() / total for l,h in [(20,95),(95,520),(520,4000),(4000,18000)]]
    texture = band(x, 520, 4000)
    attack, quiet, rise = [np.mean([rms(section(texture, o + d, span)) for o in onsets])
                            for d, span in [(0,.035),(.115,.115),(.48,.15)]]
    low = band(x, 24, 95)
    early, late = [np.mean([rms(section(low, o + d, span)) for o in onsets])
                   for d, span in [(.09,.21),(.37,.23)]]
    first = onsets[0]
    pitch = []
    for time in [.11, .24, .42, .56]:
        a = section(x, first + time - .045, .09)
        mag = abs(rfft(a * np.hanning(len(a)), n=65536))
        hz = rfftfreq(65536, 1/rate)
        idx = np.where((hz >= 25)&(hz <= 85))[0]
        pitch.append(hz[idx[mag[idx].argmax()]])
    print('spectral %', np.round(proportions, 2), '| attack:quiet:rise', np.round([1, quiet/attack, rise/attack], 2),
          '| tail/early low',round(late/early,2), '| first step low peaks Hz',np.round(pitch,1))

for name, x, onsets in [('MP3', ref,[.052,.85,1.594,2.342]),('earlier page',old,[0,.75,1.5,2.25]),
                         ('percussion only',drums,[0,.75,1.5,2.25]),('revised page',new,[0,.75,1.5,2.25])]:
    print(name)
    compare(x,onsets)
for tempo in [80,108]:
    x=np.fromfile(renders / f'revision-{tempo}-full.f32','<f4')
    end=16*120/tempo
    print(tempo, 'cycle boundary', end, 
          'RMS around boundary', round(rms(section(x,end-.5,.5)),3), round(rms(section(x,end,.5)),3),
          'RMS',round(rms(x),3),'peak',round(abs(x).max(),3))
