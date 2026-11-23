import Phaser from 'phaser';
import { PLAYER_R } from './Player.js';
import { state } from '../state.js';
import { getDifficulty } from '../systems/difficulty.js';
import { ensureEntityArtTexture } from '../systems/dungeonArt.js';

export const BOSS_TYPES = {
  bone: {
    name: '骸骨暴君',
    tex: 'boss_bone',
    hp: 680,
    dmg: 22,
    speed: 78,
    aura: 0xd0b060,
    light: 0xffc060,
    attacks: ['cleave', 'barrage', 'charge'],
    minions: ['skeleton', 'skeleton', 'archer'],
  },
  blood: {
    name: '血月主教',
    tex: 'boss_blood',
    hp: 900,
    dmg: 25,
    speed: 74,
    aura: 0xd01830,
    light: 0xff3050,
    attacks: ['nova', 'slam', 'cleave'],
    minions: ['bat', 'bat', 'necromancer'],
  },
  frost: {
    name: '霜魂領主',
    tex: 'boss_frost',
    hp: 1120,
    dmg: 27,
    speed: 72,
    aura: 0x40d0ff,
    light: 0x60e0ff,
    attacks: ['frost_nova', 'slam', 'cleave'],
    minions: ['frost_mage', 'archer', 'assassin'],
  },
  abyss: {
    name: '深淵領主',
    tex: 'boss',
    hp: 1400,
    dmg: 30,
    speed: 74,
    aura: 0xa020ff,
    light: 0xb040ff,
    attacks: ['cleave', 'nova', 'slam'],
    minions: ['skeleton', 'archer', 'assassin'],
  },
};

/** 層級 Boss（4 大原型隨無盡層數等比強化） */
export default class Boss {
  constructor(scene, x, y, floor = 1, bossType = 'abyss') {
    const def = BOSS_TYPES[bossType] || BOSS_TYPES.abyss;
    this.scene = scene;
    this.type = 'boss';
    this.bossType = bossType;
    this.def = def;
    this.isBoss = true;
    this.lvl = 4 + floor * 2;

    const fullName = floor >= 5 ? `${def.name}（無盡 第${floor}層）` : def.name;
    this.T = {
      name: fullName,
      tex: def.tex,
      w: 120,
      h: 120,
      r: 30,
      foot: 40,
      elite: true,
      gold: [80 + floor * 35, 140 + floor * 55],
      drop: 1,
    };

    const diff = getDifficulty(state.difficulty);
    this.maxHp = Math.max(1, Math.round(def.hp * Math.pow(1.42, floor - 1) * diff.hpMul));
    this.hp = this.maxHp;
    this.dmg = Math.max(1, Math.round(def.dmg * (1 + (floor - 1) * 0.22) * diff.dmgMul));
    this.xp = Math.max(1, Math.round(320 * (1 + (floor - 1) * 0.45) * diff.xpMul));
    this.baseSpeed = def.speed;
    this.speed = def.speed;
    this.dead = false;
    this.aggro = false;
    this.active = false;
    this.facing = -1;
    this.flashT = 0;
    this.slowT = 0;
    this.actT = 1500;
    this.action = null;
    this.summoned70 = false;
    this.summoned35 = false;
    this.enraged = false;

    this.shadow = scene.add.image(x, y, 'shadowtex').setScale(2.6, 0.9).setDepth(2);
    this.aura = scene.add.image(x, y, 'glow').setTint(def.aura).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5).setScale(2.4, 1).setDepth(2);
    this._customArt = false;
    this.sprite = scene.physics.add.sprite(x, y - this.T.foot, def.tex);
    this.syncBody();
    this.sprite.body.pushable = false;
    this.sprite.enemy = this;
    this.light = { x, y, r: 200, a: 0.65 };
    scene.extraLights.push(this.light);
    this.applyCustomArt();
  }

  get fx() { return this.sprite.x; }
  get fy() { return this.sprite.y + this.T.foot; }

  syncBody() {
    if (this.sprite?.body) {
      this.sprite.body.setCircle(this.T.r, this.T.w / 2 - this.T.r, this.T.h / 2 + this.T.foot - this.T.r);
    }
  }

  applyCustomArt() {
    if (this._customArt || this.dead || !this.sprite?.active || this.bossType !== 'bone') return false;
    const spec = ensureEntityArtTexture(this.scene, 'boss_bone');
    if (!spec) return false;
    const gx = this.fx, gy = this.fy;
    this._customArt = true;
    this.T.tex = spec.texKey;
    this.T.w = spec.w;
    this.T.h = spec.h;
    this.T.r = spec.r;
    this.T.foot = spec.foot;
    this.sprite.setTexture(spec.texKey);
    this.sprite.setPosition(gx, gy - this.T.foot);
    this.syncBody();
    this.shadow.setScale(2.4, 0.85);
    this.aura.setScale(2.3, 0.95);
    this.light.r = 245;
    return true;
  }

  flash(color = 0xffffff, duration = 100) {
    this.flashT = duration;
    this.sprite.setTintFill(color);
  }

  applySlow(ms) {
    this.slowT = Math.max(this.slowT, ms * 0.5);
  }

  knockback() { /* 免疫擊退 */ }

  activate() {
    this.active = true;
    this.aggro = true;
    this.actT = 1600;
  }

  update(dt) {
    if (this.dead) return;
    const sc = this.scene, p = sc.player, body = this.sprite.body;
    this.slowT = Math.max(0, this.slowT - dt);
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) {
        if (this.enraged) this.sprite.setTint(0xff9090);
        else if (this.slowT > 0) this.sprite.setTint(0x80d8ff);
        else this.sprite.clearTint();
      }
    }
    const dx = p.fx - this.fx, dy = p.fy - this.fy;
    const dist = Math.hypot(dx, dy) || 1;

    const t = sc.time.now;
    this.sprite.setScale(1 + Math.sin(t * 0.004) * 0.03, 1 - Math.sin(t * 0.004) * 0.03);
    this.shadow.setPosition(this.fx, this.fy + 1);
    this.aura.setPosition(this.fx, this.fy).setAlpha(0.4 + Math.sin(t * 0.006) * 0.15);
    this.light.x = this.fx; this.light.y = this.fy - Math.round(this.T.foot * 0.85);
    this.sprite.setDepth(this.fy);

    if (!this.active || p.dead) { body.setVelocity(0, 0); return; }

    const frac = this.hp / this.maxHp;
    if (!this.enraged && frac < 0.5) {
      this.enraged = true;
      this.speed = Math.round(this.baseSpeed * 1.38);
      this.sprite.setTint(0xff9090);
      sc.msg(`${this.T.name} 陷入狂怒！`, '#ff5050');
      sc.sfx('roar');
      sc.cameras.main.shake(500, 0.008);
    }

    if (this.action) {
      if (this.action.freeMove !== true) body.setVelocity(0, 0);
      this.action.t += dt;
      if (this.action.update) this.action.update(dt);
      if (this.action.t >= this.action.dur) this.action = null;
      return;
    }

    if (!this.summoned70 && frac < 0.7) { this.summoned70 = true; this.startAction('summon'); return; }
    if (!this.summoned35 && frac < 0.35) { this.summoned35 = true; this.startAction('summon'); return; }

    this.facing = dx >= 0 ? 1 : -1;
    this.sprite.setFlipX(this.facing > 0);
    this.actT -= dt;
    if (this.actT <= 0) {
      const pool = this.def.attacks;
      let a;
      if (dist < 170 && pool.includes('cleave') && Math.random() < 0.5) a = 'cleave';
      else a = pool[Math.floor(Math.random() * pool.length)];
      this.startAction(a);
      return;
    }
    const curSp = this.slowT > 0 ? this.speed * 0.55 : this.speed;
    if (dist - this.T.r - PLAYER_R > 50) {
      body.setVelocity((dx / dist) * curSp, (dy / dist) * curSp);
    } else body.setVelocity(0, 0);
  }

  startAction(kind) {
    const sc = this.scene;
    const cdMul = this.enraged ? 0.65 : 1;

    if (kind === 'cleave') {
      const R = 150;
      const cx = this.fx, cy = this.fy;
      const tele = sc.add.circle(cx, cy, R, 0xff1000, 0.15).setStrokeStyle(3, 0xff4020, 0.9).setDepth(3);
      const inner = sc.add.circle(cx, cy, 4, 0xff3010, 0.35).setDepth(3);
      const dur = this.enraged ? 650 : 850;
      const act = { t: 0, dur: dur + 300, fired: false };
      act.update = () => {
        if (act.fired) return;
        const prog = Math.min(1, act.t / dur);
        inner.setRadius(Math.max(4, R * prog));
        this.sprite.setAngle(-this.facing * prog * 10);
        if (prog >= 1) {
          act.fired = true;
          tele.destroy(); inner.destroy();
          this.sprite.setAngle(0);
          sc.slamEffect(cx, cy, R);
          const s = sc.add.image(cx, cy - Math.round(this.T.foot * 0.55), 'slash').setScale(this._customArt ? 2.8 : 2.6).setTint(0xff4060).setBlendMode(Phaser.BlendModes.ADD).setDepth(9200);
          sc.tweens.add({ targets: s, rotation: Math.PI * 2, alpha: 0, duration: 400, onComplete: () => s.destroy() });
          const p = sc.player;
          if (Math.hypot(p.fx - cx, p.fy - cy) < R + PLAYER_R) sc.hurtPlayer(this.dmg * 1.3, cx, cy, this);
        }
      };
      act.cleanup = () => { if (!act.fired) { tele.destroy(); inner.destroy(); } };
      this.action = act;
      this.actT = 1600 * cdMul;
    } else if (kind === 'barrage') {
      const waves = this.enraged ? 3 : 2;
      const count = this.enraged ? 9 : 7;
      this.action = { t: 0, dur: 450 + waves * 350 };
      for (let w = 0; w < waves; w++) {
        sc.time.delayedCall(350 + w * 350, () => {
          if (this.dead) return;
          const baseAng = Math.atan2(sc.player.fy - this.fy, sc.player.fx - this.fx);
          const arrowY = this.fy - Math.round(this.T.foot * 0.6);
          for (let i = 0; i < count; i++) {
            const off = (i - (count - 1) / 2) * 0.22;
            sc.spawnArrow(this.fx, arrowY, baseAng + off, this.dmg * 0.65, this);
          }
        });
      }
      this.actT = 2000 * cdMul;
    } else if (kind === 'charge') {
      const ang = Math.atan2(sc.player.fy - this.fy, sc.player.fx - this.fx);
      const len = 300;
      const tx = this.fx + Math.cos(ang) * len, ty = this.fy + Math.sin(ang) * len;
      const lane = sc.add.graphics().setDepth(3);
      lane.lineStyle(48, 0xff3020, 0.25).lineBetween(this.fx, this.fy, tx, ty);
      lane.lineStyle(2, 0xff8040, 0.85).lineBetween(this.fx, this.fy, tx, ty);
      const windDur = 700, rushDur = 380;
      const act = { t: 0, dur: windDur + rushDur + 150, freeMove: true, rushing: false, hit: false };
      act.update = () => {
        if (!act.rushing && act.t >= windDur) {
          act.rushing = true;
          lane.destroy();
          sc.sfx('roar');
          this.sprite.body.setVelocity(Math.cos(ang) * 760, Math.sin(ang) * 760);
        } else if (act.rushing && act.t < windDur + rushDur) {
          if (!act.hit && Math.hypot(sc.player.fx - this.fx, sc.player.fy - this.fy) < this.T.r + PLAYER_R + 10) {
            act.hit = true;
            sc.hurtPlayer(this.dmg * 1.2, this.fx, this.fy, this);
          }
        } else if (act.t >= windDur + rushDur) {
          this.sprite.body.setVelocity(0, 0);
        }
      };
      act.cleanup = () => { if (!act.rushing) lane.destroy(); };
      this.action = act;
      this.actT = 2200 * cdMul;
    } else if (kind === 'nova' || kind === 'frost_nova') {
      const isFrost = kind === 'frost_nova';
      const waves = this.enraged ? 4 : 3;
      const count = this.enraged ? 16 : 12;
      sc.sfx(isFrost ? 'frost' : 'nova');
      this.action = { t: 0, dur: 500 + waves * 380 };
      const castY = this.fy - Math.round(this.T.foot * 0.68);
      for (let w = 0; w < waves; w++) {
        sc.time.delayedCall(400 + w * 380, () => {
          if (this.dead) return;
          sc.sfx(isFrost ? 'frost' : 'nova');
          const off = (w % 2) * (Math.PI / count);
          for (let i = 0; i < count; i++) {
            const ang = (i / count) * Math.PI * 2 + off;
            if (isFrost) sc.spawnIceBolt(this.fx, castY, ang, this.dmg * 0.5, this);
            else sc.spawnOrb(this.fx, castY, ang, this.dmg * 0.5, this.bossType === 'blood' ? 'bloodbolt' : 'orb', this);
          }
        });
      }
      const g = sc.add.image(this.fx, castY, 'glow').setTint(this.def.light).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setDepth(9200);
      sc.tweens.add({ targets: g, scale: 2.5, alpha: 0, duration: 500 + waves * 380, onComplete: () => g.destroy() });
      this.actT = 2200 * cdMul;
    } else if (kind === 'slam') {
      const n = this.enraged ? 5 : 3;
      sc.sfx('roar');
      this.action = { t: 0, dur: 300 + n * 330 };
      for (let i = 0; i < n; i++) {
        sc.time.delayedCall(200 + i * 330, () => {
          if (this.dead) return;
          const p = sc.player;
          const tx = p.fx + p.sprite.body.velocity.x * 0.25, ty = p.fy + p.sprite.body.velocity.y * 0.25;
          sc.telegraph(tx, ty, 78, 850, () => {
            if (Math.hypot(sc.player.fx - tx, sc.player.fy - ty) < 78 + PLAYER_R) sc.hurtPlayer(this.dmg, tx, ty, this);
          }, this.def.light);
        });
      }
      this.actT = 2400 * cdMul;
    } else if (kind === 'summon') {
      sc.msg(`${this.T.name} 召喚了援軍！`, '#c080ff');
      sc.sfx('roar');
      this.action = { t: 0, dur: 1000 };
      const types = this.def.minions;
      types.forEach((type, i) => {
        const a = (i / types.length) * Math.PI * 2;
        let x = this.fx + Math.cos(a) * 130, y = this.fy + Math.sin(a) * 110;
        if (!sc.dungeon.walkableAt(x, y)) { x = this.fx; y = this.fy + 60; }
        sc.time.delayedCall(500, () => {
          if (this.dead) return;
          sc.burst(x, y, 20, [this.def.aura, 0x6020a0], 120);
          const e = sc.spawnEnemy(type, x, y, this.lvl);
          e.aggro = true;
        });
      });
      this.actT = 1500;
    }
  }

  destroyVisuals() {
    if (this.action && this.action.cleanup) this.action.cleanup();
    this.action = null;
    this.shadow.destroy();
    this.aura.destroy();
    this.scene.extraLights = this.scene.extraLights.filter((l) => l !== this.light);
  }
}
