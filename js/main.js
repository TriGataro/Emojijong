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
  sound.on = store.get(KEY_SOUND) !== '0';   // los efectos de sonido están activados por defecto
  updateMusicButton();
  updateSoundButton();
  updateHud();
}

function boot() {
  bindGuards();
  bindButtons();
  bindKeyboard();
  bindGamepadEvents();
  bindMusicUnlock();

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
