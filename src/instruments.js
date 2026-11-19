/*
 * March of the Fallen: local instrument adapters.
 *
 * Instrument implementations: https://github.com/Tonejs/Tone.js
 * Version: 15.1.22, pinned commit d2d52ffa8803b35debd9f19f2da08ad1c3540de0
 * Source checkout: thirdparty/tone_15_1_22/Tone/
 * Upstream license: MIT (thirdparty/tone_15_1_22/LICENSE.md)
 *
 * These are intentionally thin adapters, not forks or copies of Tone.js DSP.
 * The complete Tone.js runtime is built from the pinned TypeScript submodule
 * by tools/build_tone_bundle.py, then embedded into the standalone HTML.
 * Customize the project's voices here without changing upstream classes.
 */
(() => {
  "use strict";
  const T = window.Tone;
  if (!T) throw new Error("Load the pinned Tone.js bundle before instruments.js");

  class Kick extends T.MembraneSynth {}
  class Beater extends T.NoiseSynth {}
  class KickBody extends T.NoiseSynth {}
  class Footstep extends T.MembraneSynth {}
  class StepSurface extends T.NoiseSynth {}
  class Shell extends T.Oscillator {}
  class Tom extends T.MembraneSynth {}
  class Snare extends T.NoiseSynth {}
  class SnareBody extends T.MembraneSynth {}
  class SnareRoll extends T.NoiseSynth {}
  class SubBass extends T.MonoSynth {}
  class LowBrass extends T.FMSynth {}
  class MetalAccent extends T.MetalSynth {}
  class Rumble extends T.NoiseSynth {}

  window.MarchInstruments = Object.freeze({
    Kick, Beater, KickBody, Footstep, StepSurface, Shell, Tom, Snare, SnareBody,
    SnareRoll, SubBass, LowBrass, MetalAccent, Rumble
  });
})();
