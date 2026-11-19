#!/usr/bin/env node
// Measure per-track 16-second offline renders from the actual production Tone.js page.
import {spawn} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {performance} from "node:perf_hooks";
import {fileURLToPath, pathToFileURL} from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = path.join(ROOT, "output", "benchmarks");
const CHROME = process.env.CHROME_PATH || "/usr/bin/google-chrome";
const SECONDS = 16;
const BPM = 80;
const RATE = 48000;
const REPEATS = 3;
const BARS = (SECONDS - 0.12) / (2 * 60 / BPM);
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), "tone-render-bench-"));
const proc = spawn(CHROME, [
  "--headless", "--no-sandbox", "--disable-gpu", "--no-first-run",
  "--disable-background-networking", "--no-proxy-server",
  "--host-resolver-rules=MAP * ~NOTFOUND", "--remote-debugging-pipe",
  "--user-data-dir=" + PROFILE, "about:blank"
], {stdio: ["ignore", "ignore", "inherit", "pipe", "pipe"]});

let nextId = 1;
let incoming = "";
const pending = new Map();
proc.stdio[4].setEncoding("utf8");
proc.stdio[4].on("data", chunk => {
  incoming += chunk;
  let end;
  while ((end = incoming.indexOf("\0")) >= 0) {
    const message = JSON.parse(incoming.slice(0, end));
    incoming = incoming.slice(end + 1);
    if (!message.id) continue;
    const waiter = pending.get(message.id);
    if (!waiter) continue;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
  }
});
proc.on("error", error => {
  for (const waiter of pending.values()) waiter.reject(error);
  pending.clear();
});
proc.on("exit", code => {
  for (const waiter of pending.values()) waiter.reject(new Error("Chrome exited: " + code));
  pending.clear();
});
const closed = new Promise(resolve => proc.once("close", resolve));
const watchdog = setTimeout(() => proc.kill(), 12 * 60 * 1000);

function send(method, params = {}, sessionId) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, {resolve, reject});
    proc.stdio[3].write(JSON.stringify({id, method, params, sessionId}) + "\0");
  });
}

async function main() {
  fs.mkdirSync(OUT, {recursive: true});
  const {targetInfos} = await send("Target.getTargets");
  const target = targetInfos.find(item => item.type === "page");
  if (!target) throw new Error("No browser page");
  const {sessionId} = await send("Target.attachToTarget", {targetId: target.targetId, flatten: true});
  const call = (method, params) => send(method, params, sessionId);
  const evaluate = async expression => {
    const reply = await call("Runtime.evaluate", {expression, returnByValue: true, awaitPromise: true});
    if (reply.exceptionDetails) {
      throw new Error(reply.exceptionDetails.exception?.description || reply.exceptionDetails.text);
    }
    return reply.result.value;
  };
  await call("Runtime.enable");
  await call("Page.enable");
  await call("Network.enable");
  await call("Network.emulateNetworkConditions", {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0
  });
  await call("Page.navigate", {
    url: pathToFileURL(path.join(ROOT, "references", "march-of-the-fallen-tone.html")).href
  });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    ready = await evaluate("Boolean(window.MarchLab?.renderOffline && window.MarchArrangement?.tracks)");
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  if (!ready) throw new Error("Tone.js HTML did not initialize");
  const voices = await evaluate("MarchArrangement.tracks.map(track => track.key)");
  if (voices.length !== 13 || new Set(voices).size !== voices.length) {
    throw new Error("Expected 13 unique instrument tracks");
  }
  console.log("BENCH_SETTINGS", JSON.stringify({
    voices, durationSeconds: SECONDS, rate: RATE, repeats: REPEATS, bpm: BPM,
    runner: process.env.RUNNER_NAME || "local", node: process.version
  }));

  const render = async voice => {
    const options = JSON.stringify({bpm: BPM, bars: BARS, solo: voice, isolatedVoice: voice, includeDiagnostics: true, sampleRate: RATE});
    const expression = "(async()=>{" +
      "const started=performance.now();" +
      "const rendered=await MarchLab.renderOffline(" + options + ");" +
      "const audio=rendered.audio;" +
      "const elapsedMs=performance.now()-started;" +
      "let peak=0;" +
      "for(let c=0;c<audio.numberOfChannels;c++){" +
      "const samples=audio.getChannelData(c);" +
      "for(let i=0;i<samples.length;i+=128)peak=Math.max(peak,Math.abs(samples[i]));" +
      "}" +
      "return {elapsedMs,frames:audio.length,channels:audio.numberOfChannels," +
      "durationSeconds:audio.duration,sampledPeak:peak,diagnostics:rendered.diagnostics};" +
      "})()";
    const start = performance.now();
    const stats = await evaluate(expression);
    const expectedLayers = {
      step: ["step", "stepSurface"],
      shell: ["shell", "shellGain", "shellHarmonic", "shellHarmonicGain"],
      roll: ["roll", "rollSwell"],
      brass: ["brass", "brassHarmonics"],
      metal: ["metal", "metalMode"]
    };
    const expected = expectedLayers[voice] || [voice];
    const actual = stats.diagnostics?.instrumentKeys || [];
    if (actual.length !== expected.length || !expected.every(name => actual.includes(name)) ||
      JSON.stringify(stats.diagnostics.voiceGainKeys) !== JSON.stringify([voice]) ||
      stats.diagnostics.busKeys.length !== 1) {
      throw new Error("Isolated graph contains unexpected instruments: " + JSON.stringify({voice, expected, actual, diagnostics: stats.diagnostics}));
    }
    return {...stats, hostWallMs: performance.now() - start};
  };

  // Warm up Chromium and the Web Audio engine before the recorded measurements.
  const warmup = await evaluate("(async()=>{" +
    "const audio=await MarchLab.renderOffline({bpm:80,bars:1,solo:'kick',sampleRate:48000});" +
    "return {seconds:audio.duration,channels:audio.numberOfChannels};})()");
  console.log("BENCH_WARMUP", JSON.stringify(warmup));

  const samples = Object.fromEntries(voices.map(voice => [voice, []]));
  for (let run = 0; run < REPEATS; run++) {
    for (const voice of voices) {
      const result = await render(voice);
      if (result.frames !== SECONDS * RATE || result.channels !== 2) {
        throw new Error("Unexpected audio length or channels: " + JSON.stringify({voice, result}));
      }
      if (!(result.sampledPeak > 0.00001)) {
        throw new Error("Voice rendered silence: " + voice);
      }
      samples[voice].push(result);
      console.log("BENCH_SAMPLE", JSON.stringify({
        voice, run: run + 1, browserMs: +result.elapsedMs.toFixed(3),
        hostMs: +result.hostWallMs.toFixed(3), outputSeconds: result.durationSeconds,
        sampledPeak: +result.sampledPeak.toFixed(6)
      }));
    }
  }

  const rows = voices.map(voice => {
    const items = samples[voice];
    const times = items.map(item => item.elapsedMs).sort((a, b) => a - b);
    const host = items.map(item => item.hostWallMs).sort((a, b) => a - b);
    return {
      voice, medianMs: +times[1].toFixed(3), minMs: +times[0].toFixed(3),
      maxMs: +times[2].toFixed(3), medianHostMs: +host[1].toFixed(3),
      browserSamplesMs: items.map(item => +item.elapsedMs.toFixed(3)),
      hostSamplesMs: items.map(item => +item.hostWallMs.toFixed(3))
    };
  });
  const report = {
    timestamp: new Date().toISOString(), gitSha: process.env.GITHUB_SHA || "",
    runner: process.env.RUNNER_NAME || "local", node: process.version,
    durationSeconds: SECONDS, sampleRate: RATE, bpm: BPM,
    repeats: REPEATS, voiceCount: voices.length,
    method: "MarchLab.renderOffline({solo: voice, isolatedVoice: voice}) in offline Chromium",
    caveat: "Only the selected instrument is built and scheduled. Its family bus and shared master/room processing remain.",
    rows
  };
  const csv = "voice,median_ms,min_ms,max_ms,median_host_ms\n" +
    rows.map(row => [row.voice, row.medianMs, row.minMs, row.maxMs, row.medianHostMs].join(",")).join("\n") + "\n";
  const md = "# Tone.js offline solo benchmark, 16 seconds\n\n" +
    "Chrome / 48 kHz / stereo / 80 BPM / 3 repetitions per voice\n\n" +
    "| Voice | Median (ms) | Min (ms) | Max (ms) | CDP wall (ms) |\n" +
    "| --- | ---: | ---: | ---: | ---: |\n" +
    rows.map(r => "| " + [r.voice, r.medianMs, r.minMs, r.maxMs, r.medianHostMs].join(" | ") + " |").join("\n") + "\n\n" +
    "**Isolation:** Only the selected instrument is instantiated and scheduled.\n" +
    "Its family bus and shared master/room effects remain for consistency.\n";
  fs.writeFileSync(path.join(OUT, "tone-offline-16s.json"), JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(path.join(OUT, "tone-offline-16s.csv"), csv);
  fs.writeFileSync(path.join(OUT, "tone-offline-16s.md"), md);
  console.log("BENCH_RESULT", JSON.stringify(report));
}

try {
  await main();
} catch (error) {
  console.error("BENCH_FAILED", error?.stack || error);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  proc.kill();
  await closed;
  fs.rmSync(PROFILE, {recursive: true, force: true});
}
