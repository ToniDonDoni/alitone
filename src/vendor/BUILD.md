# Tone.js Browser Bundle

`Tone-15.1.22.js` was built from the Tone.js 15.1.22 Git submodule at `thirdparty/tone_15_1_22/`, pinned to commit `d2d52ffa8803b35debd9f19f2da08ad1c3540de0`. The build used the upstream `ts:build` and `webpack:build` steps in a temporary copy and omitted the network-dependent `increment` script. The Git tag source contains `version = "dev"`; the temporary build copy sets only that metadata constant to `15.1.22`, matching the published release. It is embedded into the standalone HTML by `tools/build_tone_page.py`.

Upstream source tag: `15.1.22`, commit `d2d52ffa8803b35debd9f19f2da08ad1c3540de0`.

The upstream MIT notice is embedded in the standalone page and also included in `Tone-15.1.22.LICENSE.txt`.
## Rebuilding from the upstream TypeScript sources

`tools/build_tone_bundle.py` reconstructs the browser bundle from the
pinned Git submodule using upstream's `ts:build` and `webpack:build` scripts,
without installing the Tone.js library from npm. It works in a temporary copy
and leaves the upstream sources untouched. See `src/vendor/SOURCE.md`.
After rebuilding the bundle, regenerate the HTML with
`python3 tools/build_tone_page.py`.
