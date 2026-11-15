/* =====================================================================
   Mahjong Emoji – Solitario (Phaser)
   - El tablero se dibuja con Phaser; los menús y botones son HTML.
   - Se juega con ratón/táctil, flechas o WASD, o mando.
   ===================================================================== */
'use strict';

/* ---------------------------------------------------------------------
   Constantes del juego
   --------------------------------------------------------------------- */

// Emojis de las fichas; se reparten por parejas según el diseño
const FACES = [
  '🐼', '🍎', '🌸', '🐙', '🚀', '🎈', '🍕', '⭐',
  '🐸', '🌈', '🍩', '🎸', '🦊', '🍉', '🐧', '🔥',
  '🍀', '🎲', '🐝', '🍓', '🦋', '🌙', '🍄', '🐢',
  '🍒', '🦄', '🎁', '🌻', '🍋', '🐳', '💎', '🍪',
  '🐱'
];
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

// Tamaño lógico del lienzo y de las fichas (Phaser lo escala para ajustarse a la pantalla)
const W = 920, H = 660;
const CELL_W = 88, CELL_H = 104;     // separación entre casillas
const TILE_SCALE = typeof window !== 'undefined' &&
  ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || window.innerWidth <= 700) ? 1.4 : 1;
const TW = 84 * TILE_SCALE, TH = 100 * TILE_SCALE;
const LAYER_OFF = -6 * TILE_SCALE;   // desplazamiento visual por cada capa (efecto 3D)
const RADIUS = 10 * TILE_SCALE;      // radio de las esquinas de la ficha
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
const KEY_SOUND = 'mahjong-emoji:sound';

// Cada diseño contiene capas de 6 filas por 10 columnas; '#' es una ficha y '.' un hueco.
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
  },
  {
    name: 'Fortaleza',
    layers: [
      ['##########', '##########', '##########', '##########', '##########', '##########'],
      ['.########.', '.########.', '.########.', '.########.', '.########.', '.########.'],
      ['..######..', '..######..', '..######..', '..######..', '..######..', '..######..'],
      ['....##....', '....##....', '....##....', '....##....', '....##....', '....##....']
    ]
  },
  {
    name: 'Jardín',
    layers: [
      ['..######..', '.########.', '##########', '##########', '.########.', '..######..'],
      ['..........', '...####...', '..######..', '..######..', '...####...', '..........'],
      ['..........', '..........', '....##....', '....##....', '..........', '..........']
    ]
  },
  {
    name: 'Olas',
    layers: [
      ['##########', '##########', '##########', '##########', '##########', '##########'],
      ['..........', '..######..', '.########.', '##########', '.########.', '..######..'],
      ['..........', '..........', '...####...', '..######..', '...####...', '..........'],
      ['..........', '..........', '..........', '....##....', '..........', '..........']
    ]
  },
  {
    name: 'Mariposa',
    layers: [
      ['##......##', '####..####', '##########', '##########', '####..####', '##......##'],
      ['..........', '.###..###.', '.########.', '.########.', '.###..###.', '..........'],
      ['..........', '..........', '..######..', '..######..', '..........', '..........']
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
  cursor: null,            // ficha marcada con teclado o mando
  cursorVisible: false,    // mostrar el cursor solo si se usa teclado o mando
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
    edge: c('--tile-edge'),
    tileTop: c('--tile-top'), tileBottom: c('--tile-bottom'),
    sideTop: c('--tile-side-top'), sideBottom: c('--tile-side-bottom'),
    highlight: c('--tile-highlight'),
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

