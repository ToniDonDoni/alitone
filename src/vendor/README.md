# Browser Bundle

This folder contains the compiled Tone.js file that the page builder embeds into the standalone HTML. The original Tone.js source lives in the pinned submodule at `thirdparty/tone_15_1_22/`.

- `Tone-15.1.22.js` is the browser bundle consumed by `tools/build_tone_page.py`.
- `Tone-15.1.22.LICENSE.txt` supplies the license notice that the builder inserts into the HTML.
- `BUILD.md` records the source commit and how the bundle was produced.

The bundle lets the generated page run locally without downloading Tone.js. For its provenance, see [`BUILD.md`](BUILD.md).
- `SOURCE.md` explains the original TypeScript sources, local instrument adapters, and source-only build.
