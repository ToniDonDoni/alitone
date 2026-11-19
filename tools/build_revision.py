from pathlib import Path

root = Path(__file__).resolve().parents[1]
p = root / 'references' / 'march-of-the-fallen-original-draft.html'
s = p.read_text()

def replace_section(start, end, value):
    global s
    a = s.index(start)
    b = s.index(end, a)
    s = s[:a] + value + s[b:]

replace_section('function drum(', 'function snare(', '''function bandPass(frequency, q, rate) {
  const omega = TAU * frequency / rate;
  const alpha = Math.sin(omega) / (2 * q);
  const gain = alpha / (1 + alpha);
  const a1 = 2 * Math.cos(omega) / (1 + alpha);
  const a2 = (1 - alpha) / (1 + alpha);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return input => {
    const output = gain * (input - x2) + a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = input;
    y2 = y1;
    y1 = output;
    return output;
  };
}

function kick(context, seed) {
  const rate = context.sampleRate;
  const tuning = .975 + .05 * randomGenerator(seed)();
  const head = bandPass(720, .95, rate);
  const edge = bandPass(1880, 1.25, rate);
  let phase = 0;
  const body = bandPass(193, 1.15, rate);
  return sampleBuffer(context, .15, seed, (t, noise) => {
    phase += TAU * tuning * (33 + 177 * Math.exp(-t / .023)) / rate;
    const skin = .88 * Math.sin(phase) * Math.exp(-t / .060);
    const beater = (2.1 * head(noise) + 1.7 * edge(noise)) * Math.exp(-t / .014);
    const rim = (.39 * Math.sin(phase * 1.86 + .7) + 3.4 * body(noise)) * Math.exp(-t / .047);
    return Math.tanh(skin + rim + 1.19 * beater);
  });
}

function shell(context, beat, seed) {
  const rate = context.sampleRate;
  const tuning = .981 + .038 * randomGenerator(seed)();
  let phase = 0;
  return sampleBuffer(context, beat * .84, seed, t => {
    const frequency = (59 - 23 * Math.exp(-t / .17)) * tuning;
    phase += TAU * frequency / rate;
    const bloom = (1 - Math.exp(-t / .037)) * Math.exp(-t / (beat * .48));
    const body = Math.sin(phase) + .13 * Math.sin(2 * phase + .72) * Math.exp(-t / .15);
    return bloom * body * (1 + .18 * Math.sin(TAU * 4.8 * t));
  });
}

function tom(context, seed) {
  const rate = context.sampleRate;
  const tuning = .94 + .12 * randomGenerator(seed)();
  const head = bandPass(650, 1.1, rate);
  let phase = 0;
  return sampleBuffer(context, .31, seed, (t, noise) => {
    phase += TAU * tuning * (68 + 50 * Math.exp(-t / .029)) / rate;
    return .72 * Math.sin(phase) * Math.exp(-t / .094)
      + .72 * head(noise) * Math.exp(-t / .022);
  });
}

function wireRoll(context, length, seed) {
  const rate = context.sampleRate;
  const throat = bandPass(705, 1.15, rate);
  const wires = bandPass(1690, 1.35, rate);
  return sampleBuffer(context, length, seed, (t, noise) => {
    const swell = .24 + .76 * (t / length) ** 1.55;
    const strokes = .50 + .50 * Math.cos(TAU * 18 * t + .6 * Math.sin(37 * t)) ** 2;
    return (2.2 * throat(noise) + 1.35 * wires(noise)) * swell * strokes;
  });
}

''')
s = s.replace('const trail = Math.exp(-t / .089);','const trail = Math.exp(-t / .034);')
replace_section('function bass(', 'function brass(', '''function bass(context, note, length, seed) {
  const rate = context.sampleRate;
  const frequency = midiToHz(note);
  const sustained = note === 36;
  let phase = 0;
  return sampleBuffer(context, length + .125, seed, t => {
    const attack = 1 - Math.exp(-t / (sustained ? .11 : .066));
    const release = Math.exp(-Math.max(0, t - length) / .048);
    const scoop = sustained ? .012 : .18;
    phase += TAU * frequency * (1 + scoop * Math.exp(-t / .10) + .002 * Math.sin(TAU * 2.1 * t)) / rate;
    return attack * release * Math.tanh(1.08 * Math.sin(phase) + .12 * Math.sin(2 * phase + .6));
  });
}

''')
replace_section('const percussion =', 'class March', '''// Two steps per bar. Accents repeat across the bar line.
const bassAccents = [1, 4, 7, 9];

''')
s = s.replace('drum(context, true, seed)', 'kick(context, seed)').replace('drum(context, false, seed)', 'tom(context, seed)')
s = s.replace('    this.fade.connect(output);','''    this.fade.connect(output);
    const room = context.createBiquadFilter();
    room.type = "bandpass";
    room.frequency.value = 980;
    room.Q.value = .5;
    this.fade.connect(room);
    for (const [delayTime, level, pan] of [[.018, .26, -.88], [.032, .23, .9], [.057, .11, -.65]]) {
      const delay = context.createDelay(.1);
      const gain = context.createGain();
      const stereo = context.createStereoPanner();
      delay.delayTime.value = delayTime;
      gain.gain.value = level;
      stereo.pan.value = pan;
      room.connect(delay).connect(gain).connect(stereo).connect(output);
    }''')
s = s.replace('    this.voices.clear();','''    this.voices.clear();
    this.shells = [2579, 6247, 8293].map(seed => shell(this.context, this.beat, seed));
    this.rolls = [1051, 7039, 9181].map(seed => wireRoll(this.context, this.beat * .84, seed));''')
replace_section('  scheduleBar(index, time) {', 'function createMaster(', '''  scheduleBar(index, time) {
    const bar = index % 16;
    const pedal = bar >= 8;
    const random = randomGenerator(Math.imul(index + 1, 2654435761));
    const choose = buffers => buffers[Math.floor(random() * buffers.length)];
    const hit = (buffer, step, level, pan, lag = 0) => {
      this.play(buffer, time + step * this.step + lag, level * (.97 + .06 * random()), pan, this.fade);
    };

    for (let foot = 0; foot < 2; foot++) {
      const step = foot * 4;
      const accented = bassAccents.includes(bar * 2 + foot);
      const side = foot === 0 ? -.16 : .16;
      const weight = pedal ? .68 : (foot === 0 ? 1.14 : .98);
      hit(choose(this.kicks), step, weight, side * .25);
      hit(choose(this.shells), step, weight * .88, 0, .052);
      hit(choose(this.snares), step, weight * .36, side);
      hit(choose(this.snares), step, weight * .12, -side * 2, .012);
      hit(choose(this.rolls), step + .68, pedal ? .25 : .42, -side * 1.65);
      if (accented || (pedal && foot === 0)) {
        hit(choose(this.metal), step, pedal ? .086 : .13, side * 1.7, .015);
      }
      if (!pedal) {
        if (!accented && foot === 0) hit(choose(this.toms), step + 1.04, .38, -side);
        hit(this.note("sub", 34, accented ? 2.62 : 2.20), step + 1.18, accented ? .66 : .18, 0);
        if (accented) hit(this.note("low", 34, 2.4), step + 1.33, .12, side);
      }
    }

    if (pedal) {
      const swell = .48 + .10 * Math.sin((bar - 8) * .42);
      hit(this.note("sub", 36, 7.85), 0, swell, 0);
      hit(this.note("low", 36, bar % 2 ? 3.8 : 3.2), bar % 2 ? 2.2 : .85, .147, -.15);
      if (bar % 4 === 3) hit(this.note("low", 35, 1.35), 6, .079, .18);
    }
    if (index % 2 === 0) hit(this.rumble[index % 4 / 2], 0, .17, .04);
    if (bar % 4 === 1 || bar % 4 === 3) {
      hit(choose(this.toms), 6.89, .36, .22);
      hit(choose(this.snares), 7.5, .09, -.24);
    }
  }
}

''')
s = s.replace('  const limiter = context.createDynamicsCompressor();','''  const lowPass = context.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.value = 2930;
  lowPass.Q.value = .71;
  const limiter = context.createDynamicsCompressor();
  const edge = context.createBiquadFilter();
  edge.type = "lowpass";
  edge.frequency.value = 3510;
  edge.Q.value = .71;
  lowPass.connect(edge).connect(limiter);''').replace('  return limiter;', '  return lowPass;')
print(s, end='')
