/* Mia Dashboard: suoni rilassanti generati dal vivo (nessun file audio, nessun copyright).
   - Musica: generata dal vivo (stile "beat" o "calmo").
   - Tocchi: due suoni scelti da Karim (sounds/nav.mp3 per i tasti laterali e le icone, sounds/tap.mp3 per tutti gli altri). */
const Sound = (() => {
  let ctx = null, master, musicBus, uiBus, verb, timer = null, nextBar = 0, bar = 0, noiseSrc = null;
  const st = { music: false, ui: true, vol: 0.6, style: "beat" };
  const BPM = 68, BEAT = 60 / BPM, BAR = BEAT * 4;
  // stile "beat": come il video (beat chill, 808 profondo, hi-hat, campanelle), tutto originale
  const BB = 140, S16 = 60 / BB / 4, BBAR = S16 * 16;
  const BPROG = [
    { b: 30, n: [54, 58, 61, 65] },   // Gb maj7
    { b: 29, n: [53, 56, 60, 63] },   // F m7
    { b: 27, n: [51, 54, 58, 61, 65] }, // Eb m9
    { b: 34, n: [58, 61, 65, 72] },   // Bb m(add9)
  ];
  const barLen = () => st.style === "beat" ? BBAR : BAR;
  // Fmaj9 – Em7 – Dm9 – Cmaj7 (+ a volte Am9): progressione calma e luminosa
  const PROG = [
    { bass: 41, notes: [53, 57, 60, 64, 67] },
    { bass: 40, notes: [52, 55, 59, 62, 64] },
    { bass: 38, notes: [50, 53, 57, 60, 64] },
    { bass: 36, notes: [48, 52, 55, 59, 62] },
  ];
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  function init(){
    if (ctx) return ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = st.vol; master.connect(ctx.destination);
    // riverbero morbido fatto in casa
    verb = ctx.createConvolver(); const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++){ const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    verb.buffer = ir; const vg = ctx.createGain(); vg.gain.value = 0.55; verb.connect(vg).connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master); musicBus.connect(verb);
    uiBus = ctx.createGain(); uiBus.gain.value = 0.5; uiBus.connect(master); uiBus.connect(verb);
    return ctx.resume();
  }

  /* ---------- musica ---------- */
  function pad(t, notes, dur){
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(1300, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(800, t + dur); lp.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.055, t + 1.6); g.gain.setValueAtTime(0.055, t + dur - 0.8); g.gain.linearRampToValueAtTime(0, t + dur + 1.4);
    lp.connect(g).connect(musicBus);
    notes.slice(0, 4).forEach(m => [-6, 6].forEach(cents => { const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = hz(m); o.detune.value = cents; o.connect(lp); o.start(t); o.stop(t + dur + 1.6); }));
  }
  function bass(t, m, dur){
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = hz(m);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.08); g.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.6); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(musicBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function drop(t, m, v = 0.07){ // nota "a goccia", tipo kalimba/piano elettrico
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain();
    o.type = "sine"; o.frequency.value = hz(m); o2.type = "sine"; o2.frequency.value = hz(m) * 3.01; g2.gain.value = 0.18;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, t + 2.4);
    o2.connect(g2).connect(g); o.connect(g).connect(musicBus); o.start(t); o2.start(t); o.stop(t + 2.5); o2.stop(t + 2.5);
  }
  function brush(t, v = 0.018){ // spazzola leggera sul tempo
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(0.25); const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 6000; const g = ctx.createGain();
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.18); n.connect(hp).connect(g).connect(musicBus); n.start(t); n.stop(t + 0.25);
  }
  function soft_kick(t){
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    g.gain.setValueAtTime(0.13, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.35); o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.4);
  }
  let nb = null; function noiseBuf(sec){ if (nb && nb.duration >= sec) return nb; nb = ctx.createBuffer(1, ctx.sampleRate * Math.max(sec, 2), ctx.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return nb; }
  function vinyl(){ // fruscio caldo, bassissimo
    noiseSrc = ctx.createBufferSource(); noiseSrc.buffer = noiseBuf(2); noiseSrc.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 0.6; const g = ctx.createGain(); g.gain.value = 0.006;
    noiseSrc.connect(bp).connect(g).connect(musicBus); noiseSrc.start();
  }
  function scheduleBar(t){
    const ch = PROG[bar % PROG.length];
    pad(t, ch.notes, BAR); bass(t, ch.bass, BEAT * 2.6); bass(t + BEAT * 2.5, ch.bass + (bar % 2 ? 7 : 0), BEAT * 1.4);
    for (let b = 0; b < 4; b++){ if (b % 2 === 0 && bar >= 2) soft_kick(t + b * BEAT); if (bar >= 1) brush(t + b * BEAT + BEAT / 2, 0.012); }
    const steps = [0, 1.5, 2, 3, 3.5].filter(() => Math.random() < 0.55);
    steps.forEach(s => drop(t + s * BEAT, ch.notes[Math.floor(Math.random() * ch.notes.length)] + 12, 0.045 + Math.random() * 0.03));
    bar++;
  }
  /* ---------- stile beat ---------- */
  let shaper; function sat(){ if (shaper) return shaper; shaper = ctx.createWaveShaper(); const c = new Float32Array(1024); for (let i = 0; i < 1024; i++){ const x = i / 512 - 1; c[i] = Math.tanh(2.2 * x); } shaper.curve = c; const g = ctx.createGain(); g.gain.value = 0.55; shaper.connect(g).connect(musicBus); return shaper; }
  function e808(t, m, len, glide){
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine";
    o.frequency.setValueAtTime(hz(m) * (glide ? 1.5 : 2.6), t); o.frequency.exponentialRampToValueAtTime(hz(m), t + (glide ? 0.12 : 0.045));
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.005); g.gain.exponentialRampToValueAtTime(0.25, t + 0.25); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g).connect(sat()); o.start(t); o.stop(t + len + 0.05);
  }
  function hat(t, v = 0.03, open = false){
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(1); const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7500; const bp = ctx.createBiquadFilter(); bp.type = "peaking"; bp.frequency.value = 10000; bp.gain.value = 6;
    const g = ctx.createGain(), d = open ? 0.22 : 0.035; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + d);
    n.connect(hp).connect(bp).connect(g).connect(musicBus); n.start(t, Math.random() * 0.5); n.stop(t + d + 0.02);
  }
  function snap(t, v = 0.13){
    [0, 0.011, 0.024].forEach((o, i) => { const n = ctx.createBufferSource(); n.buffer = noiseBuf(1); const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1700; bp.Q.value = 1.4;
      const g = ctx.createGain(), d = i === 2 ? 0.16 : 0.02; g.gain.setValueAtTime(v * (i === 2 ? 1 : 0.7), t + o); g.gain.exponentialRampToValueAtTime(0.0005, t + o + d);
      n.connect(bp).connect(g); g.connect(musicBus); g.connect(verb); n.start(t + o, Math.random() * 0.5); n.stop(t + o + d + 0.02); });
  }
  function bell(t, m, v = 0.05){ // campanella FM, chiara e morbida
    const c = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    c.type = "sine"; c.frequency.value = hz(m); mod.type = "sine"; mod.frequency.value = hz(m) * 3.5; mg.gain.setValueAtTime(hz(m) * 1.2, t); mg.gain.exponentialRampToValueAtTime(hz(m) * 0.05, t + 0.6);
    mod.connect(mg).connect(c.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0006, t + 1.8);
    c.connect(g); g.connect(musicBus); g.connect(verb); c.start(t); mod.start(t); c.stop(t + 1.9); mod.stop(t + 1.9);
  }
  function bpad(t, notes, dur){
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600; lp.Q.value = 0.3;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.9); g.gain.setValueAtTime(0.03, t + dur - 0.3); g.gain.linearRampToValueAtTime(0, t + dur + 0.8);
    lp.connect(g); g.connect(musicBus); g.connect(verb);
    notes.forEach(m => [-8, 8].forEach(cents => { const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz(m + 12); o.detune.value = cents; const og = ctx.createGain(); og.gain.value = 0.35; o.connect(og).connect(lp); o.start(t); o.stop(t + dur + 0.9); }));
  }
  const K808 = [[0, 1.1], [10, 0.5], [16, 0.9], [22, 0.45], [27, 0.6, true]]; // posizioni in sedicesimi su 2 battute
  function scheduleBeat(t){
    const ch = BPROG[Math.floor(bar / 2) % BPROG.length], half = bar % 2;
    if (!half) bpad(t, ch.n, BBAR * 2);
    const intro = bar < 2;
    K808.forEach(([s, len, gl]) => { const pos = s - half * 16; if (pos >= 0 && pos < 16 && !intro) e808(t + pos * S16, ch.b + (gl ? 2 : 0), len, gl); });
    for (let i = 0; i < 16; i++){
      const tt = t + i * S16, swing = i % 2 ? S16 * 0.08 : 0;
      if (i % 2 === 0) hat(tt, i % 4 === 0 ? 0.055 : 0.036);
      if (bar % 4 === 3 && i >= 12) { hat(tt + swing, 0.034); hat(tt + S16 / 2 + swing, 0.026); }
      else if (Math.random() < 0.14) hat(tt + swing, 0.014);
      if (i === 8 && !intro) snap(tt);
      if (i === 14 && bar % 2) hat(tt, 0.02, true);
    }
    // melodia a campanella: poche note, sempre dal suo accordo
    [0, 3, 6, 10, 12].forEach(i => { if (Math.random() < (i === 0 ? 0.9 : 0.45)) bell(t + i * S16, ch.n[(i + bar) % ch.n.length] + 12, 0.035 + Math.random() * 0.02); });
    bar++;
  }
  function loop(){ while (nextBar < ctx.currentTime + barLen() * 1.2){ const beat = st.style === "beat"; beat ? scheduleBeat(nextBar) : scheduleBar(nextBar); nextBar += beat ? BBAR : BAR; } }
  function startMusic(){
    if (timer) return; nextBar = ctx.currentTime + 0.15; bar = 0;
    musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime); musicBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 3);
    if (st.style !== "beat") vinyl(); loop(); timer = setInterval(loop, 250);
  }
  function stopMusic(){
    if (!timer) return; clearInterval(timer); timer = null;
    const t = ctx.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(musicBus.gain.value, t); musicBus.gain.linearRampToValueAtTime(0, t + 1.5);
    if (noiseSrc){ noiseSrc.stop(t + 1.6); noiseSrc = null; }
  }

  /* ---------- suoni dei tocchi: i due suoni scelti da Karim ---------- */
  const SFX = { nav: "sounds/nav.mp3", tap: "sounds/tap.mp3" }, buf = {};
  function loadSfx(){
    Object.entries(SFX).forEach(([k, u]) => { if (buf[k]) return; buf[k] = "loading";
      fetch(u).then(r => r.arrayBuffer()).then(a => new Promise((res, rej) => ctx.decodeAudioData(a, res, rej))).then(b => { buf[k] = b; }).catch(() => { buf[k] = null; }); });
  }
  function sfx(k){
    const b = buf[k]; if (!b || b === "loading") return;
    const src = ctx.createBufferSource(); src.buffer = b; const g = ctx.createGain(); g.gain.value = 0.9;
    src.connect(g).connect(master); src.start();
  }

  return {
    st,
    load(s){ Object.assign(st, s || {}); },
    async unlock(){ await init(); loadSfx(); if (st.music) startMusic(); },
    play(name){ if (!st.ui) return; init().then(() => { loadSfx(); sfx(name); }).catch(() => {}); },
    async setMusic(on){ st.music = on; await init(); on ? startMusic() : stopMusic(); },
    setUi(on){ st.ui = on; },
    async setStyle(s){ st.style = s; if (timer){ stopMusic(); await new Promise(r => setTimeout(r, 1700)); if (st.music) startMusic(); } },
    setVol(v){ st.vol = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    get playing(){ return !!timer; },
    pause(){ if (ctx && ctx.state === "running") ctx.suspend(); },
    resume(){ if (ctx && st.music) ctx.resume(); },
  };
})();
