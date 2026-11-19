# Tone.js Port — Implementation and Acceptance Results

## Delivered

- `references/march-of-the-fallen-tone.html` is a separate self-contained page. It embeds the JavaScript bundle compiled from the pinned local Tone.js 15.1.22 TypeScript snapshot and the project synthesis code. It contains no MP3, prerecorded samples, CDN, or remote script.
- `src/march-tone.js` keeps named patch settings separate from the repeating arrangement. Live playback and `Tone.Offline` use the same `scheduleBar` function. The kick now has an additional short 193 Hz filtered-noise body voice, independently levelled from its beater and shell.
- `src/vendor/Tone-15.1.22.js` is the release bundle built from the Tone.js Git submodule at `thirdparty/tone_15_1_22/`, pinned to commit `d2d52ffa8803b35debd9f19f2da08ad1c3540de0`. The temporary build copy used the upstream `ts:build` and `webpack:build` scripts, skipped the network-dependent version-increment script, and set the Git snapshot's `version.ts` metadata from `dev` to `15.1.22`.
- The accepted Web Audio page and reference MP3 remain available for A/B comparison.

## Acceptance checklist

- [x] Local-file playback with networking disabled; no HTTP requests were observed.
- [x] Play, stop, mute, restored volume, 80 BPM default, 40–160 BPM slider, and tempo change from 80 to 108 BPM at the next bar.
- [x] Tone Transport runs in 2/4. The two-foot pulse and the 16-bar arrangement repeat indefinitely.
- [x] Live graph contains `MembraneSynth`, `NoiseSynth`, `Oscillator`, `MonoSynth`, `FMSynth`, and `MetalSynth`, with separate percussion, bass, brass, and texture buses.
- [x] Two-bar (four quarter-note) percussion-only and full-mix renders use the same score and voice definitions. The solo buses render audible drums, bass, brass, and textures.
- [x] Stereo 80 and 108 BPM renders cross the 16-bar boundary. Peak levels remain below full scale. RMS on the two sides of the boundary is similar.
- [x] Reference analysis completed with the same FFT bands, onset alignment, and time windows as `tools/compare_audio.py`.
- [ ] Subjective timbre A/B sign-off: pending the user's listening. The numeric criteria pass, but the spec requires listening approval before calling the timbre match complete.

## Reference comparison

Measurements use the opening 7.4 seconds and 80 BPM. The reference values are taken from the trimmed MP3. The Tone.js first strike begins at 0.02 seconds; the reference onset alignment is unchanged from `tools/compare_audio.py`.

| Metric | Reference MP3 | Tone.js 80 BPM | Result |
| --- | ---: | ---: | --- |
| First-strike low peaks | 41.0 → 48.3 → 54.2 → 57.9 Hz | 41.7 → 50.5 → 57.1 → 60.8 Hz | Within the specified first/last frequency ranges |
| Late-to-early low-band RMS | 0.67 | 0.61 | Passes the ≥0.59 target |
| Pre-step noise / strike RMS | 0.17 in this measurement window | 0.47 | Passes the specified 0.30–0.49 target |
| 520–4,000 Hz energy share | 7.52% | 6.74% | 0.78 percentage points below reference; within 1 point |
| 95–520 Hz energy share | 9.53% | 4.83% | Inspected; still lower than reference |
| Stereo peak | — | 0.732 | Below full scale |
| RMS immediately before/after 16-bar boundary | — | 0.186 / 0.202 | Similar levels; no cycle dropout in the render |

At 108 BPM the 520–4,000 Hz share is 6.98%, peak is 0.732, and boundary RMS is 0.196 / 0.198.

The isolated 193 Hz kick-body voice is now in the Tone.js patch. The full-mix 95–520 Hz share remains low, so this first addition is an audible-design experiment rather than evidence that the band has been matched. See [the Revised-vs-Tone analysis](SPEC-001-REVISED-VS-TONE.md) for before/after numbers and the next tuning suggestion.

## Reproduction

From the project folder:

```sh
python3 tools/build_tone_page.py
node tools/check_tone_page.mjs
python3 tools/compare_tone.py
```

`check_tone_page.mjs` launches Chrome with network access disabled, verifies the standalone page and controls, and writes stereo float32 renders to `output/renders/`. `compare_tone.py` compares the 80 and 108 BPM results with the MP3 reference.
