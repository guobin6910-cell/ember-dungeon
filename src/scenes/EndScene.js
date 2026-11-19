import Phaser from 'phaser';
import { state, getStats, elapsedText } from '../state.js';
import { txt, SERIF } from '../ui.js';
import { Sfx } from '../systems/audio.js';
import { saveGame, clearSave } from '../systems/save.js';

export default class EndScene extends Phaser.Scene {
  constructor() { super('End'); }

  create(data) {
    const W = 1280, H = 720;
    const victory = !!data.victory;
    const bg = this.add.rectangle(W / 2, H / 2, W, H, victory ? 0x100804 : 0x120000, 0).setInteractive();
    this.tweens.add({ targets: bg, fillAlpha: 0.85, duration: 800 });

    const title = this.add.text(W / 2, 130, victory ? '無盡凱旋' : '你倒下了', {
      fontFamily: SERIF, fontSize: '72px', color: victory ? '#f0c060' : '#c02020',
      stroke: '#000', strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 0, color: victory ? '#ff8000' : '#600000', blur: 20, fill: true },
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: 150, duration: 900, delay: 200 });

    const sub = victory ? '你征服了無盡深淵，事蹟將永遠流傳於餘燼村。' : '餘燼吞噬了你的靈魂……但可回餘燼村重整旗鼓';
    txt(this, W / 2, 220, sub, 20, '#c0a888').setOrigin(0.5);

    const learnedCount = Object.keys(state.skillLevels || {}).length;
    const lines = [
      ['最高抵達層數', `第 ${state.maxFloor} 層`],
      ['已通關層數', `${state.clearedFloors} 層`],
      ['角色等級', `${state.level}`],
      ['擊殺數', `${state.kills}`],
      ['金幣 / 餘燼石', `${state.gold} / ${state.shards}`],
      ['習得技能數', `${learnedCount} 種`],
      ['冒險時間', elapsedText()],
    ];
    const panel = this.add.rectangle(W / 2, 390, 460, 270, 0x0a0606, 0.9).setStrokeStyle(2, 0x6a4020);
    panel.setAlpha(0);
    this.tweens.add({ targets: panel, alpha: 1, duration: 500, delay: 500 });
    lines.forEach(([k, v], i) => {
      const a = txt(this, W / 2 - 180, 280 + i * 33, k, 20, '#a89070').setAlpha(0);
      const b = txt(this, W / 2 + 180, 280 + i * 33, v, 20, '#ffe0a0').setOrigin(1, 0).setAlpha(0);
      this.tweens.add({ targets: [a, b], alpha: 1, duration: 400, delay: 650 + i * 110 });
    });

    const reviveVillage = () => {
      Sfx.play('click');
      const s = getStats();
      state.dead = false;
      state.hp = s.maxHp;
      state.mp = s.maxMp;
      state.shield = 0;
      saveGame();
      this.scene.stop('Game');
      this.scene.start('Game', { mode: 'village', floor: 1, keepState: true });
    };

    this.button(W / 2 - 210, 590, '回村復活', reviveVillage, 185);
    this.button(W / 2, 590, '重新開始', () => {
      Sfx.play('click');
      clearSave();
      this.scene.stop('Game');
      this.scene.start('Game', { mode: 'village', floor: 1, keepState: false });
    }, 185);
    this.button(W / 2 + 210, 590, '返回主選單', () => {
      Sfx.play('click');
      const s = getStats();
      state.dead = false;
      state.hp = s.maxHp;
      state.mp = s.maxMp;
      state.shield = 0;
      saveGame();
      this.scene.stop('Game');
      this.scene.start('Menu');
    }, 185);
  }

  button(x, y, label, cb, w = 210) {
    const bg = this.add.rectangle(x, y, w, 50, 0x1a0e0a, 0.95).setStrokeStyle(2, 0x6a4020);
    const t = txt(this, x, y, label, 22, '#e0c090').setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => { bg.setStrokeStyle(2, 0xd08030); t.setColor('#ffe0a0'); })
      .on('pointerout', () => { bg.setStrokeStyle(2, 0x6a4020); t.setColor('#e0c090'); })
      .on('pointerdown', cb);
  }
}
