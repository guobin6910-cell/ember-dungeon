import Phaser from 'phaser';
import { PLAYER_R } from './Player.js';
import { state } from '../state.js';
import { getDifficulty } from '../systems/difficulty.js';

export const ENEMY_TYPES = {
  skeleton: {
    name: '骷髏兵', tex: 'skeleton', w: 36, h: 48, r: 11, foot: 12,
    hp: 34, dmg: 7, speed: 92, range: 18, atkCd: 1150, windup: 320, xp: 12, gold: [2, 8], drop: 0.14, bookDrop: 0.03,
  },
  archer: {
    name: '骷髏弓手', tex: 'archer', w: 36, h: 48, r: 11, foot: 12,
    hp: 24, dmg: 8, speed: 80, ranged: true, range: 340, keep: 170, atkCd: 2000, windup: 520, xp: 16, gold: [3, 9], drop: 0.18, bookDrop: 0.04,
  },
  gargoyle: {
    name: '精英石像鬼', tex: 'gargoyle', w: 64, h: 64, r: 17, foot: 18, elite: true,
    hp: 190, dmg: 18, speed: 108, range: 26, slam: 92, atkCd: 1900, windup: 680, xp: 75, gold: [15, 35], drop: 0.85, bookDrop: 0.22,
  },
  bat: {
    name: '血翼蝙蝠', tex: 'bat', w: 42, h: 30, r: 10, foot: 8,
    hp: 20, dmg: 6, speed: 148, range: 16, atkCd: 900, windup: 200, xp: 10, gold: [2, 6], drop: 0.12, bookDrop: 0.03, lifesteal: 0.5,
  },
  necromancer: {
    name: '死靈法師', tex: 'necromancer', w: 36, h: 48, r: 11, foot: 12,
    hp: 38, dmg: 10, speed: 74, ranged: true, bolt: 'orb', range: 360, keep: 200, atkCd: 2100, windup: 540, summonCd: 7500, xp: 24, gold: [5, 12], drop: 0.22, bookDrop: 0.06,
  },
  assassin: {
    name: '暗影刺客', tex: 'assassin', w: 36, h: 48, r: 10, foot: 12,
    hp: 32, dmg: 14, speed: 132, range: 95, lunge: true, stealth: true, atkCd: 1500, windup: 420, xp: 22, gold: [4, 11], drop: 0.2, bookDrop: 0.05,
  },
  frost_mage: {
    name: '寒冰巫師', tex: 'frost_mage', w: 36, h: 48, r: 11, foot: 12,
    hp: 34, dmg: 9, speed: 76, ranged: true, bolt: 'ice', spread: 3, range: 350, keep: 185, atkCd: 2200, windup: 560, xp: 24, gold: [5, 12], drop: 0.22, bookDrop: 0.06,
  },
  golem: {
    name: '精英熔岩魔像', tex: 'golem', w: 64, h: 64, r: 19, foot: 20, elite: true,
    hp: 260, dmg: 22, speed: 74, range: 28, slam: 108, deathBoom: 105, atkCd: 2200, windup: 780, xp: 95, gold: [22, 46], drop: 0.9, bookDrop: 0.28,
  },
  spider: {
    name: '地城毒蛛', tex: 'spider', w: 42, h: 36, r: 10, foot: 10,
    hp: 28, dmg: 8, speed: 128, range: 18, webRange: 250, webCd: 4200, atkCd: 1050, windup: 260, xp: 15, gold: [3, 8], drop: 0.16, bookDrop: 0.04,
  },
  dummy: {
    name: '訓練木樁', tex: 'dummy', w: 36, h: 36, r: 12, foot: 10, isDummy: true,
    hp: 999999, dmg: 0, speed: 0, range: 0, atkCd: 99999, windup: 0, xp: 0, gold: [0, 0], drop: 0, bookDrop: 0,
  },
};

const rand = Phaser.Math.Between;

export default class Enemy {
  constructor(scene, type, x, y, lvl = 1) {
    const T = ENEMY_TYPES[type];
    this.scene = scene;
    this.type = type;
    this.T = T;
    this.lvl = lvl;
    this.isDummy = !!T.isDummy;
    const diff = getDifficulty(state.difficulty);
    this.maxHp = this.isDummy ? T.hp : Math.max(1, Math.round(T.hp * (1 + (lvl - 1) * 0.22) * diff.hpMul));
    this.hp = this.maxHp;
    this.dmg = this.isDummy ? 0 : Math.max(1, Math.round(T.dmg * (1 + (lvl - 1) * 0.14) * diff.dmgMul));
    this.xp = this.isDummy ? 0 : Math.max(1, Math.round(T.xp * (1 + (lvl - 1) * 0.2) * diff.xpMul));
    this.speed = T.speed;

    this.shadow = scene.add.image(x, y, 'shadowtex').setScale(T.r / 13, T.r / 34).setDepth(2);
    if (T.elite || this.isDummy) {
      if (T.elite) {
        this.aura = scene.add.image(x, y, 'glow').setTint(type === 'golem' ? 0xff5010 : 0xffa020)
          .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setScale(1.2, 0.5).setDepth(2);
      }
      this.label = scene.add.text(x, y - T.h / 2 - 22, T.name, {
        fontFamily: '"Microsoft JhengHei", sans-serif', fontSize: '14px',
        color: this.isDummy ? '#d8c088' : '#f0c040', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(9450);
    }
    this.sprite = scene.physics.add.sprite(x, y - T.foot, T.tex);
    this.sprite.body.setCircle(T.r, T.w / 2 - T.r, T.h / 2 + T.foot - T.r);
    if (this.isDummy) this.sprite.body.immovable = true;
    this.sprite.enemy = this;

    this.aggro = false;
    this.aggroDist = T.aggroDist || 330;
    this.atkT = rand(200, 900);
    this.webT = T.webCd ? rand(1000, T.webCd) : 0;
    this.summonT = T.summonCd ? rand(2500, T.summonCd) : 0;
    this.summons = [];
    this.wind = null;
    this.path = null;
    this.repathT = 0;
    this.wanderT = rand(1000, 4000);
    this.home = { x, y };
    this.flashT = 0;
    this.slowT = 0;
    this._wasSlow = false;
    this.knock = null;
    this.dead = false;
    this.walkT = Math.random() * 1000;
    this.facing = 1;
  }

  get fx() { return this.sprite.x; }
  get fy() { return this.sprite.y + this.T.foot; }

  flash(color = 0xffffff, duration = 100) {
    this.flashT = duration;
    this.sprite.setTintFill(color);
    if (!this.wind && state.vfxEnabled && !this.dead) {
      this._flashTween?.stop();
      this.sprite.setScale(1.13, 0.89);
      this._flashTween = this.scene.tweens.add({
        targets: this.sprite,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: 'Quad.Out',
      });
    }
  }

  applySlow(ms) {
    if (this.isDummy) return;
    this.slowT = Math.max(this.slowT, ms);
  }

  knockback(ax, ay, force = 160) {
    if (this.isDummy) {
      const dir = ax >= 0 ? 1 : -1;
      this._wobbleTween?.stop();
      this.sprite.setAngle(0);
      this._wobbleTween = this.scene.tweens.add({
        targets: this.sprite,
        angle: dir * 11,
        duration: 55,
        yoyo: true,
        ease: 'Quad.Out',
      });
      return;
    }
    if (this.T.elite) force *= 0.42;
    const d = Math.hypot(ax, ay) || 1;
    this.knock = { vx: (ax / d) * force, vy: (ay / d) * force, t: 115 };
  }

  moveToward(tx, ty, speed, dt) {
    const sc = this.scene;
    const body = this.sprite.body;
    if (sc.dungeon.lineClear(this.fx, this.fy, tx, ty, this.T.r)) {
      this.path = null;
      const dx = tx - this.fx, dy = ty - this.fy;
      const d = Math.hypot(dx, dy) || 1;
      body.setVelocity((dx / d) * speed, (dy / d) * speed);
      return;
    }
    this.repathT -= dt;
    if ((!this.path || !this.path.length) && this.repathT <= 0) {
      this.repathT = 500 + Math.random() * 300;
      if (sc.pathBudget > 0) {
        sc.pathBudget--;
        this.path = sc.pf.worldPath(this.fx, this.fy, tx, ty, this.T.r, 1500);
      }
    }
    if (this.path && this.path.length) {
      const p = this.path[0];
      const dx = p.x - this.fx, dy = p.y - this.fy;
      const d = Math.hypot(dx, dy);
      if (d < 8) { this.path.shift(); return; }
      body.setVelocity((dx / d) * speed, (dy / d) * speed);
    } else {
      body.setVelocity(0, 0);
    }
  }

  update(dt) {
    if (this.dead) return;
    const sc = this.scene;
    const p = sc.player;
    const body = this.sprite.body;
    const T = this.T;

    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) {
        if (this.slowT > 0) this.sprite.setTint(0x70d0ff);
        else this.sprite.clearTint();
      }
    } else {
      const slow = this.slowT > 0;
      if (slow !== this._wasSlow) {
        this._wasSlow = slow;
        if (slow) this.sprite.setTint(0x70d0ff);
        else this.sprite.clearTint();
      }
    }

    if (this.isDummy) {
      this.hp = this.maxHp;
      body.setVelocity(0, 0);
      this.sprite.setDepth(this.fy);
      return;
    }

    this.slowT = Math.max(0, this.slowT - dt);
    this.atkT -= dt;
    const spd = this.slowT > 0 ? this.speed * 0.4 : this.speed;

    const dx = p.fx - this.fx, dy = p.fy - this.fy;
    const dist = Math.hypot(dx, dy);
    const gap = dist - T.r - PLAYER_R;

    if (!this.aggro) {
      if (!p.dead && dist < (this.aggroDist || 330) && sc.dungeon.lineClear(this.fx, this.fy, p.fx, p.fy)) this.aggro = true;
    } else if (dist > 1000 || p.dead) {
      this.aggro = false;
      this.aggroDist = T.aggroDist || 330;
    }

    // 潛行透明效果
    if (T.stealth) {
      this.sprite.setAlpha(this.aggro && !this.wind && this.flashT <= 0 ? 0.45 : 1);
    }

    // 毒蛛噴吐蛛網
    if (T.webCd && this.aggro && !p.dead && !this.wind && !this.knock) {
      this.webT -= dt;
      if (this.webT <= 0 && dist > 95 && dist <= T.webRange && sc.dungeon.lineClear(this.fx, this.fy, p.fx, p.fy, 3)) {
        this.webT = T.webCd;
        sc.spawnWebBolt(this.fx, this.fy - 6, Math.atan2(dy, dx), Math.max(2, Math.round(this.dmg * 0.6)), this);
      }
    }

    // 死靈法師召喚骷髏
    if (T.summonCd && this.aggro && !p.dead && !this.wind && !this.knock) {
      this.summonT -= dt;
      if (this.summonT <= 0) {
        this.summonT = T.summonCd;
        this.summons = this.summons.filter((s) => !s.dead);
        if (this.summons.length < 2) {
          const sx = this.fx + rand(-65, 65), sy = this.fy + rand(-65, 65);
          if (sc.dungeon.walkableAt(sx, sy)) {
            sc.burst(sx, sy, 12, [0xa040ff, 0x6020a0], 90);
            const sub = sc.spawnEnemy('skeleton', sx, sy, this.lvl);
            sub.aggro = true;
            this.summons.push(sub);
          }
        }
      }
    }

    if (this.knock) {
      body.setVelocity(this.knock.vx, this.knock.vy);
      this.knock.t -= dt;
      if (this.knock.t <= 0) this.knock = null;
    } else if (this.wind) {
      body.setVelocity(0, 0);
      this.wind.t -= dt;
      const prog = 1 - this.wind.t / this.wind.dur;
      this.sprite.setScale(1 + prog * 0.12, 1 - prog * 0.08);
      if (this.wind.tele) this.wind.tele.setScale(0.3 + prog * 0.7).setAlpha(0.25 + prog * 0.35);
      if (this.wind.t <= 0) this.release();
    } else if (this.aggro && !p.dead) {
      this.facing = dx >= 0 ? 1 : -1;
      if (T.ranged) {
        const los = sc.dungeon.lineClear(this.fx, this.fy, p.fx, p.fy, 3);
        if (gap < T.keep * 0.6 && los) {
          const tx = this.fx - (dx / dist) * 60, ty = this.fy - (dy / dist) * 60;
          if (sc.dungeon.walkableAt(tx, ty)) this.moveToward(tx, ty, spd * 0.9, dt);
          else this.tryShoot(dx, dy, dist);
        } else if (!los || dist > T.range) {
          this.moveToward(p.fx, p.fy, spd, dt);
        } else {
          body.setVelocity(0, 0);
          this.tryShoot(dx, dy, dist);
        }
      } else if (gap <= T.range) {
        body.setVelocity(0, 0);
        if (this.atkT <= 0) this.startWind();
      } else {
        this.moveToward(p.fx, p.fy, spd, dt);
      }
    } else {
      // 閒晃
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = rand(2000, 5000);
        const tx = this.home.x + rand(-80, 80), ty = this.home.y + rand(-80, 80);
        this.wanderTo = sc.dungeon.walkableAt(tx, ty) ? { x: tx, y: ty } : null;
      }
      if (this.wanderTo) {
        const wx = this.wanderTo.x - this.fx, wy = this.wanderTo.y - this.fy;
        const wd = Math.hypot(wx, wy);
        if (wd < 6) { this.wanderTo = null; body.setVelocity(0, 0); }
        else { body.setVelocity((wx / wd) * spd * 0.35, (wy / wd) * spd * 0.35); this.facing = wx >= 0 ? 1 : -1; }
      } else body.setVelocity(0, 0);
    }

    // 動畫
    const moving = body.velocity.length() > 5;
    if (!this.wind) {
      if (moving) { this.walkT += dt; this.sprite.setAngle(Math.sin(this.walkT * 0.016) * 6); }
      else this.sprite.setAngle(this.sprite.angle * 0.8);
    }
    this.sprite.setFlipX(this.facing < 0);
    this.sprite.setDepth(this.fy);
    this.shadow.setPosition(this.fx, this.fy + 2);
    if (this.aura) this.aura.setPosition(this.fx, this.fy);
    if (this.label) this.label.setPosition(this.fx, this.sprite.y - T.h / 2 - 22);
  }

  tryShoot(dx, dy, dist) {
    if (this.atkT <= 0 && dist <= this.T.range) this.startWind();
  }

  startWind() {
    const T = this.T;
    this.wind = { t: T.windup, dur: T.windup };
    if (T.slam) {
      this.wind.tele = this.scene.add.circle(this.fx, this.fy, T.slam, 0xff2000, 0.3).setStrokeStyle(2, 0xff6020, 0.9).setDepth(3);
    }
    if (T.ranged) this.sprite.setTint(T.bolt === 'ice' ? 0x90f0ff : T.bolt === 'orb' ? 0xd080ff : 0xb0ffb0);
    if (T.lunge) this.sprite.setTint(0xff6090);
  }

  release() {
    const sc = this.scene, p = sc.player, T = this.T;
    const tele = this.wind.tele;
    this.wind = null;
    this.atkT = T.atkCd * (0.85 + Math.random() * 0.3);
    this.sprite.setScale(1);
    if (!this.flashT) {
      if (this.slowT > 0) this.sprite.setTint(0x70d0ff);
      else this.sprite.clearTint();
    }
    if (this.dead) { if (tele) tele.destroy(); return; }
    const dx = p.fx - this.fx, dy = p.fy - this.fy;
    const dist = Math.hypot(dx, dy) || 1;
    if (T.slam) {
      tele.destroy();
      sc.slamEffect(this.fx, this.fy, T.slam);
      if (dist <= T.slam + PLAYER_R) sc.hurtPlayer(this.dmg, this.fx, this.fy, this);
    } else if (T.ranged) {
      const lead = 0.25;
      const tx = p.fx + p.sprite.body.velocity.x * lead * Math.random();
      const ty = p.fy + p.sprite.body.velocity.y * lead * Math.random();
      const ang = Math.atan2(ty - this.fy, tx - this.fx);
      if (T.bolt === 'ice') {
        for (const off of [-0.22, 0, 0.22]) sc.spawnIceBolt(this.fx, this.fy - 10, ang + off, this.dmg, this);
      } else if (T.bolt === 'orb') {
        sc.spawnOrb(this.fx, this.fy - 10, ang, this.dmg, 'orb', this);
      } else {
        sc.spawnArrow(this.fx, this.fy - 10, ang, this.dmg, this);
      }
    } else if (T.lunge) {
      this.knock = { vx: (dx / dist) * 420, vy: (dy / dist) * 420, t: 160 };
      sc.sfx('dash');
      if (dist <= 120) sc.hurtPlayer(this.dmg, this.fx, this.fy, this);
    } else {
      this.scene.tweens.add({ targets: this.sprite, x: this.sprite.x + (dx / dist) * 8, duration: 70, yoyo: true });
      if (dist - T.r - PLAYER_R <= T.range + 16) {
        const dealt = sc.hurtPlayer(this.dmg, this.fx, this.fy, this);
        if (T.lifesteal && dealt > 0) {
          const heal = Math.max(1, Math.round(dealt * T.lifesteal));
          this.hp = Math.min(this.maxHp, this.hp + heal);
          sc.floatText(this.fx, this.sprite.y - 16, `+${heal}`, '#ff7090', 14);
        }
      } else sc.sfx('swing');
    }
  }

  destroyVisuals() {
    this._flashTween?.stop();
    this._wobbleTween?.stop();
    this.shadow.destroy();
    if (this.aura) this.aura.destroy();
    if (this.label) this.label.destroy();
    if (this.wind && this.wind.tele) this.wind.tele.destroy();
  }
}
