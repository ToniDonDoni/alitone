import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "march-chrome-"));
const renderDir = path.join(root, "output", "renders");
const chrome = process.env.CHROME_PATH || "google-chrome";
const proc = spawn(chrome, ["--headless", "--no-proxy-server", "--host-resolver-rules=MAP * ~NOTFOUND", "--disable-gpu", "--no-first-run", "--disable-background-networking",
  "--remote-debugging-pipe", "--user-data-dir=" + profile, "about:blank"],
  {stdio: ["ignore", "ignore", "inherit", "pipe", "pipe"]});

let next = 1, raw = "";
const pending = new Map();
let pageErrors = [];
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
    }
  }
});
function send(method, params = {}, sessionId) {
  const id = next++;
  return new Promise((resolve, reject) => {
    pending.set(id, {resolve, reject});
    proc.stdio[3].write(JSON.stringify({id, method, params, sessionId}) + "\0");
  });
}
proc.on("error", error => {
  for (const {reject} of pending.values()) reject(error);
});
const closed = new Promise(resolve => proc.once("close", resolve));
proc.on("exit", code => {
  for (const {reject} of pending.values()) reject(new Error("Chrome exited: " + code));
});
const timeout = setTimeout(() => proc.kill(), 60000);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const {targetInfos} = await send("Target.getTargets");
  const {sessionId} = await send("Target.attachToTarget", {targetId: targetInfos.find(t => t.type === "page").targetId, flatten: true});
  const call = (method, params) => send(method, params, sessionId);
  const evaluate = async expression => {
    const r = await call("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  async function requireCondition(expression) {
    if (!(await evaluate(expression))) throw new Error("Check failed: " + expression);
  }
  await call("Runtime.enable");
  await call("Page.enable");
  await call("Network.enable");
  await call("Network.emulateNetworkConditions", {offline:true, latency:0, downloadThroughput:0, uploadThroughput:0});
  await call("Emulation.setDeviceMetricsOverride", {width: 1200, height: 820, deviceScaleFactor: 1, mobile: false});
  await call("Page.navigate", {url: pathToFileURL(path.join(root, "references", "march-of-the-fallen-revised.html")).href});
  for (let i = 0; i < 50 && !(await evaluate("typeof March === 'function'")); i++) await delay(50);
  await requireCondition("typeof March === 'function' && tempo.type === 'range' && tempo.value === '80' && tempoValue.value === '80 BPM' && tempo.min === '40' && tempo.max === '160' ");
  const pos = await evaluate("(() => { const r = button.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2} })()");
  await call("Input.dispatchMouseEvent", {...pos,type:"mousePressed",button:"left",clickCount:1});
  await call("Input.dispatchMouseEvent", {...pos,type:"mouseReleased",button:"left",clickCount:1});
  await delay(650);
  await requireCondition('context.state === "running" && status.textContent === "Играет" && Math.max(...samples.map(Math.abs)) > .006');
  await evaluate('window.tempoCheck = {engine: march, nextTime: nextBarTime, nextIndex: nextBar}; tempo.focus();');
  await call("Input.dispatchKeyEvent", {type:"keyDown", key:"ArrowRight", code:"ArrowRight", windowsVirtualKeyCode:39});
  await call("Input.dispatchKeyEvent", {type:"keyUp", key:"ArrowRight", code:"ArrowRight", windowsVirtualKeyCode:39});
  await requireCondition('tempo.value === "81" && tempoValue.value === "81 BPM"');
  await evaluate('tempo.value = "66"; tempo.dispatchEvent(new Event("input", {bubbles:true}));');
  await requireCondition('tempoValue.value === "66 BPM" && march === tempoCheck.engine && march.bpm === 80');
  for (let i = 0; i < 70 && !(await evaluate("march.bpm === 66")); i++) await delay(50);
  await requireCondition('march.bpm === 66 && march === tempoCheck.engine && nextBar > tempoCheck.nextIndex && Math.abs(scheduledBars.at(-1).time - tempoCheck.nextTime) < .002 && status.textContent === "Играет"');
  const shot = await call("Page.captureScreenshot", {format:"png"});
  fs.writeFileSync(path.join(profile, "desktop.png"), Buffer.from(shot.data, "base64"));
  await evaluate('volumeControl.value = "0"; volumeControl.dispatchEvent(new Event("input"));');
  await delay(550);
  await requireCondition("Math.abs(volume.gain.value) < .0001");
  await evaluate("button.click(); tempo.focus();");
  await requireCondition('march === null && status.textContent === "Остановлено"');
  for (const [key, code, value] of [["Home",36,"40"],["End",35,"160"]]) {
    await call("Input.dispatchKeyEvent", {type:"keyDown", key, code:key, windowsVirtualKeyCode:code});
    await call("Input.dispatchKeyEvent", {type:"keyUp", key, code:key, windowsVirtualKeyCode:code});
    await requireCondition(`tempo.value === "${value}" && tempoValue.value === "${value} BPM"`);
  }
  await call("Emulation.setDeviceMetricsOverride", {width: 320, height: 710, deviceScaleFactor: 1, mobile: true});
  await delay(120);
  await requireCondition("document.documentElement.scrollWidth === 320 && tempo.getBoundingClientRect().width > 110");
  const mobile = await call("Page.captureScreenshot", {format:"png"});
  fs.writeFileSync(path.join(profile, "mobile.png"), Buffer.from(mobile.data, "base64"));
  if (pageErrors.length) throw new Error(JSON.stringify(pageErrors));
  console.log("80 BPM startup, keyboard slider, live 80 → 66 BPM on the expected bar without restart, 40 and 160 BPM bounds, mute, stop, and 320px mobile layout passed");

  if (process.argv.includes("--render")) {
    for (const [bpm, duration, layer] of [[80, 3, "drums"], [80, 26, "full"], [108, 42, "full"]]) {
      const {data, peak} = await evaluate(`(async () => {
        const rate = 48000;
        const offline = new OfflineAudioContext(2, rate * ${duration}, rate);
        const synth = new March(offline, ${bpm}, createMaster(offline, offline.destination));
        if ("${layer}" === "drums") {
          const harmonic = new Set();
          const note = synth.note.bind(synth);
          synth.note = (...args) => {
            const buffer = note(...args);
            harmonic.add(buffer);
            return buffer;
          };
          const play = synth.play.bind(synth);
          synth.play = (buffer, ...args) => {
            if (!harmonic.has(buffer)) play(buffer, ...args);
          };
        }
        for (let i=0; i*synth.barDuration < ${duration}; i++) synth.scheduleBar(i, i*synth.barDuration);
        const result = await offline.startRendering();
        const pcm = new Float32Array(result.length);
        const l = result.getChannelData(0), r = result.getChannelData(1);
        let peak = 0;
        for (let i=0; i<pcm.length; i++) {
          pcm[i] = (l[i]+r[i])/2;
          peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
        }
        const bytes = new Uint8Array(pcm.buffer);
        const blocks = [];
        for (let i=0; i<bytes.length; i+=16384) blocks.push(String.fromCharCode(...bytes.subarray(i,i+16384)));
        return {data: btoa(blocks.join("")), peak};
      })()`);
      const name = path.join(renderDir, `revision-${bpm}-${layer}.f32`);
      fs.writeFileSync(name, Buffer.from(data, "base64"));
      if (peak >= 1) throw new Error("Clipping in " + name + " at " + peak);
      console.log(`Web Audio rendered ${duration} s at ${bpm} BPM (${layer}), stereo peak ${peak.toFixed(3)}`);
    }
  }
} finally {
  clearTimeout(timeout);
  proc.kill();
  await closed;
  fs.rmSync(profile, {recursive: true, force: true});
}
