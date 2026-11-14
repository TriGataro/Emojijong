/* =====================================================================
   Mahjong Emoji – Solitario (Phaser)
   - El tablero se dibuja con Phaser; los menús, joystick y botones son HTML.
   - Se juega con ratón/táctil, flechas o WASD, joystick virtual o mando.
   ===================================================================== */
'use strict';

/* ---------------------------------------------------------------------
   Constantes del juego
   --------------------------------------------------------------------- */

// Emojis de las fichas (23 distintos; se reparten por parejas según el diseño)
const FACES = [
  '🐼', '🍎', '🌸', '🐙', '🚀', '🎈', '🍕', '⭐',
  '🐸', '🌈', '🍩', '🎸', '🦊', '🍉', '🐧', '🔥',
  '🍀', '🎲', '🐝', '🍓', '🦋', '🌙', '🍄'
];
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

// Tamaño lógico del lienzo y de las fichas (Phaser lo escala para ajustarse a la pantalla)
const W = 920, H = 660;
const CELL_W = 88, CELL_H = 104;     // separación entre casillas
const TW = 84, TH = 100;             // tamaño de cada ficha
const LAYER_OFF = -6;                // desplazamiento visual por cada capa (efecto 3D)
const RADIUS = 10;                   // radio de las esquinas de la ficha
const COLS = 10, ROWS = 6;
const X0 = (W - COLS * CELL_W) / 2 + CELL_W / 2;
const Y0 = (H - ROWS * CELL_H) / 2 + CELL_H / 2 + 6;

// Temas de color (los valores están en style.css)
const THEMES = [
  { id: 'clasico', name: 'Clásico' },
  { id: 'oscuro', name: 'Oscuro' },
  { id: 'claro', name: 'Claro' },
  { id: 'contraste', name: 'Alto contraste' }
];

// Claves de localStorage
const KEY_BEST = 'mahjong-emoji:best';
const KEY_THEME = 'mahjong-emoji:theme';
const KEY_MUSIC = 'mahjong-emoji:music';

// Diseños del tablero. Cada diseño es una lista de capas (de abajo hacia arriba);
// cada capa son 6 filas de 10 columnas donde '#' es una ficha y '.' un hueco.
// Cada cambio de partida elige un diseño distinto.
const LAYOUTS = [
  {
    name: 'Pirámide',
    layers: [
      ['##########', '##########', '##########', '##########', '##########', '##########'],
      ['..........', '..######..', '..######..', '..######..', '..######..', '..........'],
      ['..........', '..........', '...####...', '...####...', '..........', '..........']
    ]
  },
  {
    name: 'Diamante',
    layers: [
      ['...####...', '..######..', '.########.', '.########.', '..######..', '...####...'],
      ['..........', '...####...', '..######..', '..######..', '...####...', '..........'],
      ['..........', '..........', '...####...', '...####...', '..........', '..........']
    ]
  },
  {
    name: 'Torres gemelas',
    layers: [
      ['####..####', '####..####', '####..####', '####..####', '####..####', '####..####'],
      ['..........', '###....###', '###....###', '###....###', '###....###', '..........'],
      ['..........', '..........', '##......##', '##......##', '..........', '..........']
    ]
  },
  {
    name: 'Cruz',
    layers: [
      ['...####...', '...####...', '##########', '##########', '...####...', '...####...'],
      ['..........', '...####...', '..######..', '..######..', '...####...', '..........'],
      ['..........', '..........', '....##....', '....##....', '..........', '..........']
    ]
  },
  {
    name: 'Marco',
    layers: [
      ['##########', '##########', '##########', '##########', '##########', '##########'],
      ['.########.', '#........#', '#........#', '#........#', '#........#', '.########.'],
      ['...####...', '..........', '..........', '..........', '..........', '...####...']
    ]
  },
  {
    name: 'Dos pirámides',
    layers: [
      ['##########', '##########', '##########', '##########', '##########', '##########'],
      ['..........', '.###..###.', '.###..###.', '.###..###.', '.###..###.', '..........'],
      ['..........', '..........', '..#....#..', '..#....#..', '..........', '..........']
    ]
  }
];

/* ---------------------------------------------------------------------
   Estado global
   --------------------------------------------------------------------- */
let scene = null;          // escena de Phaser (se asigna en create)
let THEME = null;          // colores del tema actual (números para Phaser)
let currentTheme = 'clasico';

const state = {
  tiles: [],               // todas las fichas de la partida
  index: new Map(),        // "x,y,z" -> ficha
  initialFaces: null,      // caras iniciales (para reiniciar el mismo tablero)
  selected: null,          // ficha seleccionada
  cursor: null,            // ficha marcada con teclado/joystick/mando
  cursorVisible: false,    // mostrar el cursor solo si se usa teclado/mando
  hint: null,              // pareja mostrada como pista
  history: [],             // parejas retiradas (para deshacer)
  elapsed: 0,              // tiempo transcurrido (ms)
  lastShownSecond: -1,     // último segundo pintado en el marcador
  over: false,             // partida terminada
  layoutIdx: -1,           // diseño del tablero en uso
  fx: [],                  // objetos de la animación de victoria
  winTimer: null           // temporizador que muestra el menú tras la animación
};

const $ = (id) => document.getElementById(id);

/* ---------------------------------------------------------------------
   Almacenamiento (localStorage con aviso si no está disponible)
   --------------------------------------------------------------------- */
const store = {
  useMemory: false,        // si es true se guarda solo en memoria (no persiste)
  mem: {},
  test() {
    try {
      localStorage.setItem('__test', '1');
      localStorage.removeItem('__test');
      return true;
    } catch (e) {
      return false;
    }
  },
  get(key) {
    if (this.useMemory) return this.mem[key] ?? null;
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  set(key, value) {
    if (this.useMemory) { this.mem[key] = value; return true; }
    try { localStorage.setItem(key, value); return true; } catch (e) { return false; }
  }
};

// Pregunta al jugador qué hacer cuando no se puede guardar
function askStorage(onDone) {
  showOverlay('storage', '⚠️ No se puede guardar',
    'Tu navegador no permite guardar datos (récord y tema). ¿Qué quieres hacer?', [
      {
        label: 'Continuar sin guardar', primary: true,
        action: () => { store.useMemory = true; hideOverlay(); if (onDone) onDone(); }
      },
      {
        label: 'Reintentar',
        action: () => {
          if (store.test()) { hideOverlay(); if (onDone) onDone(); }
          else askStorage(onDone);
        }
      }
    ]);
}

/* ---------------------------------------------------------------------
   Utilidades
   --------------------------------------------------------------------- */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Convierte milisegundos en "mm:ss"
function fmt(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

let toastTimer = null;
function showToast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

/* ---------------------------------------------------------------------
   Temas
   --------------------------------------------------------------------- */
// Lee las variables CSS del tema y las convierte a números hexadecimales
function readTheme() {
  const css = getComputedStyle(document.documentElement);
  const c = (name) => parseInt(css.getPropertyValue(name).trim().replace('#', ''), 16);
  return {
    face: c('--tile-face'), side: c('--tile-side'), edge: c('--tile-edge'),
    shadow: c('--tile-shadow'), dim: c('--tile-dim'),
    selected: c('--selected'), hint: c('--hint'), cursor: c('--cursor'),
    accent: c('--accent'), text: c('--text')
  };
}

function applyTheme(id) {
  currentTheme = THEMES.some((t) => t.id === id) ? id : 'clasico';
  document.documentElement.dataset.theme = currentTheme;
  THEME = readTheme();
  // Actualiza el color de la barra del navegador en móviles
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', bg);
  // Redibuja las fichas con los nuevos colores
  if (scene) {
    state.tiles.forEach((t) => { if (t.node) drawTile(t); });
    refreshAll();
  }
}

function cycleTheme() {
  const i = THEMES.findIndex((t) => t.id === currentTheme);
  const next = THEMES[(i + 1) % THEMES.length];
  applyTheme(next.id);
  store.set(KEY_THEME, next.id);
  showToast('🎨 Tema: ' + next.name);
}

function themeName() {
  return THEMES.find((t) => t.id === currentTheme).name;
}

/* ---------------------------------------------------------------------
   Reglas del tablero
   --------------------------------------------------------------------- */

// Posiciones de las fichas según el diseño elegido (se lee el mapa de '#')
function buildPositions(layout) {
  const pos = [];
  layout.layers.forEach((rows, z) => {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '#') pos.push({ x, y, z });
      }
    });
  });
  // Las parejas necesitan un número par de fichas: si sobra una, se quita la más alta
  if (pos.length % 2 === 1) pos.pop();
  return pos;
}

const keyOf = (x, y, z) => x + ',' + y + ',' + z;

// Devuelve la ficha viva en esa posición (o null)
function at(x, y, z) {
  const t = state.index.get(keyOf(x, y, z));
  return t && t.alive ? t : null;
}

// Una ficha está libre si no tiene nada encima y tiene libre el lado izquierdo o el derecho
function isFree(t) {
  if (!t.alive) return false;
  if (at(t.x, t.y, t.z + 1)) return false;
  return !at(t.x - 1, t.y, t.z) || !at(t.x + 1, t.y, t.z);
}

// Una ficha es visible si no está tapada por otra encima
function isVisible(t) {
  return t.alive && !at(t.x, t.y, t.z + 1);
}

// Misma regla de "libre", pero sobre un conjunto simulado (para generar tableros resolubles)
function freeIn(t, alive, index) {
  const has = (x, y, z) => {
    const o = index.get(keyOf(x, y, z));
    return o && alive.has(o);
  };
  if (has(t.x, t.y, t.z + 1)) return false;
  return !has(t.x - 1, t.y, t.z) || !has(t.x + 1, t.y, t.z);
}

// Asigna caras a las fichas simulando la partida al revés: siempre se retiran
// dos fichas libres con la misma cara, así el tablero siempre tiene solución.
function makeSolvable(tiles, pairs) {
  const index = new Map(tiles.map((t) => [keyOf(t.x, t.y, t.z), t]));
  for (let attempt = 0; attempt < 500; attempt++) {
    const alive = new Set(tiles);
    const queue = shuffleArray(pairs.slice());
    const faces = new Map();
    let ok = true;
    while (alive.size) {
      const free = [...alive].filter((t) => freeIn(t, alive, index));
      if (free.length < 2) { ok = false; break; }
      const a = free.splice(Math.floor(Math.random() * free.length), 1)[0];
      const b = free[Math.floor(Math.random() * free.length)];
      const f = queue.pop();
      faces.set(a, f);
      faces.set(b, f);
      alive.delete(a);
      alive.delete(b);
    }
    if (ok) {
      tiles.forEach((t) => { t.face = faces.get(t); });
      return true;
    }
  }
  return false;
}

// Todas las parejas que se pueden retirar ahora mismo
function availablePairs() {
  const byFace = {};
  state.tiles.filter(isFree).forEach((t) => { (byFace[t.face] = byFace[t.face] || []).push(t); });
  const pairs = [];
  Object.values(byFace).forEach((list) => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) pairs.push([list[i], list[j]]);
    }
  });
  return pairs;
}

const aliveCount = () => state.tiles.filter((t) => t.alive).length;

/* ---------------------------------------------------------------------
   Dibujo de fichas (Phaser)
   --------------------------------------------------------------------- */

// Dibuja el cuerpo de la ficha: sombra, lateral 3D y cara
function drawTile(t) {
  const g = t.g;
  g.clear();
  g.fillStyle(THEME.shadow, 0.3);
  g.fillRoundedRect(-TW / 2 + 5, -TH / 2 + 8, TW, TH, RADIUS);
  g.fillStyle(THEME.side, 1);
  g.fillRoundedRect(-TW / 2 + 4, -TH / 2 + 6, TW, TH, RADIUS);
  g.fillStyle(THEME.face, 1);
  g.fillRoundedRect(-TW / 2, -TH / 2, TW, TH, RADIUS);
  g.lineStyle(2, THEME.edge, 1);
  g.strokeRoundedRect(-TW / 2, -TH / 2, TW, TH, RADIUS);

  // Capa oscura que se muestra cuando la ficha está bloqueada
  t.dim.clear();
  t.dim.fillStyle(THEME.dim, 0.38);
  t.dim.fillRoundedRect(-TW / 2, -TH / 2, TW, TH, RADIUS);
}

// Crea los objetos de Phaser de una ficha
function createNode(t) {
  t.px = X0 + t.x * CELL_W + t.z * LAYER_OFF;
  t.py = Y0 + t.y * CELL_H + t.z * LAYER_OFF;

  const c = scene.add.container(t.px, t.py);
  const g = scene.add.graphics();
  const txt = scene.add.text(-1, 2, FACES[t.face], {
    fontFamily: EMOJI_FONT,
    fontSize: '54px',
    padding: { x: 4, y: 8 },
    resolution: 2
  }).setOrigin(0.5);
  const dim = scene.add.graphics();
  const ring = scene.add.graphics();

  c.add([g, txt, dim, ring]);
  c.setDepth(t.z * 1000 + t.y * 20 + t.x);

  t.node = c; t.g = g; t.txt = txt; t.dim = dim; t.ring = ring;
  drawTile(t);
}

// Actualiza el aspecto de una ficha según su estado (libre, seleccionada, pista, cursor)
function refreshTile(t) {
  if (!t.alive || !t.node) return;
  t.dim.setVisible(!isFree(t));

  let color = null, width = 4;
  if (t === state.selected) { color = THEME.selected; width = 6; }
  else if (state.hint && state.hint.includes(t)) { color = THEME.hint; width = 6; }
  else if (state.cursorVisible && t === state.cursor) { color = THEME.cursor; width = 5; }

  t.ring.clear();
  if (color !== null) {
    t.ring.lineStyle(width, color, 1);
    t.ring.strokeRoundedRect(-TW / 2, -TH / 2, TW, TH, RADIUS);
  }
}

function refreshAll() {
  state.tiles.forEach(refreshTile);
}

// Pequeña sacudida cuando se toca una ficha bloqueada
function shake(t) {
  scene.tweens.killTweensOf(t.node);
  t.node.x = t.px;
  scene.tweens.add({
    targets: t.node, x: t.px + 6, duration: 50, yoyo: true, repeat: 2,
    onComplete: () => { t.node.x = t.px; }
  });
}

/* ---------------------------------------------------------------------
   Partida
   --------------------------------------------------------------------- */

// Elimina del lienzo las fichas anteriores
function clearBoard() {
  if (scene) scene.tweens.killAll();
  state.tiles.forEach((t) => { if (t.node) t.node.destroy(); });
  state.tiles = [];
  state.index = new Map();
}

// Empieza una partida. Si reuse es true se repite el mismo tablero y diseño.
// Si no, se elige un diseño distinto al anterior.
function startGame(reuse) {
  clearBoard();
  clearFx();

  const repeat = reuse && state.initialFaces && state.layoutIdx >= 0;
  if (!repeat) {
    let next;
    do { next = Math.floor(Math.random() * LAYOUTS.length); }
    while (LAYOUTS.length > 1 && next === state.layoutIdx);
    state.layoutIdx = next;
  }
  const layout = LAYOUTS[state.layoutIdx];
  const tiles = buildPositions(layout).map((p) => ({ ...p, alive: true, face: 0 }));

  if (repeat) {
    tiles.forEach((t, i) => { t.face = state.initialFaces[i]; });
  } else {
    // Lista de parejas: los emojis se reparten por parejas
    const pairs = [];
    for (let i = 0; i < tiles.length / 2; i++) pairs.push(i % FACES.length);
    if (!makeSolvable(tiles, pairs)) {
      // Respaldo: reparto aleatorio de las parejas
      const faces = shuffleArray(pairs.concat(pairs));
      tiles.forEach((t, i) => { t.face = faces[i]; });
    }
    state.initialFaces = tiles.map((t) => t.face);
    showToast('🧩 Diseño: ' + layout.name);
  }

  state.tiles = tiles;
  tiles.forEach((t) => state.index.set(keyOf(t.x, t.y, t.z), t));
  tiles.forEach(createNode);

  state.selected = null;
  state.hint = null;
  state.history = [];
  state.elapsed = 0;
  state.lastShownSecond = -1;
  state.over = false;
  state.cursor = tiles.filter(isFree)[0] || null;
  refreshAll();
  updateHud();
}

// Marcadores superiores
function updateHud() {
  $('hud-time').textContent = fmt(state.elapsed);
  $('hud-pairs').textContent = Math.floor(aliveCount() / 2);
  const best = Number(store.get(KEY_BEST));
  $('hud-best').textContent = best ? fmt(best) : '--:--';
}

// Cronómetro: solo avanza si no hay menús abiertos
function tick(delta) {
  if (state.over || overlayKind || !state.tiles.length) return;
  state.elapsed += Math.min(delta, 100);
  const sec = Math.floor(state.elapsed / 1000);
  if (sec !== state.lastShownSecond) {
    state.lastShownSecond = sec;
    $('hud-time').textContent = fmt(state.elapsed);
  }
}

// Acción de seleccionar una ficha (clic, toque, botón A, Enter...)
function activate(t) {
  if (!t || !t.alive || state.over || overlayKind) return;
  state.hint = null;

  if (!isFree(t)) {
    shake(t);
    refreshAll();
    return;
  }
  if (!state.selected) {
    state.selected = t;
  } else if (state.selected === t) {
    state.selected = null;
  } else if (state.selected.face === t.face) {
    removePair(state.selected, t);
    return;
  } else {
    state.selected = t;   // cara distinta: cambia la selección
  }
  refreshAll();
}

// Retira una pareja con una pequeña animación
function removePair(a, b) {
  a.alive = false;
  b.alive = false;
  state.history.push([a, b]);
  state.selected = null;
  state.hint = null;

  [a, b].forEach((t) => {
    scene.tweens.killTweensOf(t.node);
    scene.tweens.add({
      targets: t.node, scale: 0.2, alpha: 0, duration: 200,
      onComplete: () => { if (!t.alive) t.node.setVisible(false); }
    });
  });

  // Si el cursor quedó sobre una ficha retirada, pasa a la más cercana
  if (state.cursor && !isVisible(state.cursor)) {
    state.cursor = nearestVisible(state.cursor.px, state.cursor.py);
  }
  refreshAll();
  updateHud();

  if (aliveCount() === 0) { win(); return; }
  if (availablePairs().length === 0) noMovesMenu();
}

function nearestVisible(px, py) {
  let best = null, bestD = Infinity;
  state.tiles.filter(isVisible).forEach((t) => {
    const d = (t.px - px) ** 2 + (t.py - py) ** 2;
    if (d < bestD) { bestD = d; best = t; }
  });
  return best;
}

// Deshacer la última pareja retirada
function undo() {
  const last = state.history.pop();
  if (!last) { showToast('Nada que deshacer'); return; }
  last.forEach((t) => {
    t.alive = true;
    scene.tweens.killTweensOf(t.node);
    t.node.setVisible(true).setScale(1).setAlpha(1);
  });
  state.selected = null;
  state.hint = null;
  refreshAll();
  updateHud();
}

// Pista: resalta una pareja disponible
function hint() {
  const pairs = availablePairs();
  if (!pairs.length) { noMovesMenu(); return; }
  state.hint = pairs[Math.floor(Math.random() * pairs.length)];
  state.selected = null;
  refreshAll();
  state.hint.forEach((t) => {
    scene.tweens.killTweensOf(t.node);
    scene.tweens.add({
      targets: t.node, scale: 1.08, duration: 200, yoyo: true, repeat: 2,
      onComplete: () => { t.node.setScale(1); }
    });
  });
}

// Baraja las fichas restantes (el tablero sigue teniendo solución)
function shuffleBoard() {
  const remaining = state.tiles.filter((t) => t.alive);
  if (!remaining.length) return;

  // Cuenta cuántas veces queda cada cara y arma las parejas
  const counts = {};
  remaining.forEach((t) => { counts[t.face] = (counts[t.face] || 0) + 1; });
  const pairs = [];
  Object.keys(counts).forEach((f) => {
    for (let i = 0; i < counts[f] / 2; i++) pairs.push(Number(f));
  });

  if (!makeSolvable(remaining, pairs)) {
    // Respaldo: reparto aleatorio de las caras
    const faces = shuffleArray(remaining.map((t) => t.face));
    remaining.forEach((t, i) => { t.face = faces[i]; });
  }
  remaining.forEach((t) => t.txt.setText(FACES[t.face]));
  state.history = [];
  state.selected = null;
  state.hint = null;
  refreshAll();
  showToast('🔀 Fichas barajadas');
}

// Fin de partida con victoria
function win() {
  state.over = true;
  const t = Math.floor(state.elapsed);
  const prev = Number(store.get(KEY_BEST));
  const record = !prev || t < prev;

  // Muestra el menú de fin de partida
  const showMenu = () => {
    updateHud();
    showOverlay('win', '🎉 ¡Ganaste!',
      'Tiempo: ' + fmt(t) + (record ? ' · ¡Nuevo récord! 🏆' : ''), [
        { label: '🎲 Nueva partida', primary: true, action: () => { hideOverlay(); startGame(false); } },
        { label: '🔄 Repetir tablero', action: () => { hideOverlay(); startGame(true); } },
        { label: '📤 Compartir', action: share }
      ]);
  };

  // Primero la animación de victoria y luego el menú
  const finish = () => {
    updateHud();
    playChime();
    winAnimation(showMenu);
  };

  if (record && !store.set(KEY_BEST, String(t))) {
    askStorage(() => { store.set(KEY_BEST, String(t)); finish(); });
  } else {
    finish();
  }
}

// Quita los objetos de la animación de victoria
function clearFx() {
  if (state.winTimer) { state.winTimer.remove(false); state.winTimer = null; }
  state.fx.forEach((o) => { if (o && o.destroy) o.destroy(); });
  state.fx = [];
}

// Animación de victoria: lluvia de emojis y un mensaje que aparece con rebote
function winAnimation(done) {
  clearFx();
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const confetti = ['🎉', '✨', '⭐', '🌸', '🍀', '🎈', '🦋', '🌈', '🎊', '💫'];

  // Lluvia de emojis cayendo con giro
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * W;
    const size = 26 + Math.random() * 34;
    const piece = scene.add.text(x, -60, confetti[Math.floor(Math.random() * confetti.length)], {
      fontFamily: EMOJI_FONT, fontSize: size + 'px', padding: { x: 4, y: 8 }, resolution: 2
    }).setOrigin(0.5).setDepth(5000);
    state.fx.push(piece);
    scene.tweens.add({
      targets: piece,
      y: H + 80,
      x: x + (Math.random() - 0.5) * 180,
      angle: (Math.random() - 0.5) * 720,
      duration: 2000 + Math.random() * 1600,
      delay: Math.random() * 1100,
      ease: 'Sine.easeIn'
    });
  }

  // Mensaje central que crece con rebote y luego "late"
  const banner = scene.add.text(W / 2, H / 2, '🎉 ¡Ganaste! 🎉', {
    fontFamily: EMOJI_FONT, fontSize: '84px', fontStyle: 'bold',
    color: hex(THEME.accent), stroke: '#000000',
    strokeThickness: 10, padding: { x: 10, y: 14 }, resolution: 2
  }).setOrigin(0.5).setDepth(6000).setScale(0);
  state.fx.push(banner);
  scene.tweens.add({
    targets: banner, scale: 1, duration: 650, ease: 'Back.easeOut',
    onComplete: () => {
      scene.tweens.add({ targets: banner, scale: 1.08, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  });

  // Tras unos segundos se muestra el menú de opciones
  state.winTimer = scene.time.delayedCall(3200, () => {
    state.winTimer = null;
    done();
  });
}

/* ---------------------------------------------------------------------
   Cursor (teclado, joystick, mando)
   --------------------------------------------------------------------- */
function moveCursor(dx, dy) {
  if (state.over) return;
  state.cursorVisible = true;
  const visible = state.tiles.filter(isVisible);
  if (!visible.length) return;

  // Sin cursor válido: se coloca en una ficha libre
  if (!state.cursor || !isVisible(state.cursor)) {
    state.cursor = visible.find(isFree) || visible[0];
    refreshAll();
    return;
  }

  // Busca la ficha más cercana en la dirección pedida
  const c = state.cursor;
  let best = null, bestScore = Infinity;
  visible.forEach((o) => {
    if (o === c) return;
    const ox = o.px - c.px, oy = o.py - c.py;
    const along = dx * ox + dy * oy;
    if (along <= 8) return;
    const perp = dx !== 0 ? Math.abs(oy) : Math.abs(ox);
    const score = along + perp * 2;
    if (score < bestScore) { bestScore = score; best = o; }
  });
  if (best) state.cursor = best;
  refreshAll();
}

// Ficha bajo un punto del lienzo (la de la capa más alta)
function pickTile(x, y) {
  let best = null;
  state.tiles.forEach((t) => {
    if (!t.alive) return;
    if (Math.abs(x - t.px) <= TW / 2 && Math.abs(y - t.py) <= TH / 2) {
      if (!best || t.z > best.z) best = t;
    }
  });
  return best;
}

/* ---------------------------------------------------------------------
   Pantalla de opciones (HTML táctil)
   --------------------------------------------------------------------- */
let overlayKind = null;    // tipo de pantalla abierta (null = ninguna)
let overlayBtns = [];      // botones de la pantalla
let overlayIdx = 0;        // botón con foco (teclado/mando)

function showOverlay(kind, title, text, buttons, focusIdx) {
  overlayKind = kind;
  $('overlay-title').textContent = title;
  $('overlay-text').textContent = text;
  const box = $('overlay-buttons');
  box.replaceChildren();
  overlayBtns = buttons.map((b) => {
    const el = document.createElement('button');
    el.className = 'menu-btn' + (b.primary ? ' primary' : '');
    el.textContent = b.label;
    el.addEventListener('click', b.action);
    box.appendChild(el);
    return el;
  });
  overlayIdx = focusIdx || 0;
  focusOverlay();
  $('overlay').hidden = false;
}

function hideOverlay() {
  overlayKind = null;
  overlayBtns = [];
  $('overlay').hidden = true;
}

function focusOverlay() {
  overlayBtns.forEach((b, i) => b.classList.toggle('focus', i === overlayIdx));
}

function overlayMove(d) {
  if (!overlayBtns.length) return;
  overlayIdx = (overlayIdx + d + overlayBtns.length) % overlayBtns.length;
  focusOverlay();
}

function pauseMenu(focusIdx) {
  showOverlay('pause', '⏸️ Pausa', 'Tiempo: ' + fmt(state.elapsed), [
    { label: '▶️ Continuar', primary: true, action: hideOverlay },
    { label: '🔄 Reiniciar (mismo tablero)', action: () => { hideOverlay(); startGame(true); } },
    { label: '🎲 Nueva partida', action: () => { hideOverlay(); startGame(false); } },
    { label: '🎨 Tema: ' + themeName(), action: () => { cycleTheme(); pauseMenu(overlayIdx); } },
    { label: (music.on ? '🎵 Música: sí' : '🔇 Música: no'), action: () => { setMusic(!music.on); pauseMenu(overlayIdx); } },
    { label: '📤 Compartir', action: share }
  ], focusIdx);
}

function noMovesMenu() {
  showOverlay('nomoves', '😵 Sin movimientos',
    'No quedan parejas libres. Puedes barajar las fichas o deshacer.', [
      { label: '🔀 Barajar', primary: true, action: () => { hideOverlay(); shuffleBoard(); } },
      { label: '↩️ Deshacer', action: () => { hideOverlay(); undo(); } },
      { label: '🎲 Nueva partida', action: () => { hideOverlay(); startGame(false); } }
    ]);
}

function pauseGame() {
  if (!overlayKind && !state.over && scene) pauseMenu();
}

/* ---------------------------------------------------------------------
   Compartir (móvil y computador)
   --------------------------------------------------------------------- */
async function share() {
  const best = Number(store.get(KEY_BEST));
  const data = {
    title: 'Mahjong Emoji',
    text: '🀄 ¡Juega este Mahjong solitario con emojis!' + (best ? ' Mi mejor tiempo: ' + fmt(best) : ''),
    url: location.href
  };
  try {
    if (navigator.share) { await navigator.share(data); return; }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(data.text + ' ' + data.url);
    showToast('🔗 Enlace copiado');
  } catch (e) {
    showToast('Copia el enlace desde la barra de direcciones');
  }
}

/* ---------------------------------------------------------------------
   Acciones unificadas (teclado, botones, joystick, mando)
   --------------------------------------------------------------------- */
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

function handleMove(dx, dy) {
  if (!scene) return;
  if (overlayKind) { overlayMove(dx + dy > 0 ? 1 : -1); return; }
  moveCursor(dx, dy);
}

function runAction(name) {
  if (!scene) return;

  // Con una pantalla abierta solo se permiten algunas acciones
  if (overlayKind) {
    if (name === 'select' && overlayBtns[overlayIdx]) overlayBtns[overlayIdx].click();
    else if (name === 'pause' && overlayKind === 'pause') hideOverlay();
    else if (name === 'theme') { cycleTheme(); if (overlayKind === 'pause') pauseMenu(overlayIdx); }
    else if (name === 'share') share();
    else if (name === 'music') { setMusic(!music.on); if (overlayKind === 'pause') pauseMenu(overlayIdx); }
    return;
  }

  switch (name) {
    case 'select':
      state.cursorVisible = true;
      if (!state.cursor || !isVisible(state.cursor)) moveCursor(0, 0);
      activate(state.cursor);
      break;
    case 'hint': hint(); break;
    case 'undo': undo(); break;
    case 'shuffle': shuffleBoard(); break;
    case 'pause': pauseGame(); break;
    case 'theme': cycleTheme(); break;
    case 'share': share(); break;
    case 'music': setMusic(!music.on); break;
    default: break;
  }
}

/* ---------------------------------------------------------------------
   Entradas: teclado
   --------------------------------------------------------------------- */
const KEYMAP = {
  arrowup: [0, -1], w: [0, -1],
  arrowdown: [0, 1], s: [0, 1],
  arrowleft: [-1, 0], a: [-1, 0],
  arrowright: [1, 0], d: [1, 0]
};

function bindKeyboard() {
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();

    // Bloquea copiar, cortar, pegar y seleccionar todo
    if (e.ctrlKey || e.metaKey) {
      if (['c', 'v', 'x', 'a'].includes(k)) e.preventDefault();
      return;
    }

    if (KEYMAP[k]) { e.preventDefault(); handleMove(KEYMAP[k][0], KEYMAP[k][1]); return; }
    if (k === 'enter' || k === ' ') { e.preventDefault(); runAction('select'); }
    else if (k === 'h') runAction('hint');
    else if (k === 'u' || k === 'z') runAction('undo');
    else if (k === 'b') runAction('shuffle');
    else if (k === 'p' || k === 'escape') runAction('pause');
    else if (k === 't') runAction('theme');
    else if (k === 'm') runAction('music');
  });
}

/* ---------------------------------------------------------------------
   Entradas: joystick virtual (táctil)
   --------------------------------------------------------------------- */
function initJoystick() {
  const base = $('joystick');
  const knob = $('joystick-knob');
  let pointerId = null;
  let dir = { x: 0, y: 0 };
  let timer = null;

  const fire = () => handleMove(dir.x, dir.y);

  const reset = () => {
    pointerId = null;
    dir = { x: 0, y: 0 };
    clearInterval(timer);
    knob.style.transform = 'translate(0, 0)';
  };

  const update = (e) => {
    const r = base.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const max = r.width * 0.3;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = (dx * max) / len; dy = (dy * max) / len; }
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';

    // Dirección dominante (4 direcciones) con zona muerta
    const next = { x: 0, y: 0 };
    if (len > max * 0.45) {
      if (Math.abs(dx) > Math.abs(dy)) next.x = Math.sign(dx);
      else next.y = Math.sign(dy);
    }
    if (next.x !== dir.x || next.y !== dir.y) {
      dir = next;
      clearInterval(timer);
      if (dir.x || dir.y) { fire(); timer = setInterval(fire, 170); }
    }
  };

  base.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pointerId = e.pointerId;
    base.setPointerCapture(pointerId);
    update(e);
  });
  base.addEventListener('pointermove', (e) => { if (e.pointerId === pointerId) update(e); });
  base.addEventListener('pointerup', (e) => { if (e.pointerId === pointerId) reset(); });
  base.addEventListener('pointercancel', reset);
}

/* ---------------------------------------------------------------------
   Entradas: mando (Gamepad API)
   --------------------------------------------------------------------- */
const pad = { prev: [], lastMove: 0 };

function bindGamepadEvents() {
  window.addEventListener('gamepadconnected', (e) => {
    showToast('🎮 Mando conectado: ' + String(e.gamepad.id).slice(0, 28));
  });
  window.addEventListener('gamepaddisconnected', () => showToast('🎮 Mando desconectado'));
}

// Se llama en cada fotograma desde la escena
function pollGamepad(now) {
  if (!navigator.getGamepads) return;
  const gp = Array.from(navigator.getGamepads()).find((p) => p && p.connected);
  if (!gp) return;

  const down = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
  // true solo en el fotograma en que se pulsa el botón
  const pressed = (i) => {
    const cur = down(i);
    const was = !!pad.prev[i];
    pad.prev[i] = cur;
    return cur && !was;
  };

  if (pressed(0)) runAction('select');    // A
  if (pressed(1)) runAction('hint');      // B
  if (pressed(2)) runAction('undo');      // X
  if (pressed(3)) runAction('shuffle');   // Y
  if (pressed(9)) runAction('pause');     // Start

  // Cruceta o stick izquierdo
  let dx = 0, dy = 0;
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  if (down(14) || ax < -0.5) dx = -1; else if (down(15) || ax > 0.5) dx = 1;
  if (down(12) || ay < -0.5) dy = -1; else if (down(13) || ay > 0.5) dy = 1;
  if (dx && dy) dy = 0;

  if (dx || dy) {
    if (now - pad.lastMove > 180) { pad.lastMove = now; handleMove(dx, dy); }
  } else {
    pad.lastMove = 0;
  }
}

/* ---------------------------------------------------------------------
   Botones HTML y protecciones de la página
   --------------------------------------------------------------------- */
function bindButtons() {
  document.querySelectorAll('[data-action]').forEach((el) => {
    // Los botones virtuales responden al instante al tocar
    const evt = el.classList.contains('vbtn') ? 'pointerdown' : 'click';
    el.addEventListener(evt, (e) => {
      e.preventDefault();
      runAction(el.dataset.action);
    });
  });
}

function bindGuards() {
  const block = (e) => e.preventDefault();
  // Bloquea seleccionar, copiar, cortar, pegar, arrastrar y menú contextual
  ['copy', 'cut', 'paste', 'selectstart', 'dragstart', 'contextmenu', 'dblclick', 'gesturestart']
    .forEach((name) => document.addEventListener(name, block));
  // Evita que los botones tomen el foco con el ratón (así Enter/Espacio no los activa dos veces)
  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) e.preventDefault();
  });
  // Pausa automática al cambiar de pestaña
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
}

/* ---------------------------------------------------------------------
   Arranque de Phaser
   --------------------------------------------------------------------- */
function createGame() {
  class MahjongScene extends Phaser.Scene {
    constructor() { super('Mahjong'); }

    create() {
      scene = this;
      THEME = readTheme();
      startGame(false);

      // Clic o toque sobre el tablero
      this.input.on('pointerdown', (pointer) => {
        if (overlayKind || state.over) return;
        const t = pickTile(pointer.worldX, pointer.worldY);
        if (t) {
          state.cursorVisible = false;
          state.cursor = t;
          activate(t);
        }
      });
    }

    update(time, delta) {
      tick(delta);
      pollGamepad(time);
    }
  }

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    transparent: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      expandParent: false
    },
    scene: MahjongScene
  });
}

// Carga tema y récord guardados
function loadPrefs() {
  applyTheme(store.get(KEY_THEME) || 'clasico');
  music.on = store.get(KEY_MUSIC) !== '0';   // la música está activada por defecto
  updateMusicButton();
  updateHud();
}

function boot() {
  bindGuards();
  bindButtons();
  bindKeyboard();
  bindGamepadEvents();
  bindMusicUnlock();
  initJoystick();

  // Si Phaser no se pudo cargar (sin internet), se avisa
  if (typeof Phaser === 'undefined') {
    showOverlay('error', '⚠️ No se pudo cargar Phaser',
      'Revisa tu conexión a internet y recarga la página.', [
        { label: 'Recargar', primary: true, action: () => location.reload() }
      ]);
    return;
  }

  // Aplica el tema guardado antes de crear el tablero
  if (store.test()) {
    loadPrefs();
  } else {
    applyTheme('clasico');
    askStorage(loadPrefs);
  }
  createGame();
}

boot();
