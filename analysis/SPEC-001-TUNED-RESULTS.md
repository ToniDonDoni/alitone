# Tuned Tone.js page: verified result (80 BPM)

This report documents the selected, independently measured version of
`references/march-of-the-fallen-tone.html`. The earlier experiment adding a
second kick rim voice and a separate sub-bass octave did **not** improve the
full-mix spectral match; those changes were removed.

## Scope and reproducibility

- Comparison: `references/march-of-the-fallen-revised.html` against the
  standalone `references/march-of-the-fallen-tone.html`.
- Original successful final-version test: https://github.com/ToniDonDoni/alitone/actions/runs/44427851696
- First baseline test: https://github.com/ToniDonDoni/alitone/actions/runs/44423954020
- 48 kHz PCM, Tone.js starts 20 ms later (offset compensated), 7.4-second
  full mix, 80 BPM. Stereo Tone rendered mix was averaged to mono.
- Welch PSD with 16384-point windows, normalized to 20–18000 Hz energy.

| Metric | Revised | Final Tone.js | Previous Tone.js baseline |
| --- | ---: | ---: | ---: |
| Full-mix RMS | 0.276011 | 0.270532 | 0.182849 |
| 20–95 Hz power (%) | 87.6529 | 90.5161 | 87.9101 |
| 95–520 Hz power (%) | 5.3386 | 3.1134 | 4.7642 |
| 520–4000 Hz power (%) | 6.9626 | 6.3200 | 7.2737 |
| 4000–18000 Hz power (%) | 0.0459 | 0.0506 | 0.0520 |

The final Tone.js mix is 0.17 dB lower in full-mix RMS than Revised,
compared with a 3.57 dB gap at baseline. The 520–4000 Hz relative share is
closer to Revised, but the **95–520 Hz share remains lower**; the result
is not a claim of perfect spectral or perceptual identity.

## Isolated stems, 2.9 seconds

| Voice | Revised RMS | Final Tone.js RMS |
| --- | ---: | ---: |
| Shell | 0.231315 | 0.226479 |
| Snare roll | 0.060803 | 0.064758 |
| Low brass | 0.017753 | 0.017142 |
| Tom | 0.034267 | 0.031120 |
| Metal | 0.005493 | 0.004059 |

For the shell stem, **20–50 Hz / 50–95 Hz** shares are 57.841% / 42.096%
for Revised and 57.740% / 42.257% for Tone.js, measured with the same
band definitions. This strongly supports the revised shell envelope.

## Implemented audio changes

- Shell: an onset-aligned rising bloom, 4.8 Hz tremolo, second harmonic
  and reference-like exponential tail, all scheduled through Tone.js.
- Snare roll: shaped crescendo with ~18 Hz strokes rather than a flat
  noise-envelope swell.
- Early room: three short, band-limited stereo reflection taps.
- Kick: stronger beater and resonant noise-body paths.
- Brass: low-frequency FM voice supported by an upstream Tone.Synth
  partial stack, with its level tuned against the isolated reference.
- Tom, snare, metal, rumble and master dynamics/soft peak guard retuned.
- Individual Tone and Revised voice PCM stems added to browser verification,
  plus the self-contained HTML to CI artifacts.

## Remaining limitations

- Differences in kick transient shape, snare timbre, rumble and 95–520 Hz
  balance remain. These should be assessed by listening, not only PSD.
- Tone.js oscillators and noise sources do not necessarily use the same
  phases/random seeds as Revised. Waveform correlation is not a reliable
  standalone fidelity criterion here.
- Synthesized voices remain composed from pinned, upstream Tone.js 15.1.22
  classes, with local instrument adapters in `src/instruments.js`.
