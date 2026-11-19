/*
 * Arrangement visualization for the procedural march.
 * It mirrors scheduleBar timing, without changing the audio graph.
 */
(() => {
  "use strict";

  const PHRASE_BARS = 16;
  const STEPS_PER_BAR = 8;
  const TRACKS = [
    {key: "kick", label: "Kick", icon: "◉", color: "#ff9274"},
    {key: "beater", label: "Beater", icon: "✳", color: "#ffb19d"},
    {key: "kickBody", label: "Body", icon: "◌", color: "#f8bd81"},
    {key: "shell", label: "Shell", icon: "◎", color: "#ffd096"},
    {key: "snare", label: "Snare", icon: "▣", color: "#dfacfc"},
    {key: "snareBody", label: "S.Body", icon: "◈", color: "#b8a5ff"},
    {key: "roll", label: "Roll", icon: "≋", color: "#f3a2d1"},
    {key: "tom", label: "Tom", icon: "●", color: "#e0a5aa"},
    {key: "sub", label: "Sub", icon: "▂", color: "#83b4ff"},
    {key: "brass", label: "Brass", icon: "♬", color: "#b69bff"},
    {key: "metal", label: "Metal", icon: "✦", color: "#90dbee"},
    {key: "rumble", label: "Rumble", icon: "≈", color: "#92c9bc"}
  ];
  const ACCENTS = new Set([1, 4, 7, 9]);
  const cached = new Map();
  let lastFrame = null;
  let frameCount = 0;

  function eventsFor(bpm) {
    const tempo = Number(bpm);
    if (cached.has(tempo)) return cached.get(tempo);
    const beat = 60 / tempo;
    const stepSeconds = beat / 4;
    const result = Object.fromEntries(TRACKS.map(track => [track.key, []]));
    const add = (key, position, length, velocity = 1) => {
      result[key].push({start: position, length: Math.max(length, 0.10), velocity});
    };
    for (let bar = 0; bar < PHRASE_BARS; bar++) {
      const pedal = bar >= 8;
      const start = bar * STEPS_PER_BAR;
      for (let foot = 0; foot < 2; foot++) {
        const step = start + foot * 4;
        const accented = ACCENTS.has(bar * 2 + foot);
        const weight = pedal ? 0.68 : (foot === 0 ? 1 : 0.88);
        add("kick", step, 0.060 / stepSeconds, weight);
        add("beater", step, 0.016 / stepSeconds, weight);
        add("kickBody", step, 0.047 / stepSeconds, weight * 0.8);
        add("shell", step + 0.052 / stepSeconds, 0.84 * beat / stepSeconds, weight);
        add("snareBody", step, 0.045 / stepSeconds, weight * 0.55);
        add("snare", step, 0.034 / stepSeconds, weight);
        add("snare", step + 0.012 / stepSeconds, 0.027 / stepSeconds, weight * 0.65);
        add("roll", step + 0.68, 0.84 * beat / stepSeconds, pedal ? 0.25 : 0.42);
        if (accented || (pedal && foot === 0)) add("metal", step, 0.070 / stepSeconds, pedal ? 0.075 : 0.11);
        if (!pedal) {
          if (!accented && foot === 0) add("tom", step + 1.04, 0.094 / stepSeconds, 0.34);
          add("sub", step + 1.18, accented ? 2.62 : 2.20, accented ? 0.60 : 0.17);
          if (accented) add("brass", step + 1.33, 2.4, 0.35);
        }
      }
      if (pedal) {
        add("sub", start, 7.85, 0.46 + 0.10 * Math.sin((bar - 8) * 0.42));
        add("brass", start + (bar % 2 ? 2.2 : 0.85), bar % 2 ? 3.8 : 3.2, 0.35);
        if (bar % 4 === 3) add("brass", start + 6, 1.35, 0.21);
      }
      if (bar % 2 === 0) add("rumble", start, 2.4 / stepSeconds, 0.16);
      if (bar % 4 === 1 || bar % 4 === 3) {
        add("tom", start + 6.89, 0.094 / stepSeconds, 0.32);
        add("snare", start + 7.5, 0.027 / stepSeconds, 0.08);
      }
    }
    cached.set(tempo, result);
    return result;
  }

  function draw(ctx, {width, height, bpm, step, playing}) {
    const events = eventsFor(bpm);
    const plotBars = width < 570 ? 4 : 8;
    const period = PHRASE_BARS * STEPS_PER_BAR;
    const current = ((Number(step) % period) + period) % period;
    const viewStartBar = Math.floor(current / (plotBars * STEPS_PER_BAR)) * plotBars;
    const viewStart = viewStartBar * STEPS_PER_BAR;
    const count = plotBars * STEPS_PER_BAR;
    const labelWidth = width < 570 ? Math.min(86, width * 0.31) : 120;
    const plotX = labelWidth + 6;
    const plotWidth = Math.max(1, width - plotX - 7);
    const headerHeight = 29;
    const trackHeight = (height - headerHeight - 5) / TRACKS.length;

    ctx.fillStyle = "#101113";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#191a1e";
    ctx.fillRect(0, 0, labelWidth, height);
    ctx.fillStyle = "#15171a";
    ctx.fillRect(plotX, 0, plotWidth, height);

    for (let i = 0; i <= count; i++) {
      const x = plotX + i / count * plotWidth;
      ctx.strokeStyle = i % STEPS_PER_BAR === 0 ? "#505055" : i % 4 === 0 ? "#393a40" : "#282a2f";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, headerHeight);
      ctx.lineTo(x + 0.5, height);
      ctx.stroke();
    }
    ctx.textBaseline = "middle";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#aaa6a0";
    ctx.fillText("TRACK", 11, 14);
    for (let bar = 0; bar < plotBars; bar++) {
      ctx.fillStyle = "#a9a7a1";
      ctx.fillText(String(viewStartBar + bar + 1), plotX + (bar + 0.08) * plotWidth / plotBars, 14);
    }

    TRACKS.forEach((track, index) => {
      const y = headerHeight + index * trackHeight;
      const end = y + trackHeight;
      ctx.fillStyle = index % 2 ? "#17191b" : "#1b1d20";
      ctx.fillRect(0, y, labelWidth, trackHeight);
      ctx.strokeStyle = "#313136";
      ctx.beginPath();
      ctx.moveTo(0, end + 0.5);
      ctx.lineTo(width, end + 0.5);
      ctx.stroke();

      const instances = [];
      for (const event of events[track.key]) {
        for (const offset of [-period, 0, period]) {
          const start = event.start + offset;
          if (start + event.length > viewStart && start < viewStart + count) {
            instances.push({...event, start});
          }
        }
      }
      const active = playing && instances.some(event => event.start <= current && event.start + event.length >= current);
      if (active) {
        ctx.fillStyle = "#343036";
        ctx.fillRect(0, y + 1, labelWidth, Math.max(0, trackHeight - 2));
      }
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.fillStyle = track.color;
      ctx.fillText(track.icon, 7, y + trackHeight / 2);
      ctx.font = width < 570 ? "11px system-ui, sans-serif" : "12px system-ui, sans-serif";
      ctx.fillStyle = active ? "#fff9ef" : "#d1cec9";
      ctx.fillText(track.label, 25, y + trackHeight / 2);

      for (const event of instances) {
        const left = plotX + Math.max(0, event.start - viewStart) / count * plotWidth;
        const right = plotX + Math.min(count, event.start + event.length - viewStart) / count * plotWidth;
        const blockWidth = Math.max(2.5, right - left);
        const blockHeight = Math.max(2, trackHeight - 7);
        ctx.globalAlpha = active && event.start <= current && event.start + event.length >= current
          ? 1 : 0.50 + 0.4 * Math.min(1, event.velocity);
        ctx.fillStyle = track.color;
        ctx.fillRect(left, y + 3.5, blockWidth, blockHeight);
      }
      ctx.globalAlpha = 1;
    });

    const headX = plotX + (current - viewStart) / count * plotWidth;
    lastFrame = {
      frame: ++frameCount, step: current, playheadX: headX, playing,
      viewStart, plotX, plotWidth, width, height,
      activeTracks: TRACKS.filter(track => events[track.key].some(event => {
        for (const offset of [-period, 0, period]) {
          const start = event.start + offset;
          if (start <= current && start + event.length >= current) return true;
        }
        return false;
      })).map(track => track.key)
    };
    if (headX >= plotX && headX <= plotX + plotWidth) {
      ctx.strokeStyle = "#ff815e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(headX, 0);
      ctx.lineTo(headX, height);
      ctx.stroke();
      ctx.fillStyle = "#ff815e";
      ctx.beginPath();
      ctx.moveTo(headX - 5, 0);
      ctx.lineTo(headX + 5, 0);
      ctx.lineTo(headX, 9);
      ctx.closePath();
      ctx.fill();
    }
  }

  window.MarchArrangement = Object.freeze({
    tracks: TRACKS, eventsFor, draw,
    get lastFrame() { return lastFrame; }
  });
})();
