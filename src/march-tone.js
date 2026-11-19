/* Procedural March of the Fallen, built on the vendored Tone.js 15.1.22 source. */
(() => {
  "use strict";

  const T = window.Tone;
  const I = window.MarchInstruments;
  if (!I) throw new Error("MarchInstruments must be loaded before march-tone.js");
  const QUARTER_NOTES_PER_BAR = 2;
  const BARS_PER_PHRASE = 16;
  const BASS_ACCENTS = new Set([1, 4, 7, 9]);
  const PATCHES = {
    kick: {
      targetHz: 33, octaveMultiplier: 6.36, pitchDecay: 0.023,
      attack: 0.001, decay: 0.060, noiseDecay: 0.016,
      beaterBands: [{hz: 720, q: 0.95, trimDb: 16}, {hz: 1880, q: 1.25, trimDb: 12}],
      bodyHz: 193, bodyQ: 1.15, bodyDecay: 0.047, bodyVelocity: 0.80, bodyTrimDb: 20,
      shellStartHz: 36, shellEndHz: 59, shellTau: 0.170,
      shellAttack: 0.037, shellDecayBeats: 0.58, shellFadeBeats: 0.84
    },
    tom: {targetHz: 68, octaveMultiplier: 1.45, pitchDecay: 0.029, decay: 0.094, trimDb: 2},
    snare: {attack: 0.001, decay: 0.034, rollBands: [{hz: 705, q: 1.15}, {hz: 1690, q: 1.35}], rollAttack: 0.001, rollDecay: 0.01, rollSustain: 1},
    sub: {pulseAttack: 0.065, pedalAttack: 0.110, release: 0.050, filterHz: 145},
    brass: {harmonicity: 1, modulationIndex: 2.2, lowpassHz: 680, attack: 0.040, decay: 0.120, sustain: 0.65, release: 0.060, trimDb: -1},
    metal: {frequency: 70, modulationIndex: 2, decay: 0.070, lowpassHz: 2400},
    rumble: {lowHz: 38, highHz: 95, duration: 2.4},
    master: {lowpassHz: 2930, edgeHz: 3510, compressionDb: -7.8, ratio: 3, limitDb: -1.2}
  };

  const db = value => Math.pow(10, value / 20);
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  function seeded(seed) {
    let state = seed >>> 0;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }

  function attach(node, bus, trimDb = 0, pan = 0, routes, panners = null, panKey = null, voiceSolo = null, voiceName = null) {
    const trim = new T.Gain(voiceSolo && voiceSolo !== voiceName ? 0 : db(trimDb));
    const panner = new T.Panner(pan);
    node.connect(trim);
    trim.connect(panner);
    panner.connect(bus);
    routes.push(trim, panner);
    if (panners && panKey) panners[panKey] = panner;
    return node;
  }

  function createGraph(destination, solo = null, volumeScale = 1) {
    const masterA = new T.Filter(PATCHES.master.lowpassHz, "lowpass");
    const masterB = new T.Filter(PATCHES.master.edgeHz, "lowpass");
    const compressor = new T.Compressor({threshold: PATCHES.master.compressionDb, ratio: PATCHES.master.ratio, attack: 0.003, release: 0.135, knee: 10});
    const limiter = new T.Limiter(PATCHES.master.limitDb);
    const peakGuard = new T.WaveShaper(value => {
      const level = Math.abs(value);
      return level <= 0.79 ? value : Math.sign(value) * (0.79 + 0.19 * Math.tanh((level - 0.79) / 0.19));
    }, 4096);
    const output = new T.Gain(volumeScale);
    masterA.connect(masterB);
    masterB.connect(compressor);
    compressor.connect(limiter);
    limiter.connect(peakGuard);
    peakGuard.connect(output);
    output.connect(destination);

    const voiceBuses = {
      kick: "drums", beater: "drums", kickBody: "drums", shell: "drums",
      tom: "drums", snare: "drums", snareBody: "drums", roll: "drums",
      sub: "bass", brass: "brass", metal: "textures", rumble: "textures"
    };
    const selectedBus = voiceBuses[solo] || solo;
    const voiceSolo = voiceBuses[solo] ? solo : null;
    const buses = {
      drums: new T.Gain(selectedBus && selectedBus !== "drums" ? 0 : 1),
      bass: new T.Gain(selectedBus && selectedBus !== "bass" ? 0 : 1),
      brass: new T.Gain(selectedBus && selectedBus !== "brass" ? 0 : 1),
      textures: new T.Gain(selectedBus && selectedBus !== "textures" ? 0 : 1)
    };
    Object.values(buses).forEach(bus => bus.connect(masterA));
    const routes = [masterA, masterB, compressor, limiter, peakGuard, output, ...Object.values(buses)];

    // Band-limited early reflections match the reference's three short room taps.
    const room = new T.Filter({frequency: 980, type: "bandpass", Q: 0.5});
    Object.values(buses).forEach(bus => bus.connect(room));
    routes.push(room);
    for (const [delayTime, level, pan] of [[0.018, 0.26, -0.88], [0.032, 0.23, 0.9], [0.057, 0.11, -0.65]]) {
      const delay = new T.Delay(delayTime, 0.1);
      const gain = new T.Gain(level);
      const panner = new T.Panner(pan);
      room.connect(delay);
      delay.connect(gain);
      gain.connect(panner);
      panner.connect(masterA);
      routes.push(delay, gain, panner);
    }
    const panners = {};
    const instruments = {};

    instruments.kick = new I.Kick({
      pitchDecay: PATCHES.kick.pitchDecay,
      octaves: PATCHES.kick.octaveMultiplier,
      oscillator: {type: "sine"},
      envelope: {attack: PATCHES.kick.attack, decay: PATCHES.kick.decay, sustain: 0, release: 0.015}
    });
    instruments.kick.volume.value = 1;
    attach(instruments.kick, buses.drums, -1, 0, routes, panners, "kick", voiceSolo, "kick");
    // The reference kick has a short membrane mode at 1.86 times the swept pitch.
    instruments.kickRim = new I.Kick({
      pitchDecay: PATCHES.kick.pitchDecay,
      octaves: PATCHES.kick.octaveMultiplier,
      oscillator: {type: "sine"},
      envelope: {attack: 0.001, decay: 0.047, sustain: 0, release: 0.01}
    });
    instruments.kickRim.volume.value = -7;
    attach(instruments.kickRim, buses.drums, -1, 0, routes, null, null, voiceSolo, "kick");

    instruments.beater = new I.Beater({
      noise: {type: "white"},
      envelope: {attack: 0.001, decay: PATCHES.kick.noiseDecay, sustain: 0, release: 0.006}
    });
    instruments.beater.volume.value = 2;
    for (const band of PATCHES.kick.beaterBands) {
      const filter = new T.Filter({frequency: band.hz, type: "bandpass", Q: band.q});
      instruments.beater.connect(filter);
      attach(filter, buses.drums, band.trimDb, 0, routes, null, null, voiceSolo, "beater");
      routes.push(filter);
    }

    instruments.kickBody = new I.KickBody({
      noise: {type: "white"},
      envelope: {attack: 0.001, decay: PATCHES.kick.bodyDecay, sustain: 0, release: 0.01}
    });
    const kickBodyFilter = new T.Filter({frequency: PATCHES.kick.bodyHz, type: "bandpass", Q: PATCHES.kick.bodyQ});
    instruments.kickBody.connect(kickBodyFilter);
    attach(kickBodyFilter, buses.drums, PATCHES.kick.bodyTrimDb, 0, routes, null, null, voiceSolo, "kickBody");
    routes.push(kickBodyFilter);

    instruments.shell = new I.Shell(PATCHES.kick.shellStartHz, "sine");
    instruments.shellGain = new T.Gain(0.0001);
    instruments.shell.connect(instruments.shellGain);
    attach(instruments.shellGain, buses.drums, -0.5, 0, routes, panners, "shell", voiceSolo, "shell");
    instruments.shell.start();
    instruments.shellHarmonic = new I.Shell(PATCHES.kick.shellStartHz * 2, "sine");
    instruments.shellHarmonicGain = new T.Gain(0.0001);
    instruments.shellHarmonic.connect(instruments.shellHarmonicGain);
    attach(instruments.shellHarmonicGain, buses.drums, -0.5, 0, routes, null, null, voiceSolo, "shell");
    instruments.shellHarmonic.start();

    instruments.tom = new I.Tom({
      pitchDecay: PATCHES.tom.pitchDecay,
      octaves: PATCHES.tom.octaveMultiplier,
      oscillator: {type: "sine"},
      envelope: {attack: 0.002, decay: PATCHES.tom.decay, sustain: 0, release: 0.02}
    });
    attach(instruments.tom, buses.drums, PATCHES.tom.trimDb + 2, 0, routes, panners, "tom", voiceSolo, "tom");

    instruments.snare = new I.Snare({
      noise: {type: "white"},
      envelope: {attack: PATCHES.snare.attack, decay: PATCHES.snare.decay, sustain: 0, release: 0.012}
    });
    instruments.snare.volume.value = 7;
    for (const [index, band] of PATCHES.snare.rollBands.entries()) {
      const filter = new T.Filter({frequency: band.hz, type: "bandpass", Q: band.q});
      instruments.snare.connect(filter);
      attach(filter, buses.drums, index === 0 ? 1.5 : -0.5, index === 0 ? 0.08 : -0.08, routes, null, null, voiceSolo, "snare");
      routes.push(filter);
    }
    const snareBody = new I.SnareBody({pitchDecay: 0.012, octaves: 1.35, oscillator: {type: "sine"}, envelope: {attack: 0.001, decay: 0.045, sustain: 0, release: 0.01}});
    instruments.snareBody = snareBody;
    attach(snareBody, buses.drums, 8, 0, routes, panners, "snareBody", voiceSolo, "snareBody");

    instruments.roll = new I.SnareRoll({
      noise: {type: "white"},
      envelope: {attack: PATCHES.snare.rollAttack, decay: PATCHES.snare.rollDecay, sustain: PATCHES.snare.rollSustain, release: 0.09}
    });
    instruments.roll.volume.value = 7.5;
    instruments.rollSwell = new T.Gain(0.0001);
    instruments.roll.connect(instruments.rollSwell);
    for (const [index, band] of PATCHES.snare.rollBands.entries()) {
      const filter = new T.Filter({frequency: band.hz, type: "bandpass", Q: band.q});
      instruments.rollSwell.connect(filter);
      attach(filter, buses.drums, index === 0 ? 1.5 : -0.5, index === 0 ? -0.08 : 0.08, routes, null, null, voiceSolo, "roll");
      routes.push(filter);
    }

    instruments.sub = new I.SubBass({
      oscillator: {type: "sine"},
      filter: {type: "lowpass", frequency: PATCHES.sub.filterHz, Q: 0.7},
      filterEnvelope: {attack: 0.02, decay: 0.13, sustain: 0.18, release: 0.08, baseFrequency: 95, octaves: 0.65},
      envelope: {attack: PATCHES.sub.pulseAttack, decay: 0.13, sustain: 0.72, release: PATCHES.sub.release},
      portamento: 0.015
    });
    instruments.sub.volume.value = -3;
    const subDrive = new T.WaveShaper(value => Math.tanh(1.65 * value) / Math.tanh(1.65), 2048);
    instruments.sub.connect(subDrive);
    attach(subDrive, buses.bass, -2, 0, routes, panners, "sub", voiceSolo, "sub");
    routes.push(subDrive);
    // A quiet octave supplies the reference's ~12% second bass partial.
    instruments.subHarmonic = new T.Synth({
      oscillator: {type: "sine"},
      envelope: {attack: PATCHES.sub.pulseAttack, decay: 0.13, sustain: 0.72, release: PATCHES.sub.release}
    });
    attach(instruments.subHarmonic, buses.bass, -19, 0, routes, null, null, voiceSolo, "sub");

    instruments.brass = new I.LowBrass({
      harmonicity: PATCHES.brass.harmonicity,
      modulationIndex: PATCHES.brass.modulationIndex,
      oscillator: {type: "sine"},
      modulation: {type: "sine"},
      envelope: {attack: PATCHES.brass.attack, decay: PATCHES.brass.decay, sustain: PATCHES.brass.sustain, release: PATCHES.brass.release},
      modulationEnvelope: {attack: 0.025, decay: 0.11, sustain: 0.3, release: 0.05}
    });
    const brassFilter = new T.Filter(PATCHES.brass.lowpassHz, "lowpass");
    instruments.brass.connect(brassFilter);
    attach(brassFilter, buses.brass, PATCHES.brass.trimDb, 0, routes, panners, "brass", voiceSolo, "brass");
    routes.push(brassFilter);

    // Tone.FMSynth supplies the breathy fundamental; a separate upstream Tone.Synth
    // supplies the reference's 2nd-8th harmonics, absent with harmonicity=2 FM.
    instruments.brassHarmonics = new T.Synth({
      oscillator: {type: "custom", partials: [0, 0.45, 0.30, 0.17, 0.10, 0.07, 0.04, 0.022]},
      envelope: {attack: 0.04, decay: 0.12, sustain: 0.65, release: 0.06}
    });
    const harmonicFilter = new T.Filter(PATCHES.brass.lowpassHz, "lowpass");
    instruments.brassHarmonics.connect(harmonicFilter);
    attach(harmonicFilter, buses.brass, -12, 0, routes, null, null, voiceSolo, "brass");
    routes.push(harmonicFilter);

    instruments.metal = new I.MetalAccent({
      frequency: PATCHES.metal.frequency,
      harmonicity: 5,
      modulationIndex: PATCHES.metal.modulationIndex,
      resonance: 880,
      octaves: 1.5,
      envelope: {attack: 0.001, decay: PATCHES.metal.decay, release: 0.025}
    });
    const metalFilter = new T.Filter(PATCHES.metal.lowpassHz, "lowpass");
    instruments.metal.connect(metalFilter);
    attach(metalFilter, buses.textures, -19, 0.12, routes, panners, "metal", voiceSolo, "metal");
    routes.push(metalFilter);

    // The reference has a prominent low, inharmonic 326 Hz metal-shell mode.
    instruments.metalMode = new T.Synth({
      oscillator: {type: "sine"},
      envelope: {attack: 0.001, decay: 0.078, sustain: 0, release: 0.025}
    });
    attach(instruments.metalMode, buses.textures, 2, 0.12, routes, null, null, voiceSolo, "metal");

    instruments.rumble = new I.Rumble({
      noise: {type: "brown"},
      envelope: {attack: 0.24, decay: 0.3, sustain: 0.55, release: 0.65}
    });
    instruments.rumble.volume.value = 0;
    const rumbleHigh = new T.Filter(PATCHES.rumble.highHz, "lowpass");
    const rumbleLow = new T.Filter(PATCHES.rumble.lowHz, "highpass");
    instruments.rumble.connect(rumbleLow);
    rumbleLow.connect(rumbleHigh);
    attach(rumbleHigh, buses.textures, 0, 0, routes, panners, "rumble", voiceSolo, "rumble");
    routes.push(rumbleHigh, rumbleLow);

    return {buses, instruments, routes, panners};
  }

  function disposeGraph(graph) {
    for (const instrument of Object.values(graph.instruments)) {
      try { instrument.dispose(); } catch (_) { /* Audio graph may already have ended. */ }
    }
    for (const node of graph.routes) {
      try { node.dispose(); } catch (_) { /* Audio graph may already have ended. */ }
    }
  }

  function hit(graph, random, instrument, duration, time, velocity, pan = 0) {
    const node = graph.instruments[instrument];
    const variation = 0.97 + 0.06 * random();
    if (instrument === "kick") node.triggerAttackRelease(PATCHES.kick.targetHz, duration, time, clamp(velocity * variation, 0.02, 1));
    else if (instrument === "tom") node.triggerAttackRelease(PATCHES.tom.targetHz, duration, time, clamp(velocity * variation, 0.02, 1));
    else if (instrument === "kickBody" || instrument === "snare" || instrument === "roll" || instrument === "rumble") node.triggerAttackRelease(duration, time, clamp(velocity * variation, 0.02, 1));
    else if (instrument === "metal") {
      node.triggerAttackRelease(duration, time, clamp(velocity * variation, 0.02, 1));
      graph.instruments.metalMode.triggerAttackRelease(326, duration, time, clamp(velocity * variation, 0.02, 1));
    }
    else if (instrument === "sub") {
      const level = clamp(velocity * variation, 0.02, 1);
      node.triggerAttackRelease(duration.note, duration.seconds, time, level);
      graph.instruments.subHarmonic.triggerAttackRelease(T.Frequency(duration.note).toFrequency() * 2, duration.seconds, time, level);
    }
    else if (instrument === "brass") {
      const level = clamp(velocity * variation, 0.02, 1);
      node.triggerAttackRelease(duration.note, duration.seconds, time, level);
      graph.instruments.brassHarmonics.triggerAttackRelease(duration.note, duration.seconds, time, level);
    }
    if (graph.panners[instrument]) graph.panners[instrument].pan.setValueAtTime(pan, time);
  }

  function strikeShell(graph, time, beat, velocity) {
    const osc = graph.instruments.shell;
    const amp = graph.instruments.shellGain.gain;
    const harmonic = graph.instruments.shellHarmonic;
    const harmonicAmp = graph.instruments.shellHarmonicGain.gain;
    const end = time + beat * PATCHES.kick.shellFadeBeats;
    osc.frequency.cancelScheduledValues(time);
    const curve = Float32Array.from({length: 49}, (_, index) => {
      const elapsed = PATCHES.kick.shellFadeBeats * beat * index / 48;
      return PATCHES.kick.shellEndHz - (PATCHES.kick.shellEndHz - PATCHES.kick.shellStartHz) * Math.exp(-elapsed / PATCHES.kick.shellTau);
    });
    osc.frequency.setValueCurveAtTime(curve, time, PATCHES.kick.shellFadeBeats * beat);
    harmonic.frequency.cancelScheduledValues(time);
    harmonic.frequency.setValueCurveAtTime(Float32Array.from(curve, value => value * 2), time, PATCHES.kick.shellFadeBeats * beat);
    harmonicAmp.cancelScheduledValues(time);
    harmonicAmp.setValueAtTime(0.0001, time);
    harmonicAmp.linearRampToValueAtTime(0.10 * velocity, time + PATCHES.kick.shellAttack);
    harmonicAmp.exponentialRampToValueAtTime(0.0001, time + 0.31);
    // Match the rising shell's delayed bloom, long exponential tail and 4.8 Hz tremolo.
    const duration = PATCHES.kick.shellFadeBeats * beat;
    const ampCurve = Float32Array.from({length: 256}, (_, index) => {
      const t = duration * index / 255;
      const bloom = (1 - Math.exp(-t / 0.037)) * Math.exp(-t / (beat * 0.48));
      const wobble = 1 + 0.18 * Math.sin(2 * Math.PI * 4.8 * t);
      const fade = Math.max(0, Math.min(1, t / 0.003, (duration - t) / 0.018));
      return Math.max(0.0001, 1.15 * velocity * bloom * wobble * fade);
    });
    amp.cancelScheduledValues(time);
    amp.setValueCurveAtTime(ampCurve, time, duration);
    amp.setValueAtTime(0.0001, end + 0.002);
  }

  function strikeRoll(graph, time, length, velocity, pan) {
    // A growing snare-wire roll with ~18 Hz strokes before the next footfall.
    const amp = graph.instruments.rollSwell.gain;
    const curve = Float32Array.from({length: 384}, (_, i) => {
      const progress = i / 383;
      const t = progress * length;
      const swell = 0.24 + 0.76 * progress ** 1.55;
      const strokes = 0.5 + 0.5 * Math.cos(2 * Math.PI * 18 * t + 0.6 * Math.sin(37 * t)) ** 2;
      return Math.max(0.0001, swell * strokes * Math.min(1, t / 0.003, (length - t) / 0.018));
    });
    amp.cancelScheduledValues(time);
    amp.setValueCurveAtTime(curve, time, length);
    amp.setValueAtTime(0.0001, time + length + 0.002);
    graph.instruments.roll.triggerAttackRelease(length, time, clamp(velocity, 0.02, 1));
  }

  function scheduleBar(graph, time, index, bpm) {
    const bar = index % BARS_PER_PHRASE;
    const pedal = bar >= 8;
    const beat = 60 / bpm;
    const step = beat / 4;
    const random = seeded(Math.imul(index + 1, 2654435761));
    const drums = graph.instruments;
    const place = (name, offset, length, velocity, pan = 0, lag = 0) => {
      if (name === "roll") strikeRoll(graph, time + offset * step + lag, length, velocity, pan);
      else hit(graph, random, name, length, time + offset * step + lag, velocity, pan);
    };

    for (let foot = 0; foot < 2; foot++) {
      const offset = foot * 4;
      const accented = BASS_ACCENTS.has(bar * 2 + foot);
      const side = foot === 0 ? -0.16 : 0.16;
      const weight = pedal ? 0.68 : (foot === 0 ? 1 : 0.88);
      const at = time + offset * step;
      const variation = 0.97 + 0.06 * random();
      graph.panners.kick.pan.setValueAtTime(side * 0.30, at);
      graph.panners.shell.pan.setValueAtTime(side * 0.30, at + 0.052);
      graph.panners.snareBody.pan.setValueAtTime(side, at);
      drums.kick.triggerAttackRelease(PATCHES.kick.targetHz, 0.060, at, clamp(weight * variation, 0.02, 1));
      drums.kickRim.triggerAttackRelease(PATCHES.kick.targetHz * 1.86, 0.047, at, clamp(weight * variation, 0.02, 1));
      drums.beater.triggerAttackRelease(PATCHES.kick.noiseDecay, at, clamp(weight, 0.02, 1));
      drums.kickBody.triggerAttackRelease(PATCHES.kick.bodyDecay, at, clamp(weight * PATCHES.kick.bodyVelocity * variation, 0.02, 1));
      strikeShell(graph, at + 0.052, beat, weight * 0.9);
      drums.snareBody.triggerAttackRelease(140, 0.045, at, clamp(weight * 0.55, 0.02, 1));
      place("snare", offset, 0.034, weight, side);
      place("snare", offset, 0.027, weight * 0.65, -side * 1.6, 0.012);
      place("roll", offset + 0.68, 0.84 * beat, pedal ? 0.25 : 0.42, -side * 1.3);
      if (accented || (pedal && foot === 0)) place("metal", offset, 0.070, pedal ? 0.075 : 0.11, side * 1.4);
      if (!pedal) {
        if (!accented && foot === 0) place("tom", offset + 1.04, 0.094, 0.34, -side);
        const bassDuration = accented ? 2.62 : 2.20;
        place("sub", offset + 1.18, {note: "A#1", seconds: bassDuration * step}, accented ? 0.60 : 0.17);
        if (accented) place("brass", offset + 1.33, {note: "A#1", seconds: 2.4 * step}, 0.35, side);
      }
    }

    if (pedal) {
      const swell = 0.46 + 0.10 * Math.sin((bar - 8) * 0.42);
      place("sub", 0, {note: "C2", seconds: 7.85 * step}, swell);
      place("brass", bar % 2 ? 2.2 : 0.85, {note: "C2", seconds: (bar % 2 ? 3.8 : 3.2) * step}, 0.35, -0.15);
      if (bar % 4 === 3) place("brass", 6, {note: "B1", seconds: 1.35 * step}, 0.21, 0.18);
    }
    if (index % 2 === 0) place("rumble", 0, PATCHES.rumble.duration, 0.16);
    if (bar % 4 === 1 || bar % 4 === 3) {
      place("tom", 6.89, 0.094, 0.32, 0.20);
      place("snare", 7.5, 0.027, 0.08, -0.24);
    }
  }

  async function renderOffline({bpm = 80, bars = 2, solo = null, sampleRate = 48000} = {}) {
    const duration = bars * QUARTER_NOTES_PER_BAR * 60 / bpm + 0.12;
    let graph;
    const buffer = await T.Offline(({transport}) => {
      transport.timeSignature = QUARTER_NOTES_PER_BAR;
      transport.bpm.value = bpm;
      graph = createGraph(T.getContext().destination, solo, 1);
      let bar = 0;
      transport.scheduleRepeat(time => scheduleBar(graph, time, bar++, bpm), "1m");
      transport.start(0.02);
    }, duration, 2, sampleRate);
    if (graph) disposeGraph(graph);
    return buffer.get();
  }

  const button = document.querySelector("#transport");
  const status = document.querySelector("#status");
  const tempo = document.querySelector("#tempo");
  const tempoValue = document.querySelector("#tempo-value");
  const volumeControl = document.querySelector("#volume");
  const scope = document.querySelector("#scope");
  const drawing = scope.getContext("2d");
  const lights = [...document.querySelectorAll(".beat-light")];
  const scopeAnalyser = new T.Analyser("waveform", 1024);
  scopeAnalyser.connect(T.getContext().destination);
  const scheduled = {id: null, graph: null};
  let pendingTempo = null;
  let activeTempo = 80;
  let paintFrame = 0;
  let userVolume = 0.74;

  function outputLevel() { return userVolume ** 1.55; }

  function showTempo() {
    tempoValue.value = tempo.value + " BPM";
    tempo.setAttribute("aria-valuetext", tempoValue.value);
    pendingTempo = Number(tempo.value);
  }

  async function startMarch() {
    await T.start();
    const transport = T.Transport;
    transport.stop();
    transport.cancel(0);
    transport.position = "0:0:0";
    transport.timeSignature = QUARTER_NOTES_PER_BAR;
    activeTempo = Number(tempo.value);
    pendingTempo = null;
    transport.bpm.value = activeTempo;
    scheduled.graph = createGraph(scopeAnalyser, null, outputLevel());
    let bar = 0;
    scheduled.id = transport.scheduleRepeat(time => {
      if (pendingTempo !== null) {
        activeTempo = pendingTempo;
        pendingTempo = null;
        transport.bpm.setValueAtTime(activeTempo, time);
      }
      scheduleBar(scheduled.graph, time, bar++, activeTempo);
    }, "1m");
    transport.start("+0.03");
    button.textContent = "Остановить марш";
    button.setAttribute("aria-pressed", "true");
    status.textContent = "Играет · Tone.js";
    paint();
  }

  function stopMarch() {
    const transport = T.Transport;
    transport.stop();
    transport.cancel(0);
    if (scheduled.graph) disposeGraph(scheduled.graph);
    scheduled.graph = null;
    scheduled.id = null;
    button.textContent = "Запустить марш";
    button.setAttribute("aria-pressed", "false");
    status.textContent = "Остановлено";
    cancelAnimationFrame(paintFrame);
    paint();
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      if (scheduled.graph) stopMarch();
      else await startMarch();
    } catch (error) {
      stopMarch();
      status.textContent = "Не удалось запустить звук";
      console.error(error);
    } finally {
      button.disabled = false;
    }
  });

  tempo.addEventListener("input", showTempo);
  showTempo();
  volumeControl.addEventListener("input", () => {
    userVolume = Number(volumeControl.value) / 100;
    if (scheduled.graph) scheduled.graph.routes[5].gain.setTargetAtTime(outputLevel(), T.now(), 0.035);
  });

  function paint() {
    const width = scope.clientWidth;
    const height = scope.clientHeight;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    if (scope.width !== Math.round(width * scale) || scope.height !== Math.round(height * scale)) {
      scope.width = Math.round(width * scale);
      scope.height = Math.round(height * scale);
    }
    drawing.setTransform(scale, 0, 0, scale, 0, 0);
    drawing.clearRect(0, 0, width, height);
    drawing.strokeStyle = "#302d2c";
    drawing.lineWidth = 1;
    drawing.beginPath();
    for (let index = 1; index < 16; index++) {
      drawing.moveTo(width * index / 16, 0);
      drawing.lineTo(width * index / 16, height);
    }
    drawing.stroke();
    const transport = T.Transport;
    const inPlayback = Boolean(scheduled.graph) && transport.state === "started";
    const beatLength = 60 / activeTempo;
    const elapsed = ((transport.seconds % (2 * beatLength)) + (2 * beatLength)) % (2 * beatLength);
    const beat = inPlayback ? Math.floor(elapsed / beatLength) : -1;
    lights.forEach((light, index) => light.classList.toggle("active", index === beat));
    drawing.strokeStyle = inPlayback ? "#ff815e" : "#77524b";
    drawing.lineWidth = 1.6;
    drawing.beginPath();
    const values = scopeAnalyser.getValue();
    if (inPlayback && values && values.length) {
      for (let index = 0; index < values.length; index += 2) {
        const x = width * index / (values.length - 1);
        const y = height * 0.48 - Number(values[index]) * height * 0.62;
        if (index === 0) drawing.moveTo(x, y);
        else drawing.lineTo(x, y);
      }
    } else {
      drawing.moveTo(0, height * 0.48);
      drawing.lineTo(width, height * 0.48);
    }
    drawing.stroke();
    if (inPlayback) paintFrame = requestAnimationFrame(paint);
  }

  window.addEventListener("resize", paint);
  paint();
  window.MarchLab = Object.freeze({
    version: "Tone.js 15.1.22",
    patches: PATCHES,
    renderOffline,
    get transport() { return T.Transport; },
    get graph() { return scheduled.graph; },
    get activeTempo() { return activeTempo; }
  });
})();
