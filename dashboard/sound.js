/* Mia Dashboard: suoni rilassanti generati dal vivo (nessun file audio, nessun copyright).
   - Musica: accordi caldi e lenti, basso morbido, note sparse come gocce, un filo di "vinile".
   - Tocchi: piccolo "pop" morbido; aprire e chiudere una sezione: soffio con campanella. */
const Sound = (() => {
  let ctx = null, master, musicBus, uiBus, verb, timer = null, nextBar = 0, bar = 0, noiseSrc = null;
  const st = { music: false, ui: true, vol: 0.6 };
  const BPM = 68, BEAT = 60 / BPM, BAR = BEAT * 4;
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
  function loop(){ while (nextBar < ctx.currentTime + BAR * 1.2){ scheduleBar(nextBar); nextBar += BAR; } }
  function startMusic(){
    if (timer) return; nextBar = ctx.currentTime + 0.15; bar = 0;
    musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime); musicBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 3);
    vinyl(); loop(); timer = setInterval(loop, 250);
  }
  function stopMusic(){
    if (!timer) return; clearInterval(timer); timer = null;
    const t = ctx.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(musicBus.gain.value, t); musicBus.gain.linearRampToValueAtTime(0, t + 1.5);
    if (noiseSrc){ noiseSrc.stop(t + 1.6); noiseSrc = null; }
  }

  /* ---------- suoni dei tocchi ---------- */
  function tone(f, t, { type = "sine", v = 0.12, a = 0.005, d = 0.18, f2 } = {}){
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0005, t + d);
    o.connect(g).connect(uiBus); o.start(t); o.stop(t + d + 0.05);
  }
  function whoosh(t, up = true, v = 0.05){
    const n = ctx.createBufferSource(); n.buffer = noiseBuf(1); const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(up ? 400 : 2200, t); bp.frequency.exponentialRampToValueAtTime(up ? 2200 : 400, t + 0.32);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.38);
    n.connect(bp).connect(g).connect(uiBus); n.start(t); n.stop(t + 0.4);
  }
  const ui = {
    tap(){ const t = ctx.currentTime; tone(620, t, { v: 0.09, d: 0.09, f2: 520 }); tone(1240, t, { v: 0.025, d: 0.06 }); },
    open(){ const t = ctx.currentTime; whoosh(t, true); tone(hz(76), t + 0.06, { v: 0.06, d: 0.9 }); tone(hz(83), t + 0.12, { v: 0.04, d: 1.1 }); },
    close(){ const t = ctx.currentTime; whoosh(t, false, 0.04); tone(hz(71), t + 0.04, { v: 0.05, d: 0.6 }); },
    toggle(){ const t = ctx.currentTime; tone(880, t, { v: 0.06, d: 0.08 }); tone(1320, t + 0.06, { v: 0.05, d: 0.14 }); },
    hello(){ const t = ctx.currentTime; [72, 76, 79, 84].forEach((m, i) => tone(hz(m), t + i * 0.11, { v: 0.05, d: 1.4 })); },
  };

  return {
    st,
    load(s){ Object.assign(st, s || {}); },
    async unlock(){ await init(); if (st.music) startMusic(); },
    play(name){ if (!st.ui) return; init().then(() => ui[name] && ui[name]()).catch(() => {}); },
    async setMusic(on){ st.music = on; await init(); on ? startMusic() : stopMusic(); },
    setUi(on){ st.ui = on; },
    setVol(v){ st.vol = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    get playing(){ return !!timer; },
    pause(){ if (ctx && ctx.state === "running") ctx.suspend(); },
    resume(){ if (ctx && st.music) ctx.resume(); },
  };
})();
