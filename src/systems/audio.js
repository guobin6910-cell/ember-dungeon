/** Web Audio API 合成音效（無外部音檔） */
let ctx = null;
let master = null;
let noiseBuf = null;
let muted = false;
let ambient = null;
const last = {};

function tone({ type = 'square', f0 = 440, f1 = f0, dur = 0.15, vol = 0.3, delay = 0, attack = 0.005 }) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise({ dur = 0.2, vol = 0.3, type = 'bandpass', f0 = 1000, f1 = f0, q = 1, delay = 0, attack = 0.005 }) {
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.05);
}

const SOUNDS = {
  swing: () => noise({ dur: 0.14, vol: 0.25, type: 'bandpass', f0: 2500, f1: 600, q: 1.2 }),
  hit: () => {
    noise({ dur: 0.08, vol: 0.4, type: 'lowpass', f0: 3000, f1: 300 });
    tone({ type: 'square', f0: 180, f1: 60, dur: 0.1, vol: 0.18 });
  },
  crit: () => {
    noise({ dur: 0.12, vol: 0.5, type: 'lowpass', f0: 5000, f1: 200 });
    tone({ type: 'sawtooth', f0: 320, f1: 50, dur: 0.18, vol: 0.2 });
  },
  hurt: () => {
    tone({ type: 'sawtooth', f0: 220, f1: 90, dur: 0.2, vol: 0.25 });
    noise({ dur: 0.1, vol: 0.25, type: 'lowpass', f0: 1200, f1: 200 });
  },
  enemyDie: () => {
    noise({ dur: 0.35, vol: 0.3, type: 'bandpass', f0: 900, f1: 150, q: 2 });
    tone({ type: 'triangle', f0: 300, f1: 70, dur: 0.3, vol: 0.15 });
  },
  coin: () => {
    tone({ type: 'square', f0: 1320, dur: 0.06, vol: 0.12 });
    tone({ type: 'square', f0: 1760, dur: 0.12, vol: 0.12, delay: 0.06 });
  },
  pickup: () => {
    tone({ type: 'triangle', f0: 520, f1: 780, dur: 0.12, vol: 0.2 });
    tone({ type: 'triangle', f0: 780, f1: 1040, dur: 0.15, vol: 0.18, delay: 0.08 });
  },
  rare: () => {
    [660, 880, 1100, 1320].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.3, vol: 0.15, delay: i * 0.07 }));
  },
  levelUp: () => {
    [392, 523, 659, 784, 1046].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.22, vol: 0.13, delay: i * 0.09 }));
    tone({ type: 'sine', f0: 1046, dur: 0.8, vol: 0.15, delay: 0.45 });
  },
  fireball: () => {
    noise({ dur: 0.35, vol: 0.3, type: 'bandpass', f0: 400, f1: 2000, q: 0.8 });
    tone({ type: 'sawtooth', f0: 120, f1: 300, dur: 0.25, vol: 0.1 });
  },
  explode: () => {
    noise({ dur: 0.5, vol: 0.5, type: 'lowpass', f0: 2000, f1: 80 });
    tone({ type: 'sine', f0: 120, f1: 35, dur: 0.4, vol: 0.35 });
  },
  whirl: () => {
    for (let i = 0; i < 3; i++) noise({ dur: 0.15, vol: 0.25, type: 'bandpass', f0: 1800, f1: 500, q: 1.5, delay: i * 0.12 });
  },
  heal: () => {
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.4, vol: 0.12, delay: i * 0.05 }));
  },
  dodge: () => noise({ dur: 0.22, vol: 0.2, type: 'highpass', f0: 600, f1: 3000, q: 0.7 }),
  arrow: () => noise({ dur: 0.12, vol: 0.15, type: 'bandpass', f0: 3000, f1: 1500, q: 3 }),
  slam: () => {
    noise({ dur: 0.45, vol: 0.5, type: 'lowpass', f0: 800, f1: 60 });
    tone({ type: 'sine', f0: 90, f1: 30, dur: 0.45, vol: 0.4 });
  },
  roar: () => {
    tone({ type: 'sawtooth', f0: 90, f1: 55, dur: 1.4, vol: 0.3, attack: 0.15 });
    tone({ type: 'sawtooth', f0: 93, f1: 50, dur: 1.4, vol: 0.25, attack: 0.15 });
    noise({ dur: 1.2, vol: 0.25, type: 'lowpass', f0: 600, f1: 100, attack: 0.2 });
  },
  nova: () => {
    tone({ type: 'sine', f0: 200, f1: 800, dur: 0.3, vol: 0.2 });
    noise({ dur: 0.3, vol: 0.2, type: 'bandpass', f0: 800, f1: 2500, q: 2 });
  },
  denied: () => tone({ type: 'square', f0: 140, f1: 110, dur: 0.12, vol: 0.12 }),
  click: () => tone({ type: 'square', f0: 660, f1: 880, dur: 0.05, vol: 0.1 }),
  equip: () => {
    noise({ dur: 0.1, vol: 0.25, type: 'highpass', f0: 2000, f1: 4000 });
    tone({ type: 'triangle', f0: 400, f1: 300, dur: 0.12, vol: 0.15 });
  },
  death: () => {
    [330, 262, 196, 131].forEach((f, i) => tone({ type: 'sawtooth', f0: f, f1: f * 0.95, dur: 0.6, vol: 0.15, delay: i * 0.35 }));
  },
  victory: () => {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone({ type: 'square', f0: f, dur: 0.3, vol: 0.12, delay: i * 0.14 }));
    tone({ type: 'sine', f0: 523, dur: 1.5, vol: 0.15, delay: 1.0 });
  },
  forge: () => {
    tone({ type: 'triangle', f0: 980, f1: 720, dur: 0.28, vol: 0.24 });
    tone({ type: 'sine', f0: 1960, f1: 1480, dur: 0.22, vol: 0.14 });
    noise({ dur: 0.08, vol: 0.25, type: 'highpass', f0: 3200, f1: 1800 });
  },
  book: () => {
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.35, vol: 0.14, delay: i * 0.06 }));
  },
  lightning: () => {
    noise({ dur: 0.16, vol: 0.3, type: 'highpass', f0: 2600, f1: 900 });
    tone({ type: 'sawtooth', f0: 880, f1: 240, dur: 0.14, vol: 0.14 });
  },
  frost: () => {
    [1320, 1760, 2093].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.25, vol: 0.1, delay: i * 0.04 }));
    noise({ dur: 0.3, vol: 0.22, type: 'bandpass', f0: 2200, f1: 700, q: 1.2 });
  },
  dash: () => {
    noise({ dur: 0.18, vol: 0.28, type: 'bandpass', f0: 600, f1: 3200, q: 0.9 });
    tone({ type: 'triangle', f0: 240, f1: 540, dur: 0.12, vol: 0.14 });
  },
  meteor: () => {
    tone({ type: 'sawtooth', f0: 420, f1: 80, dur: 0.45, vol: 0.16 });
    noise({ dur: 0.65, vol: 0.55, type: 'lowpass', f0: 2200, f1: 70, delay: 0.1 });
    tone({ type: 'sine', f0: 110, f1: 28, dur: 0.55, vol: 0.4, delay: 0.1 });
  },
  portal: () => {
    tone({ type: 'sine', f0: 180, f1: 360, dur: 0.45, vol: 0.18 });
    tone({ type: 'sine', f0: 270, f1: 540, dur: 0.45, vol: 0.12, delay: 0.06 });
  },
  smash: () => {
    noise({ dur: 0.22, vol: 0.35, type: 'lowpass', f0: 1800, f1: 180 });
    tone({ type: 'triangle', f0: 160, f1: 55, dur: 0.16, vol: 0.2 });
  },
  chest: () => {
    tone({ type: 'triangle', f0: 420, f1: 280, dur: 0.09, vol: 0.2 });
    [660, 880, 1100, 1320].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.26, vol: 0.14, delay: 0.08 + i * 0.06 }));
  },
  shrine: () => {
    [392, 493.88, 587.33, 783.99].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.6, vol: 0.12, delay: i * 0.05 }));
  },
  trap: () => {
    noise({ dur: 0.12, vol: 0.32, type: 'highpass', f0: 2200, f1: 900 });
    tone({ type: 'square', f0: 520, f1: 190, dur: 0.1, vol: 0.16 });
  },
  web: () => {
    noise({ dur: 0.14, vol: 0.18, type: 'bandpass', f0: 2400, f1: 900, q: 1.5 });
  },
  rune: () => {
    [784, 1046, 1318].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.25, vol: 0.14, delay: i * 0.045 }));
  },
  runeword: () => {
    [392, 587.33, 783.99, 1046.5, 1318.5].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.45, vol: 0.15, delay: i * 0.07 }));
    tone({ type: 'sine', f0: 1568, dur: 0.9, vol: 0.14, delay: 0.32 });
  },
  thorns: () => {
    noise({ dur: 0.09, vol: 0.25, type: 'highpass', f0: 2600, f1: 1100 });
    tone({ type: 'square', f0: 680, f1: 310, dur: 0.09, vol: 0.14 });
  },
  shield: () => {
    [523, 659, 988].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.35, vol: 0.14, delay: i * 0.05 }));
  },
  poison: () => {
    noise({ dur: 0.35, vol: 0.22, type: 'bandpass', f0: 900, f1: 420, q: 2.2 });
    tone({ type: 'triangle', f0: 180, f1: 110, dur: 0.22, vol: 0.12 });
  },
  blink: () => {
    noise({ dur: 0.15, vol: 0.24, type: 'highpass', f0: 1400, f1: 3600 });
    tone({ type: 'sine', f0: 440, f1: 960, dur: 0.14, vol: 0.14 });
  },
  soul: () => {
    [330, 440, 659].forEach((f, i) => tone({ type: 'triangle', f0: f, f1: f * 1.15, dur: 0.32, vol: 0.14, delay: i * 0.05 }));
  },
};

export const Sfx = {
  init() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  },
  play(name) {
    if (!ctx || muted || ctx.state !== 'running') return;
    const now = performance.now();
    if (last[name] && now - last[name] < 45) return;
    last[name] = now;
    try { SOUNDS[name] && SOUNDS[name](); } catch (e) { /* 忽略 */ }
  },
  toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.35;
    return muted;
  },
  get muted() { return muted; },
  startAmbient() {
    if (!ctx || ambient) return;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 3);
    out.connect(master);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 180;
    filt.connect(out);
    const nodes = [];
    [41.2, 41.6, 61.7].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      o.connect(g).connect(filt);
      o.start();
      nodes.push(o);
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = 80;
    lfo.connect(lg).connect(filt.frequency);
    lfo.start();
    nodes.push(lfo);
    // 風聲
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 400;
    nf.Q.value = 0.6;
    const ng = ctx.createGain();
    ng.gain.value = 0.03;
    src.connect(nf).connect(ng).connect(out);
    src.start();
    nodes.push(src);
    ambient = { out, nodes };
  },
  stopAmbient() {
    if (!ambient) return;
    const a = ambient;
    ambient = null;
    a.out.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
    setTimeout(() => { a.nodes.forEach((n) => { try { n.stop(); } catch (e) { /* */ } }); a.out.disconnect(); }, 1200);
  },
};

