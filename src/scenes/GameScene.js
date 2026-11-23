import Phaser from 'phaser';
import { TILE } from '../systems/textures.js';
import { generateDungeon, generateVillage } from '../systems/dungeon.js';
import { PathFinder } from '../systems/pathfinding.js';
import { Sfx } from '../systems/audio.js';
import Player, { PLAYER_R } from '../entities/Player.js';
import Enemy from '../entities/Enemy.js';
import Boss from '../entities/Boss.js';
import {
  state, resetState, getStats, getEffectiveSkillLevel, addXp, INV_SIZE, setVfxEnabled,
} from '../state.js';
import { VfxManager } from '../systems/vfx.js';
import {
  preloadDungeonArt, isDungeonArtReady, ensureDungeonArtTextures, ART_KEYS,
} from '../systems/dungeonArt.js';
import { FONT, QUALITY_COLORS, QUALITY_HEX } from '../ui.js';
import { generateItem, generateSetItem, generateSkillBook, itemDisplayName } from '../systems/items.js';
import { getBossSetId } from '../systems/sets.js';
import { getSkillData, SKILL_LIST } from '../systems/skills.js';
import { RUNE_DEFS, rollRandomRune, runeDisplayName } from '../systems/runes.js';
import { saveGame, loadGame, clearSave } from '../systems/save.js';
import { getDifficulty } from '../systems/difficulty.js';

const VW = 1280, VH = 720;
const rand = Phaser.Math.Between;

export default class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data = {}) {
    this.mode = data.mode || 'village';
    this.floor = data.floor || 1;
    this.keepState = !!data.keepState;
    this.initDifficulty = data.difficulty || null;
  }

  create() {
    if (!this.keepState) resetState(this.initDifficulty);
    state.mode = this.mode;
    state.floor = this.mode === 'village' ? 0 : this.floor;
    this._smartAim = false;
    this.movePointerId = null;

    this.input.mouse.disableContextMenu();
    this.cameras.main.fadeIn(400);

    // ---- 狀態初始化（先於生成實體）
    this.loot = [];
    this.projectiles = [];
    this.interactables = [];
    this.portals = [];
    this.lights = [];
    this.torches = [];
    this.extraLights = [];
    this.pathBudget = 4;
    this.skillCd = {};
    this.whirl = null;
    this.fullMsgT = 0;
    this.victoryPending = false;
    this.ended = false;
    this.transitioning = false;
    this.props = [];
    this.traps = [];
    this.webs = [];
    this.braziers = [];
    this.chests = [];
    this.shrines = [];
    this.propTarget = null;
    this.interactTarget = null;
    this.lootTarget = null;
    this.attackTarget = null;
    this.tutMarkers = [];
    this.targetRing = this.add.circle(0, 0, 22, 0xffe060, 0.12).setStrokeStyle(2, 0xffe060, 0.85).setDepth(3).setVisible(false);
    this.holdMove = false;
    this.holdT = 0;
    this.chaseT = 0;
    this.campfire = null;
    this.campfireGlow = null;
    this.enemiesDirty = false;
    this.boss = null;
    this.bossActive = false;
    this.bossRoom = null;
    this.auraGfx = this.add.graphics().setDepth(3);
    this.shieldGfx = this.add.graphics().setDepth(9150);
    this.groundEffects = [];
    this.orbitBlades = [];
    this.burnAuraT = 0;
    this.frostAuraT = 0;
    this.lifestealPool = 0;
    this.lifestealMsgT = 0;

    // ---- 地圖
    this.dungeon = this.mode === 'village' ? generateVillage() : generateDungeon(this.floor);
    const biome = this.dungeon.biome;
    this.pf = new PathFinder(this.dungeon);
    this.map = null;
    this.layer = null;
    this.playerWallCollider = null;
    this.enemyWallCollider = null;
    this.bossWallCollider = null;
    this.floorBg = null;
    this.wallSprites = [];
    this._dungeonArtApplied = false;
    this._onDungeonArtReady = null;
    this._onEntityArtLoaded = () => {
      if (!this.sys || this.sys.settings.status >= Phaser.Scenes.SHUTDOWN) return;
      this.player?.applyCustomArt?.();
      for (const e of this.enemies) {
        if (!e.dead) e.applyCustomArt?.();
      }
    };
    this.game.events.on('entityArtLoaded', this._onEntityArtLoaded);
    preloadDungeonArt(this.game);

    if (this.mode === 'dungeon') {
      if (isDungeonArtReady(this.game)) {
        this.applyDungeonArt();
      } else {
        this.buildDungeonMapLayer(biome.tiles);
        this._onDungeonArtReady = () => {
          if (this.sys && this.sys.settings.status < Phaser.Scenes.SHUTDOWN) this.applyDungeonArt();
        };
        this.game.events.once('dungeonArtReady', this._onDungeonArtReady);
      }
    } else {
      this.buildDungeonMapLayer(biome.tiles);
    }
    this.worldW = this.dungeon.W * TILE;
    this.worldH = this.dungeon.H * TILE;
    this.physics.world.setBounds(0, 0, this.worldW, this.worldH);

    // ---- 玩家
    let sx, sy;
    if (this.mode === 'village') {
      const sp = this.dungeon.landmarks.spawn;
      sx = sp.x * TILE + TILE / 2;
      sy = sp.y * TILE + TILE / 2;
      const stats = getStats();
      state.hp = stats.maxHp;
      state.mp = stats.maxMp;
    } else {
      const start = this.dungeon.rooms[0];
      sx = start.cx * TILE + TILE / 2;
      sy = start.cy * TILE + TILE / 2;
    }
    this.player = new Player(this, sx, sy);
    this.player.onStuck = (dest) => this.repathStrict(dest);

    // ---- 敵人與場景佈置
    this.enemies = [];
    this.enemyGroup = this.physics.add.group();
    this.bindWallColliders();
    this.physics.add.collider(this.enemyGroup, this.enemyGroup);

    if (this.mode === 'village') {
      this.setupVillage();
    } else {
      this.decorate();
      this.placeTorches();
      this.populate();
      this.populateProps();
      const start = this.dungeon.rooms[0];
      this.createPortalProp(
        (start.x + 1) * TILE + TILE / 2,
        (start.y + 1) * TILE + TILE / 2,
        0xf0c040,
        '回村傳送陣 [T]',
        () => this.enterVillage(),
        0.75
      );
    }

    // ---- 攝影機
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    this.camX = this.player.fx - VW / 2;
    this.camY = this.player.fy - VH / 2;
    this.updateCamera(1000);

    // ---- 光照與霧
    this.fog = this.add.tileSprite(0, 0, VW, VH, 'fog')
      .setOrigin(0).setScrollFactor(0).setDepth(8900)
      .setAlpha(this.mode === 'village' ? 0.22 : 0.55)
      .setTint(biome.fogTint);
    this.darkColor = biome.dark;
    this.darkAlpha = biome.darkAlpha;
    this.dark = this.add.renderTexture(0, 0, VW, VH).setOrigin(0).setScrollFactor(0).setDepth(9000);
    this.lightStamp = this.make.image({ key: 'light', add: false });
    this.hpGfx = this.add.graphics().setDepth(9400);
    this.vfx = new VfxManager(this);

    // ---- 輸入
    this.setupInput();
    this.exploreT = 0;
    this.revealAround();

    this.scene.launch('UI');
    this.events.once('shutdown', () => {
      this.scene.stop('UI');
      Sfx.stopAmbient();
      if (this._onDungeonArtReady) {
        this.game.events.off('dungeonArtReady', this._onDungeonArtReady);
        this._onDungeonArtReady = null;
      }
      if (this._onEntityArtLoaded) {
        this.game.events.off('entityArtLoaded', this._onEntityArtLoaded);
        this._onEntityArtLoaded = null;
      }
      if (this.whirl) {
        this.vfx?.destroyWhirlVisuals(this.whirl);
        this.whirl = null;
      }
      this.vfx?.destroy();
    });
    Sfx.startAmbient();

    // 飄浮餘燼
    this.embers = this.add.particles(0, 0, 'spark', {
      x: { onEmit: () => this.player.fx + rand(-VW * 0.6, VW * 0.6) },
      y: { onEmit: () => this.player.fy + rand(-VH * 0.6, VH * 0.6) },
      speedX: { min: -12, max: 12 }, speedY: { min: -30, max: -8 },
      scale: { start: 0.45, end: 0 }, alpha: { start: 0.7, end: 0 }, lifespan: 4000,
      tint: this.mode === 'village' ? [0xffa040, 0xffd070] : [biome.torchTint, 0xffa040, 0xff4010],
      frequency: 120, maxAliveParticles: this.vfx.isLowSpec() ? 10 : 18, blendMode: 'ADD',
    }).setDepth(9050);
    this.vfx.applyEnabledState(state.vfxEnabled);

    window.__ember.scene = this;
    window.__ember.enterVillage = () => this.enterVillage();
    window.__ember.enterFloor = (f) => this.enterFloor(f);
    window.__ember.teleportBoss = () => {
      if (!this.bossRoom) return;
      const br = this.bossRoom;
      const midX = br.cx * TILE + TILE / 2;
      const px = this.boss && this.boss.fx >= midX
        ? (br.x + 3) * TILE + TILE / 2
        : (br.x + br.w - 4) * TILE + TILE / 2;
      this.player.setFootPosition(px, br.cy * TILE + TILE / 2);
      this.player.stop();
    };
    window.__ember.giveItems = (n = 5) => {
      for (let i = 0; i < n; i++) state.inventory.length < INV_SIZE && state.inventory.push(generateItem(Math.max(2, this.floor * 2), 0.3));
      this.game.events.emit('inventoryChanged');
    };
    window.__ember.giveBook = (skillId = null) => {
      if (state.inventory.length < INV_SIZE) state.inventory.push(generateSkillBook(skillId));
      this.game.events.emit('inventoryChanged');
    };
    window.__ember.giveGold = (n = 500) => { state.gold += n; };
    window.__ember.giveShards = (n = 10) => { state.shards += n; };
    window.__ember.teleportChest = () => {
      const c = this.chests.find((o) => !o.opened);
      if (c) { this.player.setFootPosition(c.x - 38, c.y); this.player.stop(); }
      return !!c;
    };
    window.__ember.teleportShrine = () => {
      const sh = this.shrines.find((o) => !o.used);
      if (sh) { this.player.setFootPosition(sh.x - 40, sh.y); this.player.stop(); }
      return !!sh;
    };
    window.__ember.teleportProp = () => {
      const pr = this.props.find((o) => !o.dead);
      if (pr) { this.player.setFootPosition(pr.x - 36, pr.y); this.player.stop(); }
      return !!pr;
    };
    window.__ember.teleportTrap = () => {
      const tr = this.traps[0];
      if (tr) { this.player.setFootPosition(tr.x - 45, tr.y); this.player.stop(); }
      return !!tr;
    };
    window.__ember.teleportSpider = () => {
      const sp = this.enemies.find((e) => !e.dead && e.type === 'spider');
      if (sp) { this.player.setFootPosition(sp.fx - 60, sp.fy); this.player.stop(); }
      return !!sp;
    };
    window.__ember.giveRune = (runeId = 'blood', count = 1) => {
      if (!RUNE_DEFS[runeId]) return false;
      state.runes[runeId] = (state.runes[runeId] || 0) + count;
      this.game.events.emit('inventoryChanged');
      return state.runes[runeId];
    };
    window.__ember.giveSpecial = (slot = null) => {
      if (state.inventory.length >= INV_SIZE) return null;
      const item = generateItem(Math.max(2, this.floor * 2 + 2), 0.4, 'special', slot);
      state.inventory.push(item);
      this.game.events.emit('inventoryChanged');
      return item;
    };
    window.__ember.giveSocketed = (sockets = 2, quality = 'gold', slot = null) => {
      if (state.inventory.length >= INV_SIZE) return null;
      const item = generateItem(Math.max(2, this.floor * 2 + 1), 0.3, quality, slot);
      item.sockets = sockets;
      item.runes = [];
      state.inventory.push(item);
      this.game.events.emit('inventoryChanged');
      return item;
    };
    window.__ember.spawnTestRune = (runeId = 'blood') => {
      this.spawnRune(this.player.fx + 52, this.player.fy, runeId);
      return true;
    };
    window.__ember.saveGame = () => saveGame();
    window.__ember.loadGame = () => loadGame();
    window.__ember.clearSave = () => clearSave();
    window.__ember.giveAllSkills = () => {
      for (const sk of SKILL_LIST) {
        if (!state.skillLevels[sk.id]) state.skillLevels[sk.id] = 1;
      }
      this.game.events.emit('inventoryChanged');
      return Object.keys(state.skillLevels).length;
    };
    window.__ember.giveItemForSlot = (slot, quality = 'gold') => {
      if (state.inventory.length >= INV_SIZE) return null;
      const item = generateItem(Math.max(2, this.floor * 2 + 1), 0.35, quality, slot);
      state.inventory.push(item);
      this.game.events.emit('inventoryChanged');
      return item;
    };
    window.__ember.giveSetItem = (setId = 'bone_warlord', slot = null) => {
      if (state.inventory.length >= INV_SIZE) return null;
      const item = generateSetItem(setId, Math.max(2, this.floor * 2 + 1), slot);
      state.inventory.push(item);
      this.game.events.emit('inventoryChanged');
      return item;
    };
    window.__ember.spawnTestSet = (setId = 'bone_warlord', slot = null) => {
      const item = generateSetItem(setId, Math.max(2, this.floor * 2 + 1), slot);
      this.spawnItem(this.player.fx + 96, this.player.fy, item);
      return item;
    };
    window.__ember.giveEssence = (n = 5) => {
      state.setEssence = (state.setEssence || 0) + n;
      return state.setEssence;
    };

    if (this.keepState) saveGame();

    if (this.mode === 'village') {
      this.msg('歡迎來到餘燼村！可找鐵匠鍛造或踏入傳送門挑戰無盡地城', '#ffd890');
    } else {
      this.msg(`第 ${this.floor} 層：${biome.name}`, '#e0c090');
    }
  }

  // =========================================================== 餘燼村
  setupVillage() {
    const d = this.dungeon;
    const lm = d.landmarks;
    const wc = (pt) => ({ x: pt.x * TILE + TILE / 2, y: pt.y * TILE + TILE / 2 });

    // 村莊壁掛火炬
    for (let ty = 3; ty <= 5; ty++) {
      for (let tx = 6; tx < d.W - 5; tx += 4) {
        if (d.tiles[ty][tx] !== 5) continue;
        const x = tx * TILE + TILE / 2, y = ty * TILE + 26;
        const glow = this.add.image(x, y - 6, 'glow').setTint(0xffa040).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55).setScale(2.2).setDepth(4);
        const t = this.add.image(x, y, 'torch0').setDepth(5);
        const light = { x, y: y + 18, r: 230, a: 0.95, flicker: Math.random() * 10 };
        this.torches.push({ t, glow, light, off: Math.random() * 3 });
        this.lights.push(light);
      }
    }

    // 營火
    const cf = wc(lm.campfire);
    this.campfire = this.add.image(cf.x, cf.y, 'campfire0').setScale(1.3).setDepth(cf.y);
    const cfGlow = this.add.image(cf.x, cf.y - 6, 'glow').setTint(0xff8020).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6).setScale(2.6).setDepth(3);
    this.campfireGlow = cfGlow;
    this.lights.push({ x: cf.x, y: cf.y, r: 280, a: 1, flicker: 1 });

    // 治癒聖泉
    const fn = wc(lm.fountain);
    this.add.image(fn.x, fn.y, 'glow').setTint(0x30d8ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setScale(2.0).setDepth(3);
    this.add.image(fn.x, fn.y, 'fountain').setScale(1.15).setDepth(fn.y);
    this.lights.push({ x: fn.x, y: fn.y, r: 210, a: 0.9 });
    this.addInteractable(fn.x, fn.y, 44, '治癒聖泉（點擊回滿血魔）', '#70f0ff', () => {
      const s = getStats();
      state.hp = s.maxHp;
      state.mp = s.maxMp;
      this.sfx('heal');
      this.burst(fn.x, fn.y - 10, 20, [0x60ff90, 0x70f0ff], 140);
      this.msg('聖泉恢復了全部生命與法力！', '#70ffaa');
    });

    // 鐵匠舖：熔爐、鐵砧與鐵匠布朗
    const fg = wc(lm.forge), av = wc(lm.anvil), sm = wc(lm.smith);
    this.add.image(fg.x, fg.y, 'glow').setTint(0xff6010).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55).setScale(2.2).setDepth(3);
    this.add.image(fg.x, fg.y, 'forge').setScale(1.25).setDepth(fg.y);
    this.lights.push({ x: fg.x, y: fg.y + 12, r: 220, a: 0.95, flicker: 3 });
    this.add.image(av.x, av.y + 6, 'anvil').setDepth(av.y);
    this.add.image(sm.x, sm.y + 10, 'shadowtex').setScale(0.75, 0.32).setDepth(2);
    this.add.image(sm.x, sm.y - 6, 'npc_smith').setDepth(sm.y);
    this.addInteractable(sm.x, sm.y, 52, '鐵匠 布朗（點擊鍛造裝備）', '#ffd070', () => {
      if (state.tutorial) state.tutorial.smithDone = true;
      this.sfx('forge');
      this.game.events.emit('openForge');
    });

    // 深淵傳送門
    const pt = wc(lm.portal);
    this.createPortalProp(pt.x, pt.y, 0xb040ff, '深淵傳送門 [G]', () => {
      this.sfx('portal');
      this.game.events.emit('openPortal');
    });

    // 訓練木樁
    const dm = wc(lm.dummy);
    this.spawnEnemy('dummy', dm.x, dm.y, 1);

    // 輕量新手引導箭頭（木樁 / 鐵匠 / 傳送門）
    const addTut = (key, gx, gy, col) => {
      const arrow = this.add.text(gx, gy - 64, '▼', {
        fontFamily: FONT, fontSize: '20px', color: col, stroke: '#000', strokeThickness: 4, fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(9470);
      const ring = this.add.circle(gx, gy, 34, 0xffe060, 0).setStrokeStyle(2, 0xffe060, 0.75).setDepth(3);
      this.tweens.add({ targets: arrow, y: gy - 54, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.tutMarkers.push({ key, arrow, ring });
    };
    addTut('dummy', dm.x, dm.y, '#ffe060');
    addTut('smith', sm.x, sm.y, '#ffd070');
    addTut('portal', pt.x, pt.y, '#d890ff');
    this.updateTutorialVisuals();

    // 村莊豐富擺飾（武器架、火盆、戰旗、枯木、木桶）
    this.add.image((lm.smith.x + 2) * TILE + TILE / 2, (lm.smith.y - 2) * TILE + TILE / 2, 'prop_rack')
      .setDepth((lm.smith.y - 2) * TILE + TILE / 2);
    this.spawnBrazier((lm.smith.x - 2) * TILE + TILE / 2, (lm.smith.y + 1) * TILE + TILE / 2, 0xff9030);
    this.spawnBrazier((lm.portal.x - 2) * TILE + TILE / 2, (lm.portal.y + 1) * TILE + TILE / 2, 0xb060ff);
    this.spawnBrazier((lm.portal.x + 2) * TILE + TILE / 2, (lm.portal.y + 1) * TILE + TILE / 2, 0xb060ff);
    for (const tx of [15, 21]) {
      if (d.tiles[5][tx] === 5) this.add.image(tx * TILE + TILE / 2, 5 * TILE + 30, 'prop_banner').setDepth(5);
    }
    for (const [tx, ty] of [[6.5, 18.5], [29.5, 18.5]]) {
      const x = tx * TILE, y = ty * TILE;
      this.add.image(x, y + 18, 'shadowtex').setScale(1.1, 0.45).setDepth(2);
      this.add.image(x, y - 6, 'prop_spooky_tree').setDepth(y);
    }
    this.add.image(5.8 * TILE, 19.6 * TILE, 'prop_barrel').setDepth(19.6 * TILE);
    this.add.image(29.8 * TILE, 19.6 * TILE, 'prop_barrel').setDepth(19.6 * TILE);
  }

  addInteractable(x, y, r, labelText, color, onUse) {
    const label = this.add.text(x, y - 42, labelText, {
      fontFamily: FONT, fontSize: '14px', color, stroke: '#000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.55)', padding: { x: 5, y: 2 },
    }).setOrigin(0.5).setDepth(9460);
    const it = { x, y, r, label, onUse };
    this.interactables.push(it);
    return it;
  }

  removeInteractable(it) {
    if (!it) return;
    it.label?.destroy();
    this.interactables = this.interactables.filter((o) => o !== it);
  }

  createPortalProp(x, y, tint, labelText, onUse, scale = 1) {
    const glow = this.add.image(x, y, 'glow').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setScale(1.7 * scale).setAlpha(0.55).setDepth(3);
    const vortex = this.add.image(x, y, 'portal_tex').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setScale(1.1 * scale).setDepth(y);
    this.lights.push({ x, y, r: 190 * scale, a: 0.9 });
    this.portals.push({ vortex, glow, scale });
    this.addInteractable(x, y, 42 * scale + 10, labelText, '#e0b8ff', onUse);
  }

  enterVillage() {
    if (this.transitioning || this.player.dead) return;
    this.transitioning = true;
    this.player.clearMoveInputs();
    this.scene.get('UI')?.resetTouchInputs?.();
    this.sfx('portal');
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.restart({ mode: 'village', keepState: true });
    });
  }

  enterFloor(floor) {
    if (this.transitioning || this.player.dead) return;
    const f = Math.max(1, Math.min(state.maxFloor, floor));
    if (state.tutorial) {
      state.tutorial.enteredDungeon = true;
      saveGame();
    }
    this.transitioning = true;
    this.player.clearMoveInputs();
    this.scene.get('UI')?.resetTouchInputs?.();
    this.sfx('portal');
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.restart({ mode: 'dungeon', floor: f, keepState: true });
    });
  }

  updateTutorialVisuals() {
    if (!this.tutMarkers || !this.tutMarkers.length) return;
    const tut = state.tutorial || {};
    const hideAll = !!tut.enteredDungeon || !!tut.dismissed;
    for (const m of this.tutMarkers) {
      let show = false;
      if (!hideAll) {
        if (m.key === 'dummy') show = !tut.dummyDone;
        else if (m.key === 'smith') show = !tut.smithDone;
        else if (m.key === 'portal') show = true;
      }
      m.arrow.setVisible(show);
      m.ring.setVisible(show);
    }
  }

  // =========================================================== 地城裝飾與怪物
  decorate() {
    const d = this.dungeon;
    for (let y = 0; y < d.H; y++) for (let x = 0; x < d.W; x++) {
      if (!d.isFloor(x, y)) continue;
      const r = Math.random();
      const wx = x * TILE + TILE / 2, wy = y * TILE + TILE / 2;
      if (r < 0.035) {
        this.add.image(wx + rand(-8, 8), wy + rand(-8, 8), 'blood' + rand(0, 2)).setAngle(rand(0, 3) * 90).setDepth(1).setAlpha(0.85);
      } else if (r < 0.05) {
        this.add.image(wx + rand(-10, 10), wy + rand(-10, 10), 'bones').setAngle(rand(-30, 30)).setDepth(1);
      } else if (r < 0.058) {
        this.add.image(wx + rand(-10, 10), wy + rand(-10, 10), 'skull').setDepth(1).setFlipX(Math.random() < 0.5);
      }
    }
  }

  placeTorches() {
    const d = this.dungeon;
    const tint = d.biome.torchTint;
    for (const room of d.rooms) {
      const ty = room.y - 1;
      if (ty < 0) continue;
      const step = room.boss ? 3 : 4;
      for (let tx = room.x + 1; tx < room.x + room.w - 1; tx += step) {
        if (d.tiles[ty][tx] !== 5) continue;
        const x = tx * TILE + TILE / 2, y = ty * TILE + 26;
        const glow = this.add.image(x, y - 6, 'glow').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setScale(2.2).setDepth(4);
        const t = this.add.image(x, y, 'torch0').setDepth(5);
        const light = { x, y: y + 18, r: room.boss ? 235 : 205, a: 0.95, flicker: Math.random() * 10 };
        this.torches.push({ t, glow, light, off: Math.random() * 3 });
        this.lights.push(light);
      }
    }
    for (let ty = 1; ty < d.H - 1; ty++) {
      for (let tx = 1; tx < d.W - 1; tx++) {
        if (d.tiles[ty][tx] !== 5) continue;
        if (d.rooms.some((r) => ty === r.y - 1 && tx >= r.x && tx < r.x + r.w)) continue;
        const x = tx * TILE + TILE / 2, y = ty * TILE + 26;
        if (this.torches.some((o) => Math.hypot(o.t.x - x, o.t.y - y) < 5 * TILE)) continue;
        const glow = this.add.image(x, y - 6, 'glow').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.38).setScale(1.7).setDepth(4);
        const t = this.add.image(x, y, 'torch0').setDepth(5);
        const light = { x, y: y + 18, r: 155, a: 0.78, flicker: Math.random() * 10 };
        this.torches.push({ t, glow, light, off: Math.random() * 3 });
        this.lights.push(light);
      }
    }
    const bossRoom = d.rooms.find((r) => r.boss);
    if (bossRoom) {
      const bx = bossRoom.cx * TILE + TILE / 2, by = bossRoom.cy * TILE + TILE / 2;
      const g = this.add.graphics().setDepth(1);
      g.lineStyle(3, 0x7a1c38, 0.38).strokeCircle(bx, by, 150);
      g.lineStyle(2, 0x5c1878, 0.35).strokeCircle(bx, by, 126);
      g.lineStyle(2, 0x8a2040, 0.32).strokeCircle(bx, by, 72);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const x1 = bx + Math.cos(a) * 72, y1 = by + Math.sin(a) * 72;
        const x2 = bx + Math.cos(a) * 150, y2 = by + Math.sin(a) * 150;
        g.lineStyle(1.5, 0x702070, 0.32).lineBetween(x1, y1, x2, y2);
        const rx = bx + Math.cos(a + Math.PI / 8) * 138, ry = by + Math.sin(a + Math.PI / 8) * 138;
        g.fillStyle(0x9a2050, 0.35).fillCircle(rx, ry, 4);
      }
      this.add.image(bx, by, 'glow').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.28).setScale(3.6).setDepth(2);
    }
  }

  spawnBrazier(x, y, tint = 0xff6a10) {
    const glow = this.add.image(x, y - 6, 'glow').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55).setScale(2.1).setDepth(3);
    const s = this.add.image(x, y, 'prop_brazier0').setDepth(y);
    const light = { x, y, r: 210, a: 0.95, flicker: Math.random() * 10 };
    this.lights.push(light);
    this.braziers.push({ s, glow, light, off: Math.random() * 5 });
  }

  populateProps() {
    const d = this.dungeon;
    const biome = d.biome;
    const freeSpot = (x, y, minDist = 42) => {
      if (!d.walkableAt(x, y)) return false;
      const room = d.roomAt(x, y);
      if (room && Math.hypot(x - (room.cx * TILE + TILE / 2), y - (room.cy * TILE + TILE / 2)) < 48) return false;
      for (const c of this.chests) if (Math.hypot(c.x - x, c.y - y) < minDist) return false;
      for (const sh of this.shrines) if (Math.hypot(sh.x - x, sh.y - y) < minDist) return false;
      for (const pr of this.props) if (Math.hypot(pr.x - x, pr.y - y) < minDist * 0.8) return false;
      for (const tr of this.traps) if (Math.hypot(tr.x - x, tr.y - y) < minDist) return false;
      for (const b of this.braziers) if (Math.hypot(b.s.x - x, b.s.y - y) < minDist) return false;
      return true;
    };
    const pickSpot = (room, edgeOnly = false) => {
      for (let t = 0; t < 24; t++) {
        let tx, ty;
        if (edgeOnly) {
          if (Math.random() < 0.5) {
            tx = Math.random() < 0.5 ? room.x + 1 : room.x + room.w - 2;
            ty = rand(room.y + 1, room.y + room.h - 2);
          } else {
            tx = rand(room.x + 1, room.x + room.w - 2);
            ty = Math.random() < 0.5 ? room.y + 1 : room.y + room.h - 2;
          }
        } else {
          tx = rand(room.x + 2, Math.max(room.x + 2, room.x + room.w - 3));
          ty = rand(room.y + 2, Math.max(room.y + 2, room.y + room.h - 3));
        }
        const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
        if (freeSpot(x, y)) return { x, y };
      }
      return null;
    };

    // 牆面鐵鍊與戰旗
    for (const room of d.rooms) {
      const ty = room.y - 1;
      if (ty < 0) continue;
      for (let tx = room.x + 1; tx < room.x + room.w - 1; tx += 2) {
        if (d.tiles[ty][tx] !== 5) continue;
        const wx = tx * TILE + TILE / 2, wy = ty * TILE + 28;
        if (this.torches.some((o) => Math.abs(o.t.x - wx) < 22 && Math.abs(o.t.y - wy) < 22)) continue;
        const r = Math.random();
        if (r < 0.25) this.add.image(wx, wy, 'prop_chains').setDepth(5);
        else if (r < 0.42) this.add.image(wx, wy, 'prop_banner').setDepth(5);
      }
    }

    // 房內擺飾、火盆、寶箱、可破壞物、陷阱與蛛網
    const shrineRooms = [];
    d.rooms.forEach((room, i) => {
      if (i === 0) return;
      if (room.boss) {
        for (const oy of [3, room.h - 4]) {
          const bx = (room.x + 3) * TILE + TILE / 2, by = (room.y + oy) * TILE + TILE / 2;
          if (d.walkableAt(bx, by)) this.spawnBrazier(bx, by, biome.torchTint);
        }
        return;
      }

      shrineRooms.push(room);

      // 火盆
      if (Math.random() < 0.45) {
        const sp = pickSpot(room, true);
        if (sp) this.spawnBrazier(sp.x, sp.y, biome.torchTint);
      }
      // 墓碑與武器架
      if (Math.random() < (biome.id === 'blood' || biome.id === 'frost' ? 0.45 : 0.2)) {
        const sp = pickSpot(room, true);
        if (sp) {
          this.add.image(sp.x, sp.y + 8, 'shadowtex').setScale(0.65, 0.28).setDepth(2);
          this.add.image(sp.x, sp.y, 'prop_grave').setDepth(sp.y);
        }
      }
      if (Math.random() < 0.25) {
        const sp = pickSpot(room, true);
        if (sp) this.add.image(sp.x, sp.y, 'prop_rack').setDepth(sp.y);
      }

      // 寶箱（支線房必出 1 個，普通房 35% 機率）
      if (room.branch || Math.random() < 0.35) {
        const sp = pickSpot(room, false) || pickSpot(room, true);
        if (sp) this.spawnChest(sp.x, sp.y, !!room.branch);
      }

      // 可破壞木桶與陶罐
      const nProps = rand(3, 5);
      for (let k = 0; k < nProps; k++) {
        const sp = pickSpot(room, true);
        if (sp) this.spawnProp(sp.x, sp.y, Math.random() < 0.5 ? 'barrel' : 'urn');
      }

      // 地刺與擺斧陷阱
      if (Math.random() < 0.6) {
        const nTraps = rand(1, 2);
        for (let k = 0; k < nTraps; k++) {
          const sp = pickSpot(room, false);
          if (sp) this.spawnSpikeTrap(sp.x, sp.y);
        }
      }
      if (room.w >= 11 && room.h >= 10 && Math.random() < 0.48) {
        const sp = pickSpot(room, false);
        if (sp) this.spawnAxeTrap(sp.x, sp.y);
      }

      // 蜘蛛網
      const hasSpider = this.enemies.some((e) => !e.dead && e.type === 'spider' && d.roomAt(e.fx, e.fy) === room);
      if (hasSpider || Math.random() < 0.25) {
        const nw = rand(2, 3);
        for (let k = 0; k < nw; k++) {
          const p = d.randomFloorInRoom(room, 1);
          const s = this.add.image(p.x, p.y, 'prop_web').setDepth(1).setAlpha(0.85).setAngle(rand(0, 3) * 90);
          this.webs.push({ x: p.x, y: p.y, r: 22, sprite: s, burned: false });
        }
      }
    });

    // 神秘祭壇：每層挑 1~2 間房
    Phaser.Utils.Array.Shuffle(shrineRooms);
    const nShrines = Math.min(shrineRooms.length, rand(1, 2));
    for (let i = 0; i < nShrines; i++) {
      const sp = pickSpot(shrineRooms[i], false) || pickSpot(shrineRooms[i], true);
      if (sp) this.spawnShrine(sp.x, sp.y);
    }
  }

  spawnChest(x, y, rich = false) {
    this.add.image(x, y + 10, 'shadowtex').setScale(0.85, 0.36).setDepth(2);
    const glow = this.add.image(x, y, 'glow').setTint(0xffc830).setBlendMode(Phaser.BlendModes.ADD).setScale(1.1, 0.6).setAlpha(0.45).setDepth(2);
    const sprite = this.add.image(x, y, 'prop_chest').setDepth(y);
    const chest = { x, y, sprite, glow, opened: false };
    this.chests.push(chest);
    const inter = this.addInteractable(x, y, 36, '寶箱（點擊開啟）', '#ffd860', () => {
      if (chest.opened) return;
      chest.opened = true;
      sprite.setTexture('prop_chest_open');
      glow.setAlpha(0.12);
      this.removeInteractable(inter);
      this.sfx('chest');
      this.burst(x, y - 8, 22, [0xffd040, 0xfff8b0], 150, 450);

      const diff = getDifficulty(state.difficulty);
      const goldAmt = Math.max(1, Math.round(rand(25 + this.floor * 15, 50 + this.floor * 25) * diff.goldMul));
      this.spawnGold(x + rand(-18, 18), y + rand(10, 24), goldAmt);
      const ilvl = Math.max(1, this.floor * 2);
      const mf = getStats().magicFind;
      const count = rich ? 2 : rand(1, 2);
      for (let k = 0; k < count; k++) {
        const qual = rich && k === 0
          ? 'gold'
          : Math.random() < Math.min(0.18, 0.04 + mf * 0.06)
            ? 'special'
            : Math.random() < Math.min(0.65, 0.35 + mf * 0.15)
              ? 'gold'
              : 'blue';
        this.spawnItem(x + rand(-28, 28), y + rand(14, 30), generateItem(ilvl, Math.min(0.5, 0.25 + mf * 0.15), qual));
      }
      if (Math.random() < Math.min(0.65, 0.35 * (1 + mf * 0.3))) {
        this.spawnItem(x + rand(-20, 20), y + rand(12, 26), generateSkillBook());
      }
      if (rich && Math.random() < 0.12) {
        this.spawnItem(x + rand(-24, 24), y + rand(14, 28), generateSetItem(null, ilvl));
      }
      if (Math.random() < Math.min(0.85, (rich ? 0.45 : 0.22) * (1 + mf * 0.6) * diff.runeMul)) {
        this.spawnRune(x + rand(-24, 24), y + rand(12, 26), rollRandomRune(this.floor));
      }
      if (Math.random() < 0.55) {
        const sh = rand(1, 2) + (diff.shardBonus > 0 ? 1 : 0);
        state.shards += sh;
        this.floatText(x, y - 34, `+${sh} 餘燼石`, '#ff88ff', 15);
      }
    });
  }

  spawnShrine(x, y) {
    const types = [
      { id: 'heal', name: '治癒祭壇', color: 0x60ff90, text: '#70ffaa', msg: '聖壇恢復了全部生命與法力！' },
      { id: 'frenzy', name: '狂戰祭壇', color: 0xff6030, text: '#ff8850', msg: '獲得【狂戰祝福】：攻擊 +40%、移速 +20%（20 秒）' },
      { id: 'arcane', name: '奧術祭壇', color: 0x50c8ff, text: '#70e0ff', msg: '獲得【奧術祝福】：冷卻減半、回魔 x5（20 秒）' },
      { id: 'greed', name: '貪婪祭壇', color: 0xffd040, text: '#ffe070', msg: '貪婪祭壇噴湧出大量財寶！' },
    ];
    const kind = Phaser.Utils.Array.GetRandom(types);
    this.add.image(x, y + 12, 'shadowtex').setScale(0.85, 0.36).setDepth(2);
    const glow = this.add.image(x, y - 6, 'glow').setTint(kind.color).setBlendMode(Phaser.BlendModes.ADD).setScale(1.4).setAlpha(0.55).setDepth(3);
    const sprite = this.add.image(x, y - 4, 'prop_shrine').setDepth(y);
    const sh = { x, y, sprite, glow, kind, used: false };
    this.shrines.push(sh);
    const inter = this.addInteractable(x, y, 38, `${kind.name}（點擊祈禱）`, kind.text, () => {
      if (sh.used) return;
      sh.used = true;
      sprite.setTexture('prop_shrine_used');
      glow.setAlpha(0.08);
      this.removeInteractable(inter);
      this.sfx('shrine');
      this.burst(x, y - 10, 26, [kind.color, 0xffffff], 180, 550);
      this.msg(kind.msg, kind.text);
      const s = getStats();
      if (kind.id === 'heal') {
        state.hp = s.maxHp;
        state.mp = s.maxMp;
        this.floatText(this.player.fx, this.player.topY - 6, '完全回復！', '#70ffaa', 20);
      } else if (kind.id === 'frenzy') {
        state.buffs.frenzy = 20000;
        this.floatText(this.player.fx, this.player.topY - 6, '狂戰祝福！', '#ff8850', 20);
      } else if (kind.id === 'arcane') {
        state.buffs.arcane = 20000;
        this.floatText(this.player.fx, this.player.topY - 6, '奧術祝福！', '#70e0ff', 20);
      } else if (kind.id === 'greed') {
        for (let k = 0; k < 5; k++) this.spawnGold(x + rand(-34, 34), y + rand(-18, 30), rand(18 + this.floor * 8, 34 + this.floor * 14));
        const shards = rand(1, 2);
        state.shards += shards;
        this.floatText(x, y - 34, `+${shards} 餘燼石`, '#ff88ff', 16);
      }
    });
  }

  spawnProp(x, y, kind) {
    const shadow = this.add.image(x, y + 8, 'shadowtex').setScale(0.6, 0.28).setDepth(2);
    const sprite = this.add.image(x, y, kind === 'barrel' ? 'prop_barrel' : 'prop_urn').setDepth(y);
    this.props.push({ x, y, kind, sprite, shadow, dead: false });
  }

  smashProp(pr) {
    if (!pr || pr.dead) return;
    pr.dead = true;
    pr.sprite.destroy();
    pr.shadow.destroy();
    this.sfx('smash');
    this.add.image(pr.x, pr.y, 'prop_debris').setDepth(1).setAlpha(0.85).setAngle(rand(0, 3) * 90);
    this.bloodBurst(pr.x, pr.y, 8, pr.kind === 'barrel' ? 0x8a5828 : 0x9a6448);

    const diff = getDifficulty(state.difficulty);
    const mf = getStats().magicFind;
    const r = Math.random();
    if (r < 0.42) {
      this.spawnGold(pr.x, pr.y, Math.max(1, Math.round(rand(4 + this.floor * 3, 14 + this.floor * 6) * diff.goldMul)));
    } else if (r < 0.58) {
      this.spawnOrbLoot(pr.x, pr.y, Math.random() < 0.55 ? 'hp' : 'mp');
    } else if (r < 0.66) {
      this.spawnItem(pr.x, pr.y, generateItem(Math.max(1, this.floor * 2 - 1), Math.min(0.35, 0.1 + mf * 0.15)));
    } else if (r < 0.68) {
      this.spawnItem(pr.x, pr.y, generateSkillBook());
    } else if (r < Math.min(0.76, 0.71 + mf * 0.025)) {
      this.spawnRune(pr.x, pr.y, rollRandomRune(this.floor));
    } else if (r < 0.85) {
      const sp = this.spawnEnemy('spider', pr.x, pr.y, Math.max(1, this.floor * 2 - 1));
      sp.aggro = true;
      this.floatText(pr.x, pr.y - 24, '伏擊！', '#ff6060', 15);
    }
  }

  smashPropsInRadius(x, y, r) {
    for (const pr of this.props) {
      if (!pr.dead && Math.hypot(pr.x - x, pr.y - y) <= r + 16) this.smashProp(pr);
    }
  }

  burnWebsInRadius(x, y, r) {
    for (const w of this.webs) {
      if (!w.burned && Math.hypot(w.x - x, w.y - y) <= r + w.r) {
        w.burned = true;
        w.sprite.destroy();
        this.burst(w.x, w.y, 8, [0xff7020, 0xffd060], 70, 300);
      }
    }
  }

  spawnSpikeTrap(x, y) {
    const sprite = this.add.image(x, y, 'prop_spikes_down').setDepth(2);
    const warn = this.add.circle(x, y, 22, 0xff2010, 0.22).setStrokeStyle(1.5, 0xff5020, 0.8).setDepth(2).setVisible(false);
    this.traps.push({
      kind: 'spikes', x, y, sprite, warn, state: 'idle', t: rand(0, 2000), hitCd: new Map(),
    });
  }

  spawnAxeTrap(x, y) {
    const g = this.add.graphics().setDepth(y - 2);
    const blade = this.add.image(x, y, 'prop_axe_trap').setDepth(y + 4);
    this.traps.push({
      kind: 'axe', x, y, pivotY: y - 48, len: 52, amp: 1.05, phase: Math.random() * Math.PI * 2,
      g, blade, bx: x, by: y, hitCd: new Map(),
    });
  }

  updateTraps(time, dt) {
    const p = this.player;
    const dmg = Math.max(1, Math.round((10 + this.floor * 4) * getDifficulty(state.difficulty).trapMul));
    const hitTargets = (tx, ty, rad, tr) => {
      const now = time;
      if (!p.dead && Math.hypot(p.fx - tx, p.fy - ty) < rad + PLAYER_R) {
        if ((tr.hitCd.get(p) || 0) < now) {
          tr.hitCd.set(p, now + 750);
          this.hurtPlayer(dmg, tx, ty);
        }
      }
      for (const e of this.enemies.slice()) {
        if (e.dead || e.isDummy || e.isBoss) continue;
        if (Math.hypot(e.fx - tx, e.fy - ty) < rad + e.T.r) {
          if ((tr.hitCd.get(e) || 0) < now) {
            tr.hitCd.set(e, now + 750);
            this.damageEnemy(e, Math.round(dmg * 1.4), { color: '#ff7040', kx: e.fx - tx, ky: e.fy - ty, force: 80 });
          }
        }
      }
    };

    for (const tr of this.traps) {
      if (tr.kind === 'spikes') {
        tr.t += dt;
        if (tr.state === 'idle' && tr.t >= 2400) {
          tr.state = 'warn'; tr.t = 0; tr.warn.setVisible(true);
        } else if (tr.state === 'warn' && tr.t >= 550) {
          tr.state = 'up'; tr.t = 0; tr.warn.setVisible(false);
          tr.sprite.setTexture('prop_spikes_up');
          if (Math.hypot(p.fx - tr.x, p.fy - tr.y) < 320) this.sfx('trap');
        } else if (tr.state === 'up') {
          hitTargets(tr.x, tr.y, 20, tr);
          if (tr.t >= 1100) { tr.state = 'idle'; tr.t = 0; tr.sprite.setTexture('prop_spikes_down'); }
        }
      } else if (tr.kind === 'axe') {
        const ang = tr.amp * Math.sin(time * 0.0024 + tr.phase);
        const bx = tr.x + Math.sin(ang) * tr.len;
        const by = tr.pivotY + Math.cos(ang) * tr.len * 0.85;
        tr.bx = bx; tr.by = by;
        tr.blade.setPosition(bx, by).setRotation(-ang * 0.85).setDepth(by + 4);
        tr.g.clear().lineStyle(2, 0x586068, 0.9).lineBetween(tr.x, tr.pivotY, bx, by);
        tr.g.fillStyle(0x282a2e, 1).fillCircle(tr.x, tr.pivotY, 4);
        hitTargets(bx, by, 22, tr);
      }
    }
  }

  spawnWebBolt(x, y, ang, dmg, owner = null) {
    const s = this.add.image(x, y, 'webbolt').setScale(1.1);
    this.sfx('web');
    this.projectiles.push({
      sprite: s, x, y, vx: Math.cos(ang) * 290, vy: Math.sin(ang) * 290, dmg, owner, hostile: true, slow: 1600, life: 1800, r: 7,
    });
  }

  spawnOrbLoot(x, y, kind) {
    const isHp = kind === 'hp';
    const tex = isHp ? 'orb_hp' : 'orb_mp';
    const col = isHp ? 0xff3040 : 0x3080ff;
    const s = this.add.image(x, y - 20, tex).setDepth(y).setScale(1.1);
    const glow = this.add.image(x, y, 'glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setScale(0.45).setAlpha(0.6).setDepth(2);
    this.tweens.add({ targets: s, y, duration: 350, ease: 'Bounce.Out' });
    const l = {
      kind: 'orb', sprite: s, glow, x, y, t: 0,
      update: (d, dt, i) => {
        if (d < 85 && l.t > 350 && !this.player.dead) {
          const k = Math.min(1, (dt / 1000) * 8);
          l.x += (this.player.fx - l.x) * k; l.y += (this.player.fy - l.y) * k;
          s.setPosition(l.x, l.y);
          glow.setPosition(l.x, l.y);
        }
        if (d < 40 && l.t > 350 && !this.player.dead) {
          if (this.lootTarget === l) this.lootTarget = null;
          const st = getStats();
          if (isHp) {
            const val = Math.round(st.maxHp * 0.18);
            state.hp = Math.min(st.maxHp, state.hp + val);
            this.floatText(this.player.fx, this.player.topY - 6, `+${val} 生命`, '#ff6070', 16);
          } else {
            const val = Math.round(st.maxMp * 0.22);
            state.mp = Math.min(st.maxMp, state.mp + val);
            this.floatText(this.player.fx, this.player.topY - 6, `+${val} 法力`, '#70a0ff', 16);
          }
          this.sfx('heal');
          s.destroy(); glow.destroy();
          this.loot.splice(i, 1);
        }
      },
    };
    this.loot.push(l);
  }

  populate() {
    const d = this.dungeon;
    const biome = d.biome;
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    d.rooms.forEach((room, i) => {
      if (i === 0) return;
      const lvl = (this.floor - 1) * 2 + 1 + Math.floor(i * 0.7);
      const list = [];
      let roomAggroDist = null;
      if (room.boss) {
        this.bossRoom = room;
        list.push(pick(biome.pool), pick(biome.pool), pick(biome.pool), pick(biome.pool));
      } else if (this.floor === 1 && i === 1) {
        // 第 1 層入口首戰門檻緩衝：2~3 隻基礎怪、無遠程偷襲或精英
        const starterPool = ['skeleton', 'skeleton', 'bat'];
        const n = rand(2, 3);
        for (let k = 0; k < n; k++) list.push(pick(starterPool));
        roomAggroDist = 255;
      } else if (this.floor === 1 && i === 2) {
        const earlyPool = ['skeleton', 'archer', 'bat'];
        for (let k = 0; k < 3; k++) list.push(pick(earlyPool));
      } else {
        const baseMin = this.floor === 1 && i === 3 ? 2 : 3;
        const baseMax = this.floor === 1 && i === 3 ? 4 : 5;
        const n = rand(baseMin, baseMax) + Math.floor(i / 4) + (room.branch ? 1 : 0);
        for (let k = 0; k < n; k++) list.push(pick(biome.pool));
        const allowElite1 = room.branch ? (this.floor > 1 || (room.parent >= 2)) : i >= (this.floor === 1 ? 4 : 3);
        if (allowElite1) list.push(pick(biome.elites));
        if (!room.branch && this.floor > 1 && i >= 6) list.push(pick(biome.elites));
      }
      for (const type of list) {
        const p = d.randomFloorInRoom(room, (room.boss || type === 'gargoyle') ? 2 : 1);
        const en = this.spawnEnemy(type, p.x, p.y, this.floor === 1 && i === 1 ? 1 : lvl);
        if (roomAggroDist) en.aggroDist = roomAggroDist;
      }
    });
    const br = this.bossRoom;
    const parentRoom = br.parent >= 0 ? d.rooms[br.parent] : null;
    let btx = br.cx;
    let bty = br.cy;
    if (parentRoom) {
      const dxR = br.cx - parentRoom.cx;
      const dyR = br.cy - parentRoom.cy;
      if (Math.abs(dxR) >= Math.abs(dyR)) {
        btx = br.cx + (dxR >= 0 ? 2 : -2);
      } else {
        bty = br.cy + (dyR >= 0 ? 1 : -1);
      }
    }
    btx = Phaser.Math.Clamp(btx, br.x + 6, br.x + br.w - 7);
    bty = Phaser.Math.Clamp(bty, br.y + 6, br.y + br.h - 6);
    const bossX = btx * TILE + TILE / 2;
    const bossY = bty * TILE + TILE / 2;
    this.boss = new Boss(this, bossX, bossY, this.floor, biome.bossType);
    this.enemies.push(this.boss);
    this.bossWallCollider = this.physics.add.collider(this.boss.sprite, this.layer);
    this.physics.add.collider(this.boss.sprite, this.enemyGroup);
    this.bossActive = false;
  }

  startBossFight() {
    this.bossActive = true;
    this.boss.activate();
    this.sfx('roar');
    this.cameras.main.shake(700, 0.01);
    this.cameras.main.flash(300, 80, 0, 60);
    this.game.events.emit('bossStart');
    for (const e of this.enemies) if (!e.dead && this.dungeon.roomAt(e.fx, e.fy) === this.bossRoom) e.aggro = true;
  }

  bossDefeated(b) {
    const bossX = b.fx, bossY = b.fy;
    this.bossActive = false;
    this.victoryPending = true;
    this.game.events.emit('bossEnd');
    for (const pr of this.projectiles.slice()) {
      if (pr.hostile) this.removeProjectile(pr);
    }
    this.cameras.main.shake(1200, 0.012);
    this.cameras.main.flash(600, 255, 200, 120);
    this.sfx('explode');
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 200, () => {
        this.burst(bossX + rand(-50, 50), bossY - rand(0, 80), 30, [0xa040ff, 0xff6000, 0xffd060], 260, 700);
        this.sfx('explode');
      });
    }
    for (const e of this.enemies.slice()) {
      if (!e.dead && !e.isBoss && this.dungeon.roomAt(e.fx, e.fy) === this.bossRoom) {
        this.time.delayedCall(rand(200, 900), () => {
          if (!e.dead && e.sprite && e.sprite.active) this.killEnemy(e);
        });
      }
    }

    state.clearedFloors++;
    state.maxFloor = Math.max(state.maxFloor, this.floor + 1);
    saveGame();
    this.msg(`第 ${this.floor} 層通關！已解鎖第 ${this.floor + 1} 層！`, '#ffd060');
    this.time.delayedCall(1200, () => this.sfx('victory'));
    this.time.delayedCall(1500, () => {
      if (this.player.dead) return;
      this.victoryPending = false;
      const bx = this.bossRoom.cx * TILE + TILE / 2, by = this.bossRoom.cy * TILE + TILE / 2;
      this.createPortalProp(bx - 120, by, 0xf0c040, '返回餘燼村 [T]', () => this.enterVillage());
      this.createPortalProp(bx + 120, by, 0xb040ff, `前往第 ${this.floor + 1} 層（無盡深淵）`, () => this.enterFloor(this.floor + 1));
    });
  }

  spawnOrb(x, y, ang, dmg, tex = 'orb', owner = null) {
    const s = this.add.image(x, y, tex).setScale(1.1).setBlendMode(Phaser.BlendModes.ADD);
    this.projectiles.push({
      sprite: s, x, y, vx: Math.cos(ang) * 230, vy: Math.sin(ang) * 230, dmg, owner, hostile: true, life: 3200, r: 9, light: 70,
      onUpdate: (pr) => pr.sprite.setScale(1 + Math.sin(this.time.now * 0.02) * 0.15),
    });
  }

  spawnIceBolt(x, y, ang, dmg, owner = null) {
    const s = this.add.image(x, y, 'icebolt').setScale(1.05).setBlendMode(Phaser.BlendModes.ADD);
    this.sfx('frost');
    this.projectiles.push({
      sprite: s, x, y, vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, dmg, owner, hostile: true, slow: 1800, life: 2800, r: 8, light: 65,
    });
  }

  telegraph(x, y, r, delay, onFire, tint = 0xa020ff, ignoreBossDead = false) {
    const ring = this.add.circle(x, y, r, tint, 0.12).setStrokeStyle(2, tint, 0.9).setDepth(3);
    const fill = this.add.circle(x, y, r, tint, 0.3).setDepth(3).setScale(0.05);
    this.tweens.add({
      targets: fill, scale: 1, duration: delay, ease: 'Quad.In',
      onComplete: () => {
        ring.destroy(); fill.destroy();
        if (this.player.dead || this.victoryPending) return;
        if (!ignoreBossDead && (!this.boss || this.boss.dead)) return;
        this.slamEffect(x, y, r);
        const g = this.add.image(x, y, 'glow').setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setScale((r * 2.4) / 128).setDepth(9200);
        this.tweens.add({ targets: g, alpha: 0, duration: 400, onComplete: () => g.destroy() });
        onFire();
      },
    });
  }

  spawnEnemy(type, x, y, lvl) {
    const e = new Enemy(this, type, x, y, lvl);
    this.enemies.push(e);
    this.enemyGroup.add(e.sprite);
    e.syncBody();
    return e;
  }

  // =========================================================== 輸入
  setupInput() {
    const kb = this.input.keyboard;
    kb.addCapture(['SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT']);
    this.moveKeys = kb.addKeys({
      w: 'W', a: 'A', s: 'S', d: 'D',
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
    });
    this.input.on('pointerdown', (p) => {
      if (typeof document !== 'undefined' && document.activeElement?.blur) document.activeElement.blur();
      Sfx.init();
      Sfx.startAmbient();
      if (this.player.dead || this.victoryPending || this.transitioning) return;
      if (p.y >= VH - 92) return;
      const ui = this.scene.get('UI');
      if (ui && (ui.activeModal || ui.isPointerOverHud(p))) return;
      if (p.rightButtonDown()) { this.tryDodge(); return; }
      if (p.leftButtonDown() || p.wasTouch) {
        this.movePointerId = p.id;
        this.onLeftClick(p);
      }
    });
    this.input.on('pointerup', (p) => {
      if (this.movePointerId === null || p.id === this.movePointerId) {
        this.holdMove = false;
        this.movePointerId = null;
      }
    });
    kb.on('keydown-SPACE', (ev) => {
      ev?.preventDefault?.();
      const ui = this.scene.get('UI');
      if (ui && ui.activeModal) return;
      this.tryDodge();
    });
    kb.on('keydown-ONE', () => this.castSlot(0));
    kb.on('keydown-TWO', () => this.castSlot(1));
    kb.on('keydown-THREE', () => this.castSlot(2));
    kb.on('keydown-FOUR', () => this.castSlot(3));
    kb.on('keydown-FIVE', () => this.castSlot(4));
    kb.on('keydown-NUMPAD_ONE', () => this.castSlot(0));
    kb.on('keydown-NUMPAD_TWO', () => this.castSlot(1));
    kb.on('keydown-NUMPAD_THREE', () => this.castSlot(2));
    kb.on('keydown-NUMPAD_FOUR', () => this.castSlot(3));
    kb.on('keydown-NUMPAD_FIVE', () => this.castSlot(4));
    kb.on('keydown-F', () => this.interactNearest());
    kb.on('keydown-T', () => { if (this.mode === 'dungeon') this.enterVillage(); });
    kb.on('keydown-G', () => { if (this.mode === 'village') { this.sfx('portal'); this.game.events.emit('openPortal'); } });
    kb.on('keydown-M', () => {
      const m = Sfx.toggleMute();
      this.msg(m ? '音效：關閉' : '音效：開啟', '#aaaaaa');
    });
    kb.on('keydown-V', () => this.toggleVfx());
  }

  toggleVfx() {
    const next = setVfxEnabled(!state.vfxEnabled);
    this.vfx?.applyEnabledState(next);
    this.msg(next ? '戰鬥特效：開啟' : '戰鬥特效：關閉（省電模式）', next ? '#ffd880' : '#aaaaaa');
    return next;
  }

  getNearestInteractable(maxDist = 145) {
    if (!this.player || this.player.dead) return null;
    let best = null, bd = maxDist;
    for (const it of this.interactables) {
      const d = Math.hypot(it.x - this.player.fx, it.y - this.player.fy);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  interactNearest() {
    const best = this.getNearestInteractable(145);
    if (best) best.onUse();
  }

  pointerWorld(p = this.input.activePointer) {
    return { x: p.x + this.cameras.main.scrollX, y: p.y + this.cameras.main.scrollY };
  }

  getAimWorld(maxRange = 420, preferMoveDir = false) {
    if (!this._smartAim) return this.pointerWorld();
    const p = this.player;
    const joyMag = Math.hypot(p.joyVec.x, p.joyVec.y);
    if (preferMoveDir && joyMag > 0.15) {
      const ang = Math.atan2(p.joyVec.y, p.joyVec.x);
      const dist = Math.min(maxRange, 220);
      return { x: p.fx + Math.cos(ang) * dist, y: p.fy + Math.sin(ang) * dist };
    }
    if (!preferMoveDir) {
      if (this.attackTarget && !this.attackTarget.dead && Math.hypot(this.attackTarget.fx - p.fx, this.attackTarget.fy - p.fy) <= maxRange + 80) {
        return { x: this.attackTarget.fx, y: this.attackTarget.fy };
      }
      let best = null, bd = maxRange;
      for (const e of this.enemies) {
        if (e.dead || e.isDummy) continue;
        const d = Math.hypot(e.fx - p.fx, e.fy - p.fy);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) {
        for (const e of this.enemies) {
          if (e.dead || !e.isDummy) continue;
          const d = Math.hypot(e.fx - p.fx, e.fy - p.fy);
          if (d < Math.min(maxRange, 320)) { bd = d; best = e; }
        }
      }
      if (best) return { x: best.fx, y: best.fy };
    }
    if (joyMag > 0.15) {
      const ang = Math.atan2(p.joyVec.y, p.joyVec.x);
      return { x: p.fx + Math.cos(ang) * 200, y: p.fy + Math.sin(ang) * 200 };
    }
    const ang = Number.isFinite(p.lastMoveAngle) ? p.lastMoveAngle : (p.facing >= 0 ? 0 : Math.PI);
    return { x: p.fx + Math.cos(ang) * 200, y: p.fy + Math.sin(ang) * 200 };
  }

  enemyAt(wx, wy) {
    let best = null, bd = 1e9;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const halfW = e.T.w * 0.5 + 12;
      const halfH = e.T.h * 0.5 + 10;
      if (Math.abs(wx - e.sprite.x) <= halfW && Math.abs(wy - e.sprite.y) <= halfH) {
        const d = Math.hypot(e.sprite.x - wx, e.sprite.y - wy);
        if (d < bd) { bd = d; best = e; }
      }
    }
    return best;
  }

  hitLabel(obj, wx, wy, pad = 6) {
    if (!obj || !obj.active || !obj.visible || !obj.getBounds) return false;
    const b = obj.getBounds();
    return wx >= b.left - pad && wx <= b.right + pad && wy >= b.top - pad && wy <= b.bottom + pad;
  }

  onLeftClick(p = this.input.activePointer) {
    const w = this.pointerWorld(p);
    // 優先檢查可互動物件（含其浮動文字標籤）
    const inter = this.interactables.find((it) => Math.hypot(it.x - w.x, it.y - w.y) <= it.r + 24 || this.hitLabel(it.label, w.x, w.y, 6));
    if (inter) {
      this.attackTarget = null;
      this.lootTarget = null;
      this.propTarget = null;
      this.holdMove = false;
      const useDist = Math.max(115, inter.r + 68);
      if (Math.hypot(inter.x - this.player.fx, inter.y - this.player.fy) <= useDist) {
        inter.onUse();
      } else {
        this.interactTarget = inter;
        this.moveTo(inter.x, inter.y, true);
      }
      return;
    }

    const e = this.enemyAt(w.x, w.y);
    if (e) {
      this.propTarget = null;
      this.interactTarget = null;
      this.lootTarget = null;
      this.attackTarget = e;
      this.chaseT = 0;
      this.holdMove = false;
      return;
    }

    const pr = this.props.find((o) => !o.dead && Math.hypot(o.x - w.x, o.y - w.y) < 28);
    if (pr) {
      this.interactTarget = null;
      this.attackTarget = null;
      this.lootTarget = null;
      this.holdMove = false;
      if (Math.hypot(pr.x - this.player.fx, pr.y - this.player.fy) <= 62) {
        this.player.startSwing(Math.atan2(pr.y - this.player.fy, pr.x - this.player.fx));
        this.smashProp(pr);
      } else {
        this.propTarget = pr;
        this.moveTo(pr.x, pr.y, true);
      }
      return;
    }

    this.propTarget = null;
    this.interactTarget = null;
    this.attackTarget = null;
    const lootHit = this.loot.find((l) => l.kind !== 'gold' && (Math.hypot(l.x - w.x, l.y - 10 - w.y) < 38 || this.hitLabel(l.label, w.x, w.y, 6)));
    if (lootHit) {
      this.holdMove = false;
      this.lootTarget = lootHit;
      this.moveTo(lootHit.x, lootHit.y, true);
      return;
    }
    this.lootTarget = null;
    this.holdMove = true;
    this.holdT = 0;
    this.moveTo(w.x, w.y, true);
  }

  moveTo(wx, wy, marker = false) {
    const p = this.player;
    if (p.dodge || p.dash || this.whirl) return;
    const path = this.pf.worldPath(p.fx, p.fy, wx, wy, PLAYER_R + 2, 8000, true);
    if (path && path.length) {
      p.setPath(path);
      if (marker) this.clickMarker(path[path.length - 1].x, path[path.length - 1].y);
    }
  }

  repathStrict(dest) {
    const p = this.player;
    if (!dest || p.dead || p.dodge || p.dash || this.whirl) return;
    const strict = this.pf.worldPath(p.fx, p.fy, dest.x, dest.y, PLAYER_R + 2, 8000, false);
    if (strict && strict.length) {
      p.path = strict;
      p.stuckT = 0;
    }
  }

  clickMarker(x, y) {
    const c = this.add.circle(x, y, 10).setStrokeStyle(2, 0xd09040, 0.9).setDepth(3);
    this.tweens.add({ targets: c, scale: 0.2, alpha: 0, duration: 400, onComplete: () => c.destroy() });
  }

  grantShadowCrit(s = getStats()) {
    if (!s.setEffects?.dodgeCrit || !state.buffs) return;
    state.buffs.shadowCrit = 4000;
    this.floatText(this.player.fx, this.player.topY - 18, '影殺必爆！', '#ff7090', 16);
  }

  consumeShadowCrit(s = getStats()) {
    if (!s.setEffects?.dodgeCrit || !state.buffs || state.buffs.shadowCrit <= 0) return false;
    state.buffs.shadowCrit = 0;
    return true;
  }

  tryDodge(opt = {}) {
    const p = this.player;
    if (p.dead || p.dodge || p.dash || this.transitioning) return;
    if (p.dodgeCd > 0) { this.sfx('denied'); return; }
    let ang;
    const keyMag = Math.hypot(p.keyVec.x, p.keyVec.y);
    if (!opt.smartAim && keyMag > 0.1) {
      ang = Math.atan2(p.keyVec.y, p.keyVec.x);
    } else {
      const prev = this._smartAim;
      this._smartAim = !!opt.smartAim;
      const w = this.getAimWorld(200, true);
      this._smartAim = prev;
      ang = Math.atan2(w.y - p.fy, w.x - p.fx);
    }
    const s = getStats();
    const dcd = Math.round(1200 * (1 - s.dodgeCdr));
    p.startDodge(ang);
    p.dodgeCd = dcd;
    p.dodgeMaxCd = dcd;
    p.invuln = 300;
    this.attackTarget = null;
    this.interactTarget = null;
    this.lootTarget = null;
    this.holdMove = false;
    this.sfx('dodge');
    this.vfx.playDodge(p, ang);
    this.grantShadowCrit(s);
    const ghostCount = state.vfxEnabled ? 3 : 1;
    for (let i = 1; i <= ghostCount; i++) {
      this.time.delayedCall(i * 60, () => {
        if (!p.sprite.active) return;
        const g = this.add.image(p.sprite.x, p.sprite.y, p.sprite.texture.key).setAlpha(0.4).setTint(0x80c0ff).setFlipX(p.facing < 0).setDepth(p.fy - 1);
        this.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
      });
    }
  }

  // =========================================================== 戰鬥
  attackNearest() {
    const p = this.player;
    if (p.dead || p.dodge || p.dash || this.whirl || this.transitioning) return;
    const joyMoving = Math.hypot(p.joyVec.x, p.joyVec.y) > 0.08;

    let target = this.attackTarget && !this.attackTarget.dead && Math.hypot(this.attackTarget.fx - p.fx, this.attackTarget.fy - p.fy) <= 420
      ? this.attackTarget
      : null;
    if (!target) {
      let bd = 360;
      for (const e of this.enemies) {
        if (e.dead || e.isDummy) continue;
        const d = Math.hypot(e.fx - p.fx, e.fy - p.fy);
        if (d < bd) { bd = d; target = e; }
      }
      if (!target) {
        bd = 240;
        for (const e of this.enemies) {
          if (e.dead || !e.isDummy) continue;
          const d = Math.hypot(e.fx - p.fx, e.fy - p.fy);
          if (d < bd) { bd = d; target = e; }
        }
      }
    }

    if (target) {
      const gap = Math.hypot(target.fx - p.fx, target.fy - p.fy) - target.T.r - PLAYER_R;
      if (gap <= 44 || (joyMoving && gap <= 70)) {
        p.facing = target.fx >= p.fx ? 1 : -1;
        if (p.attackCd <= 0) this.playerAttack(target);
        return;
      }
      if (!joyMoving) {
        this.attackTarget = target;
        this.interactTarget = null;
        this.propTarget = null;
        this.chaseT = 0;
        return;
      }
    }

    const nearProp = this.props.find((pr) => !pr.dead && Math.hypot(pr.x - p.fx, pr.y - p.fy) <= 85);
    if (nearProp && p.attackCd <= 0) {
      const ang = Math.atan2(nearProp.y - p.fy, nearProp.x - p.fx);
      const s0 = getStats();
      p.startSwing(ang);
      p.attackCd = Math.max(200, Math.round(520 / (1 + s0.atkSpeed)));
      this.sfx('swing');
      this.smashProp(nearProp);
      return;
    }

    if (p.attackCd <= 0) {
      const s0 = getStats();
      const ang = joyMoving
        ? Math.atan2(p.joyVec.y, p.joyVec.x)
        : (Number.isFinite(p.lastMoveAngle) ? p.lastMoveAngle : (p.facing >= 0 ? 0 : Math.PI));
      p.startSwing(ang);
      p.attackCd = Math.max(200, Math.round(520 / (1 + s0.atkSpeed)));
      this.sfx('swing');
      const reach = p.usesCustomArt ? 28 : 22;
      const startScale = p.usesCustomArt ? 0.72 : 0.55;
      const endScale = p.usesCustomArt ? 0.9 : 0.7;
      const sx = p.fx + Math.cos(ang) * reach, sy = p.sprite.y + Math.sin(ang) * reach;
      const sl = this.add.image(sx, sy, 'slash').setRotation(ang).setScale(startScale).setTint(0xffe0b0)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(p.fy + 2).setAlpha(0.9);
      this.tweens.add({ targets: sl, alpha: 0, scale: endScale, duration: 200, onComplete: () => sl.destroy() });
      this.smashPropsInRadius(sx, p.fy + Math.sin(ang) * 20, 42);
    }
  }
  playerAttack(e) {
    const p = this.player;
    const s0 = getStats();
    const ang = Math.atan2(e.fy - p.fy, e.fx - p.fx);
    p.startSwing(ang);
    p.attackCd = Math.max(200, Math.round(520 / (1 + s0.atkSpeed)));
    this.sfx('swing');
    const reach = p.usesCustomArt ? 28 : 22;
    const startScale = p.usesCustomArt ? 0.72 : 0.55;
    const endScale = p.usesCustomArt ? 0.9 : 0.7;
    const sx = p.fx + Math.cos(ang) * reach, sy = p.sprite.y + Math.sin(ang) * reach;
    const sl = this.add.image(sx, sy, 'slash').setRotation(ang).setScale(startScale).setTint(0xffe0b0)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(p.fy + 2).setAlpha(0.9);
    this.tweens.add({ targets: sl, alpha: 0, scale: endScale, duration: 200, onComplete: () => sl.destroy() });
    this.time.delayedCall(110, () => {
      if (p.dead) return;
      this.smashPropsInRadius(sx, p.fy + Math.sin(ang) * 20, 32);
      if (e.dead) return;
      const gap = Math.hypot(e.fx - p.fx, e.fy - p.fy) - e.T.r - PLAYER_R;
      if (gap > 50) return;
      const s = getStats();
      const shadow = this.consumeShadowCrit(s);
      const crit = shadow || Math.random() < s.critChance;
      let dmg = s.attack * (0.85 + Math.random() * 0.3);
      if (crit) dmg *= s.critDmg * (shadow ? 1.5 : 1);
      if (shadow) this.floatText(e.fx, e.sprite.y - e.T.h / 2 - 22, '影殺爆擊！', '#ff7090', 16);
      this.damageEnemy(e, Math.max(1, Math.round(dmg)), {
        crit,
        isBasicAttack: true,
        kx: e.fx - p.fx,
        ky: e.fy - p.fy,
        force: crit ? 205 : 175,
      });
    });
  }

  damageEnemy(e, amount, opt = {}) {
    if (e.dead) return;
    if (e.isDummy && state.tutorial && !state.tutorial.dummyDone) {
      state.tutorial.dummyDone = true;
      this.updateTutorialVisuals();
      saveGame();
    }
    if (!e.isDummy) e.hp -= amount;
    e.aggro = true;
    if (e.isBoss && !this.bossActive) this.startBossFight();
    e.flash(0xffffff, 100);
    if (opt.kx !== undefined) e.knockback(opt.kx, opt.ky, opt.force || 150);
    const color = opt.color || (opt.crit ? '#ffd030' : '#ffffff');
    this.floatText(e.fx + rand(-8, 8), e.sprite.y - e.T.h / 2, opt.crit ? `${amount}!` : `${amount}`, color, opt.crit ? 26 : 19);
    this.sfx(opt.crit ? 'crit' : 'hit');
    if (opt.isBasicAttack) {
      const hitAng = Math.atan2(
        opt.ky !== undefined ? opt.ky : (e.fy - this.player.fy),
        opt.kx !== undefined ? opt.kx : (e.fx - this.player.fx)
      );
      this.vfx.playBasicHit(e.fx, e.sprite.y - 4, hitAng, {
        crit: !!opt.crit,
        isDummy: !!e.isDummy,
        isBoss: !!e.isBoss,
      });
    }
    const debrisCount = opt.isBasicAttack ? (opt.crit ? 5 : 3) : (opt.crit ? 10 : 5);
    this.bloodBurst(e.fx, e.sprite.y, debrisCount, e.isDummy ? 0xc09850 : e.isBoss ? 0x9020c0 : e.type === 'gargoyle' || e.type === 'golem' ? 0x8a9095 : 0xcfc6a8);

    const s = getStats();
    if (!e.isDummy && amount > 0 && !this.player.dead) {
      if (!opt.isThorns && s.lifesteal > 0) {
        this.lifestealPool += amount * s.lifesteal;
        if (this.lifestealPool >= 1) {
          const heal = Math.floor(this.lifestealPool);
          this.lifestealPool -= heal;
          state.hp = Math.min(s.maxHp, state.hp + heal);
          if (this.time.now > this.lifestealMsgT) {
            this.lifestealMsgT = this.time.now + 380;
            this.floatText(this.player.fx, this.player.topY - 6, `+${heal}`, '#ff5070', 14);
          }
        }
      }
      if (!opt.isProc && !opt.isAura && !opt.isThorns && s.chainProc > 0 && Math.random() < s.chainProc) {
        this.triggerChainProc(e, Math.max(2, Math.round(amount * 0.45)));
      }
    }

    if (!e.isDummy && e.hp <= 0) this.killEnemy(e);
  }

  triggerChainProc(origin, dmg) {
    let lx = origin.fx, ly = origin.sprite.y;
    const hit = new Set([origin]);
    const pts = [{ x: lx, y: ly }];
    for (let j = 0; j < 2; j++) {
      let next = null, nd = 180;
      for (const e of this.enemies) {
        if (e.dead || e.isDummy || hit.has(e)) continue;
        const d = Math.hypot(e.fx - lx, e.fy - ly);
        if (d < nd) { nd = d; next = e; }
      }
      if (!next) break;
      hit.add(next);
      pts.push({ x: next.fx, y: next.sprite.y });
      this.damageEnemy(next, dmg, { color: '#80f0ff', isProc: true });
      lx = next.fx; ly = next.fy;
    }
    if (pts.length > 1) {
      this.sfx('lightning');
      this.vfx.playChainLightning(pts, { isProc: true });
    }
  }

  killEnemy(e) {
    if (e.dead || e.isDummy) return;
    e.dead = true;
    this.enemiesDirty = true;
    state.kills++;
    if (this.attackTarget === e) this.attackTarget = null;
    this.sfx('enemyDie');
    if (e.sprite && e.sprite.body) e.sprite.body.enable = false;
    e.destroyVisuals();
    this.tweens.add({
      targets: e.sprite, alpha: 0, angle: e.facing * 80, scaleY: 0.4, y: e.sprite.y + 10, duration: 450,
      onComplete: () => { if (e.sprite && e.sprite.active) e.sprite.destroy(); },
    });
    this.add.image(e.fx, e.fy, 'bones').setDepth(1).setAlpha(0.9).setAngle(rand(-40, 40));
    this.add.image(e.fx, e.fy, 'blood' + rand(0, 2)).setDepth(1).setAlpha(0.8);

    if (e.T.deathBoom) {
      const boomR = e.T.deathBoom, bx = e.fx, by = e.fy, bdmg = e.dmg * 1.4;
      this.telegraph(bx, by, boomR, 650, () => {
        if (Math.hypot(this.player.fx - bx, this.player.fy - by) < boomR + PLAYER_R) {
          this.hurtPlayer(bdmg, bx, by);
        }
      }, 0xff5010, true);
    }

    this.onEnemyKilled(e);
    if (e.isBoss) this.bossDefeated(e);
  }

  onEnemyKilled(e) {
    if (e.isDummy) return;
    const s = getStats();

    // 深淵疫主 4 件套效果：擊殺縮短所有技能冷卻 1 秒，受毒霧／靈魂收割影響敵人擴散新毒霧
    if (s.setEffects?.plagueSpread) {
      for (const k in this.skillCd) {
        if (this.skillCd[k] > 0) this.skillCd[k] = Math.max(0, this.skillCd[k] - 1000);
      }
      if ((e.plagueUntil || 0) > this.time.now && this.groundEffects.length < 6) {
        const pdmg = Math.max(6, Math.round((8 + s.int * 1.1 + state.level * 1.3) * s.spellPower));
        const tx = e.fx, ty = e.fy, R = 105;
        this.sfx('poison');
        this.vfx.spawnRing(tx, ty, R, 0x78ff40, { depth: 3, alpha: state.vfxEnabled ? 0.72 : 0.4, duration: 360 });
        this.floatText(tx, ty - 28, '瘟疫擴散！', '#78ff70', 16);
        for (const oe of this.enemies.slice()) {
          if (oe.dead || oe.isDummy) continue;
          if (Math.hypot(oe.fx - tx, oe.fy - ty) <= R + oe.T.r) {
            oe.applySlow(1200);
            oe.plagueUntil = this.time.now + 5500;
            this.damageEnemy(oe, Math.round(pdmg * 1.5), { color: '#78ff70', isProc: true });
          }
        }
        const pVis = this.vfx.createPoisonCloudVisuals(tx, ty, R);
        this.groundEffects.push({ x: tx, y: ty, r: R, t: 0, tickT: 500, dur: 3500, dmg: pdmg, visuals: pVis.visuals, vortex: pVis.vortex, vfxT: 0 });
      }
    }

    const ups = addXp(e.xp);
    this.floatText(e.fx, e.sprite.y - 40, `+${e.xp} 經驗`, '#b080ff', 14);
    if (ups) this.onLevelUp();

    if (!this.player.dead) {
      if (s.onKillHp > 0) {
        state.hp = Math.min(s.maxHp, state.hp + s.onKillHp);
        this.floatText(this.player.fx, this.player.topY - 6, `+${s.onKillHp}`, '#60ff70', 14);
      }
      if (s.onKillMp > 0) {
        state.mp = Math.min(s.maxMp, state.mp + s.onKillMp);
      }
    }

    const diff = getDifficulty(state.difficulty);

    if (Math.random() < 0.78 || e.T.elite) {
      const g = Math.max(1, Math.round(rand(e.T.gold[0], e.T.gold[1]) * (1 + e.lvl * 0.25) * (1 + s.goldFind) * diff.goldMul));
      this.spawnGold(e.fx + rand(-12, 12), e.fy + rand(-8, 8), g);
    }

    // 餘燼石與套裝精華掉落
    if (e.isBoss || e.T.elite) {
      const bonus = e.isBoss ? diff.shardBonus : (diff.shardBonus > 0 && Math.random() < 0.5 ? 1 : 0);
      const shards = (e.isBoss ? 3 + Math.floor(this.floor / 2) : rand(1, 2)) + bonus;
      state.shards += shards;
      this.floatText(e.fx, e.sprite.y - 60, `+${shards} 餘燼石`, '#ff88ff', 15);
      if (e.isBoss) {
        state.setEssence = (state.setEssence || 0) + 1;
        this.floatText(e.fx, e.sprite.y - 82, '+1 套裝精華', '#38f288', 15);
      }
    }

    const mf = s.magicFind || 0;

    // 裝備掉落
    const dropChance = e.isBoss ? 1 : Math.min(0.85, e.T.drop * (1 + mf * 0.5));
    let drops = e.isBoss ? 3 : Math.random() < dropChance ? 1 : 0;
    if (e.isBoss && mf >= 0.5 && Math.random() < mf * 0.45) drops++;
    const qualBonus = Math.min(0.45, (e.T.elite ? 0.30 : 0) + mf * 0.16);
    const ilvl = Math.max(1, this.floor * 2 - 1 + Math.floor(e.lvl * 0.4));
    for (let k = 0; k < drops; k++) {
      const spChance = Math.min(0.65, 0.35 + mf * 0.12);
      const qual = e.isBoss ? (k === 0 && Math.random() < spChance ? 'special' : k < 2 ? 'gold' : 'blue') : null;
      const item = generateItem(ilvl + (e.isBoss ? 2 : 0), qualBonus, qual);
      this.spawnItem(e.fx + rand(-30, 30), e.fy + rand(-20, 20), item);
    }

    // 頭目定向套裝掉落 & 精英稀有套裝掉落
    if (e.isBoss) {
      const bossSetChance = Math.min(0.92, 0.65 + mf * 0.15);
      if (Math.random() < bossSetChance) {
        const setId = getBossSetId(e.bossType);
        const owned = new Set();
        for (const slot of Object.keys(state.equipment)) {
          if (state.equipment[slot]?.setId === setId) owned.add(slot);
        }
        for (const it of state.inventory) {
          if (it?.setId === setId) owned.add(it.slot);
        }
        const setItem = generateSetItem(setId, ilvl + 2, null, owned);
        this.spawnItem(e.fx + rand(-28, 28), e.fy + rand(8, 28), setItem);
      }
    } else if (e.T.elite && Math.random() < Math.min(0.22, 0.10 * (1 + mf * 0.4))) {
      this.spawnItem(e.fx + rand(-24, 24), e.fy + rand(-12, 20), generateSetItem(null, ilvl));
    }

    // 技能書掉落
    const bookChance = e.isBoss ? 1 : Math.min(0.45, ((e.T.bookDrop || 0.03) + this.floor * 0.005) * (1 + mf * 0.45));
    if (Math.random() < bookChance) {
      this.spawnItem(e.fx + rand(-26, 26), e.fy + rand(-18, 18), generateSkillBook());
    }

    // 符文掉落（調低機率並受掉寶率與難度加成）
    const runeCount = e.isBoss
      ? 1 + (Math.random() < Math.min(0.85, (0.15 + mf * 0.4) * diff.runeMul) ? 1 : 0)
      : Math.random() < (e.T.elite ? Math.min(0.55, 0.18 * (1 + mf * 0.65) * diff.runeMul) : Math.min(0.18, 0.035 * (1 + mf * 0.65) * diff.runeMul))
        ? 1
        : 0;
    for (let k = 0; k < runeCount; k++) {
      this.spawnRune(e.fx + rand(-24, 24), e.fy + rand(-16, 16), rollRandomRune(this.floor));
    }
  }

  // =========================================================== 17 大技能
  castSlot(slotIdx, opt = {}) {
    const p = this.player;
    if (p.dead || p.dodge || p.dash || this.whirl || this.transitioning) return;
    const skillId = state.skillBar[slotIdx];
    if (!skillId) return;
    const lv = getEffectiveSkillLevel(skillId);
    if (!lv) return;
    const s = getStats();
    const sk = getSkillData(skillId, lv, { cdr: s.cdr, manaCostRed: s.manaCostRed });
    if (!sk) return;
    if ((this.skillCd[skillId] || 0) > 0) { this.sfx('denied'); return; }
    if (state.mp < sk.mp) { this.sfx('denied'); this.msg('法力不足', '#6080ff'); return; }
    state.mp -= sk.mp;
    this.skillCd[skillId] = state.buffs && state.buffs.arcane > 0 ? Math.round(sk.cd * 0.5) : sk.cd;
    const map = {
      fire: () => this.castFireball(s, sk),
      whirl: () => this.castWhirl(s, sk),
      heal: () => this.castHeal(s, sk),
      chain: () => this.castChain(s, sk),
      nova: () => this.castFrostNova(s, sk),
      dash: () => this.castShadowDash(s, sk),
      meteor: () => this.castMeteor(s, sk),
      cleave: () => this.castCleave(s, sk),
      ice_lance: () => this.castIceLance(s, sk),
      poison_cloud: () => this.castPoisonCloud(s, sk),
      holy_shield: () => this.castHolyShield(s, sk),
      blood_boil: () => this.castBloodBoil(s, sk),
      arcane_orb: () => this.castArcaneOrb(s, sk),
      blink: () => this.castBlink(s, sk),
      thunder_strike: () => this.castThunderStrike(s, sk),
      blade_storm: () => this.castBladeStorm(s, sk),
      soul_nova: () => this.castSoulNova(s, sk),
    };
    const prev = this._smartAim;
    this._smartAim = !!opt.smartAim;
    try {
      if (map[skillId]) map[skillId]();
    } finally {
      this._smartAim = prev;
    }
  }

  castFireball(s, sk) {
    const p = this.player;
    const w = this.getAimWorld(480, false);
    const sx = p.fx, sy = p.fy - 20;
    const ang = Math.atan2(w.y - sy, w.x - sx);
    p.startSwing(ang, 200);
    this.sfx('fireball');
    const fx = sx + Math.cos(ang) * 20, fy = sy + Math.sin(ang) * 20;
    const vis = this.vfx.createFireballVisuals(fx, fy, ang, false);
    const dmg = Math.round((12 + s.int * 2 + state.level * 2) * s.spellPower * sk.powerMult);
    this.projectiles.push({
      sprite: vis.sprite, tail: vis.tail, trailT: 0, pulseT: 0, isSplit: false,
      x: fx, y: fy, elev: 16, vx: Math.cos(ang) * 540, vy: Math.sin(ang) * 540, friendly: true, life: 1100, r: 10, light: 155,
      onUpdate: (pr, dt) => this.vfx.updateFireballVisuals(pr, dt),
      onHit: (pr) => this.explosion(pr.x, pr.y, 80, dmg, 'explode', { allowSplit: true, baseAng: ang }),
    });
  }

  calcCrit(s, raw, allowShadow = true) {
    const shadow = allowShadow && this.consumeShadowCrit(s);
    const crit = shadow || Math.random() < s.critChance;
    const mult = crit ? s.critDmg * (shadow ? 1.5 : 1) : 1;
    return { crit, shadow, dmg: Math.max(1, Math.round(raw * mult)) };
  }

  spawnSplitFireballs(cx, cy, baseAng, splitDmg) {
    const targets = this.enemies
      .filter((e) => !e.dead && !e.isDummy && Math.hypot(e.fx - cx, e.fy - cy) <= 320)
      .sort((a, b) => Math.hypot(a.fx - cx, a.fy - cy) - Math.hypot(b.fx - cx, b.fy - cy))
      .slice(0, 3);
    const offsets = [-0.55, 0, 0.55];
    for (let i = 0; i < 3; i++) {
      const ang = targets[i]
        ? Math.atan2(targets[i].fy - cy, targets[i].fx - cx)
        : (baseAng + offsets[i]);
      const sx = cx + Math.cos(ang) * 18;
      const sy = cy + Math.sin(ang) * 18;
      const vis = this.vfx.createFireballVisuals(sx, sy, ang, true);
      this.projectiles.push({
        sprite: vis.sprite, tail: vis.tail, trailT: 0, pulseT: 0, isSplit: true,
        x: sx, y: sy, elev: 16, vx: Math.cos(ang) * 480, vy: Math.sin(ang) * 480,
        friendly: true, life: 750, r: 7, light: 95,
        onUpdate: (pr, dt) => this.vfx.updateFireballVisuals(pr, dt),
        onHit: (pr) => this.explosion(pr.x, pr.y, 55, splitDmg, 'explode', { allowSplit: false, noShadow: true, isSplit: true }),
      });
    }
  }

  explosion(x, y, r, dmg, sfxName = 'explode', opt = {}) {
    this.sfx(sfxName);
    this.vfx.playFireballExplosion(x, y, r, { isSplit: !!opt.isSplit, isMeteor: sfxName === 'meteor' });
    this.smashPropsInRadius(x, y, r);
    this.burnWebsInRadius(x, y, r);
    const s = getStats();
    for (const e of this.enemies.slice()) {
      if (e.dead) continue;
      const d = Math.hypot(e.fx - x, e.fy - y);
      if (d < r + e.T.r) {
        const hit = this.calcCrit(s, dmg * (0.9 + Math.random() * 0.2), !opt.noShadow);
        this.damageEnemy(e, hit.dmg, { crit: hit.crit, isProc: !!opt.noShadow, color: hit.crit ? '#ffd030' : '#ff9030', kx: e.fx - x, ky: e.fy - y, force: 200 });
      }
    }
    if (opt.allowSplit && s.setEffects?.fireSplit) {
      this.spawnSplitFireballs(x, y, opt.baseAng || 0, Math.max(4, Math.round(dmg * 0.55)));
    }
  }

  castWhirl(s, sk) {
    const p = this.player;
    p.stop();
    this.attackTarget = null;
    this.sfx('whirl');
    const R = 100;
    const wVis = this.vfx.createWhirlVisuals(p.fx, p.fy, R);
    this.whirl = {
      t: 0, dur: 480, ticks: 0, dmg: s.attack * 0.9 * sk.powerMult, R,
      fx: wVis.fx, vortex: wVis.vortex, outer: wVis.outer, light: wVis.light, dustT: 0,
    };
  }

  updateWhirl(dt) {
    const w = this.whirl;
    if (!w) return;
    const p = this.player;
    w.t += dt;
    const rot = w.t * 0.03;
    this.vfx.updateWhirlVisuals(w, p, dt);
    p.sprite.setFlipX(Math.floor(w.t / 60) % 2 === 0);
    if (p.usesCustomArt) p.sprite.setAngle(Math.sin(w.t * 0.045) * 11);
    else p.sword.setRotation(rot * 1.5);
    const tickAt = [0, 160, 320];
    while (w.ticks < 3 && w.t >= tickAt[w.ticks]) {
      w.ticks++;
      this.smashPropsInRadius(p.fx, p.fy, w.R);
      const s = getStats();
      for (const e of this.enemies.slice()) {
        if (e.dead) continue;
        if (Math.hypot(e.fx - p.fx, e.fy - p.fy) < w.R + e.T.r) {
          const hit = this.calcCrit(s, w.dmg * (0.85 + Math.random() * 0.3));
          this.damageEnemy(e, hit.dmg, { crit: hit.crit, kx: e.fx - p.fx, ky: e.fy - p.fy, force: 120 });
        }
      }
    }
    if (w.t >= w.dur) {
      this.vfx.destroyWhirlVisuals(w);
      this.whirl = null;
      if (p.usesCustomArt) p.sprite.setAngle(0);
      const s = getStats();
      if (s.setEffects?.whirlQuake && !p.dead) {
        const R = 155;
        const qDmg = Math.round(s.attack * 2.2);
        this.sfx('slam');
        this.vfx.playWhirlQuake(p.fx, p.fy, R);
        this.floatText(p.fx, p.topY - 18, '震地衝擊！', '#38f288', 20);
        this.smashPropsInRadius(p.fx, p.fy, R);
        for (const e of this.enemies.slice()) {
          if (e.dead) continue;
          if (Math.hypot(e.fx - p.fx, e.fy - p.fy) <= R + e.T.r) {
            const hit = this.calcCrit(s, qDmg * (0.9 + Math.random() * 0.2), false);
            this.damageEnemy(e, hit.dmg, { crit: hit.crit, color: '#58ff98', isProc: true, kx: e.fx - p.fx, ky: e.fy - p.fy, force: 280 });
          }
        }
      }
    }
  }

  castHeal(s, sk) {
    const p = this.player;
    const amount = Math.round((s.maxHp * 0.35 + s.int * 3) * sk.powerMult);
    state.hp = Math.min(s.maxHp, state.hp + amount);
    this.sfx('heal');
    this.floatText(p.fx, p.topY - 6, `+${amount}`, '#60ff70', 24);
    this.vfx.playHeal(p);
  }

  castChain(s, sk) {
    const p = this.player;
    const w = this.getAimWorld(380, false);
    p.startSwing(Math.atan2(w.y - p.fy, w.x - p.fx), 180);
    this.sfx('lightning');

    const maxJumps = 3 + sk.level;
    const dmg = Math.round((16 + s.int * 2.1 + state.level * 2.5) * s.spellPower * sk.powerMult);
    const pts = [{ x: p.fx, y: p.sprite.y - 4 }];
    const hit = new Set();

    // 優先選游標附近 180px 且在玩家 380px 內的目標，否則選玩家附近 380px 最近敵人
    let cur = null, bd = 1e9;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.fx - p.fx, e.fy - p.fy) > 380) continue;
      const dp = Math.hypot(e.fx - w.x, e.fy - w.y);
      if (dp < bd) { bd = dp; cur = e; }
    }

    if (!cur) {
      const ang = Math.atan2(w.y - p.fy, w.x - p.fx);
      pts.push({ x: p.fx + Math.cos(ang) * 200, y: p.sprite.y + Math.sin(ang) * 200 });
    } else {
      let lx = p.fx, ly = p.fy;
      for (let j = 0; j < maxJumps && cur; j++) {
        hit.add(cur);
        pts.push({ x: cur.fx, y: cur.sprite.y });
        const ch = this.calcCrit(s, dmg * (0.9 + Math.random() * 0.2));
        this.damageEnemy(cur, ch.dmg, { crit: ch.crit, color: ch.crit ? '#ffd030' : '#70e8ff', kx: cur.fx - lx, ky: cur.fy - ly, force: 90 });
        lx = cur.fx; ly = cur.fy;
        let next = null, nd = 240;
        for (const e of this.enemies) {
          if (e.dead || hit.has(e)) continue;
          const d = Math.hypot(e.fx - lx, e.fy - ly);
          if (d < nd) { nd = d; next = e; }
        }
        cur = next;
      }
    }

    this.vfx.playChainLightning(pts);
  }

  castFrostNova(s, sk) {
    const p = this.player;
    const R = 165;
    const dmg = Math.round((14 + s.int * 1.8 + state.level * 2) * s.spellPower * sk.powerMult);
    this.sfx('frost');
    this.vfx.playFrostNova(p.fx, p.fy, R);
    this.smashPropsInRadius(p.fx, p.fy, R);
    for (const e of this.enemies.slice()) {
      if (e.dead) continue;
      if (Math.hypot(e.fx - p.fx, e.fy - p.fy) <= R + e.T.r) {
        const wasSlow = e.slowT > 0;
        e.applySlow(2800);
        const chillMul = s.setEffects?.fireSplit && wasSlow ? 1.4 : 1;
        const fh = this.calcCrit(s, dmg * chillMul * (0.9 + Math.random() * 0.2));
        this.damageEnemy(e, fh.dmg, { crit: fh.crit, color: fh.crit ? '#ffd030' : '#80e8ff', kx: e.fx - p.fx, ky: e.fy - p.fy, force: 130 });
      }
    }
  }

  castShadowDash(s, sk) {
    const p = this.player;
    const w = this.getAimWorld(280, true);
    const ang = Math.atan2(w.y - p.fy, w.x - p.fx);
    const dmg = Math.round((18 + s.attack * 1.35) * sk.powerMult);
    const hitSet = new Set();
    this.attackTarget = null;
    this.interactTarget = null;
    this.holdMove = false;
    p.invuln = 280;
    this.sfx('dash');
    this.grantShadowCrit(s);
    this.vfx.playShadowDashStart(p.fx, p.fy, ang);

    p.startDash(ang, 280, 200, (dt) => {
      this.vfx.emitShadowTrail(p.fx, p.sprite.y, ang, dt);
      this.smashPropsInRadius(p.fx, p.fy, 36);
      for (const e of this.enemies.slice()) {
        if (e.dead || hitSet.has(e)) continue;
        if (Math.hypot(e.fx - p.fx, e.fy - p.fy) < 44 + e.T.r) {
          hitSet.add(e);
          const dh = this.calcCrit(s, dmg * (0.9 + Math.random() * 0.2));
          this.damageEnemy(e, dh.dmg, { crit: dh.crit, color: dh.crit ? '#ffd030' : '#d080ff', kx: Math.cos(ang), ky: Math.sin(ang), force: 180 });
          this.vfx.playSlashImpact(e.fx, e.sprite.y, ang, 0xd080ff);
        }
      }
    });

    const ghostCount = state.vfxEnabled ? 4 : 1;
    for (let i = 0; i < ghostCount; i++) {
      this.time.delayedCall(i * 45, () => {
        if (!p.sprite.active) return;
        const g = this.add.image(p.sprite.x, p.sprite.y, p.sprite.texture.key).setAlpha(0.5).setTint(0xb050ff).setFlipX(p.facing < 0).setDepth(p.fy - 1);
        this.tweens.add({ targets: g, alpha: 0, duration: 280, onComplete: () => g.destroy() });
      });
    }
  }

  castMeteor(s, sk) {
    const p = this.player;
    const w = this.getAimWorld(420, false);
    const ang = Math.atan2(w.y - p.fy, w.x - p.fx);
    const d = Math.min(420, Math.hypot(w.x - p.fx, w.y - p.fy));
    const tx = p.fx + Math.cos(ang) * d, ty = p.fy + Math.sin(ang) * d;
    p.startSwing(ang, 220);

    const R = 125;
    const dmg = Math.round((28 + s.int * 3.0 + state.level * 3.5) * s.spellPower * sk.powerMult);
    const mVis = this.vfx.createMeteorVisuals(tx, ty, R);

    this.tweens.add({
      targets: mVis.meteor,
      x: tx,
      y: ty,
      duration: 580,
      ease: 'Quad.In',
      onUpdate: () => this.vfx.updateMeteorTrail(mVis),
      onComplete: () => {
        this.vfx.destroyMeteorVisuals(mVis);
        this.explosion(tx, ty, R, dmg, 'meteor');
      },
    });
  }

  castCleave(s, sk) {
    const p = this.player;
    const w = this.getAimWorld(180, false);
    const ang = Math.atan2(w.y - p.fy, w.x - p.fx);
    const R = 145;
    p.startSwing(ang, 240);
    this.sfx('swing');
    this.vfx.playCleave(p.fx, p.sprite.y, ang, R);
    this.smashPropsInRadius(p.fx + Math.cos(ang) * 55, p.fy + Math.sin(ang) * 55, 80);
    this.burnWebsInRadius(p.fx + Math.cos(ang) * 55, p.fy + Math.sin(ang) * 55, 80);

    const dmg = Math.round((18 + s.attack * 1.45) * sk.powerMult);
    for (const e of this.enemies.slice()) {
      if (e.dead) continue;
      const dx = e.fx - p.fx, dy = e.fy - p.fy;
      const dist = Math.hypot(dx, dy);
      if (dist > R + e.T.r) continue;
      let diff = Math.abs(Math.atan2(dy, dx) - ang);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff <= 0.96 || dist <= 36) {
        const hit = this.calcCrit(s, dmg * (0.9 + Math.random() * 0.2));
        this.damageEnemy(e, hit.dmg, { crit: hit.crit, color: hit.crit ? '#ffd030' : '#ff9040', kx: dx, ky: dy, force: 240 });
      }
    }
  }

  castIceLance(s, sk) {
    const p = this.player;
    const w = this.getAimWorld(520, false);
    const sx = p.fx, sy = p.fy - 20;
    const ang = Math.atan2(w.y - sy, w.x - sx);
    p.startSwing(ang, 180);
    this.sfx('frost');
    const ix = sx + Math.cos(ang) * 20, iy = sy + Math.sin(ang) * 20;
    const vis = this.vfx.createIceLanceVisuals(ix, iy, ang);
    const dmg = Math.round((15 + s.int * 2.0 + state.level * 2) * s.spellPower * sk.powerMult);
    const hitSet = new Set();
    this.projectiles.push({
      sprite: vis.sprite, tail: vis.tail, trailT: 0,
      x: ix, y: iy, elev: 16, vx: Math.cos(ang) * 640, vy: Math.sin(ang) * 640,
      friendly: true, pierce: true, life: 1100, r: 9, light: 80,
      onUpdate: (pr, dt) => this.vfx.updateIceLanceVisuals(pr, dt),
      onPierce: (pr, e) => {
        if (hitSet.has(e)) return;
        hitSet.add(e);
        const wasSlow = e.slowT > 0;
        e.applySlow(2200);
        const chillMul = s.setEffects?.fireSplit && wasSlow ? 1.4 : 1;
        const hit = this.calcCrit(s, dmg * chillMul * (0.9 + Math.random() * 0.2));
        this.damageEnemy(e, hit.dmg, { crit: hit.crit, color: hit.crit ? '#ffd030' : '#80e8ff', kx: pr.vx, ky: pr.vy, force: 90 });
        this.vfx.playIceLancePierce(e.fx, e.sprite.y, ang);
      },
      onHit: (pr) => this.vfx.playIceLanceEnd(pr.x, pr.y),
    });
  }

  castPoisonCloud(s, sk) {
    const p = this.player;
    const w = this.getAimWorld(380, false);
    const ang = Math.atan2(w.y - p.fy, w.x - p.fx);
    const d = Math.min(380, Math.hypot(w.x - p.fx, w.y - p.fy));
    const tx = p.fx + Math.cos(ang) * d, ty = p.fy + Math.sin(ang) * d;
    p.startSwing(ang, 200);
    this.sfx('poison');
    const R = 120;
    const dmg = Math.round((8 + s.int * 1.1 + state.level * 1.3) * s.spellPower * sk.powerMult);
    const pVis = this.vfx.createPoisonCloudVisuals(tx, ty, R);
    this.groundEffects.push({ x: tx, y: ty, r: R, t: 0, tickT: 500, dur: 4500, dmg, visuals: pVis.visuals, vortex: pVis.vortex, vfxT: 0 });
  }

  castHolyShield(s, sk) {
    const p = this.player;
    const amount = Math.round((s.maxHp * 0.30 + s.int * 4) * sk.powerMult);
    state.shield = amount;
    state.shieldMax = amount;
    state.buffs.shield = 8000;
    this.sfx('shield');
    this.floatText(p.fx, p.topY - 6, `聖光護盾 +${amount}`, '#ffe070', 20);
    this.vfx.playHolyShieldCast(p);
  }

  castBloodBoil(s, sk) {
    const p = this.player;
    state.buffs.bloodBoil = Math.round(7000 * (1 + (sk.level - 1) * 0.03));
    this.sfx('shrine');
    this.floatText(p.fx, p.topY - 6, '鮮血狂怒！', '#ff5870', 22);
    this.vfx.playBloodBoilCast(p);
  }

  castArcaneOrb(s, sk) {
    const p = this.player;
    const w = this.getAimWorld(440, false);
    const sx = p.fx, sy = p.fy - 20;
    const ang = Math.atan2(w.y - sy, w.x - sx);
    p.startSwing(ang, 200);
    this.sfx('nova');
    const ox = sx + Math.cos(ang) * 22, oy = sy + Math.sin(ang) * 22;
    const vis = this.vfx.createArcaneOrbVisuals(ox, oy);
    const dmg = Math.round((10 + s.int * 1.3 + state.level * 1.5) * s.spellPower * sk.powerMult);
    this.projectiles.push({
      sprite: vis.sprite, halo: vis.halo, trailT: 0,
      x: ox, y: oy, elev: 16, vx: Math.cos(ang) * 180, vy: Math.sin(ang) * 180,
      friendly: true, pierce: true, life: 2600, r: 14, light: 120, zapT: 0,
      onUpdate: (pr, dt) => {
        this.vfx.updateArcaneOrbVisuals(pr, dt);
        pr.zapT -= dt;
        if (pr.zapT <= 0) {
          pr.zapT = 280;
          const zapped = [];
          for (const e of this.enemies.slice()) {
            if (e.dead || zapped.length >= 3) continue;
            if (Math.hypot(e.fx - pr.x, e.fy - pr.y) <= 135 + e.T.r) {
              zapped.push({ x: e.fx, y: e.sprite.y });
              const hit = this.calcCrit(s, dmg);
              this.damageEnemy(e, hit.dmg, { crit: hit.crit, color: hit.crit ? '#ffd030' : '#d080ff', isProc: true });
            }
          }
          if (zapped.length) this.vfx.playArcaneZap(pr.x, pr.y, zapped);
        }
      },
      onHit: (pr) => {
        this.vfx.playArcaneOrbDetonate(pr.x, pr.y, 85);
        for (const e of this.enemies.slice()) {
          if (e.dead) continue;
          if (Math.hypot(e.fx - pr.x, e.fy - pr.y) <= 85 + e.T.r) {
            const hit = this.calcCrit(s, dmg * 1.4);
            this.damageEnemy(e, hit.dmg, { crit: hit.crit, color: hit.crit ? '#ffd030' : '#e098ff' });
          }
        }
      },
    });
  }

  castBlink(s, sk) {
    const p = this.player;
    const w = this.getAimWorld(240, true);
    const ang = Math.atan2(w.y - p.fy, w.x - p.fx);
    const maxDist = Math.min(260, Math.max(80, Math.hypot(w.x - p.fx, w.y - p.fy)));
    const ox = p.fx, oy = p.fy;
    let bx = ox, by = oy;
    const canStand = (x, y) => this.dungeon.walkableAt(x, y)
      && this.dungeon.walkableAt(x - 8, y) && this.dungeon.walkableAt(x + 8, y)
      && this.dungeon.walkableAt(x, y - 8) && this.dungeon.walkableAt(x, y + 8);
    for (let dist = 16; dist <= maxDist; dist += 16) {
      const tx = ox + Math.cos(ang) * dist, ty = oy + Math.sin(ang) * dist;
      if (canStand(tx, ty)) { bx = tx; by = ty; }
    }
    this.sfx('blink');
    this.grantShadowCrit(s);
    p.stop();
    p.setFootPosition(bx, by);
    p.invuln = 220;
    this.vfx.playBlink(ox, oy, bx, by, 95, p.facing < 0, p.sprite.texture.key, p.foot);
    this.smashPropsInRadius(bx, by, 75);
    const dmg = Math.round((15 + s.int * 1.7 + state.level * 2) * s.spellPower * sk.powerMult);
    for (const e of this.enemies.slice()) {
      if (e.dead) continue;
      if (Math.hypot(e.fx - bx, e.fy - by) <= 95 + e.T.r) {
        const hit = this.calcCrit(s, dmg);
        this.damageEnemy(e, hit.dmg, { crit: hit.crit, color: hit.crit ? '#ffd030' : '#d088ff', kx: e.fx - bx, ky: e.fy - by, force: 160 });
      }
    }
  }

  castThunderStrike(s, sk) {
    const p = this.player;
    const w = this.getAimWorld(360, false);
    p.startSwing(Math.atan2(w.y - p.fy, w.x - p.fx), 200);
    const count = 3 + Math.floor(sk.level / 5);
    const dmg = Math.round((20 + s.int * 2.2 + state.level * 2.5) * s.spellPower * sk.powerMult);
    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * 140, () => {
        if (p.dead) return;
        const cands = this.enemies.filter((e) => !e.dead && !e.isDummy && Math.hypot(e.fx - w.x, e.fy - w.y) <= 280);
        const pool = cands.length ? cands : this.enemies.filter((e) => !e.dead && !e.isDummy && Math.hypot(e.fx - p.fx, e.fy - p.fy) <= 360);
        let tx = w.x + rand(-60, 60), ty = w.y + rand(-60, 60);
        if (pool.length) {
          const pick = pool[rand(0, pool.length - 1)];
          tx = pick.fx; ty = pick.fy;
        }
        this.sfx('lightning');
        this.vfx.playThunderBolt(tx, ty, 70);
        this.smashPropsInRadius(tx, ty, 50);
        for (const e of this.enemies.slice()) {
          if (e.dead) continue;
          if (Math.hypot(e.fx - tx, e.fy - ty) <= 70 + e.T.r) {
            const hit = this.calcCrit(s, dmg * (0.9 + Math.random() * 0.2));
            this.damageEnemy(e, hit.dmg, { crit: hit.crit, color: hit.crit ? '#ffd030' : '#fff070' });
          }
        }
      });
    }
  }

  castBladeStorm(s, sk) {
    for (const old of this.orbitBlades) {
      old.blades.forEach((b) => b.destroy());
      if (old.orbitRing && old.orbitRing.active) old.orbitRing.destroy();
    }
    this.orbitBlades = [];
    const blades = [];
    for (let i = 0; i < 3; i++) {
      blades.push(this.add.image(this.player.fx, this.player.fy, 'sword').setOrigin(0.5, 0.85).setScale(1.1).setTint(0xc8f0ff).setDepth(9200));
    }
    this.sfx('whirl');
    const bVis = this.vfx.createBladeStormVisuals(this.player.fx, this.player.fy, 85);
    const dmg = Math.round((8 + s.attack * 0.72) * sk.powerMult);
    this.orbitBlades.push({ t: 0, dur: 5500, r: 85, dmg, hitCd: new Map(), blades, orbitRing: bVis.orbitRing, sparkT: 0 });
  }

  castSoulNova(s, sk) {
    const p = this.player;
    const R = 185;
    const dmg = Math.round((18 + s.int * 2.0 + state.level * 2.2) * s.spellPower * sk.powerMult);
    this.sfx('soul');
    this.smashPropsInRadius(p.fx, p.fy, R);
    let total = 0;
    const struckEnemies = [];
    for (const e of this.enemies.slice()) {
      if (e.dead) continue;
      if (Math.hypot(e.fx - p.fx, e.fy - p.fy) <= R + e.T.r) {
        e.plagueUntil = this.time.now + 5500;
        const hit = this.calcCrit(s, dmg * (0.9 + Math.random() * 0.2));
        total += hit.dmg;
        struckEnemies.push(e);
        this.damageEnemy(e, hit.dmg, { crit: hit.crit, color: hit.crit ? '#ffd030' : '#ff80c0', kx: e.fx - p.fx, ky: e.fy - p.fy, force: 140 });
      }
    }
    const heal = Math.round(total * 0.25);
    this.vfx.playSoulNova(p, R, struckEnemies, heal);
    if (heal > 0 && !p.dead) {
      state.hp = Math.min(s.maxHp, state.hp + heal);
      this.floatText(p.fx, p.topY - 6, `+${heal} 魂癒`, '#ff80b8', 18);
    }
  }

  // =========================================================== 裝備與技能書掉落
  spawnItem(x, y, item) {
    if (!this.dungeon.walkableAt(x, y)) { x = this.player.fx; y = this.player.fy; }
    const col = QUALITY_HEX[item.quality];
    const glow = this.add.image(x, y, 'glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6, 0.3).setAlpha(0.8).setDepth(2);
    let beam = null;
    if (item.quality !== 'white') {
      const isSet = item.quality === 'set';
      beam = this.add.image(x, y - 50, 'glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD)
        .setScale(isSet ? 0.22 : 0.18, isSet ? 1.65 : 1.4)
        .setAlpha(isSet ? 0.85 : (item.quality === 'gold' || item.quality === 'book' || item.quality === 'special' ? 0.72 : 0.42))
        .setDepth(9100);
      this.tweens.add({ targets: beam, alpha: beam.alpha * 0.5, duration: 800, yoyo: true, repeat: -1 });
    }
    const texKey = item.kind === 'book' ? 'icon_book' : 'icon_' + item.slot;
    const s = this.add.image(x, y - 40, texKey).setScale(0.7).setDepth(y);
    this.tweens.add({ targets: s, y: y - 8, duration: 450, ease: 'Bounce.Out' });
    const label = this.add.text(x, y - 34, itemDisplayName(item), {
      fontFamily: FONT, fontSize: '13px', color: QUALITY_COLORS[item.quality], stroke: '#000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.55)', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(9450);
    if (item.quality === 'gold' || item.quality === 'book' || item.quality === 'special' || item.quality === 'set') this.sfx('rare');
    const l = {
      kind: 'item', item, sprite: s, glow, beam, label, x, y, t: 0,
      update: (d, dt, i) => {
        if (this.player.dead || l.t <= 360) return;
        const canBag = state.inventory.length < INV_SIZE;
        const pullR = this.lootTarget === l ? 110 : 78;
        if (canBag && d < pullR && d > 12) {
          const k = Math.min(1, (dt / 1000) * 9);
          l.x += (this.player.fx - l.x) * k;
          l.y += (this.player.fy - l.y) * k;
          s.setPosition(l.x, l.y - 8);
          glow.setPosition(l.x, l.y);
          label.setPosition(l.x, l.y - 34);
          if (beam) beam.setPosition(l.x, l.y - 50);
        }
        if (d < 44) {
          if (!canBag) {
            if (this.time.now > this.fullMsgT) { this.fullMsgT = this.time.now + 2500; this.msg('背包已滿！（按 B 整理、右鍵賣出）', '#ff8080'); }
            return;
          }
          if (this.lootTarget === l) this.lootTarget = null;
          state.inventory.push(item);
          this.sfx(item.quality === 'white' ? 'pickup' : 'rare');
          this.msg(`拾取：${itemDisplayName(item)}`, QUALITY_COLORS[item.quality]);
          if (item.kind === 'equip' && state.tutorial && !state.tutorial.firstLootDone) {
            state.tutorial.firstLootDone = true;
            this.game.events.emit('firstLoot');
          }
          s.destroy(); glow.destroy(); label.destroy(); if (beam) beam.destroy();
          this.loot.splice(i, 1);
          this.game.events.emit('inventoryChanged');
        }
      },
    };
    this.loot.push(l);
  }

  onLevelUp() {
    this.sfx('levelUp');
    this.msg(`等級提升！目前等級 ${state.level}（獲得屬性點）`, '#ffd060');
    const p = this.player;
    const ring = this.add.circle(p.fx, p.fy, 20).setStrokeStyle(4, 0xffd060).setDepth(p.fy + 5);
    this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
    this.burst(p.fx, p.sprite.y, 24, [0xffd060, 0xfff0a0], 160);
    this.floatText(p.fx, p.topY - 18, '升級！', '#ffd060', 28);
    if (state.tutorial && !state.tutorial.firstLevelDone) {
      state.tutorial.firstLevelDone = true;
      this.game.events.emit('firstLevel');
    }
    saveGame();
  }

  hurtPlayer(raw, sx, sy, attacker = null) {
    const p = this.player;
    if (p.dead || this.victoryPending || this.mode === 'village') return 0;
    if (p.invuln > 0 || p.dodge || p.dash) {
      this.floatText(p.fx, p.topY - 6, '閃避', '#9ad0ff', 16);
      return 0;
    }
    const s = getStats();
    let dmg = Math.max(1, Math.round(raw * (60 / (60 + s.defense)) * (1 - s.dmgRed) * (0.9 + Math.random() * 0.2)));
    if (state.shield > 0) {
      const abs = Math.min(state.shield, dmg);
      state.shield -= abs;
      dmg -= abs;
      if (abs > 0) this.floatText(p.fx, p.topY - 18, `吸收 ${abs}`, '#ffe060', 14);
      if (state.shield <= 0) {
        state.shield = 0;
        if (state.buffs) state.buffs.shield = 0;
      }
    }
    p.invuln = 120;
    if (dmg > 0) {
      state.hp -= dmg;
      this.floatText(p.fx, p.topY - 6, `-${dmg}`, '#ff4040', 20);
      this.sfx('hurt');
      p.flashHurt();
      this.cameras.main.shake(120, 0.004);
      this.game.events.emit('playerHurt');
      this.bloodBurst(p.fx, p.sprite.y, 6, 0xa01010);
    } else {
      this.sfx('shield');
    }

    if (s.thorns > 0) {
      const target = (attacker && !attacker.dead && !attacker.isDummy)
        ? attacker
        : this.enemies.find((e) => !e.dead && !e.isDummy && Math.hypot(e.fx - sx, e.fy - sy) < 48);
      if (target) {
        const refDmg = Math.max(1, Math.round(raw * s.thorns));
        this.damageEnemy(target, refDmg, { color: '#c8ff40', isThorns: true });
        this.sfx('thorns');
        this.burst(target.fx, target.sprite.y, 8, [0xb8e040, 0xf0ff80], 110, 260);
      }
    }

    if (s.novaProc > 0 && Math.random() < s.novaProc) {
      const nr = 135;
      const ndmg = Math.round((10 + s.int * 1.4) * s.spellPower);
      const ring = this.add.circle(p.fx, p.fy, 20, 0x70e8ff, 0.22).setStrokeStyle(3, 0xa0f8ff, 0.9).setDepth(9200);
      this.tweens.add({ targets: ring, scale: nr / 20, alpha: 0, duration: 360, onComplete: () => ring.destroy() });
      this.sfx('frost');
      for (const e of this.enemies.slice()) {
        if (e.dead || e.isDummy) continue;
        if (Math.hypot(e.fx - p.fx, e.fy - p.fy) <= nr + e.T.r) {
          e.applySlow(2000);
          this.damageEnemy(e, ndmg, { color: '#80e8ff', isProc: true, kx: e.fx - p.fx, ky: e.fy - p.fy, force: 90 });
        }
      }
    }

    if (state.hp <= 0) {
      state.hp = 0;
      this.playerDie();
    }
    return dmg;
  }

  playerDie() {
    const p = this.player;
    p.dead = true;
    state.dead = true;
    p.clearMoveInputs();
    p.stop();
    this.scene.get('UI')?.resetTouchInputs?.();
    this.attackTarget = null;
    this.interactTarget = null;
    this.lootTarget = null;
    this.sfx('death');
    Sfx.stopAmbient();
    this.tweens.add({ targets: p.sprite, angle: 90, alpha: 0.5, duration: 600 });
    p.sword.setVisible(false);
    this.add.image(p.fx, p.fy, 'blood1').setDepth(1).setScale(1.5);
    this.time.delayedCall(1800, () => this.endGame(false));
  }

  endGame(victory) {
    if (this.ended) return;
    if (!victory && state.victory) return;
    this.ended = true;
    state.victory = victory;
    this.scene.stop('UI');
    this.scene.pause();
    this.scene.launch('End', { victory });
  }

  // =========================================================== 掉落物
  spawnGold(x, y, amount) {
    const s = this.add.image(x, y - 20, 'coin').setDepth(y).setScale(1.2);
    const glow = this.add.image(x, y, 'glow').setTint(0xffc030).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setAlpha(0.5).setDepth(2);
    this.tweens.add({ targets: s, y, duration: 350, ease: 'Bounce.Out' });
    this.loot.push({ kind: 'gold', amount, sprite: s, glow, x, y, t: 0 });
  }

  spawnRune(x, y, runeId) {
    const def = RUNE_DEFS[runeId];
    if (!def) return;
    if (!this.dungeon.walkableAt(x, y)) { x = this.player.fx; y = this.player.fy; }
    const glow = this.add.image(x, y, 'glow').setTint(def.hex).setBlendMode(Phaser.BlendModes.ADD).setScale(0.55, 0.3).setAlpha(0.75).setDepth(2);
    const beam = this.add.image(x, y - 38, 'glow').setTint(def.hex).setBlendMode(Phaser.BlendModes.ADD).setScale(0.14, 1.05).setAlpha(0.45).setDepth(9100);
    const sprite = this.add.image(x, y - 34, `rune_${runeId}`).setScale(0.72).setDepth(y);
    this.tweens.add({ targets: sprite, y: y - 6, duration: 400, ease: 'Bounce.Out' });
    const label = this.add.text(x, y - 30, def.name, {
      fontFamily: FONT, fontSize: '12px', color: def.color, stroke: '#000', strokeThickness: 3,
      backgroundColor: 'rgba(0,0,0,0.55)', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(9450);
    const l = {
      kind: 'rune', runeId, sprite, glow, beam, label, x, y, t: 0,
      update: (d, dt, i) => {
        if (this.player.dead || l.t <= 360) return;
        const pullR = this.lootTarget === l ? 110 : 78;
        if (d < pullR && d > 12) {
          const k = Math.min(1, (dt / 1000) * 9);
          l.x += (this.player.fx - l.x) * k;
          l.y += (this.player.fy - l.y) * k;
          sprite.setPosition(l.x, l.y - 6);
          glow.setPosition(l.x, l.y);
          label.setPosition(l.x, l.y - 30);
          beam.setPosition(l.x, l.y - 38);
        }
        if (d < 44) {
          if (this.lootTarget === l) this.lootTarget = null;
          state.runes[runeId] = (state.runes[runeId] || 0) + 1;
          this.sfx('rune');
          this.floatText(this.player.fx, this.player.topY - 6, `+1 ${def.name}`, def.color, 16);
          this.msg(`拾取符文：${runeDisplayName(runeId)}（${def.desc}）`, def.color);
          sprite.destroy(); glow.destroy(); beam.destroy(); label.destroy();
          this.loot.splice(i, 1);
          this.game.events.emit('inventoryChanged');
        }
      },
    };
    this.loot.push(l);
  }

  updateLoot(dt) {
    const p = this.player;
    for (let i = this.loot.length - 1; i >= 0; i--) {
      const l = this.loot[i];
      l.t += dt;
      const d = Math.hypot(l.x - p.fx, l.y - p.fy);
      if (l.kind === 'gold' && !p.dead) {
        if (d < 100 && l.t > 350) {
          const k = Math.min(1, (dt / 1000) * 8);
          l.x += (p.fx - l.x) * k; l.y += (p.fy - l.y) * k;
          l.sprite.setPosition(l.x, l.y);
          l.glow.setPosition(l.x, l.y);
        }
        if (d < 20 && l.t > 350) {
          state.gold += l.amount;
          this.sfx('coin');
          this.floatText(p.fx, p.topY - 6, `+${l.amount} 金幣`, '#f0c040', 15);
          l.sprite.destroy(); l.glow.destroy();
          this.loot.splice(i, 1);
        }
      } else if (l.update) {
        l.update(d, dt, i);
      }
    }
  }

  // =========================================================== 投射物
  spawnArrow(x, y, ang, dmg, owner = null) {
    const s = this.add.image(x, y, 'arrow').setRotation(ang).setDepth(y + 20);
    this.sfx('arrow');
    this.projectiles.push({ sprite: s, x, y, vx: Math.cos(ang) * 380, vy: Math.sin(ang) * 380, dmg, owner, hostile: true, life: 1600, r: 6 });
  }

  removeProjectile(pr) {
    if (!pr || pr.dead) return;
    pr.dead = true;
    if (pr.sprite && pr.sprite.active) pr.sprite.destroy();
    if (pr.tail && pr.tail.active) pr.tail.destroy();
    if (pr.halo && pr.halo.active) pr.halo.destroy();
    if (pr.glow && pr.glow.active) pr.glow.destroy();
    const idx = this.projectiles.indexOf(pr);
    if (idx !== -1) this.projectiles.splice(idx, 1);
  }

  updateProjectiles(dt) {
    const p = this.player;
    const sec = dt / 1000;
    const list = this.projectiles.slice();
    for (const pr of list) {
      if (pr.dead) continue;
      pr.x += pr.vx * sec; pr.y += pr.vy * sec;
      pr.life -= dt;
      if (pr.sprite && pr.sprite.active) pr.sprite.setPosition(pr.x, pr.y).setDepth(pr.y + 20);
      if (pr.onUpdate) pr.onUpdate(pr, dt);
      let done = pr.life <= 0 || !this.dungeon.walkableAt(pr.x, pr.y + (pr.elev ?? 8));
      if (!done && pr.hostile) {
        if (!p.dead && Math.hypot(pr.x - p.fx, pr.y + 12 - p.fy) < PLAYER_R + pr.r + 6) {
          const dealt = this.hurtPlayer(pr.dmg, pr.x, pr.y, pr.owner || null);
          if (pr.slow && dealt > 0) p.applySlow(pr.slow);
          done = true;
        }
      } else if (!done && pr.friendly) {
        for (const e of this.enemies) {
          if (e.dead) continue;
          const minY = e.fy - Math.max(18, e.T.h * 0.68);
          const maxY = e.fy - Math.min(8, e.T.h * 0.15);
          const cy = Phaser.Math.Clamp(pr.y, minY, maxY);
          if (Math.hypot(pr.x - e.fx, pr.y - cy) < e.T.r + pr.r + 8) {
            if (pr.pierce) {
              if (pr.onPierce) pr.onPierce(pr, e);
            } else {
              done = true; break;
            }
          }
        }
        if (!done) {
          for (const prop of this.props) {
            if (!prop.dead && Math.hypot(pr.x - prop.x, pr.y - (prop.y - 8)) < 22 + pr.r) {
              if (pr.pierce) this.smashProp(prop);
              else { done = true; break; }
            }
          }
        }
      }
      if (done) {
        this.removeProjectile(pr);
        if (pr.onHit) pr.onHit(pr);
      }
    }
  }

  // =========================================================== 特效
  floatText(x, y, str, color = '#fff', size = 18) {
    const t = this.add.text(x, y, str, {
      fontFamily: FONT, fontSize: `${size}px`, color, stroke: '#000', strokeThickness: 4, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(9500);
    this.tweens.add({
      targets: t,
      x: x + rand(-10, 10),
      y: y - 40,
      alpha: { from: 1, to: 0 },
      duration: 900,
      ease: 'Cubic.Out',
      onComplete: () => t.destroy(),
    });
    if (size >= 24) {
      t.setScale(1.5);
      this.tweens.add({ targets: t, scale: 1, duration: 150, ease: 'Back.Out' });
    } else if (size >= 18) {
      t.setScale(1.22);
      this.tweens.add({ targets: t, scale: 1, duration: 120, ease: 'Back.Out' });
    }
  }

  burst(x, y, count, tints, speed = 120, life = 500) {
    this.vfx.spawnBurst(x, y, count, tints, speed, life);
  }

  bloodBurst(x, y, count, tint) {
    this.vfx.spawnDebris(x, y, count, tint);
  }

  slamEffect(x, y, r) {
    this.sfx('slam');
    this.cameras.main.shake(180, 0.006);
    const c = this.add.circle(x, y, r, 0xff8030, 0.5).setDepth(3).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: c, alpha: 0, scale: 1.2, duration: 350, onComplete: () => c.destroy() });
    this.burst(x, y, 20, [0x8a8a8a, 0x605850], r * 2, 450);
  }

  sfx(name) { Sfx.play(name); }
  msg(text, color = '#e0d0b0') { this.game.events.emit('msg', text, color); }

  buildDungeonMapLayer(tilesetKey) {
    if (this.layer && this.layer.active) this.layer.destroy();
    if (this.map) this.map.destroy();
    this.map = this.make.tilemap({ data: this.dungeon.tiles, tileWidth: TILE, tileHeight: TILE });
    const ts = this.map.addTilesetImage(tilesetKey, tilesetKey, TILE, TILE, 0, 0);
    this.layer = this.map.createLayer(0, ts, 0, 0).setDepth(0);
    this.layer.setCollision([0, 4, 5]);
  }

  bindWallColliders() {
    if (this.playerWallCollider) {
      this.physics.world.removeCollider(this.playerWallCollider);
      this.playerWallCollider = null;
    }
    if (this.enemyWallCollider) {
      this.physics.world.removeCollider(this.enemyWallCollider);
      this.enemyWallCollider = null;
    }
    if (this.bossWallCollider) {
      this.physics.world.removeCollider(this.bossWallCollider);
      this.bossWallCollider = null;
    }
    if (this.player?.sprite && this.layer) {
      this.playerWallCollider = this.physics.add.collider(this.player.sprite, this.layer);
    }
    if (this.enemyGroup && this.layer) {
      this.enemyWallCollider = this.physics.add.collider(this.enemyGroup, this.layer);
    }
    if (this.boss?.sprite && this.layer) {
      this.bossWallCollider = this.physics.add.collider(this.boss.sprite, this.layer);
    }
  }

  applyDungeonArt() {
    if (this.mode !== 'dungeon' || this._dungeonArtApplied || !isDungeonArtReady(this.game)) return;
    this._dungeonArtApplied = true;
    const { maskKey, style } = ensureDungeonArtTextures(this, this.dungeon.biome);

    this.floorBg = this.add.tileSprite(0, 0, VW, VH, ART_KEYS.FLOOR_TILE)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(-1)
      .setTint(style.floorTint);

    this.buildDungeonMapLayer(maskKey);

    this.wallSprites = [];
    const d = this.dungeon;
    for (let y = 0; y < d.H; y++) {
      for (let x = 0; x < d.W; x++) {
        if (d.tiles[y][x] !== 5) continue;
        const isTall = !d.isFloor(x, y - 1);
        const frame = isTall ? `w${x % 3}` : 'pillar';
        const ws = this.add.image(x * TILE, (y + 1) * TILE, ART_KEYS.WALL_ATLAS, frame)
          .setOrigin(0, 1)
          .setDepth(0.5)
          .setTint(style.wallTint);
        this.wallSprites.push(ws);
      }
    }

    if (this.player && this.enemyGroup) {
      this.bindWallColliders();
    }
    const cam = this.cameras.main;
    if (cam) {
      this.floorBg.tilePositionX = cam.scrollX;
      this.floorBg.tilePositionY = cam.scrollY;
    }
  }

  // =========================================================== 更新
  updateCamera(dt) {
    const cam = this.cameras.main;
    let focusX = this.player.fx;
    let focusY = this.player.fy - Math.round(this.player.foot * 0.55);
    const inBossArea = this.mode === 'dungeon' && this.bossRoom && this.boss && !this.boss.dead
      && (this.bossActive || this.dungeon.roomAt(this.player.fx, this.player.fy) === this.bossRoom);
    if (inBossArea) {
      const bx = this.boss.fx;
      const by = this.boss.fy - Math.round(this.boss.T.foot * 0.95);
      focusX += Phaser.Math.Clamp((bx - focusX) * 0.36, -210, 210);
      focusY += Phaser.Math.Clamp((by - focusY) * 0.36, -125, 125);
    }
    let tx = focusX - VW / 2;
    let ty = focusY - VH / 2;
    if (inBossArea) {
      const bossCrownY = this.boss.fy - this.boss.T.h + 10;
      if (bossCrownY < ty + 86) {
        const neededTy = bossCrownY - 86;
        if (this.player.fy <= neededTy + VH - 125) {
          ty = neededTy;
        }
      }
    }
    const k = 1 - Math.pow(0.0005, dt / 1000);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    const b = this.dungeon.bounds || { minX: 0, minY: 0, maxX: this.worldW, maxY: this.worldH };
    const minCx = b.minX;
    const maxCx = Math.max(b.minX, b.maxX - VW);
    const minCy = inBossArea ? Math.min(b.minY, this.bossRoom.y * TILE - 72) : b.minY;
    const maxCy = Math.max(minCy, b.maxY - VH);
    this.camX = Phaser.Math.Clamp(this.camX, minCx, maxCx);
    this.camY = Phaser.Math.Clamp(this.camY, minCy, maxCy);
    cam.setScroll(Math.round(this.camX), Math.round(this.camY));
    if (this.floorBg && this.floorBg.active) {
      this.floorBg.tilePositionX = cam.scrollX;
      this.floorBg.tilePositionY = cam.scrollY;
    }
  }

  updateLighting(time) {
    const cam = this.cameras.main;
    const vx = cam.scrollX, vy = cam.scrollY;
    const dark = this.dark;
    dark.clear();
    dark.fill(this.darkColor, this.darkAlpha);
    const stamp = this.lightStamp;
    const draw = (x, y, r, a = 1) => {
      if (x + r < vx || x - r > vx + VW || y + r < vy || y - r > vy + VH) return;
      stamp.setPosition(x - vx, y - vy).setScale(r / 128).setAlpha(a);
      dark.erase(stamp);
    };
    const p = this.player;
    const lightY = p.fy - Math.round(p.foot * 0.65);
    draw(p.fx, lightY, this.mode === 'village' ? 380 : 300, 1);
    draw(p.fx, lightY, 140, 0.6);
    for (const l of this.lights) {
      const f = l.flicker !== undefined ? 1 + Math.sin(time * 0.011 + l.flicker) * 0.04 + (Math.random() - 0.5) * 0.04 : 1;
      draw(l.x, l.y, l.r * f, l.a);
    }
    for (const pr of this.projectiles) if (pr.light) draw(pr.x, pr.y, pr.light, 0.9);
    for (const l of this.extraLights) draw(l.x, l.y, l.r, l.a);

    this.fog.tilePositionX = vx * 0.8 + time * 0.012;
    this.fog.tilePositionY = vy * 0.8 + Math.sin(time * 0.0002) * 40;
  }

  revealAround() {
    const d = this.dungeon;
    if (d.isVillage) return;
    const ptx = Math.floor(this.player.fx / TILE), pty = Math.floor(this.player.fy / TILE);
    const R = 7;
    if (!d.newlyExplored) d.newlyExplored = [];
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > R * R) continue;
      const x = ptx + dx, y = pty + dy;
      if (x < 0 || y < 0 || x >= d.W || y >= d.H) continue;
      const i = y * d.W + x;
      if (!d.explored[i] && d.tiles[y][x] !== 0) { d.explored[i] = 1; d.newlyExplored.push(i); }
    }
  }

  drawEnemyBars() {
    const g = this.hpGfx;
    g.clear();
    const cam = this.cameras.main;
    for (const e of this.enemies) {
      if (e.dead || e.isBoss || e.isDummy) continue;
      if (e.hp >= e.maxHp && !e.T.elite) continue;
      const x = e.fx, y = e.sprite.y - e.T.h / 2 - 8;
      if (x < cam.scrollX - 50 || x > cam.scrollX + VW + 50 || y < cam.scrollY - 50 || y > cam.scrollY + VH + 50) continue;
      const w = e.T.elite ? 62 : 38;
      g.fillStyle(0x000000, 0.8).fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
      g.fillStyle(0x3a0808, 1).fillRect(x - w / 2, y, w, 4);
      g.fillStyle(e.T.elite ? 0xe0a020 : 0xc02020, 1).fillRect(x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }

  update(time, dt) {
    dt = Math.min(dt, 50);
    const p = this.player;
    this.pathBudget = 4;

    // 鍵盤 WASD / 方向鍵即時移動向量
    const ui = this.scene.get('UI');
    let keyActive = false;
    if (this.moveKeys && !p.dead && !(ui && ui.activeModal)) {
      const kx = (this.moveKeys.d.isDown || this.moveKeys.right.isDown ? 1 : 0) - (this.moveKeys.a.isDown || this.moveKeys.left.isDown ? 1 : 0);
      const ky = (this.moveKeys.s.isDown || this.moveKeys.down.isDown ? 1 : 0) - (this.moveKeys.w.isDown || this.moveKeys.up.isDown ? 1 : 0);
      p.setKeyVector(kx, ky);
      keyActive = kx !== 0 || ky !== 0;
    } else {
      p.setKeyVector(0, 0);
    }

    const joyActive = Math.hypot(p.joyVec.x, p.joyVec.y) > 0.08;
    const manualActive = joyActive || keyActive;
    if (manualActive) {
      this.holdMove = false;
      this.interactTarget = null;
      this.lootTarget = null;
      this.propTarget = null;
      if (this.attackTarget) {
        const ae = this.attackTarget;
        const agap = ae.dead ? 999 : Math.hypot(ae.fx - p.fx, ae.fy - p.fy) - ae.T.r - PLAYER_R;
        if (agap > 44) this.attackTarget = null;
      }
    }

    if (this.holdMove && !p.dead && !manualActive) {
      this.holdT += dt;
      const movePtr = this.input.manager.pointers.find((ptr) => ptr.id === this.movePointerId) || this.input.activePointer;
      const isDown = movePtr && movePtr.isDown && (!movePtr.rightButtonDown || !movePtr.rightButtonDown());
      if (this.holdT > 140 && isDown) {
        this.holdT = 0;
        const w = this.pointerWorld(movePtr);
        this.moveTo(w.x, w.y);
      }
    }

    if (this.interactTarget && !p.dead && !p.dodge && !p.dash && !this.whirl) {
      const it = this.interactTarget;
      const dist = Math.hypot(it.x - p.fx, it.y - p.fy);
      const useDist = Math.max(115, it.r + 68);
      if (dist <= useDist || (!p.moving && dist <= 140)) {
        p.stop();
        this.interactTarget = null;
        it.onUse();
      }
    }

    if (this.lootTarget && !this.loot.includes(this.lootTarget)) {
      this.lootTarget = null;
    }

    if (this.targetRing) {
      const tgt = this.interactTarget || this.lootTarget || this.propTarget || (this.attackTarget && !this.attackTarget.dead ? { x: this.attackTarget.fx, y: this.attackTarget.fy } : null);
      if (tgt && !p.dead) {
        this.targetRing.setPosition(tgt.x, tgt.y).setVisible(true).setScale(1 + Math.sin(time * 0.012) * 0.12);
      } else {
        this.targetRing.setVisible(false);
      }
    }

    if (this.propTarget && !p.dead && !p.dodge && !p.dash && !this.whirl) {
      const pr = this.propTarget;
      if (pr.dead) this.propTarget = null;
      else if (Math.hypot(pr.x - p.fx, pr.y - p.fy) <= 58) {
        p.stop();
        this.propTarget = null;
        p.startSwing(Math.atan2(pr.y - p.fy, pr.x - p.fx));
        this.smashProp(pr);
      }
    }

    if (this.attackTarget && !p.dead && !p.dodge && !p.dash && !this.whirl) {
      const e = this.attackTarget;
      if (e.dead) this.attackTarget = null;
      else {
        const gap = Math.hypot(e.fx - p.fx, e.fy - p.fy) - e.T.r - PLAYER_R;
        if (gap <= 24) {
          p.stop();
          p.facing = e.fx >= p.fx ? 1 : -1;
          if (p.attackCd <= 0) this.playerAttack(e);
        } else {
          this.chaseT -= dt;
          if (this.chaseT <= 0 || !p.moving) {
            this.chaseT = 200;
            this.moveTo(e.fx, e.fy);
          }
        }
      }
    }

    if (state.buffs) {
      if (state.buffs.frenzy > 0) state.buffs.frenzy = Math.max(0, state.buffs.frenzy - dt);
      if (state.buffs.arcane > 0) state.buffs.arcane = Math.max(0, state.buffs.arcane - dt);
      if (state.buffs.bloodBoil > 0) {
        state.buffs.bloodBoil = Math.max(0, state.buffs.bloodBoil - dt);
        if (!p.dead) this.vfx.emitBloodBoilTick(p, dt);
      }
      if (state.buffs.shadowCrit > 0) state.buffs.shadowCrit = Math.max(0, state.buffs.shadowCrit - dt);
      if (state.buffs.shield > 0) {
        state.buffs.shield = Math.max(0, state.buffs.shield - dt);
        if (state.buffs.shield <= 0) state.shield = 0;
      }
    }
    const s = getStats();
    const onWeb = this.webs.some((w) => !w.burned && Math.hypot(w.x - p.fx, w.y - p.fy) < w.r + PLAYER_R);
    const speedMul = (1 + s.moveSpeed) * (state.buffs && state.buffs.frenzy > 0 ? 1.2 : 1) * (onWeb ? 0.7 : 1);

    p.update(dt, speedMul);
    for (const k in this.skillCd) {
      if (this.skillCd[k] > 0) this.skillCd[k] = Math.max(0, this.skillCd[k] - dt);
    }
    this.updateWhirl(dt);
    this.updateGroundEffects(dt);
    this.updateOrbitBlades(time, dt);
    this.updateTraps(time, dt);
    for (const e of this.enemies) e.update(dt);
    if (this.enemiesDirty) { this.enemiesDirty = false; this.enemies = this.enemies.filter((e) => !e.dead); }
    this.updateProjectiles(dt);
    this.updateLoot(dt);

    if (!p.dead) {
      const regMul = this.mode === 'village' ? 12 : 1;
      const mpRegMul = regMul * (1 + s.mpRegenBonus) * (state.buffs && state.buffs.arcane > 0 ? 5 : 1);
      state.hp = Math.min(s.maxHp, state.hp + ((0.6 + s.vit * 0.03) * regMul + s.maxHp * s.hpRegenPct) * dt / 1000);
      state.mp = Math.min(s.maxMp, state.mp + (1.2 + s.int * 0.1) * mpRegMul * dt / 1000);
    }
    this.updateAuras(time, dt, s);
    this.drawShield(time);

    for (const t of this.torches) {
      t.t.setTexture('torch' + (Math.floor(time / 110 + t.off) % 3));
      t.glow.setAlpha(0.42 + Math.sin(time * 0.012 + t.off) * 0.06 + Math.random() * 0.05);
    }
    for (const b of this.braziers) {
      b.s.setTexture('prop_brazier' + (Math.floor(time / 140 + b.off) % 2));
      b.glow.setAlpha(0.48 + Math.sin(time * 0.013 + b.off) * 0.08 + Math.random() * 0.05);
    }
    if (this.campfire) {
      this.campfire.setTexture('campfire' + (Math.floor(time / 160) % 2));
      this.campfireGlow.setAlpha(0.5 + Math.sin(time * 0.01) * 0.08);
    }
    for (const pr of this.portals) {
      pr.vortex.setRotation(time * 0.0025);
      pr.glow.setScale((1.65 + Math.sin(time * 0.005) * 0.12) * pr.scale);
    }

    this.exploreT -= dt;
    if (this.exploreT <= 0) {
      this.exploreT = 120;
      this.revealAround();
      if (this.mode === 'dungeon' && !this.bossActive && this.boss && !this.boss.dead && !p.dead && this.dungeon.roomAt(p.fx, p.fy) === this.bossRoom) {
        this.startBossFight();
      }
    }

    this.updateCamera(dt);
    this.updateLighting(time);
    this.drawEnemyBars();
  }

  updateAuras(time, dt, s) {
    const g = this.auraGfx;
    g.clear();
    const p = this.player;
    if (p.dead || !s.activeAuras || !s.activeAuras.length) return;

    s.activeAuras.forEach((a, idx) => {
      const rw = a.def;
      const pulse = 1 + Math.sin(time * 0.005 + idx * 1.4) * 0.08;
      const rx = (28 + idx * 7) * pulse;
      const ry = rx * 0.48;
      g.lineStyle(2, rw.hex, 0.42 + Math.sin(time * 0.006 + idx) * 0.14);
      g.strokeEllipse(p.fx, p.fy + 3, rx * 2, ry * 2);
      g.lineStyle(1, rw.hex, 0.16);
      g.strokeEllipse(p.fx, p.fy + 3, rx * 1.5, ry * 1.5);
    });

    if (this.mode !== 'dungeon') return;

    const tickAreaAura = (key, interval, radius, baseDmg, ringCol, txtCol, applySlow) => {
      this[key] += dt;
      if (this[key] < interval) return;
      this[key] = 0;
      const ring = this.add.circle(p.fx, p.fy, 24, ringCol, 0.10).setStrokeStyle(2, ringCol, 0.55).setDepth(3);
      this.tweens.add({ targets: ring, scale: radius / 24, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
      for (const e of this.enemies.slice()) {
        if (e.dead || e.isDummy) continue;
        if (Math.hypot(e.fx - p.fx, e.fy - p.fy) <= radius + e.T.r) {
          if (applySlow) e.applySlow(1500);
          this.damageEnemy(e, baseDmg, { color: txtCol, isAura: true });
        }
      }
    };

    if (s.activeAuras.some((a) => a.def.auraTick === 'burn')) {
      const bdmg = Math.max(3, Math.round((6 + s.int * 0.8 + state.level * 1.4) * s.spellPower));
      tickAreaAura('burnAuraT', 800, 135, bdmg, 0xff7018, '#ff8030', false);
    }
    if (s.activeAuras.some((a) => a.def.auraTick === 'frost')) {
      const fdmg = Math.max(2, Math.round((4 + s.int * 0.6 + state.level * 1.1) * s.spellPower));
      tickAreaAura('frostAuraT', 1000, 150, fdmg, 0x50c8ff, '#70e8ff', true);
    }
  }

  updateGroundEffects(dt) {
    const s = getStats();
    for (let i = this.groundEffects.length - 1; i >= 0; i--) {
      const ge = this.groundEffects[i];
      ge.t += dt;
      ge.tickT -= dt;
      this.vfx.updatePoisonCloudVisuals(ge, dt);
      if (ge.tickT <= 0) {
        ge.tickT = 500;
        for (const e of this.enemies.slice()) {
          if (e.dead || e.isDummy) continue;
          if (Math.hypot(e.fx - ge.x, e.fy - ge.y) <= ge.r + e.T.r) {
            e.applySlow(1000);
            e.plagueUntil = this.time.now + 5500;
            const hit = this.calcCrit(s, ge.dmg * (0.9 + Math.random() * 0.2), false);
            this.damageEnemy(e, hit.dmg, { crit: hit.crit, color: hit.crit ? '#ffd030' : '#80ff60', isProc: true });
          }
        }
      }
      if (ge.t >= ge.dur) {
        ge.visuals.forEach((v) => v.destroy());
        this.groundEffects.splice(i, 1);
      }
    }
  }

  updateOrbitBlades(time, dt) {
    const p = this.player;
    const s = getStats();
    for (let i = this.orbitBlades.length - 1; i >= 0; i--) {
      const ob = this.orbitBlades[i];
      ob.t += dt;
      if (p.dead || ob.t >= ob.dur) {
        ob.blades.forEach((b) => b.destroy());
        if (ob.orbitRing && ob.orbitRing.active) ob.orbitRing.destroy();
        this.orbitBlades.splice(i, 1);
        continue;
      }
      const base = time * 0.0075;
      ob.blades.forEach((b, k) => {
        const a = base + (k * Math.PI * 2) / ob.blades.length;
        const bx = p.fx + Math.cos(a) * ob.r;
        const by = p.sprite.y + Math.sin(a) * ob.r * 0.72;
        b.setPosition(bx, by).setRotation(a + Math.PI / 2).setDepth(by + 20);
      });
      this.vfx.updateBladeStormVisuals(ob, p, time, dt);
      this.smashPropsInRadius(p.fx, p.fy, ob.r + 12);
      for (const e of this.enemies.slice()) {
        if (e.dead) continue;
        if (Math.hypot(e.fx - p.fx, e.fy - p.fy) <= ob.r + e.T.r + 14) {
          if ((ob.hitCd.get(e) || 0) <= time) {
            ob.hitCd.set(e, time + 380);
            const hit = this.calcCrit(s, ob.dmg * (0.9 + Math.random() * 0.2), false);
            this.damageEnemy(e, hit.dmg, { crit: hit.crit, color: hit.crit ? '#ffd030' : '#c0f0ff', isProc: true });
            this.vfx.playSlashImpact(e.fx, e.sprite.y, Math.atan2(e.fy - p.fy, e.fx - p.fx), 0x90f0ff);
          }
        }
      }
    }
  }

  drawShield(time) {
    const g = this.shieldGfx;
    g.clear();
    const p = this.player;
    if (p.dead || state.shield <= 0) return;
    const pulse = 0.7 + Math.sin(time * 0.01) * 0.2;
    const sw = Math.max(48, p.w + 16);
    const sh = Math.max(56, p.h + 10);
    g.fillStyle(0xffe060, state.vfxEnabled ? 0.12 : 0.14);
    g.fillEllipse(p.fx, p.sprite.y + 4, sw, sh);
    g.lineStyle(2.5, 0xffe870, pulse);
    g.strokeEllipse(p.fx, p.sprite.y + 4, sw, sh);
    if (state.vfxEnabled) {
      g.lineStyle(1.4, 0xfff8c8, pulse * 0.7);
      g.strokeEllipse(p.fx, p.sprite.y + 4, sw + 6, sh + 6);
      for (let i = 0; i < 3; i++) {
        const a = time * 0.004 + (i * Math.PI * 2) / 3;
        const gx = p.fx + Math.cos(a) * (sw * 0.54);
        const gy = p.sprite.y + 4 + Math.sin(a) * (sh * 0.54);
        g.fillStyle(0xfff8d0, 0.9);
        g.fillCircle(gx, gy, 2.5);
      }
    }
  }
}
