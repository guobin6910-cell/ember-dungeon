import Phaser from 'phaser';
import {
  state, getStats, getEffectiveSkillLevel, socketRune, unsocketRunes, xpToNext, SLOTS, SLOT_NAMES, INV_SIZE,
  equip, unequip, allocate, useSkillBook, assignSkillSlot, clampVitals,
} from '../state.js';
import { txt, SERIF, QUALITY_COLORS, QUALITY_HEX, QUALITY_NAMES } from '../ui.js';
import {
  STAT_NAMES, itemValue, itemDisplayName, effectiveStats, MAX_ENHANCE, formatSpecialAffix,
  enhanceCost, enhanceItem, reforgeCost, reforgeItem, punchSocketCost, punchSocket,
  forgeCost, dismantleReward, generateItem,
} from '../systems/items.js';
import {
  MAX_SOCKETS, RUNE_DEFS, RUNE_LIST, RUNEWORD_LIST, getItemRuneword, runeDisplayName,
} from '../systems/runes.js';
import { SKILL_DEFS, SKILL_LIST, MAX_SKILL_LV, getSkillData } from '../systems/skills.js';
import { getBiome } from '../systems/dungeon.js';
import { BOSS_TYPES } from '../entities/Boss.js';
import { Sfx } from '../systems/audio.js';
import { saveGame } from '../systems/save.js';

const W = 1280, H = 720;
const MM = { x: W - 16 - 240, y: 16, w: 240, h: 180 };

export default class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  create() {
    this.game_ = this.scene.get('Game');
    this.add.image(W / 2, H / 2, 'vignette');
    this.hurtVig = this.add.image(W / 2, H / 2, 'hurtvig').setAlpha(0);

    // ---- 底部面板
    const g = this.add.graphics();
    g.fillStyle(0x0a0706, 0.88).fillRect(0, H - 92, W, 92);
    g.lineStyle(2, 0x4a3020, 1).lineBetween(0, H - 92, W, H - 92);
    this.bars = this.add.graphics();
    this.hpText = txt(this, 184, H - 75, '', 14, '#ffffff').setOrigin(0.5);
    this.mpText = txt(this, 184, H - 47, '', 14, '#ffffff').setOrigin(0.5);
    txt(this, 20, H - 75, '生命', 14, '#e08080').setOrigin(0, 0.5);
    txt(this, 20, H - 47, '法力', 14, '#80a0ff').setOrigin(0, 0.5);
    this.xpText = txt(this, 812, H - 14, '', 12, '#d0c0ff').setOrigin(0, 0.5);

    // ---- 左上資訊
    this.locText = txt(this, 16, 12, '', 18, '#ffd890');
    this.lvlText = txt(this, 16, 38, '', 16, '#e0d0b8');
    this.pointsText = txt(this, 16, 62, '', 14, '#80ff80');
    this.buffText = txt(this, 16, 86, '', 14, '#ffa850');
    this.auraText = txt(this, 16, 110, '', 13, '#70f8e0');

    // ---- 小地圖
    this.mmTex = this.textures.exists('minimap') ? this.textures.get('minimap') : this.textures.createCanvas('minimap', MM.w, MM.h);
    const ctx = this.mmTex.getContext();
    ctx.clearRect(0, 0, MM.w, MM.h);
    this.mmTex.refresh();
    const mmFrame = this.add.graphics();
    mmFrame.fillStyle(0x000000, 0.72).fillRect(MM.x - 4, MM.y - 4, MM.w + 8, MM.h + 8);
    mmFrame.lineStyle(2, 0x6a4a2a, 1).strokeRect(MM.x - 4, MM.y - 4, MM.w + 8, MM.h + 8);
    this.add.image(MM.x, MM.y, 'minimap').setOrigin(0);
    this.mmDots = this.add.graphics();
    this.mmInited = false;

    this.add.image(MM.x + 8, MM.y + MM.h + 20, 'coin').setScale(1.4);
    this.goldText = txt(this, MM.x + 22, MM.y + MM.h + 20, '', 17, '#f0c040').setOrigin(0, 0.5);
    this.add.image(MM.x + 130, MM.y + MM.h + 20, 'shard').setScale(1.1);
    this.shardText = txt(this, MM.x + 144, MM.y + MM.h + 20, '', 17, '#ff90ff').setOrigin(0, 0.5);

    // ---- 訊息與受傷紅暈
    this.msgs = [];
    this.onMsg = (text, color) => this.showMsg(text, color);
    this.onHurt = () => {
      this.hurtVig.setAlpha(0.7);
      this.tweens.add({ targets: this.hurtVig, alpha: 0, duration: 450 });
    };
    this.onInv = () => { if (this.activeModal === 'panel') this.refreshPanel(); };
    this.onBossStart = () => {
      this.bossBar.setVisible(true);
      this.tweens.killTweensOf(this.bossBar);
      this.tweens.add({ targets: this.bossBar, alpha: 1, duration: 500 });
      const b = this.game_.boss;
      const bname = b ? b.T.name : '深淵領主';
      const banner = this.add.text(W / 2, 170, `${bname} 甦醒`, {
        fontFamily: SERIF, fontSize: '46px', color: '#f0b860', stroke: '#1a0414', strokeThickness: 7,
        shadow: { offsetX: 0, offsetY: 0, color: '#a020ff', blur: 18, fill: true },
      }).setOrigin(0.5).setDepth(60).setAlpha(0);
      this.tweens.add({
        targets: banner, alpha: { from: 0, to: 1 }, duration: 450,
        onComplete: () => {
          this.tweens.add({ targets: banner, alpha: 0, delay: 1300, duration: 500, onComplete: () => banner.destroy() });
        },
      });
    };
    this.onBossEnd = () => {
      this.tweens.killTweensOf(this.bossBar);
      this.tweens.add({
        targets: this.bossBar, alpha: 0, duration: 400,
        onComplete: () => this.bossBar.setVisible(false),
      });
    };
    this.onOpenForge = () => this.setModal(this.activeModal === 'forge' ? null : 'forge');
    this.onOpenPortal = () => this.setModal(this.activeModal === 'portal' ? null : 'portal');

    this.game.events.on('msg', this.onMsg);
    this.game.events.on('playerHurt', this.onHurt);
    this.game.events.on('inventoryChanged', this.onInv);
    this.game.events.on('bossStart', this.onBossStart);
    this.game.events.on('bossEnd', this.onBossEnd);
    this.game.events.on('openForge', this.onOpenForge);
    this.game.events.on('openPortal', this.onOpenPortal);
    this.events.once('shutdown', () => {
      this.game.events.off('msg', this.onMsg);
      this.game.events.off('playerHurt', this.onHurt);
      this.game.events.off('inventoryChanged', this.onInv);
      this.game.events.off('bossStart', this.onBossStart);
      this.game.events.off('bossEnd', this.onBossEnd);
      this.game.events.off('openForge', this.onOpenForge);
      this.game.events.off('openPortal', this.onOpenPortal);
    });

    const hintMsg = state.mode === 'village'
      ? '左鍵點擊移動與NPC互動｜1~5 技能｜B 背包｜G 傳送門｜M 靜音'
      : '左鍵點地面移動｜左鍵點敵人攻擊｜1~5 技能｜空白鍵 翻滾｜B 背包｜T 回村';
    this.hint = txt(this, W / 2, H - 120, hintMsg, 15, '#c8b898').setOrigin(0.5);
    this.tweens.add({ targets: this.hint, alpha: 0, delay: 9000, duration: 1500 });

    this.buildSkillBar();
    this.buildBossBar();
    this.buildQuickButtons();

    this.modal = this.add.container(0, 0).setDepth(100).setVisible(false);
    this.tooltip = this.add.container(0, 0).setDepth(220).setVisible(false);
    this.activeModal = null;
    this.panelTab = 'char';
    this.skillPage = 0;
    this.forgeSelectedId = null;
    this.forgeSlot = 'weapon';
    this.forgePage = 0;
    this.runeTargetId = null;
    this.runeRecipePage = 0;
    this.portalFloor = state.maxFloor;

    this.input.keyboard.on('keydown-B', () => this.togglePanel());
    this.input.keyboard.on('keydown-I', () => this.togglePanel());
    this.input.keyboard.on('keydown-C', () => this.togglePanel());
    this.input.keyboard.on('keydown-ESC', () => { if (this.activeModal) this.setModal(null); });
    this.input.mouse.disableContextMenu();

    window.__ember.ui = this;
  }

  // =========================================================== Modal 管理
  setModal(kind) {
    if (this.game_.player.dead || this.game_.victoryPending || this.game_.transitioning) return;
    const wasOpen = !!this.activeModal;
    this.activeModal = kind;
    this.tooltip.setVisible(false);
    Sfx.play('click');
    if (kind) {
      this.modal.setVisible(true);
      if (kind === 'panel') this.refreshPanel();
      else if (kind === 'forge') this.refreshForge();
      else if (kind === 'portal') this.refreshPortal();
      if (!wasOpen) this.scene.pause('Game');
    } else {
      this.modal.removeAll(true).setVisible(false);
      if (wasOpen) this.scene.resume('Game');
    }
  }

  togglePanel() {
    this.setModal(this.activeModal === 'panel' ? null : 'panel');
  }

  get panelOpen() { return this.activeModal === 'panel'; }

  // =========================================================== 技能列（1~5 + 空白鍵）
  buildSkillBar() {
    this.skillSlots = [];
    for (let i = 0; i < 6; i++) {
      const x = 392 + i * 72, y = H - 54;
      const isDodge = i === 5;
      this.add.rectangle(x, y, 58, 58, 0x050304, 1).setStrokeStyle(2, 0x6a4a2a);
      const icon = this.add.image(x, y, isDodge ? 'sk_dodge' : 'sk_fire').setScale(0.95);
      const cdG = this.add.graphics();
      const cdT = txt(this, x, y, '', 17, '#ffffff').setOrigin(0.5);
      txt(this, x - 25, y - 27, isDodge ? '空白' : `${i + 1}`, 11, '#ffd890');
      const mpT = txt(this, x + 25, y + 27, '', 11, '#80a0ff').setOrigin(1, 1);
      const lvT = txt(this, x + 25, y - 27, '', 10, '#70f0b0').setOrigin(1, 0);
      const nameT = txt(this, x, y - 39, isDodge ? '翻滾' : '', 11, '#c8b898').setOrigin(0.5);
      this.skillSlots.push({ i, isDodge, x, y, icon, cdG, cdT, mpT, lvT, nameT });
    }
  }

  updateSkillBar() {
    const gs = this.game_;
    if (!gs.skillCd) return;
    const sStats = getStats();
    this.skillSlots.forEach((s) => {
      if (s.isDodge) {
        const cd = gs.player.dodgeCd;
        const maxDodge = gs.player.dodgeMaxCd || 1200;
        s.cdG.clear();
        if (cd > 0) {
          s.cdG.fillStyle(0x000000, 0.72).fillRect(s.x - 27, s.y - 27, 54, 54 * Math.min(1, cd / maxDodge));
          s.cdT.setText((cd / 1000).toFixed(1));
        } else s.cdT.setText('');
        return;
      }
      const skillId = state.skillBar[s.i];
      if (!skillId) {
        s.icon.setVisible(false);
        s.cdG.clear();
        s.cdT.setText('');
        s.mpT.setText('');
        s.lvT.setText('');
        s.nameT.setText('空').setColor('#5a4a3a');
        return;
      }
      const baseLv = state.skillLevels[skillId] || 1;
      const effLv = getEffectiveSkillLevel(skillId);
      const sk = getSkillData(skillId, effLv, { cdr: sStats.cdr, manaCostRed: sStats.manaCostRed });
      s.icon.setVisible(true).setTexture(sk.icon);
      s.nameT.setText(sk.name).setColor('#c8b898');
      s.mpT.setText(`${sk.mp}`);
      s.lvT.setText(`Lv${effLv}`).setColor(effLv > baseLv ? '#ffd860' : '#70f0b0');
      const cd = gs.skillCd[skillId] || 0;
      s.cdG.clear();
      if (cd > 0) {
        s.cdG.fillStyle(0x000000, 0.72).fillRect(s.x - 27, s.y - 27, 54, 54 * Math.min(1, cd / sk.cd));
        s.cdT.setText((cd / 1000).toFixed(1));
      } else s.cdT.setText('');
      s.icon.setTint(sk.mp > state.mp ? 0x4050a0 : 0xffffff);
    });
  }

  // =========================================================== Boss 血條 & 快捷按鈕
  buildBossBar() {
    const cx = W / 2, y = 32, bw = 520;
    const c = this.add.container(0, 0).setDepth(50).setVisible(false).setAlpha(0);
    const frame = this.add.graphics();
    frame.fillStyle(0x0b0508, 0.9).fillRect(cx - bw / 2 - 10, y - 14, bw + 20, 52);
    frame.lineStyle(2, 0x702848, 1).strokeRect(cx - bw / 2 - 10, y - 14, bw + 20, 52);
    c.add(frame);
    this.bossName = txt(this, cx - bw / 2, y - 10, '深淵領主', 16, '#e8c088');
    this.bossHpText = txt(this, cx + bw / 2, y - 10, '', 14, '#e8d0d0').setOrigin(1, 0);
    this.bossFill = this.add.graphics();
    c.add([this.bossName, this.bossHpText, this.bossFill]);
    this.bossBar = c;
  }

  updateBossBar() {
    const b = this.game_.boss;
    if (!this.bossBar || !this.bossBar.visible || !b) return;
    const cx = W / 2, y = 44, bw = 520, bh = 18;
    const frac = Phaser.Math.Clamp(b.hp / b.maxHp, 0, 1);
    const g = this.bossFill;
    g.clear();
    g.fillStyle(0x16080e, 1).fillRect(cx - bw / 2, y, bw, bh);
    g.fillStyle(b.enraged ? 0xc81c30 : 0x8e1a58, 1).fillRect(cx - bw / 2, y, bw * frac, bh);
    g.fillStyle(b.enraged ? 0xff7070 : 0xd060ff, 0.45).fillRect(cx - bw / 2, y, bw * frac, bh / 3);
    g.lineStyle(1, 0x583044, 1).strokeRect(cx - bw / 2, y, bw, bh);
    this.bossName.setText(b.enraged ? `${b.T.name} · 狂怒` : b.T.name).setColor(b.enraged ? '#ff5858' : '#e8c088');
    this.bossHpText.setText(`${Math.max(0, Math.ceil(b.hp))} / ${b.maxHp}`);
  }

  buildQuickButtons() {
    const y = H - 54;
    const mkBtn = (x, label, cb) => {
      const bg = this.add.rectangle(x, y, 84, 40, 0x18100d, 0.95).setStrokeStyle(2, 0x6a4a2a).setInteractive({ useHandCursor: true });
      const t = txt(this, x, y, label, 13, '#e0c090').setOrigin(0.5);
      bg.on('pointerover', () => { bg.setFillStyle(0x2a1810, 0.98); t.setColor('#ffe0a0'); });
      bg.on('pointerout', () => { bg.setFillStyle(0x18100d, 0.95); t.setColor('#e0c090'); });
      bg.on('pointerdown', cb);
      return { bg, t, x, y };
    };
    this.navBtn = mkBtn(934, state.mode === 'village' ? '地城 [G]' : '回村 [T]', () => {
      if (state.mode === 'village') this.setModal('portal');
      else this.game_.enterVillage();
    });
    this.bagBtn = mkBtn(1028, '背包 [B]', () => this.togglePanel());
    this.saveBtn = mkBtn(1122, '存檔', () => {
      Sfx.init();
      if (saveGame()) {
        Sfx.play('book');
        this.game_.msg('遊戲進度已儲存！', '#80ff98');
      } else {
        Sfx.play('denied');
        this.game_.msg('存檔失敗（瀏覽器儲存空間受限）', '#ff8080');
      }
    });
    this.muteBtn = mkBtn(1216, '音效：開', () => {
      Sfx.init();
      const m = Sfx.toggleMute();
      this.game_.msg(m ? '音效：關閉' : '音效：開啟', '#aaaaaa');
    });
  }

  // =========================================================== 角色 / 背包 / 技能書庫面板
  slotBox(c, x, y, item, label, onClick, size = 62) {
    const sc = size / 62;
    const half = size / 2;
    const border = item ? QUALITY_HEX[item.quality] : 0x4a3a2a;
    const bg = this.add.rectangle(x, y, size, size, item ? 0x1a1412 : 0x0e0a08, 1).setStrokeStyle(2, border);
    c.add(bg);
    if (item) {
      c.add(this.add.image(x, y, 'glow').setTint(border).setAlpha(0.18).setScale(0.45 * sc));
      const texKey = item.kind === 'book' ? 'icon_book' : 'icon_' + item.slot;
      c.add(this.add.image(x, y, texKey).setScale(0.92 * sc));
      if (item.enhance) {
        c.add(txt(this, x + half - 4, y + half - 4, `+${item.enhance}`, size < 60 ? 11 : 12, '#ffd860').setOrigin(1, 1));
      }
      if (item.kind !== 'book' && item.sockets > 0) {
        const sg = this.add.graphics();
        const step = size < 60 ? 9 : 10;
        const rad = size < 60 ? 3.2 : 3.8;
        for (let k = 0; k < item.sockets; k++) {
          const sx = x - half + 8 + k * step, sy = y + half - 8;
          const rId = item.runes && item.runes[k];
          if (rId && RUNE_DEFS[rId]) {
            sg.fillStyle(RUNE_DEFS[rId].hex, 1).fillCircle(sx, sy, rad);
            sg.lineStyle(1, 0xffffff, 0.85).strokeCircle(sx, sy, rad);
          } else {
            sg.fillStyle(0x080608, 0.9).fillCircle(sx, sy, rad);
            sg.lineStyle(1, 0x8a7866, 0.9).strokeCircle(sx, sy, rad);
          }
        }
        c.add(sg);
        if (getItemRuneword(item)) {
          c.add(txt(this, x - half + 4, y - half + 3, '✦', size < 60 ? 11 : 13, '#ffe060'));
        }
      }
    } else if (label) {
      c.add(txt(this, x, y, label, size < 60 ? 12 : 13, '#5a4a3a').setOrigin(0.5));
    }
    bg.setInteractive({ useHandCursor: !!item });
    bg.on('pointerover', () => { bg.setStrokeStyle(3, 0xffe0a0); if (item) this.showTooltip(item, x, y); });
    bg.on('pointerout', () => { bg.setStrokeStyle(2, border); this.tooltip.setVisible(false); });
    bg.on('pointerdown', (p) => onClick(p));
    return bg;
  }

  refreshPanel() {
    const c = this.modal;
    c.removeAll(true);
    this.tooltip.setVisible(false);
    const X = 140, Y = 80, PW = 1000, PH = 550;
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.58).setInteractive());
    const g = this.add.graphics();
    g.fillStyle(0x120c0a, 0.97).fillRect(X, Y, PW, PH);
    g.lineStyle(3, 0x6a4020, 1).strokeRect(X, Y, PW, PH);
    g.lineStyle(1, 0x3a2416, 1).lineBetween(X + 415, Y + 20, X + 415, Y + PH - 46);
    c.add(g);

    // 左欄分頁標籤
    const mkTab = (tx, label, tabId) => {
      const act = this.panelTab === tabId;
      const b = this.add.rectangle(tx, Y + 30, 122, 34, act ? 0x3a2012 : 0x18100c)
        .setStrokeStyle(2, act ? 0xd09040 : 0x4a3420).setInteractive({ useHandCursor: true });
      const t = txt(this, tx, Y + 30, label, 15, act ? '#ffe0a0' : '#a08870').setOrigin(0.5);
      b.on('pointerdown', () => { Sfx.play('click'); this.panelTab = tabId; this.refreshPanel(); });
      c.add([b, t]);
      return { x: tx, y: Y + 30 };
    };
    this.tabPosChar = mkTab(X + 76, '角色與屬性', 'char');
    this.tabPosSkills = mkTab(X + 206, '技能書庫', 'skills');
    this.tabPosRunes = mkTab(X + 336, '符文鑲嵌', 'runes');

    c.add(txt(this, X + 705, Y + 28, `背包（${state.inventory.length} / ${INV_SIZE}）`, 22, '#e0b070').setOrigin(0.5));
    const close = txt(this, X + PW - 24, Y + 14, '✕', 24, '#c08060').setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.setModal(null));
    c.add(close);

    if (this.panelTab === 'char') this.renderCharTab(c, X, Y);
    else if (this.panelTab === 'skills') this.renderSkillsTab(c, X, Y);
    else this.renderRunesTab(c, X, Y);

    // 背包格 (6 x 4 = 24 格)
    this.invPositions = [];
    for (let i = 0; i < INV_SIZE; i++) {
      const col = i % 6, row = Math.floor(i / 6);
      const ix = X + 488 + col * 84, iy = Y + 114 + row * 94;
      this.invPositions.push({ x: ix, y: iy });
      const item = state.inventory[i];
      this.slotBox(c, ix, iy, item, null, (p) => {
        if (!item) return;
        if (p.rightButtonDown()) {
          const retRunes = item.kind === 'equip' ? unsocketRunes(item) : 0;
          const v = itemValue(item);
          state.gold += v;
          state.inventory.splice(i, 1);
          Sfx.play('coin');
          const runeNote = retRunes > 0 ? `（已退回 ${retRunes} 符文）` : '';
          this.game_.msg(`賣出 ${itemDisplayName(item)}，獲得 ${v} 金幣${runeNote}`, '#f0c040');
          saveGame();
        } else if (this.panelTab === 'runes' && item.kind === 'equip') {
          this.runeTargetId = item.id;
          Sfx.play('click');
          this.refreshPanel();
          return;
        } else if (item.kind === 'book') {
          const res = useSkillBook(i);
          const def = SKILL_DEFS[res.skillId];
          if (res.ok) {
            Sfx.play('book');
            this.game_.msg(res.learned ? `習得新技能：【${def.name}】！` : `【${def.name}】提升至 Lv.${res.level}！`, '#60ffb8');
            saveGame();
          } else {
            Sfx.play('denied');
            this.game_.msg(`【${def.name}】已達最高等級 Lv.${MAX_SKILL_LV}`, '#ff8080');
          }
        } else {
          equip(i);
          Sfx.play('equip');
          saveGame();
        }
        this.refreshPanel();
      });
    }
    const hint = this.panelTab === 'runes'
      ? '左鍵背包裝備：選為鑲嵌目標　｜　右鍵物品：賣出換金幣　｜　B / ESC：關閉'
      : '左鍵：穿卸裝備 / 閱讀技能書　｜　右鍵背包物品：賣出換金幣　｜　B / ESC：關閉';
    c.add(txt(this, X + PW / 2, Y + PH - 24, hint, 14, '#8a7a6a').setOrigin(0.5));
  }

  renderCharTab(c, X, Y) {
    this.slotPositions = {};
    SLOTS.forEach((slot, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const sx = X + 68 + col * 92;
      const sy = Y + 82 + row * 76;
      this.slotPositions[slot] = { x: sx, y: sy };
      const item = state.equipment[slot];
      this.slotBox(c, sx, sy, item, SLOT_NAMES[slot], () => {
        if (!item) return;
        if (unequip(slot)) { Sfx.play('equip'); saveGame(); this.refreshPanel(); }
        else { Sfx.play('denied'); this.game_.msg('背包已滿', '#ff8080'); }
      }, 56);
      c.add(txt(this, sx, sy + 34, SLOT_NAMES[slot], 11, '#8a7a6a').setOrigin(0.5));
    });

    const s = getStats();
    let y = Y + 210;
    c.add(txt(this, X + 24, y, `等級 ${state.level}　　經驗 ${state.xp} / ${xpToNext(state.level)}`, 14, '#ffd890'));
    y += 22;
    c.add(txt(this, X + 24, y, `可分配屬性點：${state.points}`, 14, state.points ? '#80ff80' : '#8a7a6a'));
    y += 24;
    this.plusButtons = {};
    const attrs = [['str', '力量', '提升攻擊力'], ['vit', '體質', '提升生命與防禦'], ['int', '智力', '提升法力與技能傷害']];
    for (const [k, n, desc] of attrs) {
      c.add(txt(this, X + 24, y, `${n}`, 15, '#e8dcc0'));
      c.add(txt(this, X + 76, y, `${state.base[k]}`, 15, '#ffffff'));
      c.add(txt(this, X + 122, y + 2, desc, 12, '#8a7a6a'));
      if (state.points > 0) {
        const bx = X + 365, by = y + 9;
        const b = this.add.rectangle(bx, by, 26, 21, 0x2a4a1a).setStrokeStyle(1, 0x80c060).setInteractive({ useHandCursor: true });
        const t = txt(this, bx, by, '+', 15, '#c0ff90').setOrigin(0.5);
        b.on('pointerdown', () => { if (allocate(k)) { Sfx.play('equip'); saveGame(); this.refreshPanel(); } });
        c.add([b, t]);
        this.plusButtons[k] = { x: bx, y: by };
      }
      y += 25;
    }
    y += 4;
    const defPct = Math.round((1 - 60 / (60 + s.defense)) * 100);
    const lines = [
      ['攻擊力', `${s.attack}`],
      ['防禦力', `${s.defense} (${defPct}%${s.dmgRed ? `+${Math.round(s.dmgRed * 100)}%` : ''})`],
      ['生命上限', `${s.maxHp}`],
      ['法力上限', `${s.maxMp}`],
      ['技能傷害', `${Math.round(s.spellPower * 100)}%`],
      ['冷卻縮減', `${Math.round(s.cdr * 100)}%`],
      ['移速/攻速', `+${Math.round(s.moveSpeed * 100)}/+${Math.round(s.atkSpeed * 100)}%`],
      ['吸血/反傷', `${Math.round(s.lifesteal * 100)}%/${Math.round(s.thorns * 100)}%`],
      ['掉寶/金幣', `+${Math.round(s.magicFind * 100)}/+${Math.round(s.goldFind * 100)}%`],
      ['爆擊機率', `${Math.round(s.critChance * 100)}% (${s.critDmg.toFixed(1)}x)`],
      ['最高層數', `第 ${state.maxFloor} 層`],
      ['金 / 石', `${state.gold} / ${state.shards}`],
    ];
    lines.forEach(([k, v], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      c.add(txt(this, X + 24 + col * 192, y + row * 22, `${k}：`, 12, '#a89070'));
      c.add(txt(this, X + 106 + col * 192, y + row * 22, `${v}`, 12, '#ffe0a0'));
    });
    const auraLabel = s.activeAuras.length ? s.activeAuras.map((a) => a.def.name).join(' · ') : '無（鑲嵌組合符文啟用）';
    c.add(txt(this, X + 24, y + 134, `符文光環：${auraLabel}`, 12, s.activeAuras.length ? '#70f8e0' : '#6a5a4a', { wordWrap: { width: 376 } }));
  }

  renderSkillsTab(c, X, Y) {
    this.skillBindBtns = {};
    const perPage = 6;
    const totalPages = Math.ceil(SKILL_LIST.length / perPage);
    this.skillPage = Phaser.Math.Clamp(this.skillPage || 0, 0, totalPages - 1);
    c.add(txt(this, X + 24, Y + 58, `點選 [1~5] 設定快捷欄（第 ${this.skillPage + 1}/${totalPages} 頁 · 上限 Lv.${MAX_SKILL_LV}）`, 12, '#9a8a7a'));
    const prev = txt(this, X + 350, Y + 57, '◀', 15, '#ffd080').setInteractive({ useHandCursor: true });
    const next = txt(this, X + 378, Y + 57, '▶', 15, '#ffd080').setInteractive({ useHandCursor: true });
    prev.on('pointerdown', () => { this.skillPage = (this.skillPage + totalPages - 1) % totalPages; Sfx.play('click'); this.refreshPanel(); });
    next.on('pointerdown', () => { this.skillPage = (this.skillPage + 1) % totalPages; Sfx.play('click'); this.refreshPanel(); });
    c.add([prev, next]);
    this.skillPagePrev = { x: X + 356, y: Y + 64 };
    this.skillPageNext = { x: X + 384, y: Y + 64 };

    const slice = SKILL_LIST.slice(this.skillPage * perPage, (this.skillPage + 1) * perPage);
    slice.forEach((def, idx) => {
      const ry = Y + 86 + idx * 66;
      const lv = state.skillLevels[def.id] || 0;
      const effLv = getEffectiveSkillLevel(def.id);
      const bonus = effLv - lv;
      const learned = lv > 0;
      c.add(this.add.rectangle(X + 207, ry + 24, 376, 58, learned ? 0x1c1412 : 0x100c0b).setStrokeStyle(1, learned ? 0x5a402a : 0x2c201a));
      const ic = this.add.image(X + 48, ry + 24, def.icon).setScale(0.78);
      if (!learned) ic.setTint(0x404040);
      c.add(ic);
      c.add(txt(this, X + 80, ry + 5, def.name, 15, learned ? '#ffe0a0' : '#706050'));
      const lvStr = learned ? `Lv.${lv}${bonus > 0 ? ` (+${bonus})` : ''}/${MAX_SKILL_LV}` : '未習得';
      c.add(txt(this, X + 158, ry + 6, lvStr, 12, bonus > 0 ? '#ffd860' : learned ? '#60f0a0' : '#805050'));
      c.add(txt(this, X + 80, ry + 28, def.desc, 12, '#a09080'));
      if (learned) {
        this.skillBindBtns[def.id] = [];
        for (let sIdx = 0; sIdx < 5; sIdx++) {
          const bx = X + 275 + sIdx * 24, by = ry + 24;
          const bound = state.skillBar[sIdx] === def.id;
          const b = this.add.rectangle(bx, by, 21, 24, bound ? 0x4a3014 : 0x1a1412)
            .setStrokeStyle(1.5, bound ? 0xffc040 : 0x5a4a3a).setInteractive({ useHandCursor: true });
          const bt = txt(this, bx, by, `${sIdx + 1}`, 12, bound ? '#ffd870' : '#b0a090').setOrigin(0.5);
          b.on('pointerdown', () => { assignSkillSlot(sIdx, def.id); Sfx.play('equip'); saveGame(); this.refreshPanel(); });
          c.add([b, bt]);
          this.skillBindBtns[def.id].push({ x: bx, y: by });
        }
      }
    });
  }

  renderRunesTab(c, X, Y) {
    this.runeSlotBtns = {};
    this.runeBagBtns = {};
    this.runeUnsocketBtn = null;

    const allEquips = [];
    for (const slot of SLOTS) {
      if (state.equipment[slot]) allEquips.push({ item: state.equipment[slot], equipped: true });
    }
    for (const it of state.inventory) {
      if (it.kind === 'equip') allEquips.push({ item: it, equipped: false });
    }
    let sel = allEquips.find((o) => o.item.id === this.runeTargetId);
    if (!sel) sel = allEquips.find((o) => (o.item.sockets || 0) > 0) || allEquips[0] || null;
    this.runeTargetId = sel ? sel.item.id : null;

    // 快捷選取已裝備部位（2 x 4）
    SLOTS.forEach((slot, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const bx = X + 64 + col * 95, by = Y + 64 + row * 26;
      const eq = state.equipment[slot];
      const act = eq && eq.id === this.runeTargetId;
      const b = this.add.rectangle(bx, by, 88, 22, act ? 0x3a2414 : eq ? 0x1a1412 : 0x100c0b)
        .setStrokeStyle(1.5, act ? 0xffc040 : eq ? 0x6a5038 : 0x2e241e);
      if (eq) b.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.runeTargetId = eq.id; Sfx.play('click'); this.refreshPanel();
      });
      const sockTag = eq && eq.sockets ? `(${(eq.runes || []).length}/${eq.sockets})` : '';
      const t = txt(this, bx, by, `${SLOT_NAMES[slot]}${sockTag}`, 11, act ? '#ffe080' : eq ? '#d0c0a8' : '#584838').setOrigin(0.5);
      c.add([b, t]);
      this.runeSlotBtns[slot] = { x: bx, y: by };
    });

    // 選取裝備鑲嵌區
    const box = this.add.rectangle(X + 207, Y + 140, 382, 66, 0x18110e).setStrokeStyle(1.5, 0x5c422c);
    c.add(box);
    const target = sel ? sel.item : null;
    if (!target) {
      c.add(txt(this, X + 207, Y + 140, '尚無可鑲嵌裝備（點選右側背包裝備或先穿上裝備）', 13, '#8a7a6a').setOrigin(0.5));
    } else {
      c.add(this.add.image(X + 46, Y + 140, 'icon_' + target.slot).setScale(0.68));
      const eqTag = sel.equipped ? ' [裝備中]' : '';
      c.add(txt(this, X + 80, Y + 112, `${itemDisplayName(target)}${eqTag}`, 13, QUALITY_COLORS[target.quality]));

      const sockCount = target.sockets || 0;
      const fitted = target.runes || [];
      if (sockCount === 0) {
        c.add(txt(this, X + 80, Y + 134, '此裝備無插孔（可至餘燼村鐵匠處花費打孔）', 11, '#a08878'));
      } else {
        const sg = this.add.graphics();
        for (let k = 0; k < sockCount; k++) {
          const sx = X + 90 + k * 76, sy = Y + 138;
          const rId = fitted[k];
          const rDef = rId && RUNE_DEFS[rId];
          if (rDef) {
            sg.fillStyle(rDef.hex, 1).fillCircle(sx, sy, 5.5);
            sg.lineStyle(1.5, 0xffffff, 0.9).strokeCircle(sx, sy, 5.5);
            c.add(txt(this, sx + 9, sy - 6, rDef.name, 11, rDef.color));
          } else {
            sg.fillStyle(0x0a0808, 1).fillCircle(sx, sy, 5.5);
            sg.lineStyle(1.5, 0x8a7866, 0.9).strokeCircle(sx, sy, 5.5);
            c.add(txt(this, sx + 9, sy - 6, '空槽', 11, '#706050'));
          }
        }
        c.add(sg);
      }

      const rw = getItemRuneword(target);
      const rwLine = rw
        ? `✦ ${rw.name}：${rw.short}`
        : sockCount > fitted.length ? '點擊下方符文袋中的符文即可鑲嵌'
        : sockCount > 0 ? '插孔已滿（重鑄可保留符文；取出需花費金幣）' : '';
      if (rwLine) c.add(txt(this, X + 80, Y + 154, rwLine, 11, rw ? rw.color : '#8a7a6a'));

      if (fitted.length > 0) {
        const uCost = 30 * fitted.length;
        const canUn = state.gold >= uCost;
        const ub = this.add.rectangle(X + 354, Y + 123, 76, 22, canUn ? 0x3a2018 : 0x201816)
          .setStrokeStyle(1, canUn ? 0xe08050 : 0x4a3830).setInteractive({ useHandCursor: true });
        const ut = txt(this, X + 354, Y + 123, `取出 (${uCost}金)`, 11, canUn ? '#ffd0a0' : '#706058').setOrigin(0.5);
        ub.on('pointerdown', () => {
          if (!canUn) { Sfx.play('denied'); this.game_.msg('金幣不足，無法取出符文', '#ff8080'); return; }
          state.gold -= uCost;
          const cnt = unsocketRunes(target);
          Sfx.play('equip');
          saveGame();
          this.game_.msg(`已從 ${itemDisplayName(target)} 取出 ${cnt} 顆符文`, '#ffd870');
          this.refreshPanel();
        });
        c.add([ub, ut]);
        this.runeUnsocketBtn = { x: X + 354, y: Y + 123 };
      }
    }

    // 符文袋（2x4）
    c.add(txt(this, X + 20, Y + 180, '符文袋（點擊鑲嵌至上方選取裝備）', 12, '#d0b0ff'));
    const shortBonuses = {
      blood: '吸血 +4%', thorn: '反傷 +25%', wind: '移速 +8%', flame: '攻擊 +8',
      frost: '防+6 血+25', arcane: 'CD-5% 魔+20', crit: '爆+5% 傷+15%', holy: '減傷5% 血+35',
    };
    RUNE_LIST.forEach((r, idx) => {
      const col = idx % 4, row = Math.floor(idx / 4);
      const cx = X + 64 + col * 95, cy = Y + 224 + row * 56;
      const cnt = (state.runes && state.runes[r.id]) || 0;
      const b = this.add.rectangle(cx, cy, 90, 50, cnt > 0 ? 0x1c1620 : 0x100d10)
        .setStrokeStyle(1.5, cnt > 0 ? r.hex : 0x3a3038).setInteractive({ useHandCursor: cnt > 0 });
      c.add(b);
      const ic = this.add.image(cx - 24, cy - 7, `rune_${r.id}`).setScale(0.64);
      if (cnt === 0) ic.setAlpha(0.35);
      c.add(ic);
      c.add(txt(this, cx - 5, cy - 20, r.name, 12, cnt > 0 ? r.color : '#685c66'));
      c.add(txt(this, cx + 41, cy - 20, `x${cnt}`, 11, cnt > 0 ? '#ffffff' : '#685c66').setOrigin(1, 0));
      c.add(txt(this, cx, cy + 14, shortBonuses[r.id] || r.desc, 10, cnt > 0 ? '#d8c8d8' : '#584e58').setOrigin(0.5));
      this.runeBagBtns[r.id] = { x: cx, y: cy };
      b.on('pointerdown', () => {
        if (!target) { Sfx.play('denied'); this.game_.msg('請先選取一件裝備', '#ff8080'); return; }
        if (cnt <= 0) { Sfx.play('denied'); this.game_.msg(`沒有 ${r.name}`, '#ff8080'); return; }
        const res = socketRune(target, r.id);
        if (!res.ok) {
          Sfx.play('denied');
          this.game_.msg((target.sockets || 0) === 0 ? '此裝備沒有插孔，請先至鐵匠打孔' : '此裝備插孔已滿', '#ff8080');
          return;
        }
        if (res.runeword) {
          Sfx.play('runeword');
          this.game_.msg(`✦ 啟動符文光環：【${res.runeword.name}】（${res.runeword.desc}）！`, res.runeword.color);
        } else {
          Sfx.play('rune');
          this.game_.msg(`成功鑲嵌 ${runeDisplayName(r.id)} 至 ${itemDisplayName(target)}`, r.color);
        }
        saveGame();
        this.refreshPanel();
      });
    });

    // 符文光環配方（每頁 4 條）
    const totalPages = Math.ceil(RUNEWORD_LIST.length / 4);
    this.runeRecipePage = Phaser.Math.Clamp(this.runeRecipePage || 0, 0, totalPages - 1);
    c.add(txt(this, X + 20, Y + 314, `符文光環配方（第 ${this.runeRecipePage + 1}/${totalPages} 頁）`, 12, '#ffe080'));
    const prev = txt(this, X + 344, Y + 314, '◀', 14, '#ffd080').setInteractive({ useHandCursor: true });
    const next = txt(this, X + 372, Y + 314, '▶', 14, '#ffd080').setInteractive({ useHandCursor: true });
    prev.on('pointerdown', () => { this.runeRecipePage = (this.runeRecipePage + totalPages - 1) % totalPages; Sfx.play('click'); this.refreshPanel(); });
    next.on('pointerdown', () => { this.runeRecipePage = (this.runeRecipePage + 1) % totalPages; Sfx.play('click'); this.refreshPanel(); });
    c.add([prev, next]);

    const slice = RUNEWORD_LIST.slice(this.runeRecipePage * 4, (this.runeRecipePage + 1) * 4);
    slice.forEach((rw, idx) => {
      const ry = Y + 336 + idx * 38;
      const haveMap = { ...(state.runes || {}) };
      const canMake = rw.runes.every((rid) => (haveMap[rid] || 0) > 0 && (haveMap[rid]--, true));
      c.add(this.add.rectangle(X + 207, ry + 16, 380, 33, canMake ? 0x1a2018 : 0x141012).setStrokeStyle(1, canMake ? rw.hex : 0x3a2c24));
      const combo = rw.runes.map((rid) => RUNE_DEFS[rid].name).join(' + ');
      c.add(txt(this, X + 26, ry + 2, `${rw.name}  [${combo}]`, 12, rw.color));
      if (canMake) c.add(txt(this, X + 388, ry + 2, '可合成', 11, '#80ff90').setOrigin(1, 0));
      c.add(txt(this, X + 26, ry + 17, rw.short, 11, '#c8d8d0'));
    });
  }

  invSlotPos(i) { return this.invPositions && this.invPositions[i]; }
  plusPos(k) { return this.plusButtons && this.plusButtons[k]; }

  // =========================================================== 鐵匠鍛造面板
  refreshForge() {
    const c = this.modal;
    c.removeAll(true);
    this.tooltip.setVisible(false);
    const X = 140, Y = 80, PW = 1000, PH = 550;
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.62).setInteractive());
    const g = this.add.graphics();
    g.fillStyle(0x140d0a, 0.98).fillRect(X, Y, PW, PH);
    g.lineStyle(3, 0x905020, 1).strokeRect(X, Y, PW, PH);
    g.lineStyle(1, 0x4a2a18, 1).lineBetween(X + 370, Y + 64, X + 370, Y + PH - 24);
    g.lineStyle(1, 0x4a2a18, 1).lineBetween(X + 390, Y + 328, X + PW - 24, Y + 328);
    c.add(g);

    c.add(txt(this, X + 28, Y + 22, '鐵匠布朗的鍛造爐', 24, '#ffd080'));
    c.add(txt(this, X + PW - 64, Y + 25, `金幣：${state.gold}　　餘燼石：${state.shards}`, 16, '#f0d090').setOrigin(1, 0));
    const close = txt(this, X + PW - 24, Y + 14, '✕', 24, '#c08060').setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.setModal(null));
    c.add(close);

    // 彙整所有裝備（先已裝備，後背包）
    const list = [];
    for (const slot of SLOTS) {
      if (state.equipment[slot]) list.push({ item: state.equipment[slot], equipped: true, invIndex: -1 });
    }
    state.inventory.forEach((it, idx) => {
      if (it.kind === 'equip') list.push({ item: it, equipped: false, invIndex: idx });
    });

    if (!list.some((o) => o.item.id === this.forgeSelectedId)) {
      this.forgeSelectedId = list.length ? list[0].item.id : null;
    }
    const perPage = 8;
    const maxPage = Math.max(0, Math.ceil(list.length / perPage) - 1);
    this.forgePage = Phaser.Math.Clamp(this.forgePage, 0, maxPage);
    const pageItems = list.slice(this.forgePage * perPage, (this.forgePage + 1) * perPage);

    c.add(txt(this, X + 28, Y + 68, `選擇裝備進行強化 / 重鑄 / 打孔 / 拆解（${list.length}）`, 14, '#b09878'));
    if (maxPage > 0) {
      const prev = txt(this, X + 318, Y + 68, '◀', 15, '#ffd080').setInteractive({ useHandCursor: true });
      const next = txt(this, X + 342, Y + 68, '▶', 15, '#ffd080').setInteractive({ useHandCursor: true });
      prev.on('pointerdown', () => { this.forgePage = Math.max(0, this.forgePage - 1); this.refreshForge(); });
      next.on('pointerdown', () => { this.forgePage = Math.min(maxPage, this.forgePage + 1); this.refreshForge(); });
      c.add([prev, next]);
    }

    this.forgeBtns = {};
    pageItems.forEach((entry, i) => {
      const ry = Y + 98 + i * 52;
      const sel = entry.item.id === this.forgeSelectedId;
      const bg = this.add.rectangle(X + 190, ry + 20, 326, 46, sel ? 0x342014 : 0x1a120e)
        .setStrokeStyle(2, sel ? 0xffc040 : QUALITY_HEX[entry.item.quality]).setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => { this.forgeSelectedId = entry.item.id; Sfx.play('click'); this.refreshForge(); });
      c.add(bg);
      c.add(this.add.image(X + 52, ry + 20, 'icon_' + entry.item.slot).setScale(0.65));
      c.add(txt(this, X + 80, ry + 4, itemDisplayName(entry.item), 15, QUALITY_COLORS[entry.item.quality]));
      const sTag = entry.item.sockets ? ` [${(entry.item.runes || []).length}/${entry.item.sockets}孔]` : '';
      const sub = `${entry.equipped ? '[裝備] ' : ''}${SLOT_NAMES[entry.item.slot]} · Lv.${entry.item.ilvl}${sTag}`;
      c.add(txt(this, X + 80, ry + 24, sub, 12, entry.equipped ? '#80ff90' : '#9a8a7a'));
    });

    // 右上：強化／重鑄／打孔／拆解
    const RX = X + 400;
    const selected = list.find((o) => o.item.id === this.forgeSelectedId);
    if (!selected) {
      c.add(txt(this, RX + 260, Y + 180, '身上與背包內目前沒有可鍛造的裝備', 17, '#8a7a6a').setOrigin(0.5));
    } else {
      const it = selected.item;
      const enh = it.enhance || 0;
      const curStats = effectiveStats(it);
      const nextStats = enh < MAX_ENHANCE ? effectiveStats(it, enh + 1) : curStats;
      c.add(this.add.image(RX + 34, Y + 106, 'icon_' + it.slot).setScale(1.1));
      c.add(txt(this, RX + 76, Y + 80, itemDisplayName(it), 21, QUALITY_COLORS[it.quality]));
      c.add(txt(this, RX + 76, Y + 108, `${QUALITY_NAMES[it.quality]}・${SLOT_NAMES[it.slot]}　物品等級 ${it.ilvl}　（強化 ${enh} / ${MAX_ENHANCE}）`, 13, '#a09080'));

      let sy = Y + 142;
      for (const k of ['atk', 'def', 'hp', 'mp']) {
        if (!curStats[k]) continue;
        const line = enh < MAX_ENHANCE
          ? `+${curStats[k]} ${STAT_NAMES[k]}  →  +${nextStats[k]}`
          : `+${curStats[k]} ${STAT_NAMES[k]}（已滿）`;
        c.add(txt(this, RX + 16, sy, line, 14, '#90d0ff'));
        sy += 22;
      }

      // 右半欄：插孔、符文光環與特殊詞條
      let sy2 = Y + 142;
      const rw = getItemRuneword(it);
      const sockLine = `插孔：${(it.runes || []).length}/${it.sockets || 0}${rw ? ` · ✦${rw.name}` : `（上限 ${MAX_SOCKETS}）`}`;
      c.add(txt(this, RX + 236, sy2, sockLine, 13, rw ? rw.color : '#80e8d0'));
      sy2 += 22;
      if (it.specials && it.specials.length) {
        for (const af of it.specials) {
          c.add(txt(this, RX + 236, sy2, `★ ${formatSpecialAffix(af)}`, 13, '#ffb060'));
          sy2 += 20;
        }
      }

      const eCost = enhanceCost(it);
      const canEnh = enh < MAX_ENHANCE && state.gold >= eCost;
      this.forgeBtns.enhance = this.mkModalBtn(c, RX + 64, Y + 286, 128, 44,
        enh >= MAX_ENHANCE ? '強化已滿' : `強化 +${enh + 1} (${eCost}金)`,
        canEnh ? 0x26441c : 0x221a16, canEnh ? 0x80d050 : 0x55443a, () => {
          if (!canEnh) { Sfx.play('denied'); return; }
          state.gold -= eCost;
          enhanceItem(it);
          clampVitals();
          Sfx.play('forge');
          saveGame();
          this.game_.msg(`強化成功！${itemDisplayName(it)}`, '#ffd860');
          this.refreshForge();
        });

      const rCost = reforgeCost(it);
      const canRef = state.gold >= rCost;
      this.forgeBtns.reforge = this.mkModalBtn(c, RX + 202, Y + 286, 128, 44,
        `重鑄 (${rCost}金)`,
        canRef ? 0x20324a : 0x221a16, canRef ? 0x60a0ff : 0x55443a, () => {
          if (!canRef) { Sfx.play('denied'); return; }
          state.gold -= rCost;
          reforgeItem(it);
          clampVitals();
          Sfx.play('forge');
          saveGame();
          this.game_.msg(`已重鑄 ${itemDisplayName(it)} 的屬性與詞條！`, '#70b8ff');
          this.refreshForge();
        });

      const sCost = punchSocketCost(it);
      const canSock = (it.sockets || 0) < MAX_SOCKETS && state.gold >= sCost.gold && state.shards >= sCost.shards;
      this.forgeBtns.socket = this.mkModalBtn(c, RX + 340, Y + 286, 128, 44,
        (it.sockets || 0) >= MAX_SOCKETS ? '插孔已滿' : `打孔 (${sCost.gold}金+${sCost.shards}石)`,
        canSock ? 0x32204a : 0x221a16, canSock ? 0xb870ff : 0x55443a, () => {
          if (!canSock) { Sfx.play('denied'); return; }
          state.gold -= sCost.gold;
          state.shards -= sCost.shards;
          punchSocket(it);
          Sfx.play('forge');
          saveGame();
          this.game_.msg(`打孔成功！${itemDisplayName(it)} 現有 ${it.sockets} 個插孔`, '#d090ff');
          this.refreshForge();
        });

      const rew = dismantleReward(it);
      const canDis = !selected.equipped;
      this.forgeBtns.dismantle = this.mkModalBtn(c, RX + 478, Y + 286, 128, 44,
        selected.equipped ? '裝備中' : `拆解 (+${rew.shards}石/${rew.gold}金)`,
        canDis ? 0x461c1c : 0x201818, canDis ? 0xd05050 : 0x4a3a3a, () => {
          if (!canDis) { Sfx.play('denied'); return; }
          const retRunes = unsocketRunes(it);
          state.gold += rew.gold;
          state.shards += rew.shards;
          state.inventory.splice(selected.invIndex, 1);
          Sfx.play('forge');
          saveGame();
          const rNote = retRunes > 0 ? `（退回 ${retRunes} 顆符文）` : '';
          this.game_.msg(`拆解獲得 ${rew.gold} 金幣、${rew.shards} 餘燼石${rNote}`, '#ff98ff');
          this.forgeSelectedId = null;
          this.refreshForge();
        });
    }

    // 右下：鍛造新裝備（2x4 部位）
    const ilvl = Math.max(1, state.maxFloor * 2 - 1);
    c.add(txt(this, RX + 10, Y + 340, `鍛造新裝備（依已解鎖層數產出 Lv.${ilvl} 裝備）`, 15, '#ffd080'));
    SLOTS.forEach((slot, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const bx = RX + 65 + col * 116, by = Y + 382 + row * 36;
      const act = this.forgeSlot === slot;
      this.mkModalBtn(c, bx, by, 104, 30, SLOT_NAMES[slot],
        act ? 0x442a14 : 0x1a120e, act ? 0xffb840 : 0x5a402a, () => {
          this.forgeSlot = slot;
          Sfx.play('click');
          this.refreshForge();
        });
    });

    const nCost = forgeCost('normal', ilvl);
    const lCost = forgeCost('legendary', ilvl);
    const bagFull = state.inventory.length >= INV_SIZE;
    const canNorm = !bagFull && state.gold >= nCost.gold;
    const canLeg = !bagFull && state.gold >= lCost.gold && state.shards >= lCost.shards;

    this.forgeBtns.craftNormal = this.mkModalBtn(c, RX + 140, Y + 482, 260, 46,
      bagFull ? '背包已滿' : `精工鍛造 (${nCost.gold}金 · 藍/金裝)`,
      canNorm ? 0x1c324a : 0x201816, canNorm ? 0x6aa8ff : 0x50403a, () => {
        if (!canNorm) { Sfx.play('denied'); return; }
        state.gold -= nCost.gold;
        const qual = Math.random() < 0.28 ? 'gold' : 'blue';
        const item = generateItem(ilvl, 0.25, qual, this.forgeSlot);
        state.inventory.push(item);
        this.forgeSelectedId = item.id;
        Sfx.play('forge');
        saveGame();
        this.game_.msg(`鍛造出：${item.name}！`, QUALITY_COLORS[item.quality]);
        this.refreshForge();
      });

    this.forgeBtns.craftLegend = this.mkModalBtn(c, RX + 425, Y + 482, 270, 46,
      bagFull ? '背包已滿' : `餘燼神鑄 (${lCost.gold}金+${lCost.shards}石 · 必金/特殊)`,
      canLeg ? 0x4a2a0e : 0x201816, canLeg ? 0xf0c040 : 0x50403a, () => {
        if (!canLeg) { Sfx.play('denied'); return; }
        state.gold -= lCost.gold;
        state.shards -= lCost.shards;
        const qual = Math.random() < 0.25 ? 'special' : 'gold';
        const item = generateItem(ilvl + 1, 0.4, qual, this.forgeSlot);
        state.inventory.push(item);
        this.forgeSelectedId = item.id;
        Sfx.play('rare');
        Sfx.play('forge');
        saveGame();
        this.game_.msg(`${qual === 'special' ? '神鑄特殊傳世' : '神鑄傳奇'}：${item.name}！`, QUALITY_COLORS[qual]);
        this.refreshForge();
      });
  }

  // =========================================================== 深淵傳送門面板
  refreshPortal() {
    const c = this.modal;
    c.removeAll(true);
    this.tooltip.setVisible(false);
    const X = 320, Y = 140, PW = 640, PH = 440;
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setInteractive());
    const g = this.add.graphics();
    g.fillStyle(0x100814, 0.98).fillRect(X, Y, PW, PH);
    g.lineStyle(3, 0x9040d0, 1).strokeRect(X, Y, PW, PH);
    c.add(g);

    this.portalFloor = Phaser.Math.Clamp(this.portalFloor || state.maxFloor, 1, state.maxFloor);
    const f = this.portalFloor;
    const biome = getBiome(f);
    const bossDef = BOSS_TYPES[biome.bossType];

    c.add(txt(this, W / 2, Y + 32, '深淵傳送門 — 無盡地城', 26, '#e0b0ff').setOrigin(0.5));
    c.add(txt(this, W / 2, Y + 66, `已解鎖最高層數：第 ${state.maxFloor} 層　｜　已通關層數：${state.clearedFloors}`, 14, '#a090b0').setOrigin(0.5));
    const close = txt(this, X + PW - 24, Y + 14, '✕', 24, '#c080c0').setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => this.setModal(null));
    c.add(close);

    // 層數切換
    this.mkModalBtn(c, W / 2 - 150, Y + 135, 52, 46, '◀', f > 1 ? 0x2a1838 : 0x18121c, f > 1 ? 0xb060ff : 0x44364a, () => {
      if (f > 1) { this.portalFloor = f - 1; Sfx.play('click'); this.refreshPortal(); }
    });
    c.add(txt(this, W / 2, Y + 135, `第 ${f} 層`, 36, '#ffd880').setOrigin(0.5));
    this.mkModalBtn(c, W / 2 + 150, Y + 135, 52, 46, '▶', f < state.maxFloor ? 0x2a1838 : 0x18121c, f < state.maxFloor ? 0xb060ff : 0x44364a, () => {
      if (f < state.maxFloor) { this.portalFloor = f + 1; Sfx.play('click'); this.refreshPortal(); }
    });

    // 快速選擇鈕
    const quickFloors = [];
    for (let k = 1; k <= Math.min(4, state.maxFloor); k++) quickFloors.push(k);
    if (state.maxFloor > 4) quickFloors.push(state.maxFloor);
    quickFloors.forEach((qf, i) => {
      const bx = W / 2 - ((quickFloors.length - 1) * 95) / 2 + i * 95;
      const act = qf === f;
      this.mkModalBtn(c, bx, Y + 196, 86, 32, qf > 4 ? `最高 ${qf}層` : `第 ${qf} 層`,
        act ? 0x4a2068 : 0x1a1220, act ? 0xe080ff : 0x583870, () => {
          this.portalFloor = qf;
          Sfx.play('click');
          this.refreshPortal();
        });
    });

    const box = this.add.rectangle(W / 2, Y + 286, 520, 100, 0x180e20, 0.9).setStrokeStyle(1, 0x5a3078);
    c.add(box);
    c.add(txt(this, W / 2, Y + 258, `地貌區域：${biome.name}${f >= 5 ? '（無盡深淵強化）' : ''}`, 18, '#d8c0ff').setOrigin(0.5));
    c.add(txt(this, W / 2, Y + 288, `鎮守頭目：${bossDef.name}`, 16, '#ff9888').setOrigin(0.5));
    c.add(txt(this, W / 2, Y + 314, '每次進入皆會生成全新隨機地圖與地形配置', 13, '#9888a8').setOrigin(0.5));

    this.portalEnterBtn = this.mkModalBtn(c, W / 2, Y + 382, 240, 52, `踏入第 ${f} 層`, 0x4a1c68, 0xd070ff, () => {
      const targetFloor = this.portalFloor;
      this.modal.removeAll(true).setVisible(false);
      this.activeModal = null;
      this.scene.resume('Game');
      this.game_.enterFloor(targetFloor);
    });
  }

  mkModalBtn(c, x, y, w, h, label, bgCol, borderCol, cb) {
    const bg = this.add.rectangle(x, y, w, h, bgCol, 0.96).setStrokeStyle(2, borderCol).setInteractive({ useHandCursor: true });
    const t = txt(this, x, y, label, Math.min(18, Math.max(11, Math.floor(h * 0.36))), '#ffe8c0').setOrigin(0.5);
    if (t.width > w - 12) t.setScale((w - 12) / t.width);
    bg.on('pointerover', () => bg.setStrokeStyle(3, 0xffe8a0));
    bg.on('pointerout', () => bg.setStrokeStyle(2, borderCol));
    bg.on('pointerdown', cb);
    c.add([bg, t]);
    return { bg, t, x, y };
  }

  showTooltip(item, x, y) {
    const t = this.tooltip;
    t.removeAll(true);
    const lines = [];
    if (item.kind === 'book') {
      const def = SKILL_DEFS[item.skillId];
      const curLv = state.skillLevels[item.skillId] || 0;
      lines.push([item.name, QUALITY_COLORS.book, 18]);
      lines.push(['技能秘典　（左鍵點擊閱讀）', '#9a8a7a', 13]);
      lines.push([def.desc, '#d0e8e0', 14]);
      lines.push([curLv === 0 ? '尚未習得此技能（閱讀後立即學會）'
        : curLv >= MAX_SKILL_LV ? `已達最高等級 Lv.${MAX_SKILL_LV}` : `目前 Lv.${curLv} → 閱讀升至 Lv.${curLv + 1}`,
      curLv >= MAX_SKILL_LV ? '#ff9090' : '#70ff98', 13]);
      lines.push([`售價：${itemValue(item)} 金幣`, '#c0a040', 12]);
    } else {
      lines.push([itemDisplayName(item), QUALITY_COLORS[item.quality], 18]);
      lines.push([`${QUALITY_NAMES[item.quality]}・${SLOT_NAMES[item.slot]}　（物品等級 ${item.ilvl}）`, '#9a8a7a', 13]);
      const eff = effectiveStats(item);
      for (const k of ['atk', 'def', 'hp', 'mp']) if (eff[k]) lines.push([`+${eff[k]} ${STAT_NAMES[k]}`, '#a0c8ff', 14]);
      if (item.specials && item.specials.length) {
        for (const af of item.specials) lines.push([`★ ${formatSpecialAffix(af)}`, '#ffb060', 14]);
      }
      if ((item.sockets || 0) > 0) {
        const fitted = item.runes || [];
        const rStr = fitted.length ? fitted.map((r) => RUNE_DEFS[r]?.name || r).join('、') : '空';
        lines.push([`插孔 (${fitted.length}/${item.sockets})：${rStr}`, '#80e8ff', 13]);
        const rw = getItemRuneword(item);
        if (rw) {
          lines.push([`✦ 符文光環：【${rw.name}】`, rw.color, 14]);
          lines.push([`  ${rw.desc}`, '#d0f8e8', 12]);
        }
      }
      const eq = state.equipment[item.slot];
      if (eq && eq !== item) {
        const eqEff = effectiveStats(eq);
        const eqSum = ['atk', 'def', 'hp', 'mp'].filter((k) => eqEff[k]).map((k) => `${STAT_NAMES[k]}+${eqEff[k]}`).join(' ');
        lines.push([`目前裝備：${itemDisplayName(eq)}`, QUALITY_COLORS[eq.quality], 13]);
        if (eqSum) lines.push([eqSum, '#8a8a8a', 12]);
      } else if (eq === item) {
        lines.push(['（裝備中）', '#80ff80', 13]);
      }
      lines.push([`售價：${itemValue(item)} 金幣`, '#c0a040', 12]);
    }

    let yy = 10;
    const objs = lines.map(([s, col, size]) => {
      const o = txt(this, 12, yy, s, size, col);
      yy += size + 7;
      return o;
    });
    const w = Math.max(...objs.map((o) => o.width)) + 24;
    const h = yy + 6;
    const bg = this.add.rectangle(0, 0, w, h, 0x080606, 0.96).setOrigin(0).setStrokeStyle(2, QUALITY_HEX[item.quality]);
    t.add(bg);
    t.add(objs);
    let tx = x + 40, ty = y - 20;
    if (tx + w > W - 8) tx = x - 40 - w;
    tx = Math.max(8, Math.min(W - w - 8, tx));
    ty = Math.max(8, Math.min(H - h - 8, ty));
    t.setPosition(tx, ty).setVisible(true);
  }

  showMsg(text, color) {
    const t = txt(this, W / 2, 110, text, 21, color).setOrigin(0.5);
    this.msgs.forEach((m) => { m.y += 30; });
    this.msgs.push(t);
    this.tweens.add({
      targets: t, alpha: 0, delay: 2600, duration: 700,
      onComplete: () => { t.destroy(); this.msgs = this.msgs.filter((m) => m !== t); },
    });
  }

  drawBars() {
    const s = getStats();
    const b = this.bars;
    b.clear();
    const bar = (x, y, w, h, frac, c1, c2) => {
      b.fillStyle(0x000000, 1).fillRect(x - 2, y - 2, w + 4, h + 4);
      b.fillStyle(0x1a1010, 1).fillRect(x, y, w, h);
      b.fillStyle(c1, 1).fillRect(x, y, w * Phaser.Math.Clamp(frac, 0, 1), h);
      b.fillStyle(c2, 0.5).fillRect(x, y, w * Phaser.Math.Clamp(frac, 0, 1), h / 3);
      b.lineStyle(1, 0x5a4030, 1).strokeRect(x - 2, y - 2, w + 4, h + 4);
    };
    bar(64, H - 86, 240, 22, state.hp / s.maxHp, 0xa01818, 0xff6060);
    if (state.shield > 0) {
      const shFrac = Phaser.Math.Clamp(state.shield / Math.max(1, state.shieldMax || s.maxHp), 0, 1);
      b.fillStyle(0xffe050, 0.92).fillRect(64, H - 70, 240 * shFrac, 6);
    }
    bar(64, H - 58, 240, 22, state.mp / s.maxMp, 0x1838a0, 0x6080ff);
    const need = xpToNext(state.level);
    bar(340, H - 18, 460, 8, state.xp / need, 0x7040c0, 0xb090ff);
    const shTxt = state.shield > 0 ? ` (+${Math.ceil(state.shield)})` : '';
    this.hpText.setText(`${Math.ceil(state.hp)}${shTxt} / ${s.maxHp}`);
    this.mpText.setText(`${Math.floor(state.mp)} / ${s.maxMp}`);
    this.xpText.setText(`經驗 ${state.xp} / ${need}`);
  }

  updateMinimap() {
    const gs = this.game_;
    const d = gs.dungeon;
    if (!d) return;

    const scale = Math.min(MM.w / d.W, MM.h / d.H);
    const ox = MM.x + (MM.w - d.W * scale) / 2;
    const oy = MM.y + (MM.h - d.H * scale) / 2;

    if (!this.mmInited || (d.newlyExplored && d.newlyExplored.length)) {
      const ctx = this.mmTex.getContext();
      if (!this.mmInited) {
        this.mmInited = true;
        ctx.clearRect(0, 0, MM.w, MM.h);
      }
      const bossRoom = d.isVillage ? null : d.rooms[d.rooms.length - 1];
      const list = d.newlyExplored || [];
      const localOx = (MM.w - d.W * scale) / 2;
      const localOy = (MM.h - d.H * scale) / 2;
      for (const i of list) {
        const x = i % d.W, y = (i / d.W) | 0;
        const floor = d.grid[i] === 1;
        const inBoss = bossRoom && x >= bossRoom.x && x < bossRoom.x + bossRoom.w && y >= bossRoom.y && y < bossRoom.y + bossRoom.h;
        ctx.fillStyle = floor ? (d.isVillage ? '#786850' : inBoss ? '#5a2030' : '#6a5a48') : '#2a2220';
        ctx.fillRect(localOx + x * scale, localOy + y * scale, Math.ceil(scale), Math.ceil(scale));
      }
      if (d.newlyExplored) d.newlyExplored.length = 0;
      this.mmTex.refresh();
    }

    const g = this.mmDots;
    g.clear();
    const s = scale / 48;
    if (d.isVillage && d.landmarks) {
      const lm = d.landmarks;
      g.fillStyle(0xffa030, 1).fillCircle(ox + (lm.smith.x + 0.5) * scale, oy + (lm.smith.y + 0.5) * scale, 4);
      g.fillStyle(0x40e0ff, 1).fillCircle(ox + (lm.fountain.x + 0.5) * scale, oy + (lm.fountain.y + 0.5) * scale, 4);
      g.fillStyle(0xb050ff, 1).fillCircle(ox + (lm.portal.x + 0.5) * scale, oy + (lm.portal.y + 0.5) * scale, 4);
    } else {
      for (const e of gs.enemies) {
        if (e.dead || e.isDummy) continue;
        const tx = Math.floor(e.fx / 48), ty = Math.floor(e.fy / 48);
        if (!d.explored[ty * d.W + tx]) continue;
        if (Math.hypot(e.fx - gs.player.fx, e.fy - gs.player.fy) > 520 && !e.isBoss) continue;
        g.fillStyle(e.isBoss ? 0xff40ff : e.T.elite ? 0xffb020 : 0xff3030, 1);
        const r = e.isBoss ? 3 : 1.5;
        g.fillRect(ox + e.fx * s - r, oy + e.fy * s - r, r * 2, r * 2);
      }
      if (gs.chests) {
        g.fillStyle(0xffd840, 1);
        for (const c of gs.chests) {
          if (c.opened) continue;
          const tx = Math.floor(c.x / 48), ty = Math.floor(c.y / 48);
          if (!d.explored[ty * d.W + tx]) continue;
          g.fillRect(ox + c.x * s - 1.5, oy + c.y * s - 1.5, 3, 3);
        }
      }
      if (gs.shrines) {
        g.fillStyle(0x50f0d0, 1);
        for (const sh of gs.shrines) {
          if (sh.used) continue;
          const tx = Math.floor(sh.x / 48), ty = Math.floor(sh.y / 48);
          if (!d.explored[ty * d.W + tx]) continue;
          g.fillRect(ox + sh.x * s - 1.5, oy + sh.y * s - 1.5, 3, 3);
        }
      }
    }
    const pblink = 0.6 + Math.sin(this.time.now * 0.01) * 0.4;
    g.fillStyle(0x60ff60, pblink);
    g.fillRect(ox + gs.player.fx * s - 2.5, oy + gs.player.fy * s - 2.5, 5, 5);
  }

  update() {
    this.drawBars();
    this.updateMinimap();
    this.updateSkillBar();
    this.updateBossBar();

    const d = this.game_.dungeon;
    if (state.mode === 'village') {
      this.locText.setText('餘燼村（安全區）').setColor('#ffd890');
    } else if (d && d.biome) {
      this.locText.setText(`第 ${state.floor} 層 · ${d.biome.name}`).setColor('#f0c090');
    }
    this.lvlText.setText(`等級 ${state.level}　擊殺 ${state.kills}`);
    this.pointsText.setText(state.points > 0 ? `可分配屬性點：${state.points}（按 C）` : '');
    const buffs = [];
    if (state.buffs && state.buffs.frenzy > 0) buffs.push(`狂戰祝福 ${Math.ceil(state.buffs.frenzy / 1000)}s`);
    if (state.buffs && state.buffs.arcane > 0) buffs.push(`奧術祝福 ${Math.ceil(state.buffs.arcane / 1000)}s`);
    if (state.buffs && state.buffs.bloodBoil > 0) buffs.push(`鮮血狂怒 ${Math.ceil(state.buffs.bloodBoil / 1000)}s`);
    if (state.buffs && state.buffs.shield > 0 && state.shield > 0) buffs.push(`聖光護盾 ${Math.ceil(state.buffs.shield / 1000)}s`);
    this.buffText.setText(buffs.join(' · '));
    const st = getStats();
    this.auraText.setText(st.activeAuras.length ? '光環：' + st.activeAuras.map((a) => a.def.name).join(' · ') : '');
    this.goldText.setText(`${state.gold}`);
    this.shardText.setText(`${state.shards}`);

    if (this.bagBtn) this.bagBtn.bg.setStrokeStyle(2, state.points > 0 ? 0x80d060 : 0x6a4a2a);
    if (this.muteBtn) this.muteBtn.t.setText(Sfx.muted ? '音效：關' : '音效：開');
    if (this.navBtn) this.navBtn.t.setText(state.mode === 'village' ? '地城 [G]' : '回村 [T]');
  }
}
