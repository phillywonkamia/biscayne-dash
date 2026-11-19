// BISCAYNE DASH — every sound and the soundtrack, synthesized live in WebAudio. No sound files.
// The browser only allows audio after a tap / key press, so Sound.start() is called from the start input.

let ctx = null, master, sfx, musicBus, noiseBuf;
let muted = localStorage.getItem('bdash-mute') === '1';
let engine, siren, heli, nitro;
let playing = false, step = 0, nextT = 0;

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const BPM = 104, STEP = 60 / BPM / 4;
const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];   // Am · F · C · G

function noiseSrc(loop = false) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = loop; return s;
}
function env(g, t, a, peak, d) {   // quick attack / exponential decay envelope
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(type, freq, t, dur, peak, dest, glideTo) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  env(g, t, 0.005, peak, dur); o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
function burst(t, dur, peak, type, freq, dest, q = 0.7) {
  const n = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  env(g, t, 0.003, peak, dur); n.connect(f).connect(g).connect(dest); n.start(t); n.stop(t + dur + 0.05);
}

// ---------------------------------------------------------------- continuous voices
function buildLoops() {
  // engine: detuned saw + sub square through a lowpass that opens with speed
  const e1 = ctx.createOscillator(), e2 = ctx.createOscillator(), ef = ctx.createBiquadFilter(), eg = ctx.createGain();
  e1.type = 'sawtooth'; e2.type = 'square'; ef.type = 'lowpass'; ef.Q.value = 4; eg.gain.value = 0;
  e1.connect(ef); e2.connect(ef); ef.connect(eg).connect(sfx); e1.start(); e2.start();
  engine = { e1, e2, ef, eg };

  // siren: triangle wail, louder the closer the nearest cop is
  const so = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), sg = ctx.createGain();
  so.type = 'triangle'; so.frequency.value = 950; lfo.frequency.value = 0.55; lg.gain.value = 380; sg.gain.value = 0;
  lfo.connect(lg).connect(so.frequency); so.connect(sg).connect(sfx); so.start(); lfo.start();
  siren = sg;

  // helicopter: lowpassed noise chopped by an 11 Hz square LFO
  const hn = noiseSrc(true), hf = ctx.createBiquadFilter(), chop = ctx.createGain(), hl = ctx.createOscillator(), hlg = ctx.createGain(), hg = ctx.createGain();
  hf.type = 'lowpass'; hf.frequency.value = 380; chop.gain.value = 0.5; hl.type = 'square'; hl.frequency.value = 11; hlg.gain.value = 0.5; hg.gain.value = 0;
  hl.connect(hlg).connect(chop.gain); hn.connect(hf).connect(chop).connect(hg).connect(sfx); hn.start(); hl.start();
  heli = hg;

  // nitro: bandpassed noise rush
  const nn = noiseSrc(true), nf = ctx.createBiquadFilter(), ng = ctx.createGain();
  nf.type = 'bandpass'; nf.frequency.value = 1400; nf.Q.value = 0.6; ng.gain.value = 0;
  nn.connect(nf).connect(ng).connect(sfx); nn.start();
  nitro = ng;
}

// ---------------------------------------------------------------- the soundtrack (synthwave, Am-F-C-G)
let delay, arpBus;
function playStep(s, t) {
  const i = s % 16, chord = PROG[Math.floor(s / 16) % 4];
  // pad on each bar (always)
  if (i === 0) for (const n of chord) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = mtof(n);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + STEP * 16);
    o.connect(g).connect(musicBus); o.start(t); o.stop(t + STEP * 16 + 0.1);
  }
  // bass: 8ths, octave pops
  if (i % 2 === 0) tone('sawtooth', mtof(chord[0] - 24 + (i % 8 === 6 ? 12 : 0)), t, STEP * 1.8, playing ? 0.16 : 0.08, musicBus);
  if (!playing) return;
  // drums
  if (i % 4 === 0) tone('sine', 130, t, 0.28, 0.6, musicBus, 38);
  if (i === 4 || i === 12) burst(t, 0.18, 0.22, 'highpass', 1500, musicBus);
  if (i % 2 === 1) burst(t, 0.04, 0.06, 'highpass', 7000, musicBus);
  // arp through the delay
  tone('square', mtof(chord[i % 3] + (i % 6 >= 3 ? 24 : 12)), t, STEP * 0.9, 0.035, arpBus);
}
function scheduler() {
  if (!ctx) return;
  while (nextT < ctx.currentTime + 0.15) { playStep(step, nextT); nextT += STEP; step = (step + 1) % 64; }
}

// ---------------------------------------------------------------- public API
export const Sound = {
  get muted() { return muted; },
  start() {
    if (ctx) { if (ctx.state !== 'running') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
    delay = ctx.createDelay(); delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.35; delay.connect(fb).connect(delay); delay.connect(musicBus);
    arpBus = ctx.createGain(); arpBus.connect(musicBus); arpBus.connect(delay);   // arp plays dry + echoed
    buildLoops();
    nextT = ctx.currentTime + 0.05; setInterval(scheduler, 25);
  },
  toggleMute() {
    muted = !muted; localStorage.setItem('bdash-mute', muted ? '1' : '0');
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
    return muted;
  },
  setPlaying(on) { playing = on; },
  // per-frame: speed01 0..1, boosting bool, siren/heli levels 0..1
  update(speed01, boosting, sirenLvl, heliLvl, driving) {
    if (!ctx) return;
    const t = ctx.currentTime, f = 42 + speed01 * 120 + (boosting ? 35 : 0);
    engine.e1.frequency.setTargetAtTime(f, t, 0.08); engine.e2.frequency.setTargetAtTime(f * 0.5, t, 0.08);
    engine.ef.frequency.setTargetAtTime(250 + speed01 * 1600 + (boosting ? 900 : 0), t, 0.08);
    engine.eg.gain.setTargetAtTime(driving ? 0.07 : 0, t, 0.1);
    siren.gain.setTargetAtTime(driving ? sirenLvl * 0.05 : 0, t, 0.1);
    heli.gain.setTargetAtTime(driving ? heliLvl * 0.35 : 0, t, 0.2);
    nitro.gain.setTargetAtTime(driving && boosting ? 0.12 : 0, t, 0.05);
  },
  coin() { if (!ctx) return; const t = ctx.currentTime; tone('sine', 1320, t, 0.08, 0.12, sfx); tone('sine', 1760, t + 0.06, 0.12, 0.12, sfx); },
  close(combo) {
    if (!ctx) return; const t = ctx.currentTime;
    burst(t, 0.3, 0.25, 'bandpass', 2400, sfx, 1.5);
    tone('triangle', mtof(76 + Math.min(combo, 5) * 2), t + 0.04, 0.25, 0.1, sfx);
  },
  crash() {
    if (!ctx) return; const t = ctx.currentTime;
    burst(t, 0.9, 0.7, 'lowpass', 900, sfx); tone('sine', 90, t, 0.6, 0.6, sfx, 28);
    burst(t + 0.05, 0.5, 0.3, 'highpass', 3000, sfx);   // glass
  },
  alarm() { if (!ctx) return; const t = ctx.currentTime; for (let k = 0; k < 4; k++) tone('square', k % 2 ? 660 : 880, t + k * 0.16, 0.14, 0.07, sfx); },
  chime() { if (!ctx) return; const t = ctx.currentTime; [64, 69, 73, 76].forEach((n, k) => tone('triangle', mtof(n + 12), t + k * 0.09, 0.4, 0.07, sfx)); },
  buy() { if (!ctx) return; const t = ctx.currentTime; tone('square', 880, t, 0.06, 0.06, sfx); tone('square', 1320, t + 0.07, 0.15, 0.06, sfx); },
};
