# Revised vs Tone.js Spectrum Analysis

## Method

This compares the rendered music output, not a filter's transfer-function response. A true filter frequency-response measurement needs a known test input such as a sweep. The two pages were rendered at 80 BPM and compared over the first 7.4 seconds using the same Welch power-spectrum bands and onset windows as `tools/compare_audio.py` and `tools/compare_tone.py`. The Tone.js stereo render is downmixed to mono for these measurements. Band shares are normalized to total 20–18,000 Hz power, so the table describes spectral balance rather than playback loudness.

## Baseline before the kick-body voice

| Band | Revised page | Tone.js before patch | Difference, Tone − Revised |
| --- | ---: | ---: | ---: |
| 20–95 Hz | 87.65% | 88.21% | +0.56 percentage points |
| 95–520 Hz | 5.34% | 4.95% | −0.39 percentage points |
| 520–4,000 Hz | 6.96% | 6.80% | −0.16 percentage points |
| 4,000–18,000 Hz | 0.05% | 0.05% | approximately even |

The smaller sub-bands showed the main shape difference: Tone.js had more 20–50 Hz energy (40.87% vs 37.56%) and less 50–95 Hz energy (47.34% vs 50.09%). In the 95–520 Hz band, the largest deficits were around 200–520 Hz. Tone.js's low-frequency peak movement was already close to Revised: 41.7 → 50.5 → 57.1 → 60.1 Hz vs 41.7 → 50.5 → 57.1 → 57.1 Hz.

Other matched-window metrics were close: low-band late/early RMS was 0.61 for Tone.js and 0.59 for Revised; pre-step noise/strike was 0.44 and 0.49 respectively. Both pages were below the MP3 reference's 9.53% share in 95–520 Hz, so the difference between the pages is smaller than their shared gap to the recording.

## One patch tried: short kick-body noise

Tone.js now adds a separate white-noise voice on every footfall, filtered at 193 Hz (Q 1.15), with a 47 ms decay. This mirrors the narrow kick-body component in `tools/build_revision.py` while keeping the original Tone.js kick, shell, rhythm, bass and master settings intact. The controls are `bodyHz`, `bodyQ`, `bodyDecay`, `bodyVelocity` and `bodyTrimDb` in `src/march-tone.js`.

| Band | Revised | Tone.js before | Tone.js with kick body |
| --- | ---: | ---: | ---: |
| 20–95 Hz | 87.65% | 88.21% | 88.39% |
| 95–520 Hz | 5.34% | 4.95% | 4.83% |
| 520–4,000 Hz | 6.96% | 6.80% | 6.74% |
| 4,000–18,000 Hz | 0.05% | 0.05% | 0.05% |

The change did not move the full-mix 95–520 Hz share toward Revised in this render. The band remains 0.51 percentage points lower, so the insert is not yet a measured spectral fix. In the two-bar percussion-only renders, Tone.js has 5.65% in 95–520 Hz while Revised has 4.34%; this points to the full-mix bass/brass balance as a larger source of the remaining gap than the percussion bus alone. The pre-step ratio is 0.47, the low late/early ratio is 0.61, and the low peaks are 41.7 → 50.5 → 57.1 → 60.8 Hz. A/B listening is still needed to judge whether the new kick body improves the perceived weight despite the small aggregate change.

## Mix level and next experiment

The saved 7.4 s Tone.js render has RMS 0.1855 vs 0.2760 for Revised (about 3.45 dB lower); match playback loudness before judging timbre. Do not change the master EQ based on these results: 520–4,000 Hz is already within one percentage point of the MP3 target, and the high band is close to Revised.

If the new body is not audible, check its solo contribution and level before adding more layers. The next useful isolated experiment would be a low-level harmonic branch from the sine sub-bass, since the Tone.js sub currently has fewer upper harmonics than a mildly saturated bass voice. Keep the 193 Hz kick-body patch fixed while evaluating that next change.

## Reproducibility

```sh
python3 tools/compare_audio.py
python3 tools/compare_tone.py
```

Offline renders and comparison inputs are stored in `output/renders/`.
