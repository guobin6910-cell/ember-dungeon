import Phaser from 'phaser';
import { state, detectTouchDevice } from '../state.js';

const FLAME_TRAIL_TINTS = [0xfff0a8, 0xff823e, 0xe03a0c];
const FIRE_PUFF_TINTS = [0xffa040, 0xff6218, 0xd42c08];
const FIRE_SPARK_TINTS = [0xfff6c8, 0xffc848, 0xff823e, 0xff4510];
const TRAIL_SPARK_TINTS = [0xffe070, 0xff823e];
const HIT_SPARK_TINTS = [0xfff8d8, 0xffd068, 0xff8c30];
const CRIT_SPARK_TINTS = [0xffffff, 0xffe458, 0xff9a28];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randFloat = Phaser.Math.FloatBetween;

export class VfxManager {
  constructor(scene) {
    this.scene = scene;
    this.scorchDecals = [];

    this.flameEmitter = scene.add.particles(0, 0, 'vfx_flame_wisp', {
      emitting: false,
      maxAliveParticles: 36,
      blendMode: 'ADD',
      gravityY: -28,
      accelerationX: { onEmit: () => 0, onUpdate: (p) => -p.velocityX * 2.1 },
      accelerationY: { onEmit: () => 0, onUpdate: (p) => -p.velocityY * 2.1 },
      scale: { onEmit: () => 1, onUpdate: (p, _k, t) => (p._s0 ?? 0.7) * (1 - t * 0.88) },
      alpha: { onEmit: () => 1, onUpdate: (p, _k, t) => (p._a0 ?? 0.75) * (1 - t) },
      rotate: { onEmit: () => 0, onUpdate: (_p, _k, _t, v) => v },
    }).setDepth(9240);

    this.sparkEmitter = scene.add.particles(0, 0, 'vfx_spark_streak', {
      emitting: false,
      maxAliveParticles: 48,
      blendMode: 'ADD',
      accelerationX: { onEmit: () => 0, onUpdate: (p) => -p.velocityX * 3.4 },
      accelerationY: { onEmit: () => 0, onUpdate: (p) => -p.velocityY * 3.4 },
      scaleX: { onEmit: () => 1, onUpdate: (p, _k, t) => (p._sx0 ?? 1) * (1 - t * 0.72) },
      scaleY: { onEmit: () => 1, onUpdate: (p, _k, t) => (p._sy0 ?? 1) * (1 - t * 0.80) },
      alpha: { onEmit: () => 1, onUpdate: (p, _k, t) => (p._a0 ?? 0.95) * Math.pow(1 - t, 0.75) },
      rotate: { onEmit: () => 0, onUpdate: (_p, _k, _t, v) => v },
    }).setDepth(9280);

    this.emberEmitter = scene.add.particles(0, 0, 'spark', {
      emitting: false,
      maxAliveParticles: 32,
      blendMode: 'ADD',
      scale: { onEmit: () => 1, onUpdate: (p, _k, t) => (p._s0 ?? 0.75) * (1 - t) },
      alpha: { onEmit: () => 1, onUpdate: (p, _k, t) => (p._a0 ?? 0.85) * (1 - t) },
    }).setDepth(9260);

    this.debrisEmitter = scene.add.particles(0, 0, 'pixel', {
      emitting: false,
      maxAliveParticles: 24,
      gravityY: 280,
      scale: { onEmit: () => 1, onUpdate: (p, _k, t) => (p._s0 ?? 1.2) * (1 - t * 0.65) },
      alpha: { onEmit: () => 1, onUpdate: (p, _k, t) => (p._a0 ?? 0.9) * (1 - t * 0.85) },
    }).setDepth(9250);
  }

  isEnabled() {
    return !!state.vfxEnabled;
  }

  isLowSpec() {
    return detectTouchDevice() || !!state.touchMode;
  }

  getCap() {
    return this.isLowSpec() ? 56 : 100;
  }

  getAliveCount() {
    return (
      this.flameEmitter.getAliveParticleCount() +
      this.sparkEmitter.getAliveParticleCount() +
      this.emberEmitter.getAliveParticleCount() +
      this.debrisEmitter.getAliveParticleCount()
    );
  }

  remainingBudget() {
    return Math.max(0, this.getCap() - this.getAliveCount());
  }

  applyEnabledState(enabled) {
    const on = !!enabled;
    if (!on) {
      this.flameEmitter.killAll();
      this.sparkEmitter.killAll();
      this.emberEmitter.killAll();
      this.debrisEmitter.killAll();
      for (const dec of this.scorchDecals) {
        if (dec && dec.active) dec.destroy();
      }
      this.scorchDecals = [];
    }
    const embers = this.scene.embers;
    if (embers && embers.active) {
      if (on) {
        embers.setVisible(true);
        embers.start();
      } else {
        embers.stop();
        embers.killAll();
        embers.setVisible(false);
      }
    }
  }

  addTimedLight(x, y, radius, alpha, duration) {
    const lights = this.scene.extraLights;
    const timed = lights.filter((l) => l._vfxTimed);
    if (timed.length >= 10) {
      const oldest = timed[0];
      const idx = lights.indexOf(oldest);
      if (idx !== -1) lights.splice(idx, 1);
    }
    const l = { x, y, r: radius, a: alpha, _vfxTimed: true };
    lights.push(l);
    this.scene.tweens.add({
      targets: l,
      r: 0,
      a: 0,
      duration,
      ease: 'Quad.Out',
      onComplete: () => {
        const idx = this.scene.extraLights.indexOf(l);
        if (idx !== -1) this.scene.extraLights.splice(idx, 1);
      },
    });
  }

  _emitDirected(emitter, x, y, angRad, speed, life, tint, setup) {
    const p = emitter.emitParticleAt(x, y, 1);
    if (!p) return null;
    p.velocityX = Math.cos(angRad) * speed;
    p.velocityY = Math.sin(angRad) * speed;
    p.angle = Phaser.Math.RadToDeg(angRad);
    p.rotation = angRad;
    p.tint = tint;
    p.life = life;
    p.lifeCurrent = life;
    if (setup) setup(p);
    return p;
  }

  spawnBurst(x, y, count, tints, speed = 120, life = 450) {
    if (!this.isEnabled()) return;
    const scaled = this.isLowSpec() ? Math.max(1, Math.round(count * 0.65)) : count;
    const n = Math.min(scaled, this.remainingBudget());
    if (n <= 0) return;
    const arr = Array.isArray(tints) && tints.length ? tints : [tints ?? 0xffffff];
    for (let i = 0; i < n; i++) {
      const ang = randFloat(0, Math.PI * 2);
      const sp = randFloat(speed * 0.3, speed);
      const lf = Math.round(life * randFloat(0.75, 1.1));
      this._emitDirected(this.emberEmitter, x, y, ang, sp, lf, pick(arr), (p) => {
        p._s0 = 0.78;
        p._a0 = 0.9;
        p.scaleX = p._s0;
        p.scaleY = p._s0;
      });
    }
  }

  spawnDebris(x, y, count, tint) {
    if (!this.isEnabled()) return;
    const scaled = this.isLowSpec() ? Math.max(1, Math.round(count * 0.7)) : count;
    const n = Math.min(scaled, this.remainingBudget());
    if (n <= 0) return;
    for (let i = 0; i < n; i++) {
      const ang = randFloat(0, Math.PI * 2);
      const sp = randFloat(40, 140);
      const lf = Math.round(randFloat(320, 440));
      this._emitDirected(this.debrisEmitter, x, y, ang, sp, lf, tint, (p) => {
        p._s0 = 1.25;
        p._a0 = 0.92;
        p.scaleX = p._s0;
        p.scaleY = p._s0;
      });
    }
  }

  playBasicHit(x, y, angle, opt = {}) {
    if (!this.isEnabled()) return;
    const crit = !!opt.crit;
    const low = this.isLowSpec();
    const rawCount = crit ? 9 : 6;
    const targetCount = low ? (crit ? 6 : 4) : rawCount;
    const count = Math.min(targetCount, this.remainingBudget());
    const tints = crit ? CRIT_SPARK_TINTS : HIT_SPARK_TINTS;

    for (let i = 0; i < count; i++) {
      const ang = angle + randFloat(-0.92, 0.92);
      const sp = crit ? randFloat(170, 320) : randFloat(130, 260);
      const life = Math.round(randFloat(170, 260));
      this._emitDirected(this.sparkEmitter, x, y, ang, sp, life, pick(tints), (p) => {
        p._sx0 = randFloat(0.75, 1.15);
        p._sy0 = randFloat(0.65, 0.95);
        p._a0 = 0.96;
        p.scaleX = p._sx0;
        p.scaleY = p._sy0;
      });
    }

    const star = this.scene.add.image(x, y, 'vfx_hit_star')
      .setDepth(9290)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(crit ? 0xffe878 : 0xfff0c8)
      .setRotation(randFloat(-0.45, 0.45))
      .setScale(0.35)
      .setAlpha(0.92);
    this.scene.tweens.add({
      targets: star,
      scale: crit ? 1.25 : 0.9,
      alpha: 0,
      duration: 120,
      ease: 'Quad.Out',
      onComplete: () => { if (star.active) star.destroy(); },
    });

    this.addTimedLight(x, y, crit ? 105 : 78, crit ? 0.52 : 0.36, 130);
    this.scene.cameras.main.shake(crit ? 65 : 42, crit ? 0.0022 : 0.0011);
  }

  createFireballVisuals(x, y, angle, isSplit = false) {
    const sprite = this.scene.add.image(x, y, 'fireball')
      .setScale(isSplit ? 0.8 : 1.24)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(y + 20);
    let tail = null;
    if (this.isEnabled()) {
      tail = this.scene.add.image(x, y, 'vfx_flame_wisp')
        .setOrigin(0.78, 0.5)
        .setRotation(angle)
        .setTint(0xff823e)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.62)
        .setScale(isSplit ? 1.25 : 1.95, isSplit ? 0.68 : 1.0)
        .setDepth(y + 19);
    }
    return { sprite, tail, trailT: 0, pulseT: 0, isSplit };
  }

  updateFireballVisuals(pr, dt) {
    pr.pulseT = (pr.pulseT || 0) + dt;
    const isSplit = !!pr.isSplit;
    const baseScale = isSplit ? 0.81 : 1.24;
    const pulse = baseScale + Math.sin(pr.pulseT * 0.025) * (isSplit ? 0.05 : 0.06);
    if (pr.sprite && pr.sprite.active) {
      pr.sprite.setRotation(pr.sprite.rotation + (isSplit ? 0.34 : 0.28)).setScale(pulse);
    }

    const enabled = this.isEnabled();
    const ang = Math.atan2(pr.vy, pr.vx);
    if (pr.tail && pr.tail.active) {
      if (!enabled) {
        pr.tail.setVisible(false);
      } else {
        const flick = Math.sin(pr.pulseT * 0.045) * 0.14;
        pr.tail
          .setVisible(true)
          .setPosition(pr.x, pr.y)
          .setRotation(ang)
          .setDepth(pr.y + 19)
          .setScale((isSplit ? 1.25 : 1.95) * (1 + flick), isSplit ? 0.68 : 1.0)
          .setAlpha(0.56 + Math.sin(pr.pulseT * 0.055) * 0.1);
      }
    }

    if (!enabled) return;

    const low = this.isLowSpec();
    const stepMs = (low ? 34 : 22) + (isSplit ? 12 : 0);
    pr.trailT = (pr.trailT || 0) + dt;
    if (pr.trailT < stepMs) return;
    pr.trailT %= stepMs;

    if (this.remainingBudget() <= 0) return;

    const nx = Math.cos(ang), ny = Math.sin(ang);
    const speedMag = Math.hypot(pr.vx, pr.vy) || 480;
    const wispCount = (!isSplit && !low && this.remainingBudget() >= 2) ? 2 : 1;
    for (let i = 0; i < wispCount; i++) {
      if (this.remainingBudget() <= 0) break;
      const tx = pr.x - nx * 8 + randFloat(-2.5, 2.5);
      const ty = pr.y - ny * 8 + randFloat(-2.5, 2.5);
      const backAng = ang + Math.PI + randFloat(-0.45, 0.45);
      const sp = speedMag * randFloat(0.11, 0.22);
      const life = Math.round(randFloat(190, 260));
      this._emitDirected(this.flameEmitter, tx, ty, backAng, sp, life, pick(FLAME_TRAIL_TINTS), (p) => {
        p._s0 = isSplit ? 0.45 : 0.72;
        p._a0 = 0.72;
        p.scaleX = p._s0;
        p.scaleY = p._s0;
      });
    }

    const sparkChance = (isSplit || low) ? 0.35 : 0.55;
    if (Math.random() < sparkChance && this.remainingBudget() > 0) {
      const sx = pr.x - nx * 6 + randFloat(-3, 3);
      const sy = pr.y - ny * 6 + randFloat(-3, 3);
      const backAng = ang + Math.PI + randFloat(-0.6, 0.6);
      const sp = randFloat(55, 125);
      const life = Math.round(randFloat(200, 290));
      this._emitDirected(this.sparkEmitter, sx, sy, backAng, sp, life, pick(TRAIL_SPARK_TINTS), (p) => {
        p._sx0 = 0.65;
        p._sy0 = 0.6;
        p._a0 = 0.88;
        p.scaleX = p._sx0;
        p.scaleY = p._sy0;
      });
    }
  }

  playFireballExplosion(x, y, radius, opt = {}) {
    const enabled = this.isEnabled();

    // 暗沉地城中的戰術性照明與空心衝擊波（關閉特效時仍保留輕量可視輪廓）
    this.addTimedLight(x, y, Math.min(210, radius * 1.85), enabled ? 0.82 : 0.62, 360);
    const ring = this.scene.add.image(x, y, 'vfx_ring')
      .setDepth(9220)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xff823e)
      .setScale(0.22)
      .setAlpha(enabled ? 0.82 : 0.45);
    this.scene.tweens.add({
      targets: ring,
      scale: (radius * 2.05) / 96,
      alpha: 0,
      duration: enabled ? 250 : 180,
      ease: 'Cubic.Out',
      onComplete: () => { if (ring.active) ring.destroy(); },
    });

    if (!enabled) return;

    while (this.scorchDecals.length >= 6) {
      const oldest = this.scorchDecals.shift();
      if (oldest && oldest.active) oldest.destroy();
    }
    const scorch = this.scene.add.image(x, y, 'vfx_scorch_crack')
      .setDepth(1.5)
      .setRotation(randFloat(0, Math.PI * 2))
      .setScale((radius * 1.65) / 96)
      .setAlpha(0.7);
    this.scorchDecals.push(scorch);
    this.scene.tweens.add({
      targets: scorch,
      alpha: 0,
      duration: 860,
      ease: 'Quad.In',
      onComplete: () => {
        this.scorchDecals = this.scorchDecals.filter((d) => d !== scorch);
        if (scorch.active) scorch.destroy();
      },
    });

    const coreGlow = this.scene.add.image(x, y, 'glow')
      .setDepth(9230)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xff8a30)
      .setScale(0.25)
      .setAlpha(0.66);
    this.scene.tweens.add({
      targets: coreGlow,
      scale: Math.min(1.35, (radius * 1.25) / 128),
      alpha: 0,
      duration: 185,
      ease: 'Quad.Out',
      onComplete: () => { if (coreGlow.active) coreGlow.destroy(); },
    });

    const star = this.scene.add.image(x, y, 'vfx_hit_star')
      .setDepth(9270)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xfff0b0)
      .setRotation(randFloat(0, Math.PI / 2))
      .setScale(0.45)
      .setAlpha(0.88);
    this.scene.tweens.add({
      targets: star,
      scale: opt.isSplit ? 1.15 : 1.65,
      alpha: 0,
      duration: 155,
      ease: 'Quad.Out',
      onComplete: () => { if (star.active) star.destroy(); },
    });

    const low = this.isLowSpec();
    let sparkCount = opt.isMeteor ? 18 : opt.isSplit ? 7 : 13;
    if (low) sparkCount = Math.max(4, Math.round(sparkCount * 0.65));
    sparkCount = Math.min(sparkCount, this.remainingBudget());
    for (let i = 0; i < sparkCount; i++) {
      const ang = (i / sparkCount) * Math.PI * 2 + randFloat(-0.22, 0.22);
      const sp = randFloat(135, 285);
      const life = Math.round(randFloat(230, 360));
      this._emitDirected(this.sparkEmitter, x, y, ang, sp, life, pick(FIRE_SPARK_TINTS), (p) => {
        p._sx0 = randFloat(0.85, 1.35);
        p._sy0 = randFloat(0.7, 1.05);
        p._a0 = 0.96;
        p.scaleX = p._sx0;
        p.scaleY = p._sy0;
      });
    }

    let flameCount = opt.isMeteor ? 12 : opt.isSplit ? 5 : 8;
    if (low) flameCount = Math.max(3, Math.round(flameCount * 0.65));
    flameCount = Math.min(flameCount, this.remainingBudget());
    for (let i = 0; i < flameCount; i++) {
      const ang = randFloat(0, Math.PI * 2);
      const sp = randFloat(45, 135);
      const life = Math.round(randFloat(250, 390));
      this._emitDirected(this.flameEmitter, x, y, ang, sp, life, pick(FIRE_PUFF_TINTS), (p) => {
        p._s0 = opt.isSplit ? 0.75 : 1.05;
        p._a0 = 0.64;
        p.scaleX = p._s0;
        p.scaleY = p._s0;
      });
    }

    if (opt.isMeteor) this.scene.cameras.main.shake(220, 0.0065);
    else if (opt.isSplit) this.scene.cameras.main.shake(65, 0.0018);
    else this.scene.cameras.main.shake(105, 0.003);
  }

  destroy() {
    this.flameEmitter?.destroy();
    this.sparkEmitter?.destroy();
    this.emberEmitter?.destroy();
    this.debrisEmitter?.destroy();
    for (const dec of this.scorchDecals) {
      if (dec && dec.active) dec.destroy();
    }
    this.scorchDecals = [];
  }
}

