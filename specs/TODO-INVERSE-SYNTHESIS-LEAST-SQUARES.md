# TODO: Inverse synthesis with nonlinear least squares

**Status:** Proposed experiment, not implemented. Start with one instrument and a 16-second reference segment. Do not replace the existing Tone.js synthesizer or arrangement until measured results justify it.

## Problem

Manual sound matching across many Tone.js instrument patches, note velocities, and timing offsets is slow. A large non-negative matrix factorization (NMF) dictionary would introduce many templates and large intermediate matrices. Test a smaller, render-driven inverse-synthesis approach that reuses the existing instrument definitions and an off-the-shelf nonlinear least-squares solver.

**Goal:** Given a reference audio segment, recover approximate instrument parameters and timing/activity such that an offline Tone.js render resembles it both numerically and by ear.

## Proposed fitting pipeline

- [ ] Select a 16-second excerpt of `references/march_of_fallen.mp3`; fix the sample rate and channel convention. Keep an untouched reference and a reproducible comparison report.
- [ ] Estimate the initial temporal alignment from an onset or amplitude-envelope cross-correlation peak (`argmax`). Search only a plausible lag range. This is a *time shift*, not necessarily the phase of every waveform component.
- [ ] Pick an initial instrument/patch approximation by listening and comparing the current rendered spectrum and envelope. Start with a deterministic voice such as `tom` or `kick`, then try `roll`.
- [ ] Expose five meaningful, bounded continuous patch controls for the first voice (for example filter cutoff, Q, attack, decay, and level). Define their units, bounds, normalization, and a repeatable baseline preset. Some voices may need different controls.
- [ ] Render candidates through `MarchLab.renderOffline({ isolatedVoice: voice, solo: voice, sampleRate: 48000, ... })` in headless Chromium. Use the existing Tone.js sound engine, not a second reimplementation in Python or C++.
- [ ] Compute a residual vector from onset-aligned reference and generated audio. Start with multi-resolution STFT magnitude/log-magnitude and envelope differences; test loudness normalization and band weighting. Do not blindly compare raw waveform samples when noise and minute phase shifts dominate the error.
- [ ] Use `scipy.optimize.least_squares` with parameter bounds and numerical finite differences. The solver lives in Python; Node.js/Chromium handles rendering. Compare with `scipy.optimize.minimize` only if the loss cannot naturally be represented as a residual vector. Ceres/C++ is optional only after identifying a real performance bottleneck.
- [ ] Jointly refine a small global time offset and five sound controls, or alternate alignment and parameter fitting. Report objective loss before/after and retain audible A/B examples.
- [ ] Extend to per-note activation/velocity only after the single-instrument fit works. At zero activity the gradient with respect to that instrument's filter parameters is zero, while the activation gradient can be nonzero; first enable activity or use small positive initial activity, then tune its filters. Do not assume simultaneous zero initialization can change filter settings.
- [ ] Test several initial presets and held-out excerpts to detect local minima and avoid improving only one reference window.
- [ ] Preserve reproducibility: freeze noise realizations when taking finite differences if possible, or compare stable spectral statistics/use repeated renders. `SnareRoll` uses white noise, so two renders need not be sample-identical.
- [ ] Measure optimization cost, quality, memory, and wall time before considering 50 instruments or longer recordings. Investigate caching unaffected notes/segments and reusing fixed template layers; do not cache a render after changing parameters that affect its audio.

## Initial cost model and questions

For five tunable sound parameters, a central finite-difference Jacobian needs two perturbed renders per parameter plus a baseline, approximately **11 render evaluations per Jacobian** before any additional solver work. With many individual note velocities, the parameter count rises; prefer staged optimization, sparsity, and pre-rendered stable features rather than immediately optimizing a dense instrument-by-time matrix.

This is **not yet a timing estimate for the optimizer**: solver iterations, residual computation, random-noise variance, changing note schedules, and cross-process round trips have not been measured. First test whether the fit converges and whether its audible result improves.

## Analysis already completed: 16-second Tone.js benchmarks

Two real GitHub Actions benchmarks, on the `march-of-the-fallen` PR branch:

1. [First benchmark, whole graph created and scheduled (run 44534818112)](https://github.com/ToniDonDoni/alitone/actions/runs/44534818112): `solo` muted other instruments, but the renderer still instantiated and scheduled **all 13 voices**. Every solo output took about **5.5-5.6 s** for 16 s of audio; this was **not** a valid isolated-instrument cost measurement.
2. [Corrected, truly isolated voice benchmark (run 44541795882)](https://github.com/ToniDonDoni/alitone/actions/runs/44541795882): the renderer created and scheduled only the selected voice and its necessary layers, plus the shared master and room-effect chain. Every voice was measured **three times**, with median render times (seconds):

   | Voice | Median s | Voice | Median s |
   | --- | ---: | --- | ---: |
   | kick | 0.452 | beater | 0.531 |
   | kickBody | 0.491 | step | 0.661 |
   | shell | 1.153 | snare | 0.617 |
   | snareBody | 0.452 | roll | 1.871 |
   | tom | 0.409 | sub | 0.583 |
   | brass | 0.696 | metal | 1.187 |
   | rumble | 0.502 | | |

The corrected benchmark verified the **instrument-node inventory** during rendering, rather than relying on an inaudible solo gain. Configuration: **headless Chromium, Node.js 22, 48 kHz, stereo, 80 BPM, exactly 16.0 s output, three measurements per voice**. This is hardware- and implementation-dependent; the shared effects still contribute to the cost.

[Corrected benchmark artifact](https://github.com/ToniDonDoni/alitone/actions/runs/44541795882) is named `tone-offline-16s-timings` and contains `tone-offline-16s.json`, `tone-offline-16s.csv`, and `tone-offline-16s.md`. Artifacts are retained for 30 days; the workflow logs and source remain accessible separately.

The `roll` source is a `Tone.NoiseSynth` (white noise) with **two band-pass filters**, a swell gain, and a **384-point gain curve per roll trigger**, not a single cached audio sample. Its 1.871 s benchmark is for the **complete 16-second rendered excerpt including its repeated rolls and shared processing**, not per hit. Which of noise generation, the 384-point automation, filtering, and shared effects dominates has **not** yet been profiled.

### CI/CD commands and reproducibility

Implementation:
- [Benchmark workflow](../.github/workflows/benchmark-tone-offline.yml) is triggered by pushes to `march-of-the-fallen` and by manual `workflow_dispatch`.
- [Benchmark runner](../tools/benchmark_tone_offline.mjs) launches headless Chromium, uses the page's `MarchLab.renderOffline`, samples the rendered PCM to confirm non-silence, validates that only the expected instrument nodes exist, and records browser `performance.now()` elapsed time.
- [Renderer and instruments](../src/march-tone.js) and [Tone.js wrappers](../src/instruments.js).
- [Full browser/audio comparison CI (run 44541796022)](https://github.com/ToniDonDoni/alitone/actions/runs/44541796022) passed after isolation changes.
- [Earlier benchmark implementation commit](https://github.com/ToniDonDoni/alitone/commit/6940dd662cfe937ba061d735bbb47cb9868b9a10) and [isolated-render implementation commit](https://github.com/ToniDonDoni/alitone/commit/fd068125cd0692474f0fef8fe527ae8a41b88c78).

Run on a machine with Google Chrome installed, after checkout and setup:

```sh
python3 tools/build_tone_page.py
CHROME_PATH=/usr/bin/google-chrome node tools/benchmark_tone_offline.mjs
```

Output is saved under `output/benchmarks/`. On macOS, set `CHROME_PATH` to the installed Google Chrome binary. The benchmark requires the repo's existing built/vendor Tone.js resources and instrument scripts.

## Acceptance criteria for the first inverse-synthesis proof of concept

- [ ] One reproducible 16-second single-instrument fitting experiment is runnable end-to-end from a documented command.
- [ ] The solver actually calls the unchanged Tone.js synthesis engine for every candidate and logs its exact parameter vector and objective value.
- [ ] Alignment, initial preset, fitted preset, and measured residuals are stored as artifacts, together with an audible A/B example.
- [ ] Repeat runs exhibit stable objective behavior; noise/seed effects are explicitly characterized.
- [ ] Report median wall time per objective evaluation and total fit runtime, plus an honest listening assessment.
- [ ] Keep the existing real-time march playback and full-render CI passing.
