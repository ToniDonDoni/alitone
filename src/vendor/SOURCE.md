# Project instruments and upstream source

The project-specific instruments are in [src/instruments.js](../instruments.js).
Each named instrument is a minimal JavaScript subclass of a Tone.js instrument.
The existing voice patches and score remain in [src/march-tone.js](../march-tone.js).

The instrument implementations are **not copied or downloaded from npm**.
They remain at the pinned Git submodule:
`thirdparty/tone_15_1_22/Tone/`.
Source: https://github.com/Tonejs/Tone.js
Tag: 15.1.22
Commit: d2d52ffa8803b35debd9f19f2da08ad1c3540de0
License: MIT. The original LICENSE.md remains in the submodule.

To verify and build the browser bundle from TypeScript source:

```sh
git submodule update --init --recursive
python3 tools/build_tone_bundle.py --verify-only
python3 tools/build_tone_bundle.py
python3 tools/build_tone_page.py
node tools/check_tone_page.mjs
```

`build_tone_bundle.py` uses a temporary copy of the source submodule
without modifying it. It executes upstream's TypeScript and Webpack scripts.
By default, `npm ci` installs **build dependencies of the source repository**,
not a published Tone.js library. If development dependencies are already
installed at `thirdparty/tone_15_1_22/node_modules`, use
`python3 tools/build_tone_bundle.py --skip-install` to avoid that step.

The final HTML is still self-contained and does not require a network connection.
