# Independent Revised vs Tone.js rendered-audio comparison

Generated: 2026-11-19 (after GitHub Actions run 44423954020)
Branch: `march-of-the-fallen`
Render commit: `9f511b938a70720d096b81e19c68510df75de29b`

## Reproduction and evidence

- Workflow: https://github.com/ToniDonDoni/alitone/actions/runs/44423954020
- Source code: `tools/compare_rendered_audio.py` and `.github/workflows/audio-compare.yml`
- Artifacts: `march-revised-tone-audio` (GitHub retention: 7 days)
- Source renders: `revision-80-full.f32` (mono) and `tone-80-boundary-full-stereo.f32` (stereo)
- Additional percussion comparison: `revision-80-drums.f32` and `tone-80-2bars-drums-stereo.f32`

Both HTML pages executed in headless Chrome with networking disabled. The new
Tone.js page's generated content was verified against `build_tone_page.py`.
The uploaded float32 PCM was downloaded and analyzed a second time in a separate
Python container, not merely accepted from previously committed report values.

The primary comparison uses 48 kHz PCM, 80 BPM, the first 7.4 seconds, 20 ms
Tone.js render-start offset correction, stereo-to-mono averaging and Welch
PSD with `nperseg=16384`. Values are **relative shares of 20–18,000 Hz
spectral power**, not transfer-function frequency responses. Percussion-only
comparison covers the first 2.9 seconds.

## Full-mix measured spectral shares

| Band | Revised | Tone.js | Difference (Tone minus Revised) |
| --- | ---: | ---: | ---: |
| 20–50 Hz | 37.56% | 40.65% | +3.09 pp |
| 50–95 Hz | 50.09% | 47.26% | -2.83 pp |
| 95–200 Hz | 4.06% | 4.01% | -0.05 pp |
| 200–520 Hz | 1.28% | 0.76% | -0.52 pp |
| 520–4,000 Hz | 6.96% | 7.27% | +0.31 pp |
| 4,000–18,000 Hz | 0.046% | 0.052% | +0.006 pp |

The 95–520 Hz total is 5.34% Revised vs 4.76% Tone.js. Almost all of this
measured gap is in 200–520 Hz, not 95–200 Hz.

## Drums-only, first 2.9 seconds

| Band | Revised | Tone.js |
| --- | ---: | ---: |
| 20–50 Hz | 47.46% | 56.27% |
| 50–95 Hz | 40.61% | 28.35% |
| 95–200 Hz | 3.20% | 4.43% |
| 200–520 Hz | 1.19% | 0.95% |
| 520–4,000 Hz | 7.48% | 9.93% |

This is stronger evidence for a **kick/shell tonal-balance discrepancy**
than for a generic lack of higher frequencies. The Tone.js drums have
relatively more very-low-frequency power and less 50–95 Hz power. Do not
solve this by increasing global master EQ.

## Level, dynamic behaviour, and event windows

- Full-mix RMS: Revised `0.276011`; Tone.js `0.182849`.
  Tone.js is about 3.57 dB lower in RMS before loudness matching.
- Full-mix mono peak: Revised `0.942452`; Tone.js `0.732103`.
- Low 24–95 Hz late/early RMS: Revised `0.5888`; Tone.js `0.6153`.
- First strike low-frequency peak movement, in Hz:
  Revised `41.75 → 50.54 → 57.13 → 57.13`;
  Tone.js `41.75 → 50.54 → 57.13 → 60.79`.
- 520–4000 Hz, window 115–230 ms / first-35-ms attack:
  Revised `0.186`; Tone.js `0.462`.
- 520–4000 Hz, window 480–630 ms / first-35-ms attack:
  Revised `0.492`; Tone.js `0.688`.
  These two windows measure different parts of the event and must not
  both be labeled 'pre-step noise' without specifying the time window.

## Recommendations, in order

1. Export reproducible **isolated kick, shell, beater, kick-body, snare,
   snare-roll, sub-bass and brass stems**, pre-master as well as post-master.
   The current Tone.js offline renderer solos *buses*, not those individual
   voices. Compare each stem in identical onset windows.
2. Tune the Tone.js kick/shell energy split in 20–50 vs 50–95 Hz before
   adding another layer. Check shell gain and trajectory against the
   Revised shell's 36→59 Hz rising resonance, faint second harmonic and
   4.8 Hz modulation.
3. For 200–520 Hz, inspect the sub-bass's 2nd harmonic and the missing
   short reflected component. Revised uses saturating bass and short
   early reflections; Tone.js uses a sine-based MonoSynth and no
   equivalent reflections. Test **one isolated, level-controlled change**
   at a time, then re-render.
4. Measure snare-wire buildup separately. The Tone.js 480–630 ms
   high-band tail is relatively stronger than Revised, and an unchanging
   NoiseSynth envelope is not equivalent to Revised's ~18 Hz strokes.
5. Keep deterministic test conditions where possible, document noise
   randomness, compare at matched playback RMS, and keep the two-bar
   percussion-only test as the first regression target. Preserve the
   baseline before tuning the sound.

No claim of a perceptual/timbre match is made without a controlled listening
comparison. No musical parameters were changed as part of this measurement.
