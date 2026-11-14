/* ---------------------------------------------------------------------
   Dibujo de fichas (Phaser)
   --------------------------------------------------------------------- */

// Dibuja el cuerpo de la ficha: sombra, lateral 3D y cara
function drawTile(t) {
  const g = t.g;
  g.clear();
  g.fillStyle(THEME.shadow, 0.3);
  g.fillRoundedRect(-TW / 2 + 5, -TH / 2 + 8, TW, TH, RADIUS);
  g.fillGradientStyle(THEME.sideTop, THEME.sideTop, THEME.sideBottom, THEME.sideBottom, 1);
  g.fillRoundedRect(-TW / 2 + 4, -TH / 2 + 6, TW, TH, RADIUS);
  g.fillGradientStyle(THEME.tileTop, THEME.tileTop, THEME.tileBottom, THEME.tileBottom, 1);
  g.fillRoundedRect(-TW / 2, -TH / 2, TW, TH, RADIUS);
  g.lineStyle(2, THEME.edge, 1);
  g.strokeRoundedRect(-TW / 2, -TH / 2, TW, TH, RADIUS);
  g.lineStyle(2, THEME.highlight, 0.9);
  g.strokeRoundedRect(-TW / 2 + 4, -TH / 2 + 4, TW - 8, TH - 8, RADIUS - 3);

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
   Cursor (teclado, mando)
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

