/* ---------------------------------------------------------------------
   Entradas: teclado
   --------------------------------------------------------------------- */
const KEYMAP = {
  arrowup: [0, -1], w: [0, -1],
  arrowdown: [0, 1], s: [0, 1],
  arrowleft: [-1, 0], a: [-1, 0],
  arrowright: [1, 0], d: [1, 0]
};

function handleMove(dx, dy) {
  if (!scene) return;
  if (overlayKind) { overlayMove(dx + dy > 0 ? 1 : -1); return; }
  moveCursor(dx, dy);
}

function runAction(name) {
  if (!scene) return;

  if (overlayKind) {
    if (name === 'select' && overlayBtns[overlayIdx]) overlayBtns[overlayIdx].click();
    else if (name === 'pause' && overlayKind === 'pause') hideOverlay();
    else if (name === 'theme') { cycleTheme(); if (overlayKind === 'pause') pauseMenu(overlayIdx); }
    else if (name === 'share') share();
    else if (name === 'music') { setMusic(!music.on); if (overlayKind === 'pause') pauseMenu(overlayIdx); }
    else if (name === 'sound') { setSound(!sound.on); if (overlayKind === 'pause') pauseMenu(overlayIdx); }
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
    case 'sound': setSound(!sound.on); break;
    default: break;
  }
}

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
    el.addEventListener('click', (e) => {
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

