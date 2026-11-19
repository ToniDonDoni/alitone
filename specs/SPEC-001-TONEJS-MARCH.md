# 001 — Port March of the Fallen to Tone.js

## Current state

- [SPEC-ORIGINAL.md](SPEC-ORIGINAL.md) defines a dark industrial military march in strict 2/4. Low percussion leads, followed by sub-bass and low brass. The original brief called for 108 BPM. The revised page defaults to 80 BPM, close to the opening pulse of the reference.
- [march-of-the-fallen-revised.html](../references/march-of-the-fallen-revised.html) is the accepted starting point. It is a standalone Web Audio page with procedural voices and a 16-bar arrangement that repeats. An earlier version is also available for comparison.
- [march_of_fallen.mp3](../references/march_of_fallen.mp3) is the listening reference. [The comparison notes](../analysis/SPEC-001-COMPARISON.md) document the onset alignment, spectrum and envelopes. The first strong footfall has a short attack followed by a low resonance that rises from roughly 41 to 58 Hz over the measurement windows. The current page approaches that movement, with less energy at 95–520 Hz and a stronger snare-wire buildup before the next footfall.
- [Tone.js 15.1.22](../thirdparty/UPSTREAM-TONEJS.md) is available locally as a pinned Git submodule, with the matching published browser build documented.

## Desired state

**Tone.js generates the music.** The new self-contained HTML page uses the pinned local Tone.js source to synthesize every audible layer of the march in real time: the drum strike and rising shell, toms, snare and wire roll, sub-bass, low brass, and industrial textures. Tone.js schedules the arrangement and drives both its built-in instruments and the custom shell voice built with Tone.js nodes. The march plays indefinitely after the first click.

Use the MP3 as the reference for tuning the synthesized voices. Keep the current HTML alongside the new page for A/B comparison.

Give each voice its own named preset with pitches, envelopes, filter settings, and mix level. Keep the arrangement and voice settings separate so the same two bars can be rendered with two presets while holding timing constant. Carry over the 80 BPM default, the 40–160 BPM slider, the change at the next bar, and the play, stop, volume, and mute behavior.

## Proposed solution

### Voices and initial settings

These settings are starting points. Envelope times are in milliseconds unless otherwise stated. Gain offsets are first-pass channel trims after setting comparable nominal voice levels. Retune from the drum bus outward.

| Voice | Tone.js building blocks | Initial patch and role |
| --- | --- | --- |
| Bass drum, beater | [MembraneSynth](../thirdparty/tone_15_1_22/Tone/instrument/MembraneSynth.ts) plus [NoiseSynth](../thirdparty/tone_15_1_22/Tone/instrument/NoiseSynth.ts) and band-pass filters | Center on every footfall. Sine, target 33 Hz, `octaves: 5.8` (~191 Hz start in this tag), `pitchDecay: 0.023` s. Start with 1 ms attack, 60 ms decay, zero sustain. Add a separate 14–20 ms noise strike through bands near 720 and 1,880 Hz. A quiet body branch near 193 Hz can add weight. |
| Bass drum, shell | [Oscillator](../thirdparty/tone_15_1_22/Tone/source/oscillator/Oscillator.ts), frequency automation and [Gain](../thirdparty/tone_15_1_22/Tone/core/context/Gain.ts) | Start 52 ms after the beater. Use a sine that starts at 36 Hz and approaches 59 Hz with a 170 ms time constant. Start with a 37 ms gain-rise time constant, decay time constant of 0.48 beat, and a fade at 0.84 beat. Start its peak trim about 1 dB below the beater. Optionally add a weak second harmonic if the shell lacks body. |
| Low tom | MembraneSynth | Sine with a 68 Hz target, `octaves: 1.74` (~118 Hz start), 29 ms pitch decay, 2 ms attack, 94 ms decay, zero sustain. Set roughly −9 dB relative to the kick for offbeats and short fills. |
| Snare strike and wire roll | Two NoiseSynth voices with separate filters and envelopes | Strike first: white noise, 1–3 ms attack, about 34 ms decay, zero sustain. Add a softer flam 12 ms after the strike. Roll: combine bands near 705 and 1,690 Hz, with Q about 1.15 and 1.35 respectively. Start about 0.17 beat after each strike, grow over about 0.82 beat, and taper into the next step. Start the roll quietly and tune its rise against the reference. |
| Sub-bass | [MonoSynth](../thirdparty/tone_15_1_22/Tone/instrument/MonoSynth.ts), optional mild saturation | Sine, centered. Use B-flat1 (~58.3 Hz) on selected steps in the first half and a C2 (~65.4 Hz) pedal in the second half. Start with 65 ms attack for pulses, 110 ms attack for the pedal, and roughly 50 ms release. Start the filter envelope near 145 Hz with a small opening range. Set the strongest sub accents about −6 dB relative to kick, then trim by ear. |
| Low brass | [FMSynth](../thirdparty/tone_15_1_22/Tone/instrument/FMSynth.ts) and low-pass filter | Sine carrier and sine modulator, harmonicity 2, modulation index 1.2, filter around 680 Hz. Start with amplitude attack 40 ms, decay 120 ms, sustain 0.65, release 60 ms. Use short B-flat1 and C2 replies with the existing occasional B1 tension note. Start around −16 dB relative to kick. |
| Metal and rumble | [MetalSynth](../thirdparty/tone_15_1_22/Tone/instrument/MetalSynth.ts) for accents, filtered NoiseSynth for the bed | Try a short, quiet clang from a 70 Hz fundamental, with about 70 ms decay, low modulation index (start at 2), and a low-pass filter around 2.4 kHz. Start the rumble with quiet noise filtered to roughly 38–95 Hz and fade it in and out over about 2.4 s. |

In the pinned release, `MembraneSynth.octaves` is a multiplier applied to the trigger frequency. Its built-in ramp runs down from the higher starting frequency. The shell's upward curve is a separate Tone oscillator with scheduled frequency automation. The listed time constants for the shell describe the target curve, while the ADSR values are initial patch settings.

### Arrangement, mix, and delivery

- Port the revised page's event pattern before changing the score. Retain two quarter-note footfalls per bar, quiet variations between them, and the bass accents on zero-based steps 1, 4, 7, and 9 of the 16-footfall opening section. The next eight bars use the low C pedal beneath the same marching pulse.
- Set the Tone Transport time signature to 2/4 and use the callback's audio time for note events. Schedule pending BPM changes on the next bar. Route voices to separate percussion, bass, brass, and texture buses. Start with the current dark master response, approximately 2.9 and 3.5 kHz low-pass stages, gentle compression, and peak protection. Keep the low end centered and use small stereo offsets for wire, tom, and metal details.
- Build the browser bundle from the pinned local TypeScript snapshot. Use the checked-in TypeScript and Webpack build steps without upstream's release-version increment step, which queries npm. Keep the vendored snapshot intact by building in a separate workspace. Embed the resulting bundle and its license notices in the standalone output. Keep voice settings and the arrangement readable in the project's source. Use the same voice definitions and event pattern for real-time playback and offline renders, with a separate audio context for offline work.
- Evaluate the percussion-only render first. Then add bass and brass, and run a level-matched A/B with the reference MP3 and the current page. Tune the beater, shell, and roll independently before adjusting the master. Inspect the spectrum and envelopes of rendered audio. Use filter frequency response only to check filter behavior.

## Acceptance criteria

- [ ] The new HTML opens from a local file with networking disabled. Play, stop, mute and volume work. The march continues across the 16-bar boundary with no missing beat or audible click. Tempo defaults to 80 BPM, supports 108 BPM within the 40–160 range, and changes on a bar boundary.
- [ ] The page embeds the bundle built from the pinned local source tree. The audible signal for every layer originates in the Tone.js playback graph. It uses MembraneSynth and NoiseSynth for percussion, MonoSynth for sub-bass, FMSynth for brass, and MetalSynth and filtered NoiseSynth for the industrial textures. The kick includes the independently scheduled Tone oscillator for the rising shell. Soloed voice renders or inspection of the live graph demonstrate that these voices produce the sound. The shipped playback requires no MP3, prerecorded samples, or remote resources.
- [ ] Each voice has editable parameters in the project source. Changing one patch while holding the score fixed can produce a new two-bar render. The first four beats can be rendered as percussion only and as a full mix, allowing a direct comparison.
- [ ] Use the same measurement windows and onset alignment as [the existing comparison script](../tools/compare_audio.py). As initial acceptance targets, the first step rises from about 38–46 Hz to 54–62 Hz, late-to-early low-band RMS is at least 0.59, and pre-step noise relative to the strike is between 0.30 and 0.49. Over the same opening 7.4 s, aim for 520–4,000 Hz energy within one percentage point of the reference's 7.52%. Inspect the 95–520 Hz band during tuning too. Document the final measurements.
- [ ] Stereo renders at 80 and 108 BPM cross the loop boundary and remain below full scale. In the matched-level listening comparison, the two-foot pulse, thick drum tail, and pre-step roll are clear. The drums lead the mix, with the sub behind them and quiet low-brass answers. Ask for listening sign-off before calling the timbre match complete.

## To-do

- [ ] Implement the Tone.js port and save it as a separate HTML page.
- [ ] Port the exact cadence and build the initial voice presets above.
- [ ] Render two bars of percussion and tune the beater, upward resonance, tom, and snare roll against the reference.
- [ ] Add sub-bass, brass, metal, and rumble. Tune the full mix and check the later pedal section.
- [ ] Verify standalone playback, tempo changes, continuity, and the comparison metrics. Deliver the new page and the A/B findings for listening.
