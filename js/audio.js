/* ---------------------------------------------------------------------
   Música relajada (generada con WebAudio, sin archivos de audio)
   Un colchón de acordes suaves y notas pentatónicas con eco.
   --------------------------------------------------------------------- */
const music = {
  on: true,        // música activada por el jugador
  ctx: null,       // contexto de audio
  bus: null,       // entrada de efectos
  master: null,    // volumen general
  timer: null,     // planificador
  nextChord: 0,    // próximo momento para un acorde
  nextNote: 0,     // próximo momento para una nota de melodía
  chordIdx: 0,
  lastNote: 4
};

// Acordes (notas MIDI): Do mayor 7 – La menor 7 – Fa mayor 7 – Sol 6
const CHORDS = [
  [48, 55, 60, 64],
  [45, 52, 57, 60],
  [41, 48, 53, 57],
  [43, 50, 55, 59]
];
// Escala pentatónica para la melodía (siempre suena bien)
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76];
const CHORD_SECONDS = 8;

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Crea el audio la primera vez (los navegadores exigen un toque o tecla del jugador)
function ensureAudio() {
  if (music.ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try {
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = music.on ? 0.9 : 0;
    master.connect(ctx.destination);

    // Entrada → filtro suave → salida, más un eco que da sensación de espacio
    const bus = ctx.createGain();
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1900;
    bus.connect(lowpass);
    lowpass.connect(master);

    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.62;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.42;
    const wet = ctx.createGain();
    wet.gain.value = 0.4;
    lowpass.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(master);

    music.ctx = ctx;
    music.master = master;
    music.bus = bus;
    return true;
  } catch (e) {
    return false;
  }
}

// Una nota con entrada y salida suaves
function tone(freq, start, dur, vol, type, attack, release) {
  const ctx = music.ctx;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + attack);
  g.gain.setValueAtTime(vol, Math.max(start + attack, start + dur - release));
  g.gain.linearRampToValueAtTime(0, start + dur);
  osc.connect(g);
  g.connect(music.bus);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

// Planifica con anticipación los acordes y las notas
function scheduleMusic() {
  const ctx = music.ctx;
  if (!ctx || ctx.state !== 'running') return;
  const horizon = ctx.currentTime + 1.5;

  while (music.nextChord < horizon) {
    const chord = CHORDS[music.chordIdx % CHORDS.length];
    chord.forEach((m, i) => {
      // Dos osciladores ligeramente desafinados para un sonido cálido
      tone(midiHz(m), music.nextChord, CHORD_SECONDS + 3, 0.045, 'triangle', 3, 4);
      if (i > 0) tone(midiHz(m) * 1.004, music.nextChord, CHORD_SECONDS + 3, 0.02, 'sine', 3.5, 4);
    });
    music.chordIdx++;
    music.nextChord += CHORD_SECONDS;
  }

  while (music.nextNote < horizon) {
    // La melodía se mueve por pasos cercanos y a veces descansa
    if (Math.random() > 0.2) {
      const step = Math.floor(Math.random() * 5) - 2;
      music.lastNote = Math.min(SCALE.length - 1, Math.max(0, music.lastNote + step));
      tone(midiHz(SCALE[music.lastNote]), music.nextNote, 3.6, 0.06, 'sine', 0.06, 3);
    }
    music.nextNote += 1.4 + Math.random() * 2.2;
  }
}

// Arranca (o reanuda) la música
function startMusic() {
  if (!ensureAudio()) return;
  const ctx = music.ctx;
  const go = () => {
    if (!music.on || music.timer) return;
    music.nextChord = ctx.currentTime + 0.1;
    music.nextNote = ctx.currentTime + 1.5;
    scheduleMusic();
    music.timer = setInterval(scheduleMusic, 400);
  };
  if (ctx.state === 'suspended') ctx.resume().then(go).catch(() => {});
  else go();
}

function stopMusicTimer() {
  clearInterval(music.timer);
  music.timer = null;
}

// Activa o silencia la música
function setMusic(on) {
  music.on = on;
  store.set(KEY_MUSIC, on ? '1' : '0');
  if (music.ctx) {
    music.master.gain.setTargetAtTime(on ? 0.9 : 0, music.ctx.currentTime, 0.4);
  }
  if (on) startMusic(); else stopMusicTimer();
  updateMusicButton();
}

function updateMusicButton() {
  const btn = $('btn-music');
  if (btn) btn.textContent = music.on ? '🎵' : '🔇';
}

// Sonido corto de celebración al ganar
function playChime() {
  if (!music.on || !ensureAudio()) return;
  const ctx = music.ctx;
  if (ctx.state === 'suspended') ctx.resume();
  const t0 = ctx.currentTime + 0.05;
  [72, 76, 79, 84, 88].forEach((m, i) => {
    tone(midiHz(m), t0 + i * 0.16, 1.6, 0.09, 'sine', 0.02, 1.2);
  });
}

// Los navegadores solo permiten audio tras una interacción: se arranca con la primera
function bindMusicUnlock() {
  const unlock = () => {
    ['pointerdown', 'keydown', 'touchend'].forEach((n) => window.removeEventListener(n, unlock));
    if (music.on) startMusic();
  };
  ['pointerdown', 'keydown', 'touchend'].forEach((n) => window.addEventListener(n, unlock));

  // Pausa el audio al salir de la pestaña y lo reanuda al volver
  document.addEventListener('visibilitychange', () => {
    if (!music.ctx) return;
    if (document.hidden) music.ctx.suspend();
    else if (music.on) music.ctx.resume();
  });
}

