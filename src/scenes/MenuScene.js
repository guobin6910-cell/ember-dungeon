import Phaser from 'phaser';
import { txt, SERIF } from '../ui.js';
import { Sfx } from '../systems/audio.js';
import { TILE } from '../systems/textures.js';
import { getSaveMeta, loadGame, saveGame, clearSave } from '../systems/save.js';
import { DIFFICULTY_LIST, DEFAULT_DIFFICULTY, getDifficulty } from '../systems/difficulty.js';
import { state, setDifficulty, loadTouchPref } from '../state.js';

const HELP = [
  '【電腦鍵鼠操作】',
  'WASD / 方向鍵：角色移動　｜　左鍵點地面尋路繞障／點 NPC 與掉落物自動互動拾取',
  '空白鍵 / 右鍵：閃避翻滾　｜　1~5：施放技能（瞄準游標）',
  'B / I / C：背包與屬性　｜　F：互動　｜　T：回村　｜　G：傳送門　｜　M：靜音',
  '',
  '【手機觸控操作】',
  '左下虛擬搖桿移動　｜　右下「攻擊 / 互動 / 翻滾」快捷操作',
  '點擊下方 1~5 技能自動瞄準最近目標（背包可切換「賣出模式」）',
  '',
  '【套裝與鐵匠保底】',
  '擊殺各層頭目機率掉落翠綠「4 件套裝」與套裝精華；鐵匠可轉換同套部位或定向保底鍛造！',
];

export default class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    const W = 1280, H = 720;
    this.starting = false;
    state.touchMode = loadTouchPref();
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
    [[200, 240], [W - 200, 240]].forEach(([x, y]) => {
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

    const title = this.add.text(W / 2, 144, '餘燼地城', {
      fontFamily: SERIF, fontSize: '90px', color: '#d8a050', stroke: '#2a0800', strokeThickness: 10,
      shadow: { offsetX: 0, offsetY: 0, color: '#ff4000', blur: 24, fill: true },
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, alpha: 0.82, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    txt(this, W / 2, 218, 'EMBER  DUNGEON', 19, '#8a6a4a').setOrigin(0.5).setLetterSpacing?.(6);
    txt(this, W / 2, 250, '整備餘燼村莊，踏入無盡深淵鍛造神兵、斬殺諸王', 19, '#a08870').setOrigin(0.5);

    const meta = getSaveMeta();
    this.selectedDiff = meta ? meta.difficulty : (state.difficulty || DEFAULT_DIFFICULTY);
    this.diffBtns = {};
    this.diffSummaryText = txt(this, W / 2, 336, '', 15, '#ffd880').setOrigin(0.5);

    const updateDiffUI = () => {
      const cur = getDifficulty(this.selectedDiff);
      DIFFICULTY_LIST.forEach((d) => {
        const btn = this.diffBtns[d.id];
        if (!btn) return;
        const act = d.id === cur.id;
        btn.bg.setFillStyle(act ? 0x2a1812 : 0x120c0a, 0.95);
        btn.bg.setStrokeStyle(act ? 3 : 1.5, act ? d.hex : 0x584030);
        btn.t.setColor(act ? d.color : '#9a8878');
      });
      this.diffSummaryText.setText(`【${cur.name}】${cur.short}`).setColor(cur.color);
    };

    const startX = W / 2 - ((DIFFICULTY_LIST.length - 1) * 126) / 2;
    DIFFICULTY_LIST.forEach((d, idx) => {
      const bx = startX + idx * 126, by = 302;
      const bg = this.add.rectangle(bx, by, 112, 38, 0x120c0a, 0.95)
        .setStrokeStyle(1.5, 0x584030).setInteractive({ useHandCursor: true });
      const t = txt(this, bx, by, d.name, 18, '#9a8878').setOrigin(0.5);
      bg.on('pointerdown', () => {
        Sfx.init();
        Sfx.play('click');
        this.selectedDiff = d.id;
        setDifficulty(d.id);
        updateDiffUI();
      });
      this.diffBtns[d.id] = { bg, t, x: bx, y: by };
    });
    updateDiffUI();

    const enterGame = (params) => {
      if (this.starting) return;
      this.starting = true;
      this.cameras.main.resetFX();
      this.cameras.main.fadeOut(450, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', params));
    };

    const startNew = () => {
      Sfx.init();
      Sfx.play('click');
      setDifficulty(this.selectedDiff);
      clearSave();
      enterGame({ mode: 'village', floor: 1, keepState: false, difficulty: this.selectedDiff });
    };

    let helpY = 478;
    if (meta) {
      const metaDiff = getDifficulty(meta.difficulty);
      txt(
        this, W / 2, 370,
        `存檔：Lv.${meta.level} · 最高第 ${meta.maxFloor} 層 · 【${metaDiff.name}】 · 擊殺 ${meta.kills} · ${meta.gold} 金`,
        16, '#80ff98',
      ).setOrigin(0.5);
      this.continueBtn = this.makeButton(W / 2, 420, '繼續遊戲', () => {
        Sfx.init();
        Sfx.play('click');
        const ok = loadGame();
        if (ok && this.selectedDiff !== state.difficulty) {
          setDifficulty(this.selectedDiff);
          saveGame();
        }
        enterGame({ mode: 'village', floor: 1, keepState: ok });
      });
      this.newGameBtn = this.makeButton(W / 2, 482, '新遊戲', startNew);
      helpY = 544;
    } else {
      this.startBtn = this.makeButton(W / 2, 412, '開始遊戲', startNew);
      helpY = 478;
    }

    // 置中操作說明卡片（加寬與充裕內距，右上使用 ASCII X 關閉）
    this.helpCard = this.add.container(0, 0).setDepth(100).setVisible(false);
    const helpBack = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.78).setInteractive();
    helpBack.on('pointerdown', () => this.helpCard.setVisible(false));
    const helpBox = this.add.rectangle(W / 2, H / 2, 860, 490, 0x140d0a, 0.98).setStrokeStyle(3, 0x905828).setInteractive();
    const helpTitle = txt(this, W / 2, H / 2 - 206, '餘燼地城 — 操作與系統說明', 26, '#ffd890').setOrigin(0.5);
    const helpDiv = this.add.graphics();
    helpDiv.lineStyle(1, 0x6a4020, 0.9).lineBetween(W / 2 - 380, H / 2 - 172, W / 2 + 380, H / 2 - 172);
    const helpBody = txt(this, W / 2, H / 2 - 146, HELP.join('\n'), 15, '#d8c8b0', { align: 'center', lineSpacing: 8, wordWrap: { width: 790 } }).setOrigin(0.5, 0);
    const closeXBg = this.add.rectangle(W / 2 + 404, H / 2 - 219, 30, 30, 0x26140e).setStrokeStyle(1.5, 0x905828).setInteractive({ useHandCursor: true });
    const closeXT = this.add.text(W / 2 + 404, H / 2 - 219, 'X', {
      fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffe0b0',
    }).setOrigin(0.5);
    closeXBg.on('pointerdown', () => { Sfx.play('click'); this.helpCard.setVisible(false); });
    const closeBg = this.add.rectangle(W / 2, H / 2 + 202, 160, 42, 0x2e1810).setStrokeStyle(2, 0xc08040).setInteractive({ useHandCursor: true });
    const closeTxt = txt(this, W / 2, H / 2 + 202, '關閉說明', 18, '#ffe0a0').setOrigin(0.5);
    closeBg.on('pointerdown', () => { Sfx.play('click'); this.helpCard.setVisible(false); });
    this.helpCard.add([helpBack, helpBox, helpTitle, helpDiv, helpBody, closeXBg, closeXT, closeBg, closeTxt]);

    this.helpBtn = this.makeButton(W / 2, helpY, '操作說明', () => {
      Sfx.init();
      Sfx.play('click');
      this.helpCard.setVisible(!this.helpCard.visible);
    });

    txt(this, W - 16, H - 16, 'V5 套裝與操作升級版', 14, '#6a5a4a').setOrigin(1, 1);
    this.input.keyboard.once('keydown-ENTER', () => {
      Sfx.init();
      const ok = meta ? loadGame() : false;
      if (!ok) setDifficulty(this.selectedDiff);
      enterGame({ mode: 'village', floor: 1, keepState: ok, difficulty: this.selectedDiff });
    });
    this.cameras.main.fadeIn(600);

    if (window.__ember) window.__ember.menu = this;
  }

  makeButton(x, y, label, cb) {
    const bg = this.add.rectangle(x, y, 260, 48, 0x1a0e0a, 0.92).setStrokeStyle(2, 0x6a4020);
    const t = txt(this, x, y, label, 24, '#e0c090').setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => { bg.setFillStyle(0x3a1a0e, 0.96); bg.setStrokeStyle(2, 0xd08030); t.setColor('#ffe0a0'); })
      .on('pointerout', () => { bg.setFillStyle(0x1a0e0a, 0.92); bg.setStrokeStyle(2, 0x6a4020); t.setColor('#e0c090'); })
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
