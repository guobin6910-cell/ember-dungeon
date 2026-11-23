import Phaser from 'phaser';
import { generateTextures } from '../systems/textures.js';
import { preloadDungeonArt, hasBackdropArt, fitCoverSprite, ART_KEYS } from '../systems/dungeonArt.js';
import { txt, SERIF } from '../ui.js';

export default class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const W = 1280, H = 720;
    this.cameras.main.setBackgroundColor('#050304');

    this._backdropImg = null;
    this._scrim = this.add.rectangle(W / 2, H / 2, W, H, 0x050304, 0.56).setDepth(-5);

    this.add.text(W / 2, H / 2 - 64, '餘燼地城', {
      fontFamily: SERIF,
      fontSize: '72px',
      color: '#d8a050',
      stroke: '#2a0800',
      strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 0, color: '#ff4000', blur: 18, fill: true },
    }).setOrigin(0.5);
    txt(this, W / 2, H / 2 - 4, 'EMBER  DUNGEON', 16, '#8a6a4a').setOrigin(0.5);

    const barW = 340, barH = 10, barX = W / 2 - barW / 2, barY = H / 2 + 44;
    this.add.rectangle(W / 2, barY + barH / 2, barW + 4, barH + 4, 0x160c08, 0.92)
      .setStrokeStyle(1.5, 0x704828);
    this._barFill = this.add.rectangle(barX, barY, 0, barH, 0xd88830, 1).setOrigin(0, 0);
    this._barW = barW;
    this._statusTxt = txt(this, W / 2, barY + 28, '載入中...', 14, '#c0a888').setOrigin(0.5);

    const isAlive = () => !!this.sys && this.sys.settings.status < Phaser.Scenes.SHUTDOWN;
    const showBackdrop = () => {
      if (this._backdropImg || !hasBackdropArt(this.game) || !isAlive()) return;
      const img = this.add.image(W / 2, H / 2, ART_KEYS.BACKDROP).setDepth(-10).setAlpha(0);
      fitCoverSprite(img, W, H);
      this._backdropImg = img;
      this.tweens.add({ targets: img, alpha: 1, duration: 220, ease: 'Quad.Out' });
    };

    this._onBackdropLoaded = showBackdrop;
    preloadDungeonArt(this.game);
    if (hasBackdropArt(this.game)) {
      showBackdrop();
    } else {
      this.game.events.once(`dungeonArtLoaded:${ART_KEYS.BACKDROP}`, this._onBackdropLoaded);
    }

    this.events.once('shutdown', () => {
      this.game.events.off(`dungeonArtLoaded:${ART_KEYS.BACKDROP}`, this._onBackdropLoaded);
      if (this._finishWaitCb) {
        this.game.events.off(`dungeonArtLoaded:${ART_KEYS.BACKDROP}`, this._finishWaitCb);
        this._finishWaitCb = null;
      }
      if (this._finishErrCb) {
        this.game.events.off(`dungeonArtError:${ART_KEYS.BACKDROP}`, this._finishErrCb);
        this._finishErrCb = null;
      }
    });

    this.load.on('progress', (val) => {
      if (this._barFill?.active) this._barFill.width = Math.max(24, this._barW * Math.min(0.6, val * 0.6));
    });
    this.load.json('asset_manifest', 'assets/overrides/manifest.json');
  }

  create() {
    const manifest = this.cache.json.get('asset_manifest');
    const list = manifest && Array.isArray(manifest.overrides) ? manifest.overrides : [];
    let queued = 0;
    for (const entry of list) {
      if (!entry || !entry.key || !entry.file) continue;
      this.load.image(entry.key, `assets/overrides/${entry.file}`);
      queued++;
    }

    const isAlive = () => !!this.sys && this.sys.settings.status < Phaser.Scenes.SHUTDOWN;
    const startMenuFlow = () => {
      generateTextures(this);
      if (this._barFill?.active) this._barFill.width = this._barW * 0.85;

      let done = false;
      const proceed = (delayMs = 180) => {
        if (done || !isAlive()) return;
        done = true;
        if (this._finishWaitCb) {
          this.game.events.off(`dungeonArtLoaded:${ART_KEYS.BACKDROP}`, this._finishWaitCb);
          this._finishWaitCb = null;
        }
        if (this._finishErrCb) {
          this.game.events.off(`dungeonArtError:${ART_KEYS.BACKDROP}`, this._finishErrCb);
          this._finishErrCb = null;
        }
        if (this._barFill?.active) this._barFill.width = this._barW;
        if (this._statusTxt?.active) this._statusTxt.setText('準備完成');
        this.time.delayedCall(delayMs, () => {
          if (isAlive()) this.scene.start('Menu');
        });
      };

      if (hasBackdropArt(this.game)) {
        proceed(180);
        return;
      }

      this._finishWaitCb = () => proceed(180);
      this._finishErrCb = () => proceed(50);
      this.game.events.once(`dungeonArtLoaded:${ART_KEYS.BACKDROP}`, this._finishWaitCb);
      this.game.events.once(`dungeonArtError:${ART_KEYS.BACKDROP}`, this._finishErrCb);
      // 最多等待 900ms，避免弱網手機卡在開始畫面
      this.time.delayedCall(900, () => proceed(0));
    };

    if (queued > 0) {
      this.load.once('complete', startMenuFlow);
      this.load.start();
      return;
    }
    startMenuFlow();
  }
}
