# TODO: Browser music lab and JavaScript SDK

Build a small local browser studio for shaping a procedural march. Start with the current Web Audio engine. Compare two bars of generated audio with the same part of the reference MP3 at matched loudness.

## First experiment

- [ ] Expose separate drum, snare roll, sub-bass, brass, and texture tracks with mute, solo, and gain.
- [ ] Add a loop and A/B switching between reference and render. Expose the reference as a separate local input and measure loudness for the same region.
- [ ] Add tone and envelope controls for each voice. Start with drum attack, initial pitch, resonance sweep, decay, and snare-wire buildup. Save and reload a preset as JSON.
- [ ] Compare a short Tone.js prototype against the existing Web Audio clock, voices, and offline renderer. Use Tone.js for useful sequencing or effects and keep the current custom drum voices available.
- [ ] If realistic low brass is needed for comparison, try SpessaSynth with a suitably licensed local instrument bank. Treat it as an optional comparison voice. The procedural march remains independently playable.
- [ ] Render from the same state via `OfflineAudioContext` and compare onset times, envelope shape, low pitch movement, band energy, and peak or loudness. Keep the final A/B judgment audible.
- [ ] For analysis views, use `AnalyserNode` for live spectrum and `BiquadFilterNode.getFrequencyResponse()` for the exact response of a filter. Measure chains of linear effects with a sweep. For instrument or nonlinear-effect comparisons, keep the note, velocity, modulation, and input level fixed and measure the actual render.

## Optional MCP bridge

Use a local Node.js MCP server with the official TypeScript SDK. The server can accept structured operations from the agent and pass studio actions to the browser via loopback WebSocket. Keep the web studio usable directly in the browser too.

Prototype `create_instrument`, `set_instrument_parameter`, `create_effect_chain`, `set_filter_frequency`, `render_audio`, `analyze_spectrum`, `get_frequency_response`, and `compare_audio_versions`. Use explicit ranges and units for parameters. Try a render → measure → adjust loop with a bounded parameter search and a short list of A/B candidates.

- [Tone.js](https://tonejs.github.io/) and [documentation](https://tonejs.github.io/docs/)
- [SpessaSynth](https://github.com/spessasus/spessasynth_lib) and [documentation](https://spessasus.github.io/spessasynth_lib/index.html)
- [Web Audio AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode) and [filter frequency response](https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode/getFrequencyResponse)
- [Official MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
