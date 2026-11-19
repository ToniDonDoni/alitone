# Missing march-footstep impact: Revised vs Tone.js

## Observation and source

The Revised page has no standalone "footstep" instrument. The heavy impact
is synthesized mainly in `kick(context, seed)`, with a swept 33+177 Hz skin,
a 1.86x pitched rim harmonic, a 193 Hz band-pass noise-body, two short
beater bands (720 and 1880 Hz), and `tanh` saturation applied to the
combined voice. Its `snare` also uses short pitched wire modes.

Tone.js originally split these parts into independent upstream
`MembraneSynth` and `NoiseSynth` voices. The resulting higher
mid-frequency tail immediately after the kick was weaker, even when
the broad low-frequency shell and loudness matched.

The new `Step` track is an additional creative approximation of a
boot/heel impact rather than a claim that Revised literally contains
another instrument. It uses upstream `Tone.MembraneSynth` for a short
swept resonant heel and upstream `Tone.NoiseSynth` with two band-pass
filters for the sole/wood/clack texture. The two are routed to **one
dedicated voice gain** so a single click or touch mutes both together.
It is triggered 12 ms after every footfall and has its own event block
in the arrangement view.

## Measured results at 80 BPM

Mono-mixed 48 kHz Web Audio renders, three footfalls at 0, 0.75, and
1.5 seconds. RMS in the 50–150 ms window **after** each footfall,
averaged across the three. Tone stereo onset corrected by 20 ms.

| Frequency range | Revised | Tone BEFORE | Tone with Step | Before/reference | With Step/reference |
| --- | ---: | ---: | ---: | ---: | ---: |
| 95–200 Hz | 0.0325 | 0.0065 | 0.0124 | 20% | 38% |
| 200–520 Hz | 0.0253 | 0.0041 | 0.0080 | 16% | 32% |
| 520–1400 Hz | 0.0211 | 0.0058 | 0.0120 | 27% | 57% |
| 1400–4000 Hz | 0.0263 | 0.0099 | 0.0120 | 38% | 46% |

Step approximately **doubles the missing 95–520 Hz footfall tail**
relative to the prior Tone version. It does **not** eliminate the gap
or guarantee the listener perceives the same sound.

Full mix for the new Tone at 80 BPM: RMS 0.2708 (Revised 0.2760),
95–520 Hz spectral share 3.1936% (Revised 5.3386%), 520–4000 Hz
6.5322% (Revised 6.9626%).

## Regression checks

- Standalone HTML is rebuilt at `references/march-of-the-fallen-tone.html`.
- Lint passed and the Chrome audio-compare workflow passed.
- The added Step stem rendered at non-zero level and produced **zero PCM**
  when `mutedTracks: ["step"]` was applied to the offline graph.
- All 13 voice gains and arrangement tracks remain independently muteable.
- Existing playhead image/pixel movement, scheduling alignment, 320px mobile
  layout, input events, and offline network isolation are verified.
- Re-run: `CHROME_PATH=/usr/bin/google-chrome node tools/check_tone_page.mjs --stems`,
  `python3 tools/compare_step_transients.py`.

Successful run: https://github.com/ToniDonDoni/alitone/actions/runs/44438929156
Source commit: https://github.com/ToniDonDoni/alitone/commit/b8741bc166ce18f3837dd33eb0fbf7400946de81

This comparison uses rendered PCM and source code, not a claim of
personally hearing the audio. A final perceptual A/B test remains useful.
