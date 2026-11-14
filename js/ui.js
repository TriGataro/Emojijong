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

