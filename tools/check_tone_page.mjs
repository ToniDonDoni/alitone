import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "march-tone-chrome-"));
const renderDir = path.join(root, "output", "renders");
const chrome = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const proc = spawn(chrome, ["--headless", "--no-sandbox", "--no-proxy-server", "--host-resolver-rules=MAP * ~NOTFOUND", "--disable-gpu", "--no-first-run", "--disable-background-networking", "--remote-debugging-pipe", "--user-data-dir=" + profile, "about:blank"], {stdio: ["ignore", "ignore", "inherit", "pipe", "pipe"]});

let nextId = 1;
let raw = "";
const pending = new Map();
const pageErrors = [];
const requests = [];
proc.stdio[4].setEncoding("utf8");
proc.stdio[4].on("data", chunk => {
  raw += chunk;
  let end;
  while ((end = raw.indexOf("\0")) >= 0) {
    const message = JSON.parse(raw.slice(0, end));
    raw = raw.slice(end + 1);
    if (message.id) {
      const item = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) item.reject(new Error(JSON.stringify(message.error)));
      else item.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") {
      pageErrors.push(message.params.exceptionDetails);
    } else if (message.method === "Network.requestWillBeSent") {
      requests.push(message.params.request.url);
    }
  }
});
function send(method, params = {}, sessionId) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, {resolve, reject});
    proc.stdio[3].write(JSON.stringify({id, method, params, sessionId}) + "\0");
  });
}
proc.on("error", error => { for (const item of pending.values()) item.reject(error); });
const closed = new Promise(resolve => proc.once("close", resolve));
proc.on("exit", code => { for (const item of pending.values()) item.reject(new Error("Chrome exited: " + code)); });
const timeout = setTimeout(() => proc.kill(), 180000);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function interleaveAndWrite(name, b64, peak) {
  const data = Buffer.from(b64, "base64");
  fs.writeFileSync(path.join(renderDir, name), data);
  if (!(peak < 1)) throw new Error("Render clipped: " + name + " peak " + peak);
  return data.length;
}

try {
  fs.mkdirSync(renderDir, {recursive: true});
  const {targetInfos} = await send("Target.getTargets");
  const pageTarget = targetInfos.find(target => target.type === "page");
  const {sessionId} = await send("Target.attachToTarget", {targetId: pageTarget.targetId, flatten: true});
  const call = (method, params) => send(method, params, sessionId);
  const evaluate = async expression => {
    const result = await call("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const requireCondition = async expression => {
    if (!(await evaluate(expression))) throw new Error("Check failed: " + expression);
  };
  await call("Runtime.enable");
  await call("Page.enable");
  await call("Network.enable");
  await call("Network.emulateNetworkConditions", {offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0});
  await call("Emulation.setDeviceMetricsOverride", {width: 1200, height: 820, deviceScaleFactor: 1, mobile: false});
  await call("Page.navigate", {url: pathToFileURL(path.join(root, "references", "march-of-the-fallen-tone.html")).href});
  for (let index = 0; index < 100 && !(await evaluate("Boolean(window.MarchLab)")); index++) await delay(50);
  await requireCondition("Boolean(window.MarchInstruments) && Object.keys(MarchInstruments).length === 12 && MarchInstruments.Kick.prototype instanceof Tone.MembraneSynth && MarchInstruments.Beater.prototype instanceof Tone.NoiseSynth && MarchInstruments.SubBass.prototype instanceof Tone.MonoSynth && MarchInstruments.LowBrass.prototype instanceof Tone.FMSynth && MarchInstruments.MetalAccent.prototype instanceof Tone.MetalSynth");
  await requireCondition("MarchLab.arrangement === MarchArrangement && MarchArrangement.tracks.length === 12 && MarchArrangement.eventsFor(80).kick.length === 32 && MarchArrangement.eventsFor(80).roll.length === 32 && document.querySelector('#scope').getBoundingClientRect().height >= 330");
  await requireCondition("Boolean(MarchLab) && MarchLab.version === 'Tone.js 15.1.22' && Tone.version === '15.1.22' && Tone.MembraneSynth && Tone.NoiseSynth && Tone.MonoSynth && Tone.FMSynth && Tone.MetalSynth && Tone.Oscillator");
  console.log("Desktop UI state", await evaluate("JSON.stringify({width:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,tempo:tempo.value,tempoText:document.querySelector('#tempo-value').value,canvasHeight:document.querySelector('#scope').getBoundingClientRect().height})"));
  await requireCondition("tempo.type === 'range' && tempo.min === '40' && tempo.max === '160' && tempo.value === '80' && document.querySelector('#tempo-value').value === '80 BPM'");
  await requireCondition("document.documentElement.scrollWidth <= window.innerWidth");
  const preview = await call("Page.captureScreenshot", {format: "png"});
  fs.writeFileSync(path.join(os.tmpdir(), "march-tone-preview.png"), Buffer.from(preview.data, "base64"));
  const launch = await evaluate("(() => { const r = transport.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2} })()");
  await call("Input.dispatchMouseEvent", {...launch, type: "mousePressed", button: "left", clickCount: 1});
  await call("Input.dispatchMouseEvent", {...launch, type: "mouseReleased", button: "left", clickCount: 1});
  await delay(550);
  await requireCondition("Tone.getContext().state === 'running' && MarchLab.graph && MarchLab.transport.state === 'started' && MarchLab.transport.timeSignature === 2 && document.querySelector('#status').textContent.includes('Играет')");
  await requireCondition("['MembraneSynth','NoiseSynth','Oscillator','MonoSynth','FMSynth','MetalSynth'].every(kind => Object.values(MarchLab.graph.instruments).some(instrument => instrument.name === kind))");
  await requireCondition("Boolean(MarchLab.graph.instruments.kick.output && MarchLab.graph.instruments.shell.output && MarchLab.graph.instruments.snare.output && MarchLab.graph.instruments.sub.output && MarchLab.graph.instruments.brass.output && MarchLab.graph.instruments.metal.output)");
  // Real pointer input must mute a voice in the AUDIO graph, not only its canvas paint.
  await requireCondition("MarchLab.mutedTracks.length === 0 && MarchLab.arrangement.tracks.every(track => MarchLab.graph.voiceGains[track.key].gain.value === 1)");
  const clickTrack = async (name, useTouch = false) => {
    const pos = await evaluate(`(() => {
      const canvas = document.querySelector("#scope");
      const rect = canvas.getBoundingClientRect();
      const index = MarchArrangement.tracks.findIndex(track => track.key === ${JSON.stringify(name)});
      const height = rect.height;
      const trackHeight = (height - 29 - 5) / MarchArrangement.tracks.length;
      const point = {x: rect.left + 12, y: rect.top + 29 + (index + 0.5) * trackHeight};
      if (MarchArrangement.trackAt(12, point.y - rect.top, rect.width, height) !== ${JSON.stringify(name)}) {
        throw new Error("Track hit testing failed");
      }
      return point;
    })()`);
    if (useTouch) {
      await call("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x: pos.x, y: pos.y}]});
      await call("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
    } else {
      await call("Input.dispatchMouseEvent", {...pos, type: "mousePressed", button: "left", clickCount: 1});
      await call("Input.dispatchMouseEvent", {...pos, type: "mouseReleased", button: "left", clickCount: 1});
    }
  };
  await clickTrack("kick");
  await delay(110);
  await requireCondition("MarchLab.mutedTracks.includes('kick') && MarchLab.graph.voiceGains.kick.gain.value < 0.01 && MarchLab.graph.voiceGains.snare.gain.value > 0.99 && MarchArrangement.lastFrame.mutedTracks.includes('kick')");
  const mutedPreview = await call("Page.captureScreenshot", {format: "png"});
  fs.writeFileSync(path.join(renderDir, "kick-muted.png"), Buffer.from(mutedPreview.data, "base64"));
  await clickTrack("kick");
  await delay(110);
  await requireCondition("!MarchLab.mutedTracks.includes('kick') && MarchLab.graph.voiceGains.kick.gain.value > 0.99 && !MarchArrangement.lastFrame.mutedTracks.includes('kick')");
  await clickTrack("brass");
  await delay(110);
  await requireCondition("MarchLab.mutedTracks.includes('brass') && MarchLab.graph.voiceGains.brass.gain.value < 0.01 && MarchLab.graph.voiceGains.kick.gain.value > 0.99");
  await clickTrack("brass");
  await delay(110);
  await requireCondition("MarchLab.mutedTracks.length === 0 && MarchLab.graph.voiceGains.brass.gain.value > 0.99");
  // Clicking outside the left header does not mute any instrument.
  await evaluate("document.querySelector('#scope').dispatchEvent(new PointerEvent('pointerdown', {clientX:document.querySelector('#scope').getBoundingClientRect().right-20,clientY:document.querySelector('#scope').getBoundingClientRect().top+65,bubbles:true}))");
  await requireCondition("MarchLab.mutedTracks.length === 0");
  console.log("Track mute/unmute via real mouse input passed; other tracks remain audible.");

  // Verify actual rendered canvas pixels, not just the value of Transport.ticks.
  // The moving #ff815e cursor must be visible in both screenshots.
  const visualState = `(() => {
    const frame = MarchArrangement.lastFrame;
    const canvas = document.querySelector("#scope");
    const context = canvas.getContext("2d");
    const x = Math.round(frame.playheadX * canvas.width / frame.width);
    const y = Math.round(canvas.height * 0.6);
    const pixels = [];
    for (let dx = -2; dx <= 2; dx++) {
      const rgba = context.getImageData(Math.max(0, x + dx), y, 1, 1).data;
      pixels.push([rgba[0], rgba[1], rgba[2]]);
    }
    return {
      frame, transportSeconds: MarchLab.transport.seconds,
      transportTicks: MarchLab.transport.ticks,
      pixelOnCursor: pixels.some(rgb => rgb[0] > 200 && rgb[0] > rgb[1] * 1.35 && rgb[1] > rgb[2])
    };
  })()`;
  const visualBefore = await evaluate(visualState);
  const beforeImage = await call("Page.captureScreenshot", {format: "png"});
  fs.writeFileSync(path.join(renderDir, "playhead-before.png"), Buffer.from(beforeImage.data, "base64"));
  await delay(850);
  const visualAfter = await evaluate(visualState);
  const afterImage = await call("Page.captureScreenshot", {format: "png"});
  fs.writeFileSync(path.join(renderDir, "playhead-after.png"), Buffer.from(afterImage.data, "base64"));
  console.log("Playhead frames and pixels", JSON.stringify({before: visualBefore, after: visualAfter}));
  if (!visualBefore.pixelOnCursor || !visualAfter.pixelOnCursor) {
    throw new Error("Playhead is missing from actual rendered canvas pixels");
  }
  if (visualAfter.frame.frame - visualBefore.frame.frame < 8) {
    throw new Error("Playhead canvas stopped repainting");
  }
  if (visualAfter.frame.playheadX - visualBefore.frame.playheadX < 10) {
    throw new Error("Playhead visually did not move despite transport playback");
  }
  if (visualAfter.transportSeconds - visualBefore.transportSeconds < 0.40) {
    throw new Error("Tone.Transport audio clock did not advance with playhead");
  }
  const match = await evaluate(`(() => {
    const events = MarchArrangement.eventsFor(80);
    const actual = MarchLab.scheduledNotes.filter(event => event.bar === 0);
    const mismatches = actual.filter(event => !events[event.name]?.some(shape =>
      Math.abs(shape.start - event.start) < 0.025 &&
      Math.abs(shape.length - event.length) < 0.025
    ));
    return {count: actual.length, voices: [...new Set(actual.map(event => event.name))], mismatches};
  })()`);
  console.log("Scheduled audio triggers vs displayed clips", JSON.stringify(match));
  if (match.count < 17 || match.voices.length < 9 || match.mismatches.length) {
    throw new Error("Visual instrument clips differ from actual scheduled audio events: " + JSON.stringify(match));
  }

  await evaluate("tempo.value='108'; tempo.dispatchEvent(new Event('input',{bubbles:true}))");
  await requireCondition("MarchLab.activeTempo === 80 && document.querySelector('#tempo-value').value === '108 BPM'");
  await delay(1750);
  await requireCondition("MarchLab.activeTempo === 108 && MarchLab.transport.state === 'started'");
  await evaluate("document.querySelector('#volume').value='0'; volume.dispatchEvent(new Event('input',{bubbles:true}))");
  await delay(350);
  await requireCondition("MarchLab.graph.routes[5].gain.value < 0.001");
  await evaluate("document.querySelector('#volume').value='74'; document.querySelector('#volume').dispatchEvent(new Event('input',{bubbles:true}))");
  await delay(350);
  await requireCondition("MarchLab.graph.routes[5].gain.value > 0.5");
  await evaluate("document.querySelector('#transport').click()");
  await requireCondition("!MarchLab.graph && MarchLab.transport.state !== 'started' && document.querySelector('#status').textContent === 'Остановлено'");
  await evaluate("document.querySelector('#transport').click()");
  await delay(250);
  await requireCondition("MarchLab.graph && MarchLab.transport.state === 'started'");
  await evaluate("document.querySelector('#transport').click()");
  await requireCondition("!MarchLab.graph && MarchLab.transport.state !== 'started'");
  await evaluate("tempo.focus();");
  for (const [key, code, expected] of [["Home", 36, "40"], ["End", 35, "160"]]) {
    await call("Input.dispatchKeyEvent", {type: "keyDown", key, code: key, windowsVirtualKeyCode: code});
    await call("Input.dispatchKeyEvent", {type: "keyUp", key, code: key, windowsVirtualKeyCode: code});
    await requireCondition("tempo.value === '" + expected + "' && document.querySelector('#tempo-value').value === '" + expected + " BPM'");
  }
  await call("Emulation.setDeviceMetricsOverride", {width: 320, height: 710, deviceScaleFactor: 1, mobile: true});
  await requireCondition("document.documentElement.scrollWidth === 320 && tempo.getBoundingClientRect().width > 110");
  // A tap in the mobile track header must toggle the same audio gain.
  await clickTrack("snare", true);
  await requireCondition("MarchLab.mutedTracks.includes('snare') && MarchArrangement.lastFrame.mutedTracks.includes('snare')");
  await clickTrack("snare", true);
  await requireCondition("MarchLab.mutedTracks.length === 0");
  console.log("Mobile touch mute/unmute passed.");

  if (pageErrors.length) throw new Error("Browser exceptions: " + JSON.stringify(pageErrors));
  if (requests.some(url => !["file:", "blob:", "data:"].some(protocol => url.startsWith(protocol)))) throw new Error("Unexpected network request: " + requests.join(", "));
  console.log("Offline HTML load, Tone.js instruments, play/stop, mute, 80→108 BPM bar-boundary change, slider bounds, and 320px layout passed.");
  console.log("No external network requests; live graph contains each required Tone.js voice.");

  const noiseProbe = await evaluate(`(async()=>{const result=await Tone.Offline(()=>{const noise=new Tone.NoiseSynth({noise:{type:"white"},envelope:{attack:0.001,decay:0.2,sustain:0,release:0.01}});noise.connect(Tone.getContext().destination);noise.triggerAttackRelease(0.2,0.05,1)},0.5,2,48000);const b=result.get();let peak=0;for(let channel=0;channel<b.numberOfChannels;channel++){const data=b.getChannelData(channel);for(let i=0;i<data.length;i++)peak=Math.max(peak,Math.abs(data[i]))}return peak})()`);
  console.log("isolated Tone.NoiseSynth probe peak", noiseProbe);

  // An isolated muted voice must generate silence, not only a zero-valued UI flag.
  const mutedAudio = await evaluate(`(async()=> {
    async function peak(mutedTracks) {
      const buffer = await MarchLab.renderOffline({bpm:80,bars:1,solo:"kick",mutedTracks,sampleRate:24000});
      const channel = buffer.getChannelData(0);
      let maximum = 0;
      for (const sample of channel) maximum = Math.max(maximum, Math.abs(sample));
      return maximum;
    }
    return {normal:await peak([]),muted:await peak(["kick"])};
  })()`);
  console.log("Isolated kick mute audio proof", mutedAudio);
  if (!(mutedAudio.normal > 0.01 && mutedAudio.muted < 0.0001)) {
    throw new Error("Muted kick voice still emitted audio: " + JSON.stringify(mutedAudio));
  }

  const renderExpression = (bpm, bars, solo) => `(async()=>{const buffer=await MarchLab.renderOffline({bpm:${bpm},bars:${bars},solo:${solo ? JSON.stringify(solo) : "null"},sampleRate:48000});const left=buffer.getChannelData(0),right=buffer.getChannelData(1);const pcm=new Float32Array(left.length*2);let peak=0;for(let i=0;i<left.length;i++){pcm[i*2]=left[i];pcm[i*2+1]=right[i];peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));}const bytes=new Uint8Array(pcm.buffer);let chunks=[];for(let i=0;i<bytes.length;i+=16384)chunks.push(String.fromCharCode(...bytes.subarray(i,i+16384)));return {data:btoa(chunks.join('')),peak,length:left.length}})()`;
  for (const [bpm, bars, solo, filename] of [
    [80, 2, "drums", "tone-80-2bars-drums-stereo.f32"],
    [80, 2, null, "tone-80-2bars-full-stereo.f32"],
    [80, 17.35, null, "tone-80-boundary-full-stereo.f32"],
    [108, 17.35, null, "tone-108-boundary-full-stereo.f32"]
  ]) {
    const result = await evaluate(renderExpression(bpm, bars, solo));
    const byteCount = interleaveAndWrite(filename, result.data, result.peak);
    console.log("Tone.Offline rendered " + filename + " at " + bpm + " BPM, " + result.length + " stereo frames, peak " + result.peak.toFixed(3) + ", " + byteCount + " bytes.");
  }
  if (process.argv.includes("--stems")) {
    for (const voice of ["kick", "shell", "tom", "snare", "roll", "metal", "rumble", "sub", "brass", "beater", "kickBody", "snareBody"]) {
      const result = await evaluate(renderExpression(80, 2, voice));
      if (result.peak < 0.0001) throw new Error("Silent voice stem: " + voice);
      const bytes = interleaveAndWrite("tone-80-2bars-stem-" + voice + "-stereo.f32", result.data, result.peak);
      console.log("Voice stem " + voice + ": peak " + result.peak.toFixed(4) + ", bytes " + bytes);
    }
  }
  for (const solo of ["drums", "bass", "brass", "textures"]) {
    const result = await evaluate(renderExpression(80, 2, solo));
    if (result.peak < 0.0005) throw new Error("Silent solo bus: " + solo);
    console.log("Solo bus " + solo + " rendered with peak " + result.peak.toFixed(4));
  }
  if (pageErrors.length) throw new Error("Browser exceptions during offline render: " + JSON.stringify(pageErrors));
} finally {
  clearTimeout(timeout);
  proc.kill();
  await closed;
  fs.rmSync(profile, {recursive: true, force: true});
}
