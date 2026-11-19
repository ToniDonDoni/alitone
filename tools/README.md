# Tools

Scripts for building the pages, checking browser behavior, and comparing audio. Run commands from the project root.

- `build_tone_page.py` assembles the Tone.js standalone page from `src/` and writes `references/march-of-the-fallen-tone.html`.
- `build_revision.py` transforms the original Web Audio page into the revised version and writes the HTML to standard output.
- `check_tone_page.mjs` checks the Tone.js page in offline Chrome and renders its two-bar and loop-boundary audio files into `output/renders/`.
- `check_browser.mjs` checks the revised Web Audio page's controls, tempo changes, and mobile layout. Pass `--render` to create its audio renders in `output/renders/`.
- `compare_audio.py` compares the reference MP3, earlier page, and revised page using the saved renders.
- `compare_tone.py` compares the Tone.js renders at 80 and 108 BPM with the reference MP3.

The audio comparison scripts require Python with NumPy and SciPy plus FFmpeg. Browser checks require Node.js and Chrome; set `CHROME_PATH` if Chrome is not found automatically.
