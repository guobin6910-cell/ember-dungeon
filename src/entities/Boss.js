import Phaser from 'phaser';
import { PLAYER_R } from './Player.js';
import { state } from '../state.js';
import { getDifficulty } from '../systems/difficulty.js';
import { ensureEntityArtTexture } from '../systems/dungeonArt.js';
import { TILE } from '../systems/textures.js';

export const BOSS_TYPES = {
  bone: {
    name: '骸骨暴君',
    tex: 'boss_bone',
    hp: 680,
    dmg: 22,
    speed: 78,
    aura: 0xd0b060,
    light: 0xffc060,
    attacks: ['bone_cleave', 'bone_barrage', 'bone_charge', 'bone_prison'],
    minions: ['skeleton', 'bone_guard', 'archer'],
    skillSummary: '裂骨斬擊｜骨矛齊射｜暴君衝鋒｜骸骨牢籠',
  },
  blood: {
    name: '血月主教',
    tex: 'boss_blood',
    hp: 900,
    dmg: 25,
    speed: 74,
    aura: 0xd01830,
    light: 0xff3050,
    attacks: ['blood_siphon', 'crimson_cross', 'blood_pools', 'bat_swarm'],
    minions: ['bat', 'ghoul', 'blood_cultist'],
    skillSummary: '鮮血虹吸｜血月十字｜血池蔓延｜血蝠狂潮',
  },
  frost: {
    name: '霜魂領主',
    tex: 'boss_frost',
    hp: 1120,
    dmg: 27,
    speed: 72,
    aura: 0x40d0ff,
    light: 0x60e0ff,
    attacks: ['ice_donut', 'glacial_lance', 'blizzard_rain', 'frost_spiral'],
    minions: ['frost_mage', 'frost_wraith', 'bone_guard'],
    skillSummary: '絕對零度環｜極冰貫穿槍｜暴雪天降｜霜魂漩渦',
  },
  abyss: {
    name: '深淵領主',
    tex: 'boss',
    hp: 1400,
    dmg: 30,
    speed: 74,
    aura: 0xa020ff,
    light: 0xb040ff,
    attacks: ['meteor_apocalypse', 'void_blink', 'abyss_vortex', 'hellfire_fissure'],
    minions: ['pyro_demon', 'assassin', 'blood_cultist'],
    skillSummary: '深淵隕星雨｜虛空瞬斬｜深淵引力渦｜獄火裂隙',
  },
};

const CLOSE_MOVES = new Set(['bone_cleave', 'blood_siphon', 'ice_donut', 'abyss_vortex']);
const LONG_MOVES = new Set(['bone_charge', 'blood_pools', 'glacial_lance', 'void_blink']);

function pointSegDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return Math.hypot(px - x1, py - y1);
  const t = Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}

/** 層級 Boss（4 大原型各有專屬 4 招連段，隨無盡層數等比強化） */
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
    this.lastAttack = null;
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
    this.actT = 1500;
  }

  castBanner(title, color = '#ffd880') {
    this.scene.floatText(this.fx, this.sprite.y - this.T.h / 2 - 18, `【${title}】`, color, 17);
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
      if (this.action.t >= this.action.dur) {
        if (this.action.cleanup) this.action.cleanup(false);
        this.action = null;
      }
      return;
    }

    if (!this.summoned70 && frac < 0.7) { this.summoned70 = true; this.startAction('summon'); return; }
    if (!this.summoned35 && frac < 0.35) { this.summoned35 = true; this.startAction('summon'); return; }

    this.facing = dx >= 0 ? 1 : -1;
    this.sprite.setFlipX(this.facing > 0);
    this.actT -= dt;
    if (this.actT <= 0) {
      const pool = this.def.attacks;
      const cands = pool.length > 1 ? pool.filter((m) => m !== this.lastAttack) : pool;
      let a = null;
      if (dist < 190 && Math.random() < 0.45) {
        a = cands.find((m) => CLOSE_MOVES.has(m)) || null;
      } else if (dist > 230 && Math.random() < 0.45) {
        a = cands.find((m) => LONG_MOVES.has(m)) || null;
      }
      if (!a) a = cands[Math.floor(Math.random() * cands.length)];
      this.lastAttack = a;
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
    const p = sc.player;
    const cdMul = this.enraged ? 0.65 : 1;
    const makeAct = (dur, freeMove = false) => {
      const act = { t: 0, dur, freeMove, timers: [], objs: [] };
      act.after = (ms, fn) => {
        const ev = sc.time.delayedCall(ms, () => {
          if (!this.dead && this.action === act) fn();
        });
        act.timers.push(ev);
        return ev;
      };
      act.track = (obj, killOnFinish = true) => {
        if (obj) act.objs.push({ obj, killOnFinish });
        return obj;
      };
      act.cleanup = (interrupted = true) => {
        for (const ev of act.timers) ev?.remove?.(false);
        for (const entry of act.objs) {
          if ((interrupted || entry.killOnFinish) && entry.obj && entry.obj.active) {
            sc.tweens.killTweensOf(entry.obj);
            entry.obj.destroy();
          }
        }
        act.timers.length = 0;
        act.objs.length = 0;
        if (this.sprite?.active) {
          this.sprite.setAngle(0).setAlpha(1);
          this.sprite.body?.setVelocity?.(0, 0);
        }
      };
      return act;
    };

    // =========================================================================
    // 1) 骸骨暴君 (bone) — 裂骨斬擊 / 骨矛齊射 / 暴君衝鋒 / 骸骨牢籠
    // =========================================================================
    if (kind === 'bone_cleave') {
      this.castBanner('裂骨斬擊', '#f0d890');
      const R = 152;
      const cx = this.fx, cy = this.fy;
      const dur = this.enraged ? 650 : 850;
      const act = makeAct(dur + 300);
      const tele = act.track(sc.add.circle(cx, cy, R, 0xff2810, 0.16).setStrokeStyle(3, 0xff9030, 0.92).setDepth(3));
      const inner = act.track(sc.add.circle(cx, cy, 4, 0xff5020, 0.34).setDepth(3));
      let fired = false;
      act.update = () => {
        if (fired) return;
        const prog = Math.min(1, act.t / dur);
        if (inner.active) inner.setRadius(Math.max(4, R * prog));
        this.sprite.setAngle(-this.facing * prog * 11);
        if (prog >= 1) {
          fired = true;
          if (tele.active) tele.destroy();
          if (inner.active) inner.destroy();
          this.sprite.setAngle(0);
          sc.slamEffect(cx, cy, R, 0xff9040);
          const s = sc.add.image(cx, cy - Math.round(this.T.foot * 0.55), 'slash')
            .setScale(this._customArt ? 2.8 : 2.6).setTint(0xffc060)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(9200);
          sc.tweens.add({ targets: s, rotation: Math.PI * 2, alpha: 0, duration: 400, onComplete: () => s.destroy() });
          if (Math.hypot(p.fx - cx, p.fy - cy) < R + PLAYER_R) sc.hurtPlayer(this.dmg * 1.3, cx, cy, this);
          if (this.enraged) {
            const spearY = cy - Math.round(this.T.foot * 0.58);
            for (let i = 0; i < 4; i++) {
              sc.spawnBoneSpear(cx, spearY, i * (Math.PI / 2) + Math.PI / 4, this.dmg * 0.55, this, { speed: 340, silent: i > 0 });
            }
          }
        }
      };
      this.action = act;
      this.actT = 1550 * cdMul;
    } else if (kind === 'bone_barrage') {
      this.castBanner('骨矛齊射', '#f0d890');
      const waves = this.enraged ? 3 : 2;
      const count = this.enraged ? 9 : 7;
      const act = makeAct(420 + waves * 340);
      for (let w = 0; w < waves; w++) {
        act.after(320 + w * 340, () => {
          const baseAng = Math.atan2(p.fy - this.fy, p.fx - this.fx);
          const spearY = this.fy - Math.round(this.T.foot * 0.6);
          for (let i = 0; i < count; i++) {
            const off = (i - (count - 1) / 2) * 0.18;
            sc.spawnBoneSpear(this.fx, spearY, baseAng + off, this.dmg * 0.65, this, { speed: 400, silent: i > 0 });
          }
        });
      }
      this.action = act;
      this.actT = 1900 * cdMul;
    } else if (kind === 'bone_charge') {
      this.castBanner('暴君衝鋒', '#ff9850');
      const ang = Math.atan2(p.fy - this.fy, p.fx - this.fx);
      const len = 320;
      const tx = this.fx + Math.cos(ang) * len, ty = this.fy + Math.sin(ang) * len;
      const windDur = 680, rushDur = 380;
      const act = makeAct(windDur + rushDur + 220, true);
      const lane = act.track(sc.add.graphics().setDepth(3));
      lane.lineStyle(48, 0xff4020, 0.26).lineBetween(this.fx, this.fy, tx, ty);
      lane.lineStyle(2, 0xffb050, 0.9).lineBetween(this.fx, this.fy, tx, ty);
      let rushing = false, hit = false, stomped = false;
      act.update = () => {
        if (!rushing && act.t >= windDur) {
          rushing = true;
          if (lane.active) lane.destroy();
          sc.sfx('roar');
          this.sprite.body.setVelocity(Math.cos(ang) * 760, Math.sin(ang) * 760);
        } else if (rushing && act.t < windDur + rushDur) {
          if (!hit && Math.hypot(p.fx - this.fx, p.fy - this.fy) < this.T.r + PLAYER_R + 10) {
            hit = true;
            sc.hurtPlayer(this.dmg * 1.15, this.fx, this.fy, this);
          }
        } else if (!stomped && act.t >= windDur + rushDur) {
          stomped = true;
          this.sprite.body.setVelocity(0, 0);
          sc.slamEffect(this.fx, this.fy, 88, 0xff8030);
          if (Math.hypot(p.fx - this.fx, p.fy - this.fy) <= 88 + PLAYER_R) {
            sc.hurtPlayer(this.dmg * 0.9, this.fx, this.fy, this);
          }
        }
      };
      this.action = act;
      this.actT = 2100 * cdMul;
    } else if (kind === 'bone_prison') {
      this.castBanner('骸骨牢籠', '#e8d088');
      const cx = p.fx, cy = p.fy;
      const baseAng = Math.atan2(this.fy - cy, this.fx - cx);
      const n = this.enraged ? 6 : 5;
      const act = makeAct(this.enraged ? 1750 : 1200);
      sc.sfx('roar');
      for (let i = 0; i < n; i++) {
        const a = baseAng + (i / Math.max(1, n - 1)) * Math.PI * 1.55;
        let kx = cx + Math.cos(a) * 105, ky = cy + Math.sin(a) * 105;
        if (!sc.dungeon.walkableAt(kx, ky)) { kx = cx; ky = cy; }
        act.after(60 + i * 70, () => {
          sc.telegraph(kx, ky, 46, 860, () => {
            if (Math.hypot(p.fx - kx, p.fy - ky) <= 46 + PLAYER_R) sc.hurtPlayer(this.dmg * 0.9, kx, ky, this);
          }, 0xe0b858);
        });
      }
      if (this.enraged) {
        act.after(750, () => {
          sc.telegraph(cx, cy, 62, 680, () => {
            if (Math.hypot(p.fx - cx, p.fy - cy) <= 62 + PLAYER_R) sc.hurtPlayer(this.dmg, cx, cy, this);
          }, 0xff7020);
        });
      }
      this.action = act;
      this.actT = 2200 * cdMul;

    // =========================================================================
    // 2) 血月主教 (blood) — 鮮血虹吸 / 血月十字 / 血池蔓延 / 血蝠狂潮
    // =========================================================================
    } else if (kind === 'blood_siphon') {
      this.castBanner('鮮血虹吸', '#ff5070');
      const R = 185;
      const wind = 720;
      const chanDur = this.enraged ? 1750 : 1350;
      const act = makeAct(wind + chanDur);
      const ring = act.track(sc.add.circle(this.fx, this.fy, R, 0xb01028, 0.14).setStrokeStyle(3, 0xff4060, 0.85).setDepth(3));
      const tether = act.track(sc.add.graphics().setDepth(9180));
      let channeling = false, tickT = 0;
      act.update = (dt) => {
        const d = Math.hypot(p.fx - this.fx, p.fy - this.fy);
        if (!channeling) {
          const prog = Math.min(1, act.t / wind);
          if (ring.active) ring.setScale(0.35 + prog * 0.65);
          if (act.t >= wind) {
            channeling = true;
            tickT = 100;
            sc.sfx('soul');
          }
        } else {
          if (ring.active) ring.setAlpha(0.32 + Math.sin(act.t * 0.02) * 0.12);
          tether.clear();
          if (d <= R + PLAYER_R) {
            tether.lineStyle(5, 0xff2040, 0.35).lineBetween(this.fx, this.sprite.y, p.fx, p.sprite.y);
            tether.lineStyle(2, 0xffa0b0, 0.92).lineBetween(this.fx, this.sprite.y, p.fx, p.sprite.y);
            tickT -= dt;
            if (tickT <= 0) {
              tickT = 350;
              const dealt = sc.hurtPlayer(this.dmg * 0.42, this.fx, this.fy, this);
              if (dealt > 0) {
                const heal = Math.min(Math.round(this.maxHp * 0.025), Math.max(4, Math.round(dealt * 2.2)));
                this.hp = Math.min(this.maxHp, this.hp + heal);
                sc.floatText(this.fx, this.sprite.y - 32, `+${heal}`, '#ff6080', 15);
              }
            }
          }
        }
      };
      this.action = act;
      this.actT = 2200 * cdMul;
    } else if (kind === 'crimson_cross') {
      this.castBanner('血月十字', '#ff4060');
      const cx = this.fx, cy = this.fy;
      const len = 340, halfW = 22, delay = 780;
      const phases = this.enraged ? 2 : 1;
      const act = makeAct(phases === 2 ? delay + 1150 : delay + 320);
      const fireCross = (baseAng) => {
        const arms = [0, 1, 2, 3].map((k) => baseAng + (k * Math.PI) / 2);
        const gfx = act.track(sc.add.graphics().setDepth(3));
        arms.forEach((a) => {
          const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len;
          gfx.lineStyle(halfW * 2, 0xb01028, 0.24).lineBetween(cx, cy, ex, ey);
          gfx.lineStyle(2, 0xff5070, 0.88).lineBetween(cx, cy, ex, ey);
        });
        act.after(delay, () => {
          if (gfx.active) gfx.destroy();
          sc.sfx('nova');
          const flash = act.track(sc.add.graphics().setDepth(9190).setBlendMode(Phaser.BlendModes.ADD));
          let hit = false;
          arms.forEach((a) => {
            const ex = cx + Math.cos(a) * len, ey = cy + Math.sin(a) * len;
            flash.lineStyle(halfW * 2, 0xff2848, 0.78).lineBetween(cx, cy, ex, ey);
            flash.lineStyle(10, 0xffc0d0, 0.95).lineBetween(cx, cy, ex, ey);
            if (!hit && pointSegDist(p.fx, p.fy, cx, cy, ex, ey) <= halfW + PLAYER_R) {
              hit = true;
              sc.hurtPlayer(this.dmg * 1.2, cx, cy, this);
            }
          });
          act.after(230, () => { if (flash.active) flash.destroy(); });
        });
      };
      fireCross(0);
      if (this.enraged) act.after(820, () => fireCross(Math.PI / 4));
      this.action = act;
      this.actT = 2200 * cdMul;
    } else if (kind === 'blood_pools') {
      this.castBanner('血池蔓延', '#e02848');
      const n = this.enraged ? 5 : 3;
      const act = makeAct(350 + n * 340);
      sc.sfx('roar');
      for (let i = 0; i < n; i++) {
        act.after(180 + i * 340, () => {
          let tx = p.fx + p.sprite.body.velocity.x * 0.28 + Phaser.Math.Between(-36, 36);
          let ty = p.fy + p.sprite.body.velocity.y * 0.28 + Phaser.Math.Between(-36, 36);
          if (!sc.dungeon.walkableAt(tx, ty)) { tx = p.fx; ty = p.fy; }
          sc.telegraph(tx, ty, 68, 820, () => {
            if (Math.hypot(p.fx - tx, p.fy - ty) <= 68 + PLAYER_R) sc.hurtPlayer(this.dmg * 0.85, tx, ty, this);
            sc.spawnHostileHazard(tx, ty, 64, 5500, Math.max(2, Math.round(this.dmg * 0.35)), {
              kind: 'blood_pool', healOwner: this,
            });
          }, 0xe02040);
        });
      }
      this.action = act;
      this.actT = 2300 * cdMul;
    } else if (kind === 'bat_swarm') {
      this.castBanner('血蝠狂潮', '#ff6080');
      const waves = this.enraged ? 4 : 3;
      const count = this.enraged ? 10 : 8;
      const act = makeAct(420 + waves * 360);
      const castY = this.fy - Math.round(this.T.foot * 0.65);
      for (let w = 0; w < waves; w++) {
        act.after(320 + w * 360, () => {
          sc.sfx('nova');
          const curve = w % 2 === 0 ? 0.55 : -0.55;
          const off = (w % 2) * (Math.PI / count);
          for (let i = 0; i < count; i++) {
            const ang = (i / count) * Math.PI * 2 + off;
            sc.spawnOrb(this.fx, castY, ang, this.dmg * 0.52, 'bloodbolt', this, { speed: 235, curve });
          }
        });
      }
      this.action = act;
      this.actT = 2000 * cdMul;

    // =========================================================================
    // 3) 霜魂領主 (frost) — 絕對零度環 / 極冰貫穿槍 / 暴雪天降 / 霜魂漩渦
    // =========================================================================
    } else if (kind === 'ice_donut') {
      this.castBanner('絕對零度環', '#70e8ff');
      const cx = this.fx, cy = this.fy;
      const innerR = 95, outerR = 235, wind = 900;
      const act = makeAct(this.enraged ? wind + 750 : wind + 260);
      const gfx = act.track(sc.add.graphics().setDepth(3));
      const midR = (innerR + outerR) / 2, bandW = outerR - innerR;
      let fired = false;
      act.update = () => {
        if (fired) return;
        const prog = Math.min(1, act.t / wind);
        gfx.clear();
        gfx.lineStyle(bandW, 0x30b8ff, 0.12 + 0.16 * prog).strokeCircle(cx, cy, midR);
        gfx.lineStyle(3, 0x90f8ff, 0.9).strokeCircle(cx, cy, outerR);
        gfx.lineStyle(3, 0xd8ffff, 0.95).strokeCircle(cx, cy, innerR);
        if (prog >= 1) {
          fired = true;
          gfx.destroy();
          sc.sfx('frost');
          sc.burst(cx, cy - 8, 22, [0x60d8ff, 0xd8f8ff], 240, 520);
          const ring = sc.add.circle(cx, cy, midR, 0x60d8ff, 0).setStrokeStyle(bandW * 0.7, 0x90f8ff, 0.55).setBlendMode(Phaser.BlendModes.ADD).setDepth(9200);
          sc.tweens.add({ targets: ring, alpha: 0, scale: 1.06, duration: 360, onComplete: () => ring.destroy() });
          const d = Math.hypot(p.fx - cx, p.fy - cy);
          if (d >= innerR - PLAYER_R * 0.4 && d <= outerR + PLAYER_R) {
            const dealt = sc.hurtPlayer(this.dmg * 1.25, cx, cy, this);
            if (dealt > 0) p.applySlow(2200);
          }
          if (this.enraged) {
            sc.telegraph(cx, cy, 88, 650, () => {
              if (Math.hypot(p.fx - cx, p.fy - cy) <= 88 + PLAYER_R) {
                const dealt = sc.hurtPlayer(this.dmg, cx, cy, this);
                if (dealt > 0) p.applySlow(1800);
              }
            }, 0x80f0ff);
          }
        }
      };
      this.action = act;
      this.actT = 2200 * cdMul;
    } else if (kind === 'glacial_lance') {
      this.castBanner('極冰貫穿槍', '#90f4ff');
      const volleys = this.enraged ? 2 : 1;
      const act = makeAct(volleys === 2 ? 2100 : 1200);
      const fireLance = () => {
        const ang = Math.atan2(p.fy - this.fy, p.fx - this.fx);
        const cx = this.fx, cy = this.fy - Math.round(this.T.foot * 0.55);
        const len = 460;
        const beam = act.track(sc.add.graphics().setDepth(3));
        beam.lineStyle(22, 0x40c8ff, 0.25).lineBetween(cx, cy, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
        beam.lineStyle(3, 0xb8f8ff, 0.92).lineBetween(cx, cy, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
        act.after(640, () => {
          if (beam.active) beam.destroy();
          sc.sfx('frost');
          for (let i = 0; i < 5; i++) {
            act.after(i * 65, () => {
              sc.spawnIceBolt(this.fx, this.fy - Math.round(this.T.foot * 0.55), ang, this.dmg * 0.72, this, {
                speed: 460, scale: 1.22, life: 1500, silent: i > 0,
              });
            });
          }
        });
      };
      fireLance();
      if (this.enraged) act.after(1050, fireLance);
      this.action = act;
      this.actT = 2100 * cdMul;
    } else if (kind === 'blizzard_rain') {
      this.castBanner('暴雪天降', '#80e8ff');
      const n = this.enraged ? 7 : 5;
      const act = makeAct(350 + n * 260);
      sc.sfx('frost');
      for (let i = 0; i < n; i++) {
        act.after(150 + i * 260, () => {
          let tx = p.fx + p.sprite.body.velocity.x * 0.25 + Phaser.Math.Between(-55, 55);
          let ty = p.fy + p.sprite.body.velocity.y * 0.25 + Phaser.Math.Between(-55, 55);
          if (!sc.dungeon.walkableAt(tx, ty)) { tx = p.fx; ty = p.fy; }
          sc.telegraph(tx, ty, 64, 760, () => {
            if (Math.hypot(p.fx - tx, p.fy - ty) <= 64 + PLAYER_R) {
              const dealt = sc.hurtPlayer(this.dmg * 0.85, tx, ty, this);
              if (dealt > 0) p.applySlow(1800);
            }
            sc.spawnHostileHazard(tx, ty, 56, 4000, Math.max(2, Math.round(this.dmg * 0.28)), {
              kind: 'frost_zone', slow: 1200,
            });
          }, 0x50d8ff);
        });
      }
      this.action = act;
      this.actT = 2300 * cdMul;
    } else if (kind === 'frost_spiral') {
      this.castBanner('霜魂漩渦', '#a0f8ff');
      const waves = this.enraged ? 7 : 5;
      const act = makeAct(360 + waves * 260);
      const castY = this.fy - Math.round(this.T.foot * 0.65);
      for (let w = 0; w < waves; w++) {
        act.after(260 + w * 260, () => {
          sc.sfx('frost');
          const base = w * 0.26;
          for (let i = 0; i < 8; i++) {
            sc.spawnIceBolt(this.fx, castY, base + (i / 8) * Math.PI * 2, this.dmg * 0.48, this, { speed: 220, silent: i > 0 });
          }
        });
      }
      this.action = act;
      this.actT = 2050 * cdMul;

    // =========================================================================
    // 4) 深淵領主 (abyss) — 深淵隕星雨 / 虛空瞬斬 / 深淵引力渦 / 獄火裂隙
    // =========================================================================
    } else if (kind === 'meteor_apocalypse') {
      this.castBanner('深淵隕星雨', '#ff9040');
      const n = this.enraged ? 6 : 4;
      const act = makeAct(420 + n * 320);
      sc.sfx('roar');
      for (let i = 0; i < n; i++) {
        act.after(180 + i * 320, () => {
          let tx = p.fx + p.sprite.body.velocity.x * 0.28 + Phaser.Math.Between(-48, 48);
          let ty = p.fy + p.sprite.body.velocity.y * 0.28 + Phaser.Math.Between(-48, 48);
          if (!sc.dungeon.walkableAt(tx, ty)) { tx = p.fx; ty = p.fy; }
          const meteor = act.track(sc.add.image(tx - 28, ty - 220, 'fireball').setScale(1.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(9300), false);
          sc.tweens.add({ targets: meteor, x: tx, y: ty - 6, duration: 880, ease: 'Cubic.In', onComplete: () => { if (meteor.active) meteor.destroy(); } });
          sc.telegraph(tx, ty, 82, 880, () => {
            sc.sfx('meteor');
            if (Math.hypot(p.fx - tx, p.fy - ty) <= 82 + PLAYER_R) sc.hurtPlayer(this.dmg * 1.1, tx, ty, this);
            sc.spawnHostileHazard(tx, ty, 66, 5000, Math.max(3, Math.round(this.dmg * 0.35)), { kind: 'lava_patch' });
          }, 0xff6010);
        });
      }
      this.action = act;
      this.actT = 2400 * cdMul;
    } else if (kind === 'void_blink') {
      this.castBanner('虛空瞬斬', '#d070ff');
      const br = sc.bossRoom;
      const canLand = (x, y) => {
        if (br) {
          if (x < (br.x + 1.5) * TILE || x > (br.x + br.w - 1.5) * TILE || y < (br.y + 1.5) * TILE || y > (br.y + br.h - 1.5) * TILE) return false;
        }
        return sc.dungeon.walkableAt(x, y)
          && sc.dungeon.walkableAt(x - 24, y) && sc.dungeon.walkableAt(x + 24, y)
          && sc.dungeon.walkableAt(x, y - 24) && sc.dungeon.walkableAt(x, y + 24);
      };
      let tx = this.fx, ty = this.fy;
      for (let k = 0; k < 14; k++) {
        const a = Math.random() * Math.PI * 2;
        const cx = p.fx + Math.cos(a) * 84, cy = p.fy + Math.sin(a) * 84;
        if (canLand(cx, cy)) { tx = cx; ty = cy; break; }
      }
      const act = makeAct(1150);
      this.sprite.setAlpha(0.28);
      sc.burst(this.fx, this.fy - 20, 14, [0xb040ff, 0x601090], 130, 360);
      const R = 135;
      const tele = act.track(sc.add.circle(tx, ty, R, 0xa020ff, 0.16).setStrokeStyle(3, 0xd070ff, 0.92).setDepth(3));
      const inner = act.track(sc.add.circle(tx, ty, 6, 0xc050ff, 0.3).setDepth(3));
      let blinked = false, slammed = false;
      act.update = () => {
        const prog = Math.min(1, act.t / 720);
        if (!slammed && inner.active) inner.setRadius(Math.max(6, R * prog));
        if (!blinked && act.t >= 480) {
          blinked = true;
          this.sprite.setPosition(tx, ty - this.T.foot).setAlpha(1);
          sc.sfx('blink');
          sc.burst(tx, ty - 20, 16, [0xc060ff, 0xffffff], 150, 380);
        }
        if (!slammed && act.t >= 760) {
          slammed = true;
          if (tele.active) tele.destroy();
          if (inner.active) inner.destroy();
          sc.slamEffect(tx, ty, R, 0xb040ff);
          if (Math.hypot(p.fx - tx, p.fy - ty) <= R + PLAYER_R) sc.hurtPlayer(this.dmg * 1.25, tx, ty, this);
          if (this.enraged) {
            const castY = ty - Math.round(this.T.foot * 0.6);
            for (let i = 0; i < 6; i++) {
              sc.spawnOrb(tx, castY, (i / 6) * Math.PI * 2, this.dmg * 0.55, 'voidbolt', this, { speed: 260 });
            }
          }
        }
      };
      this.action = act;
      this.actT = 2150 * cdMul;
    } else if (kind === 'abyss_vortex') {
      this.castBanner('深淵引力渦', '#b040ff');
      const cx = this.fx, cy = this.fy;
      const R = 175, pullDur = 1200;
      const act = makeAct(pullDur + 350);
      const gfx = act.track(sc.add.graphics().setDepth(3));
      let detonated = false;
      act.update = (dt) => {
        if (detonated) return;
        const prog = Math.min(1, act.t / pullDur);
        gfx.clear();
        gfx.lineStyle(3, 0xb040ff, 0.82).strokeCircle(cx, cy, R * (1 - prog * 0.25));
        gfx.lineStyle(2, 0xe088ff, 0.55).strokeCircle(cx, cy, R * ((1 - prog) * 0.7 + 0.15));
        if (!p.dead && !p.dodge && !p.dash) {
          const pdx = cx - p.fx, pdy = cy - p.fy;
          const dist = Math.hypot(pdx, pdy) || 1;
          if (dist > this.T.r + PLAYER_R + 12 && dist < 270) {
            const step = 120 * (dt / 1000);
            const nx = p.fx + (pdx / dist) * step;
            const ny = p.fy + (pdy / dist) * step;
            if (sc.dungeon.walkableAt(nx, p.fy)) p.sprite.x = nx;
            if (sc.dungeon.walkableAt(p.fx, ny)) p.sprite.y = ny - p.foot;
          }
        }
        if (act.t >= pullDur) {
          detonated = true;
          gfx.destroy();
          sc.slamEffect(cx, cy, R, 0xa030ff);
          sc.sfx('nova');
          if (Math.hypot(p.fx - cx, p.fy - cy) <= R + PLAYER_R) sc.hurtPlayer(this.dmg * 1.2, cx, cy, this);
          const count = this.enraged ? 12 : 10;
          const castY = cy - Math.round(this.T.foot * 0.65);
          for (let i = 0; i < count; i++) {
            sc.spawnOrb(cx, castY, (i / count) * Math.PI * 2, this.dmg * 0.55, 'voidbolt', this, { speed: 245 });
          }
        }
      };
      this.action = act;
      this.actT = 2300 * cdMul;
    } else if (kind === 'hellfire_fissure') {
      this.castBanner('獄火裂隙', '#ff7030');
      const cx = this.fx, cy = this.fy;
      const baseAng = Math.atan2(p.fy - cy, p.fx - cx);
      const rays = this.enraged ? 5 : 3;
      const act = makeAct(1350);
      sc.sfx('roar');
      for (let rIdx = 0; rIdx < rays; rIdx++) {
        const ang = baseAng + (rIdx - (rays - 1) / 2) * 0.36;
        for (let step = 1; step <= 4; step++) {
          const rx = cx + Math.cos(ang) * (step * 72);
          const ry = cy + Math.sin(ang) * (step * 72);
          if (!sc.dungeon.walkableAt(rx, ry)) break;
          act.after(step * 110, () => {
            sc.telegraph(rx, ry, 48, 560, () => {
              if (Math.hypot(p.fx - rx, p.fy - ry) <= 48 + PLAYER_R) sc.hurtPlayer(this.dmg * 0.9, rx, ry, this);
            }, 0xff5010);
          });
        }
      }
      this.action = act;
      this.actT = 2250 * cdMul;

    } else if (kind === 'summon') {
      sc.msg(`${this.T.name} 召喚了援軍！`, '#c080ff');
      sc.sfx('roar');
      const act = makeAct(1000);
      const types = this.def.minions;
      types.forEach((type, i) => {
        const a = (i / types.length) * Math.PI * 2;
        let x = this.fx + Math.cos(a) * 130, y = this.fy + Math.sin(a) * 110;
        if (!sc.dungeon.walkableAt(x, y)) { x = this.fx; y = this.fy + 60; }
        act.after(500, () => {
          sc.burst(x, y, 20, [this.def.aura, 0x6020a0], 120);
          const e = sc.spawnEnemy(type, x, y, this.lvl);
          e.aggro = true;
        });
      });
      this.action = act;
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
