import Phaser from 'phaser';
import { txt, SERIF } from '../ui.js';
import { Sfx } from '../systems/audio.js';
import { TILE } from '../systems/textures.js';
import { getSaveMeta, loadGame, clearSave } from '../systems/save.js';

const HELP = [
  '【操作說明】',
  '左鍵點地面移動　｜　左鍵點敵人／NPC 攻擊與互動',
  '空白鍵 / 右鍵：閃避翻滾　｜　1~5：施放技能　｜　T：回餘燼村',
  'B / I / C：背包、技能書與屬性配點　｜　M：靜音',
  '於餘燼村找鐵匠打孔強化鍛造，蒐集符文光環與特殊詞條挑戰無盡深淵',
];

export default class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    const W = 1280, H = 720;
    this.cameras.main.setBackgroundColor('#050304');

    // 背景磚牆
    for (let y = 0; y < H; y += TILE) for (let x = 0; x < W; x += TILE) {
      const t = this.add.image(x, y, 'tiles').setOrigin(0).setCrop(5 * TILE, 0, TILE, TILE);
      t.x -= 5 * TILE;
      t.setAlpha(0.35);
    }
    this.add.image(W / 2, H / 2, 'vignette').setScale(1.1);
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45);

    // 火炬
    this.torches = [];
    [[200, 260], [W - 200, 260]].forEach(([x, y]) => {
      const glow = this.add.image(x, y - 10, 'glow').setScale(3.2).setTint(0xff7020).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55);
      const t = this.add.image(x, y, 'torch0').setScale(1.6);
      this.torches.push({ t, glow });
    });

    // 餘燼粒子
    this.add.particles(0, 0, 'spark', {
      x: { min: 0, max: W },
      y: H + 10,
      lifespan: 6000,
      speedY: { min: -40, max: -90 },
      speedX: { min: -15, max: 15 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xff6a00, 0xffa030, 0xff3000],
      frequency: 90,
      blendMode: 'ADD',
    });

    const title = this.add.text(W / 2, 185, '餘燼地城', {
      fontFamily: SERIF, fontSize: '96px', color: '#d8a050', stroke: '#2a0800', strokeThickness: 10,
      shadow: { offsetX: 0, offsetY: 0, color: '#ff4000', blur: 24, fill: true },
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, alpha: 0.82, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    txt(this, W / 2, 270, 'EMBER  DUNGEON', 20, '#8a6a4a').setOrigin(0.5).setLetterSpacing?.(6);
    txt(this, W / 2, 308, '整備餘燼村莊，踏入無盡深淵鍛造神兵、斬殺諸王', 20, '#a08870').setOrigin(0.5);

    const startNew = () => {
      Sfx.init();
      Sfx.play('click');
      clearSave();
      this.cameras.main.fadeOut(450, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { mode: 'village', floor: 1, keepState: false }));
    };

    const meta = getSaveMeta();
    let helpY = 555;
    if (meta) {
      txt(
        this, W / 2, 342,
        `存檔：Lv.${meta.level} · 最高第 ${meta.maxFloor} 層 · 擊殺 ${meta.kills} · ${meta.gold} 金`,
        16, '#80ff98',
      ).setOrigin(0.5);
      this.makeButton(W / 2, 395, '繼續遊戲', () => {
        Sfx.init();
        Sfx.play('click');
        const ok = loadGame();
        this.cameras.main.fadeOut(450, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { mode: 'village', floor: 1, keepState: ok }));
      });
      this.makeButton(W / 2, 462, '新遊戲', startNew);
      helpY = 528;
    } else {
      this.makeButton(W / 2, 410, '開始遊戲', startNew);
      helpY = 480;
    }

    this.helpText = txt(this, W / 2, helpY + 90, HELP.join('\n'), 17, '#c8b898', { align: 'center', lineSpacing: 7 }).setOrigin(0.5).setVisible(false);
    this.makeButton(W / 2, helpY, '操作說明', () => {
      Sfx.init();
      Sfx.play('click');
      this.helpText.setVisible(!this.helpText.visible);
    });

    txt(this, W - 16, H - 16, 'V3 無盡遠征', 14, '#5a4a3a').setOrigin(1, 1);
    this.input.keyboard.once('keydown-ENTER', () => {
      Sfx.init();
      const ok = meta ? loadGame() : false;
      this.scene.start('Game', { mode: 'village', floor: 1, keepState: ok });
    });
    this.cameras.main.fadeIn(600);
  }

  makeButton(x, y, label, cb) {
    const bg = this.add.rectangle(x, y, 260, 50, 0x1a0e0a, 0.9).setStrokeStyle(2, 0x6a4020);
    const t = txt(this, x, y, label, 25, '#e0c090').setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => { bg.setFillStyle(0x3a1a0e, 0.95); bg.setStrokeStyle(2, 0xd08030); t.setColor('#ffe0a0'); })
      .on('pointerout', () => { bg.setFillStyle(0x1a0e0a, 0.9); bg.setStrokeStyle(2, 0x6a4020); t.setColor('#e0c090'); })
      .on('pointerdown', cb);
    return bg;
  }

  update(time) {
    this.torches.forEach((o, i) => {
      o.t.setTexture('torch' + (Math.floor(time / 120 + i) % 3));
      o.glow.setAlpha(0.45 + Math.sin(time * 0.013 + i) * 0.08 + Math.random() * 0.05);
    });
  }
}
