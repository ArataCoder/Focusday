/* Focusday · ambient-engine.js — процедурные фоновые звуки на Web Audio API (без .mp3).
   Чистый модуль без DOM: работает и с AudioContext, и с OfflineAudioContext (тесты). */
export const SOUNDS = [
  { id: 'rain', name: 'Дождь', emoji: '🌧️', level: 0.8 },
  { id: 'cafe', name: 'Кафе', emoji: '☕', level: 1.3 },
  { id: 'library', name: 'Библиотека', emoji: '📚', level: 0.6 },
  { id: 'brown', name: 'Коричневый шум', emoji: '🟤', level: 0.48 },
  { id: 'pink', name: 'Розовый шум', emoji: '🌸', level: 1.0 },
  { id: 'ocean', name: 'Океан', emoji: '🌊', level: 0.54 },
  { id: 'fire', name: 'Камин', emoji: '🔥', level: 0.9 },
  { id: 'wind', name: 'Ветер', emoji: '🍃', level: 1.5 }
];

const buffers = new WeakMap();
function makeNoise(ctx, kind, seconds = 8) {
  const sr = ctx.sampleRate, n = Math.floor(sr * seconds), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w * 0.5;
    else if (kind === 'pink') { // Paul Kellet
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } // brown
  }
  // бесшовная петля: кроссфейд хвоста с началом (без щелчка на стыке)
  const x = Math.floor(sr * 0.25);
  for (let i = 0; i < x; i++) { const k = i / x; d[n - x + i] = d[n - x + i] * (1 - k) + d[i] * k; }
  return buf;
}
function noiseBuf(ctx, kind) {
  let m = buffers.get(ctx); if (!m) { m = {}; buffers.set(ctx, m); }
  return m[kind] || (m[kind] = makeNoise(ctx, kind, kind === 'white' ? 2 : 8));
}

const G = (ctx, v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
const F = (ctx, type, f, Q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; return b; };
function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }

export function buildSound(ctx, id, dest) {
  const nodes = [], timers = [];
  const src = (kind, offset = Math.random() * 4) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx, kind); s.loop = true; s.start(ctx.currentTime, offset); nodes.push(s); return s; };
  const lfo = (freq, depth, param) => { const o = ctx.createOscillator(); o.frequency.value = freq; o.connect(G(ctx, depth)).connect(param); o.start(); nodes.push(o); return o; };
  const out = G(ctx, 1); out.connect(dest);

  // одиночные события (капли, звон чашек, треск, шелест страниц)
  const burst = (t, { f = 3000, q = 1, type = 'bandpass', dur = 0.02, amp = 0.1, attack = 0.002 }) => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx, 'white');
    const flt = F(ctx, type, f, q), g = G(ctx, 0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
    chain(s, flt, g, out); s.start(t, Math.random() * 1.5); s.stop(t + attack + dur + 0.05);
  };
  const clink = (t) => {
    const f0 = 2100 + Math.random() * 1400, amp = 0.012 + Math.random() * 0.02;
    [1, 2.76, 5.4].forEach((r, i) => { const o = ctx.createOscillator(), g = G(ctx, 0); o.frequency.value = f0 * r;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp / (i + 1), t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35 + Math.random() * 0.4);
      chain(o, g, out); o.start(t); o.stop(t + 0.9); });
  };
  const EVENTS = {
    rain: [{ rate: 22, fn: t => burst(t, { f: 2200 + Math.random() * 4200, q: 1.4, dur: 0.012 + Math.random() * 0.03, amp: 0.02 + Math.random() * 0.07 }) }],
    cafe: [{ rate: 0.28, fn: clink }, { rate: 0.6, fn: t => burst(t, { f: 900, q: 0.6, dur: 0.12, amp: 0.025, attack: 0.03 }) }],
    library: [{ rate: 0.09, fn: t => { for (let k = 0; k < 3; k++) burst(t + k * 0.09, { f: 1600 + Math.random() * 1200, q: 0.7, dur: 0.18, amp: 0.035, attack: 0.04 }); } }],
    fire: [{ rate: 7, fn: t => burst(t, { type: 'highpass', f: 1500 + Math.random() * 2500, q: 0.5, dur: 0.004 + Math.random() * 0.01, amp: 0.05 + Math.random() * 0.3 }) },
           { rate: 0.5, fn: t => burst(t, { type: 'lowpass', f: 300, q: 0.7, dur: 0.06, amp: 0.4 }) }]
  }[id] || [];

  switch (id) {
    case 'rain':
      chain(src('pink'), F(ctx, 'highpass', 450), F(ctx, 'lowpass', 7500), G(ctx, 0.55), out);
      chain(src('brown'), F(ctx, 'lowpass', 380), G(ctx, 0.35), out); break;
    case 'cafe': {
      const m1 = G(ctx, 0.5), m2 = G(ctx, 0.3);
      chain(src('brown'), F(ctx, 'bandpass', 480, 0.6), m1, out); lfo(0.17, 0.18, m1.gain);
      chain(src('pink'), F(ctx, 'bandpass', 1150, 0.9), m2, out); lfo(0.23, 0.12, m2.gain);
      chain(src('pink'), F(ctx, 'lowpass', 3200), G(ctx, 0.05), out); break; }
    case 'library':
      chain(src('brown'), F(ctx, 'lowpass', 260), G(ctx, 0.5), out);
      chain(src('pink'), F(ctx, 'bandpass', 850, 0.5), G(ctx, 0.05), out); break;
    case 'brown': chain(src('brown'), F(ctx, 'lowpass', 1100), G(ctx, 0.85), out); break;
    case 'pink': chain(src('pink'), F(ctx, 'lowpass', 9000), G(ctx, 0.42), out); break;
    case 'ocean': {
      const lp = F(ctx, 'lowpass', 520), g = G(ctx, 0.5), foamG = G(ctx, 0.05);
      chain(src('brown'), lp, g, out); lfo(0.075, 380, lp.frequency); lfo(0.075, 0.32, g.gain);
      chain(src('pink'), F(ctx, 'highpass', 1800), foamG, out); lfo(0.075, 0.045, foamG.gain); break; }
    case 'fire': chain(src('brown'), F(ctx, 'lowpass', 600), G(ctx, 0.45), out); break;
    case 'wind': {
      const bp = F(ctx, 'bandpass', 520, 1.1), g = G(ctx, 0.6);
      chain(src('pink'), bp, g, out); lfo(0.05, 260, bp.frequency); lfo(0.13, 110, bp.frequency); lfo(0.07, 0.22, g.gain); break; }
    default: chain(src('brown'), G(ctx, 0.6), out);
  }

  // планировщик событий: realtime — с упреждением 0,5 с, offline — сразу на всю длину
  let horizon = ctx.currentTime;
  const plan = (until) => { for (const ev of EVENTS) { let t = Math.max(horizon, ctx.currentTime); while ((t += -Math.log(1 - Math.random()) / ev.rate) < until) ev.fn(t); } horizon = until; };
  if (EVENTS.length) {
    if (typeof ctx.startRendering === 'function') plan(ctx.length / ctx.sampleRate);
    else { plan(ctx.currentTime + 0.6); timers.push(setInterval(() => plan(ctx.currentTime + 0.6), 250)); }
  }
  return { output: out, stop(at = ctx.currentTime) { timers.forEach(clearInterval); nodes.forEach(n => { try { n.stop(at); } catch (_) {} }); setTimeout(() => { try { out.disconnect(); } catch (_) {} }, Math.max(0, (at - ctx.currentTime) * 1000) + 200); } };
}

/** Плеер: один звук за раз, плавный вход/выход, громкость 0–1. */
export function createAmbientPlayer(getCtx) {
  let ctx = null, master = null, cur = null, curId = null, vol = 0.5, fadeTimer = null;
  const ensure = () => {
    if (!ctx) { ctx = getCtx(); master = ctx.createGain(); master.gain.value = 0; const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; master.connect(comp).connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume?.(); return ctx;
  };
  const level = (id) => (SOUNDS.find(s => s.id === id)?.level || 1);
  return {
    get playing() { return !!cur; }, get id() { return curId; },
    play(id, fadeIn = 1.6) {
      ensure(); clearTimeout(fadeTimer);
      if (cur && curId === id) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(vol * level(id), ctx.currentTime, fadeIn / 3); return; }
      if (cur) { const old = cur, g = old.output; g.gain.setTargetAtTime(0, ctx.currentTime, 0.4); old.stop(ctx.currentTime + 1.6); }
      cur = buildSound(ctx, id, master); curId = id;
      cur.output.gain.setValueAtTime(0, ctx.currentTime); cur.output.gain.setTargetAtTime(1, ctx.currentTime, 0.5);
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(vol * level(id), ctx.currentTime, fadeIn / 3);
    },
    stop(fadeOut = 1.5) {
      if (!cur || !ctx) return; const s = cur; cur = null;
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeOut);
      s.stop(ctx.currentTime + fadeOut + 0.1); fadeTimer = setTimeout(() => { if (!cur) curId = null; }, fadeOut * 1000 + 150);
    },
    setVolume(v) { vol = Math.max(0, Math.min(1, Number(v) || 0)); if (cur && ctx) master.gain.setTargetAtTime(vol * level(curId), ctx.currentTime, 0.08); }
  };
}
