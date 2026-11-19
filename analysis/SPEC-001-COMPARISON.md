# Reference comparison

The opening accent grid is approximately 80 BPM. The original page used a drum that bent downward and lost much of its low energy between beats. The revision separates the short beater strike from the rising shell resonance. It adds a filtered snare-wire buildup, sub-bass on selected steps, and sparse low-brass replies. In the later section the bass settles around C2 (~65 Hz).

| Metric | Reference MP3 | Earlier page | Revised page |
| --- | ---: | ---: | ---: |
| First strike, four low-frequency peak estimates | 41.0 → 48.3 → 54.2 → 57.9 Hz | 45.4 → 39.6 → 60.1 → 60.1 Hz | 41.7 → 50.5 → 57.1 → 57.1 Hz |
| Late-to-early low-frequency RMS over the first four beats | 0.67 | 0.44 | 0.59 |
| Share of opening energy at 520–4,000 Hz | 7.52% | 3.91% | 6.96% |
| Pre-step noise RMS relative to the attack | 0.37 | 0.23 | 0.49 |

The revised shell follows the reference more closely. The snare-wire buildup still rises higher relative to the attack, and the revised mix has less energy at 95–520 Hz. These are signal measurements. Perceptual matching still requires listening to a level-matched A/B comparison.

Chrome playback was checked with networking disabled. The browser test exercised the tempo slider, live tempo changes at bar boundaries, mute, stop, and the 320 px layout. The revised offline renders at 80 and 108 BPM crossed the arrangement cycle boundary without clipping.

## Reproduce

Run the commands from the project folder. Python comparison requires NumPy, SciPy and FFmpeg. Node.js and Chrome are needed for the browser check. Set `CHROME_PATH` to the Chrome executable if it is not on `PATH` as `google-chrome`.

```sh
python3 tools/compare_audio.py
node tools/check_browser.mjs
node tools/check_browser.mjs --render
python3 tools/build_revision.py | cmp - references/march-of-the-fallen-revised.html
```

`--render` refreshes the revised renders in `output/renders/`. The saved files are mono 48 kHz little-endian float32 PCM. The three revised renders are 3 s of drums at 80 BPM, 26 s of the full mix at 80 BPM, and 42 s of the full mix at 108 BPM. `before-march.f32` is the 24 s earlier render at 80 BPM.

To audition a saved render with a compatible player, specify its input format:

```sh
ffplay -f f32le -ar 48000 -ch_layout mono output/renders/revision-80-full.f32
```


## Tone.js port

See [the Tone.js implementation results](SPEC-001-TONEJS-IMPLEMENTATION.md) for the new standalone page, its 80/108 BPM renders, and the updated reference comparison.
