import Phaser from 'phaser';
import { PLAYER_R } from './Player.js';
import { state } from '../state.js';
import { getDifficulty } from '../systems/difficulty.js';
import { ensureEntityArtTexture } from '../systems/dungeonArt.js';

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
  hellhound: {
    name: '焦炎獵犬', tex: 'hellhound', w: 42, h: 30, r: 10, foot: 9,
    hp: 26, dmg: 9, speed: 152, range: 86, lunge: true, lungeSpd: 440, burnSpark: true, atkCd: 1350, windup: 340, xp: 15, gold: [3, 8], drop: 0.15, bookDrop: 0.04, debrisColor: 0xff7020,
  },
  bone_guard: {
    name: '骸骨盾衛', tex: 'bone_guard', w: 36, h: 48, r: 12, foot: 12,
    hp: 58, dmg: 11, speed: 74, range: 22, shieldDr: 0.3, bashSlow: 900, atkCd: 1450, windup: 440, xp: 20, gold: [4, 10], drop: 0.2, bookDrop: 0.05, debrisColor: 0xd8d0b8,
  },
  blood_cultist: {
    name: '血月祭司', tex: 'blood_cultist', w: 36, h: 48, r: 11, foot: 12,
    hp: 36, dmg: 9, speed: 76, ranged: true, bolt: 'blood', range: 350, keep: 195, healCd: 5200, healAmt: 0.24, atkCd: 2050, windup: 500, xp: 24, gold: [5, 13], drop: 0.22, bookDrop: 0.06, debrisColor: 0xc01830,
  },
  ghoul: {
    name: '狂血食屍鬼', tex: 'ghoul', w: 36, h: 48, r: 11, foot: 12,
    hp: 40, dmg: 10, speed: 112, range: 18, lifesteal: 0.4, berserk: true, atkCd: 980, windup: 260, xp: 18, gold: [3, 10], drop: 0.17, bookDrop: 0.04, debrisColor: 0xb82038,
  },
  frost_wraith: {
    name: '寒霜幽靈', tex: 'frost_wraith', w: 36, h: 48, r: 10, foot: 12,
    hp: 30, dmg: 11, speed: 94, ranged: true, bolt: 'ice_twin', range: 340, keep: 180, blinkCd: 4600, ghostly: true, atkCd: 1750, windup: 440, xp: 23, gold: [5, 12], drop: 0.21, bookDrop: 0.06, debrisColor: 0x70e0ff,
  },
  pyro_demon: {
    name: '烈焰惡魔', tex: 'pyro_demon', w: 36, h: 48, r: 11, foot: 12,
    hp: 46, dmg: 14, speed: 84, ranged: true, bolt: 'firebomb', range: 360, keep: 195, atkCd: 2400, windup: 560, xp: 28, gold: [6, 15], drop: 0.24, bookDrop: 0.07, debrisColor: 0xff5010,
  },
  blood_knight: {
    name: '精英血月騎士', tex: 'blood_knight', w: 64, h: 64, r: 18, foot: 18, elite: true, auraTint: 0xd81838, slamColor: 0xd81838,
    hp: 225, dmg: 20, speed: 102, range: 28, slam: 86, eliteChargeCd: 4600, lifesteal: 0.35, atkCd: 1850, windup: 620, xp: 88, gold: [20, 42], drop: 0.88, bookDrop: 0.25, debrisColor: 0xd01838,
  },
  frost_titan: {
    name: '精英冰晶巨像', tex: 'frost_titan', w: 64, h: 64, r: 19, foot: 20, elite: true, auraTint: 0x40d0ff, slamColor: 0x40d0ff,
    hp: 250, dmg: 20, speed: 78, range: 28, slam: 100, frostRing: true, deathFrostNova: true, atkCd: 2150, windup: 740, xp: 92, gold: [22, 44], drop: 0.9, bookDrop: 0.26, debrisColor: 0x70e8ff,
  },
  dummy: {
    name: '訓練木樁', tex: 'dummy', w: 36, h: 36, r: 12, foot: 10, isDummy: true,
    hp: 999999, dmg: 0, speed: 0, range: 0, atkCd: 99999, windup: 0, xp: 0, gold: [0, 0], drop: 0, bookDrop: 0,
  },
};

const rand = Phaser.Math.Between;

export default class Enemy {
  constructor(scene, type, x, y, lvl = 1) {
    const T = { ...ENEMY_TYPES[type] };
    this.scene = scene;
    this.type = type;
    this.T = T;
    this.lvl = lvl;
    this.isDummy = !!T.isDummy;
    this._customArt = false;
    const diff = getDifficulty(state.difficulty);
    this.maxHp = this.isDummy ? T.hp : Math.max(1, Math.round(T.hp * (1 + (lvl - 1) * 0.22) * diff.hpMul));
    this.hp = this.maxHp;
    this.dmg = this.isDummy ? 0 : Math.max(1, Math.round(T.dmg * (1 + (lvl - 1) * 0.14) * diff.dmgMul));
    this.xp = this.isDummy ? 0 : Math.max(1, Math.round(T.xp * (1 + (lvl - 1) * 0.2) * diff.xpMul));
    this.speed = T.speed;

    this.shadow = scene.add.image(x, y, 'shadowtex').setScale(T.r / 13, T.r / 34).setDepth(2);
    if (T.elite || this.isDummy) {
      if (T.elite) {
        const auraTint = T.auraTint ?? (type === 'golem' ? 0xff5010 : 0xffa020);
        this.aura = scene.add.image(x, y, 'glow').setTint(auraTint)
          .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setScale(1.2, 0.5).setDepth(2);
      }
      this.label = scene.add.text(x, y - T.h / 2 - 22, T.name, {
        fontFamily: '"Microsoft JhengHei", sans-serif', fontSize: '14px',
        color: this.isDummy ? '#d8c088' : '#f0c040', stroke: '#000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(9450);
    }
    this.sprite = scene.physics.add.sprite(x, y - T.foot, T.tex);
    if (T.ghostly) this.sprite.setAlpha(0.88);
    this.syncBody();
    if (this.isDummy) this.sprite.body.immovable = true;
    this.sprite.enemy = this;
    this.applyCustomArt();

    this.aggro = false;
    this.aggroDist = T.aggroDist || 330;
    this.atkT = rand(200, 900);
    this.webT = T.webCd ? rand(1000, T.webCd) : 0;
    this.summonT = T.summonCd ? rand(2500, T.summonCd) : 0;
    this.healT = T.healCd ? rand(1800, T.healCd) : 0;
    this.blinkT = T.blinkCd ? rand(800, 2200) : 0;
    this.chargeT = T.eliteChargeCd ? rand(1800, T.eliteChargeCd) : 0;
    this.summons = [];
    this.wind = null;
    this.path = null;
    this.repathT = 0;
    this.wanderT = rand(1000, 4000);
    this.home = { x, y };
    this.flashT = 0;
    this.slowT = 0;
    this._wasSlow = false;
    this.enraged = false;
    this.rush = null;
    this.knock = null;
    this.dead = false;
    this.walkT = Math.random() * 1000;
    this.facing = 1;
  }

  get fx() { return this.sprite.x; }
  get fy() { return this.sprite.y + this.T.foot; }

  syncBody() {
    if (this.sprite?.body) {
      this.sprite.body.setCircle(this.T.r, this.T.w / 2 - this.T.r, this.T.h / 2 + this.T.foot - this.T.r);
    }
  }

  applyCustomArt() {
    if (this._customArt || this.dead || !this.sprite?.active) return false;
    if (this.type !== 'skeleton' && this.type !== 'gargoyle') return false;
    const spec = ensureEntityArtTexture(this.scene, this.type);
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
    this.shadow.setScale(this.T.r / 13, this.T.r / 34);
    if (this.aura) {
      this.aura.setScale(this.type === 'gargoyle' ? 1.45 : 1.2, this.type === 'gargoyle' ? 0.6 : 0.5);
    }
    if (this.label) {
      this.label.setPosition(this.fx, this.sprite.y - this.T.h / 2 - 22);
    }
    return true;
  }

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
        else if (this.enraged) this.sprite.setTint(0xff6868);
        else this.sprite.clearTint();
      }
    } else {
      const slow = this.slowT > 0;
      if (slow !== this._wasSlow) {
        this._wasSlow = slow;
        if (slow) this.sprite.setTint(0x70d0ff);
        else if (this.enraged) this.sprite.setTint(0xff6868);
        else this.sprite.clearTint();
      }
    }

    if (this.isDummy) {
      this.hp = this.maxHp;
      body.setVelocity(0, 0);
      this.sprite.setDepth(this.fy);
      return;
    }

    // 狂暴食屍鬼低血量狂暴化
    if (T.berserk && !this.enraged && this.hp < this.maxHp * 0.5) {
      this.enraged = true;
      this.speed = Math.round(T.speed * 1.45);
      if (this.flashT <= 0 && this.slowT <= 0) this.sprite.setTint(0xff6868);
      sc.burst(this.fx, this.fy - 6, 12, [0xff3040, 0xff8060], 110, 320);
      sc.floatText(this.fx, this.sprite.y - 24, '狂暴！', '#ff5050', 14);
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

    // 血月祭司治療負傷友軍
    if (T.healCd && this.aggro && !p.dead && !this.wind && !this.knock && !this.rush) {
      this.healT -= dt;
      if (this.healT <= 0) {
        let best = null, lowest = 0.92;
        for (const ally of sc.enemies) {
          if (ally === this || ally.dead || ally.isDummy) continue;
          const frac = ally.hp / ally.maxHp;
          if (frac < lowest && Math.hypot(ally.fx - this.fx, ally.fy - this.fy) <= 280) {
            lowest = frac;
            best = ally;
          }
        }
        if (best) {
          this.healT = T.healCd;
          const heal = best.isBoss
            ? Math.max(1, Math.round(best.maxHp * 0.03))
            : Math.max(2, Math.round(best.maxHp * (T.healAmt || 0.24)));
          best.hp = Math.min(best.maxHp, best.hp + heal);
          const beam = sc.add.graphics().setDepth(9200);
          beam.lineStyle(3, 0xff5070, 0.85).lineBetween(this.fx, this.sprite.y, best.fx, best.sprite.y);
          sc.tweens.add({ targets: beam, alpha: 0, duration: 320, onComplete: () => beam.destroy() });
          sc.burst(best.fx, best.fy - 8, 8, [0xff4060, 0xffa0b0], 80, 300);
          sc.floatText(best.fx, best.sprite.y - 20, `+${heal}`, '#ff7090', 14);
          sc.sfx('heal');
        } else {
          this.healT = 900;
        }
      }
    }

    // 寒霜幽靈近身相位瞬移
    if (T.blinkCd && this.aggro && !p.dead && !this.wind && !this.knock && !this.rush) {
      this.blinkT -= dt;
      if (this.blinkT <= 0 && dist < 130) {
        const away = Math.atan2(this.fy - p.fy, this.fx - p.fx);
        for (let k = 0; k < 10; k++) {
          const ang = away + (Math.random() - 0.5) * 2.1;
          const rDist = rand(115, 165);
          const bx = this.fx + Math.cos(ang) * rDist;
          const by = this.fy + Math.sin(ang) * rDist;
          if (sc.dungeon.walkableAt(bx, by) && Math.hypot(bx - p.fx, by - p.fy) > 105) {
            sc.burst(this.fx, this.fy - 8, 10, [0x60d8ff, 0xd0f8ff], 110, 320);
            this.sprite.setPosition(bx, by - T.foot);
            sc.burst(bx, by - 8, 10, [0x60d8ff, 0xd0f8ff], 110, 320);
            sc.sfx('blink');
            this.blinkT = T.blinkCd;
            this.path = null;
            break;
          }
        }
      }
    }

    // 精英血月騎士直線衝鋒
    if (T.eliteChargeCd && this.aggro && !p.dead && !this.wind && !this.knock && !this.rush) {
      this.chargeT -= dt;
      if (this.chargeT <= 0 && dist > 110 && dist < 275 && sc.dungeon.lineClear(this.fx, this.fy, p.fx, p.fy, T.r * 0.7)) {
        this.chargeT = T.eliteChargeCd;
        this.startChargeWind(Math.atan2(dy, dx));
      }
    }

    if (this.rush) {
      body.setVelocity(this.rush.vx, this.rush.vy);
      if (!this.rush.hit && Math.hypot(p.fx - this.fx, p.fy - this.fy) < T.r + PLAYER_R + 10) {
        this.rush.hit = true;
        const dealt = sc.hurtPlayer(this.dmg * 1.15, this.fx, this.fy, this);
        if (T.lifesteal && dealt > 0) {
          const heal = Math.max(1, Math.round(dealt * T.lifesteal));
          this.hp = Math.min(this.maxHp, this.hp + heal);
          sc.floatText(this.fx, this.sprite.y - 16, `+${heal}`, '#ff7090', 14);
        }
      }
      this.rush.t -= dt;
      if (this.rush.t <= 0) {
        this.rush = null;
        body.setVelocity(0, 0);
      }
    } else if (this.knock) {
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
    const tiltAmp = this._customArt ? 4.5 : 6;
    if (!this.wind) {
      if (moving) { this.walkT += dt; this.sprite.setAngle(Math.sin(this.walkT * 0.016) * tiltAmp); }
      else this.sprite.setAngle(this.sprite.angle * 0.8);
    }
    this.sprite.setFlipX(this.facing < 0);
    this.sprite.setDepth(this.fy);
    this.shadow.setPosition(this.fx, this.fy + 1);
    if (this.aura) this.aura.setPosition(this.fx, this.fy);
    if (this.label) this.label.setPosition(this.fx, this.sprite.y - T.h / 2 - 22);
  }

  tryShoot(dx, dy, dist) {
    if (this.atkT <= 0 && dist <= this.T.range) this.startWind();
  }

  startChargeWind(ang) {
    const sc = this.scene;
    const len = 240;
    const tx = this.fx + Math.cos(ang) * len, ty = this.fy + Math.sin(ang) * len;
    const lane = sc.add.graphics().setDepth(3);
    lane.lineStyle(38, 0xd81838, 0.28).lineBetween(this.fx, this.fy, tx, ty);
    lane.lineStyle(2, 0xff6080, 0.88).lineBetween(this.fx, this.fy, tx, ty);
    this.wind = { kind: 'charge', t: 520, dur: 520, ang, lane };
    this.facing = Math.cos(ang) >= 0 ? 1 : -1;
    this.sprite.setTint(0xff4060);
  }

  startWind() {
    const T = this.T;
    this.wind = { t: T.windup, dur: T.windup };
    if (T.slam) {
      const col = T.slamColor || 0xff2000;
      this.wind.tele = this.scene.add.circle(this.fx, this.fy, T.slam, col, 0.28).setStrokeStyle(2, col, 0.9).setDepth(3);
    }
    if (T.ranged) {
      const col = T.bolt === 'firebomb' ? 0xff9040
        : T.bolt === 'blood' ? 0xff5070
          : (T.bolt === 'ice' || T.bolt === 'ice_twin') ? 0x90f0ff
            : T.bolt === 'orb' ? 0xd080ff : 0xb0ffb0;
      this.sprite.setTint(col);
    }
    if (T.lunge) this.sprite.setTint(T.burnSpark ? 0xff9030 : 0xff6090);
  }

  release() {
    const sc = this.scene, p = sc.player, T = this.T;
    const wind = this.wind;
    const tele = wind?.tele;
    const lane = wind?.lane;
    this.wind = null;
    this.atkT = T.atkCd * (0.85 + Math.random() * 0.3) * (this.enraged ? 0.7 : 1);
    this.sprite.setScale(1);
    if (!this.flashT) {
      if (this.slowT > 0) this.sprite.setTint(0x70d0ff);
      else if (this.enraged) this.sprite.setTint(0xff6868);
      else this.sprite.clearTint();
    }
    if (this.dead) {
      if (tele && tele.active) tele.destroy();
      if (lane && lane.active) lane.destroy();
      return;
    }
    if (wind?.kind === 'charge') {
      if (lane && lane.active) lane.destroy();
      const ang = wind.ang;
      sc.sfx('dash');
      this.rush = { vx: Math.cos(ang) * 560, vy: Math.sin(ang) * 560, t: 310, hit: false };
      return;
    }
    const dx = p.fx - this.fx, dy = p.fy - this.fy;
    const dist = Math.hypot(dx, dy) || 1;
    if (T.slam) {
      if (tele && tele.active) tele.destroy();
      sc.slamEffect(this.fx, this.fy, T.slam, T.slamColor || 0xff8030);
      if (dist <= T.slam + PLAYER_R) {
        const dealt = sc.hurtPlayer(this.dmg, this.fx, this.fy, this);
        if (T.frostRing && dealt > 0) p.applySlow(1800);
        if (T.lifesteal && dealt > 0) {
          const heal = Math.max(1, Math.round(dealt * T.lifesteal));
          this.hp = Math.min(this.maxHp, this.hp + heal);
          sc.floatText(this.fx, this.sprite.y - 16, `+${heal}`, '#ff7090', 14);
        }
      }
      if (T.frostRing) {
        for (let i = 0; i < 6; i++) {
          sc.spawnIceBolt(this.fx, this.fy - 10, (i / 6) * Math.PI * 2, Math.max(2, Math.round(this.dmg * 0.55)), this, { speed: 225, silent: i > 0 });
        }
      }
    } else if (T.ranged) {
      const lead = 0.25;
      const tx = p.fx + p.sprite.body.velocity.x * lead * Math.random();
      const ty = p.fy + p.sprite.body.velocity.y * lead * Math.random();
      const ang = Math.atan2(ty - this.fy, tx - this.fx);
      if (T.bolt === 'ice') {
        for (const off of [-0.22, 0, 0.22]) sc.spawnIceBolt(this.fx, this.fy - 10, ang + off, this.dmg, this);
      } else if (T.bolt === 'ice_twin') {
        sc.spawnIceBolt(this.fx, this.fy - 10, ang - 0.08, Math.max(2, Math.round(this.dmg * 0.72)), this, { speed: 295 });
        sc.spawnIceBolt(this.fx, this.fy - 10, ang + 0.08, Math.max(2, Math.round(this.dmg * 0.72)), this, { speed: 295, silent: true });
      } else if (T.bolt === 'blood') {
        sc.spawnOrb(this.fx, this.fy - 10, ang, this.dmg, 'bloodbolt', this, { speed: 255 });
      } else if (T.bolt === 'firebomb') {
        const bx = sc.dungeon.walkableAt(tx, ty) ? tx : p.fx;
        const by = sc.dungeon.walkableAt(tx, ty) ? ty : p.fy;
        sc.sfx('fireball');
        const fb = sc.add.image(this.fx, this.fy - 14, 'fireball').setScale(1.05).setBlendMode(Phaser.BlendModes.ADD).setDepth(9200);
        sc.tweens.add({ targets: fb, x: bx, y: by - 6, duration: 520, ease: 'Sine.Out', onComplete: () => { if (fb.active) fb.destroy(); } });
        sc.telegraph(bx, by, 58, 720, () => {
          if (Math.hypot(sc.player.fx - bx, sc.player.fy - by) < 58 + PLAYER_R) sc.hurtPlayer(this.dmg * 1.1, bx, by, this);
        }, 0xff5810, true);
      } else if (T.bolt === 'orb') {
        sc.spawnOrb(this.fx, this.fy - 10, ang, this.dmg, 'orb', this);
      } else {
        sc.spawnArrow(this.fx, this.fy - 10, ang, this.dmg, this);
      }
    } else if (T.lunge) {
      const lSpd = T.lungeSpd || 420;
      this.knock = { vx: (dx / dist) * lSpd, vy: (dy / dist) * lSpd, t: 160 };
      sc.sfx('dash');
      if (T.burnSpark) sc.burst(this.fx, this.fy - 4, 8, [0xff8020, 0xffe060], 130, 280);
      if (dist <= 120) sc.hurtPlayer(this.dmg, this.fx, this.fy, this);
    } else {
      this.scene.tweens.add({ targets: this.sprite, x: this.sprite.x + (dx / dist) * 8, duration: 70, yoyo: true });
      if (dist - T.r - PLAYER_R <= T.range + 16) {
        const dealt = sc.hurtPlayer(this.dmg, this.fx, this.fy, this);
        if (T.bashSlow && dealt > 0) p.applySlow(T.bashSlow);
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
    if (this.wind && this.wind.tele && this.wind.tele.active) this.wind.tele.destroy();
    if (this.wind && this.wind.lane && this.wind.lane.active) this.wind.lane.destroy();
  }
}
