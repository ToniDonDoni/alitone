# Source

This folder contains the editable inputs for the standalone Tone.js page.

- `march-tone.js` defines the procedural instruments, their patches, the repeating march, and live/offline playback.
- `page-template.html` defines the page markup, styling, controls, and insertion points for the bundle and music code.
- `vendor/` holds the compiled Tone.js browser bundle and its license notice; see [`vendor/README.md`](vendor/README.md).

From the project root, run `python3 tools/build_tone_page.py` to rebuild `references/march-of-the-fallen-tone.html` from these files.
