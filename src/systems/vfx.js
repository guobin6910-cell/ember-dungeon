import Phaser from 'phaser';
import { state, detectTouchDevice } from '../state.js';

const FLAME_TRAIL_TINTS = [0xfff0a8, 0xff823e, 0xe03a0c];
const FIRE_PUFF_TINTS = [0xffa040, 0xff6218, 0xd42c08];
const FIRE_SPARK_TINTS = [0xfff6c8, 0xffc848, 0xff823e, 0xff4510];
const TRAIL_SPARK_TINTS = [0xffe070, 0xff823e];
const HIT_SPARK_TINTS = [0xfff8d8, 0xffd068, 0xff8c30];
const CRIT_SPARK_TINTS = [0xffffff, 0xffe458, 0xff9a28];

const WHIRL_DUST_TINTS = [0xc8bba8, 0x9c8f7e, 0xd8ccb8];
const WHIRL_SPARK_TINTS = [0xe0f4ff, 0xffffff, 0x90d0ff];
const HEAL_MOTE_TINTS = [0x58ff88, 0xc8ffd8, 0x28d860];
const CHAIN_SPARK_TINTS = [0x70e8ff, 0xffffff, 0x40a8ff];
const FROST_SHARD_TINTS = [0xb8f8ff, 0x70e8ff, 0xffffff];
const FROST_MIST_TINTS = [0x90e4ff, 0xd8f8ff];
const SHADOW_SMOKE_TINTS = [0x6020a0, 0x9040d8];
const SHADOW_SPARK_TINTS = [0xe0a0ff, 0xa850ff, 0xffffff];
const POISON_MIST_TINTS = [0x58d828, 0x90ff50];
const HOLY_MOTE_TINTS = [0xfff6c0, 0xffe060, 0xffb830];
const BLOOD_SHARD_TINTS = [0xff2040, 0xff7090, 0xffd0d8];
const THUNDER_SPARK_TINTS = [0xffffff, 0xffe848, 0xffaa20];
const SOUL_SHARD_TINTS = [0xff70c0, 0xffa8dc, 0xffffff];
const DODGE_DUST_TINTS = [0xc8baa0, 0x9e907c];
const DODGE_SPARK_TINTS = [0x9ad0ff, 0xffffff];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randFloat = Phaser.Math.FloatBetween;

export class VfxManager {
  constructor(scene) {
    this.scene = scene;
    this.scorchDecals = [];
    this._shadowTrailT = 0;
    this._bloodBoilT = 0;

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

    this.dustEmitter = scene.add.particles(0, 0, 'vfx_dust_puff', {
      emitting: false,
      maxAliveParticles: 32,
      blendMode: 'NORMAL',
      gravityY: -18,
      accelerationX: { onEmit: () => 0, onUpdate: (p) => -p.velocityX * 1.6 },
      accelerationY: { onEmit: () => 0, onUpdate: (p) => -p.velocityY * 1.6 },
      scale: { onEmit: () => 1, onUpdate: (p, _k, t) => (p._s0 ?? 0.8) * (0.65 + t * 0.65) },
      alpha: { onEmit: () => 0.1, onUpdate: (p, _k, t) => (p._a0 ?? 0.45) * Math.sin(t * Math.PI) },
      rotate: { onEmit: () => 0, onUpdate: (_p, _k, _t, v) => v },
    }).setDepth(9210);

    this.moteEmitter = scene.add.particles(0, 0, 'vfx_frost_shard', {
      emitting: false,
      maxAliveParticles: 36,
      blendMode: 'ADD',
      accelerationX: { onEmit: () => 0, onUpdate: (p) => -p.velocityX * 1.8 },
      accelerationY: { onEmit: () => 0, onUpdate: (p) => -p.velocityY * 1.8 },
      scale: { onEmit: () => 1, onUpdate: (p, _k, t) => (p._s0 ?? 0.75) * (1 - t * 0.72) },
      alpha: { onEmit: () => 1, onUpdate: (p, _k, t) => (p._a0 ?? 0.9) * (1 - t) },
      rotate: { onEmit: () => 0, onUpdate: (p, _k, _t, v) => v + (p._spin ?? 0) },
    }).setDepth(9275);
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
      this.debrisEmitter.getAliveParticleCount() +
      this.dustEmitter.getAliveParticleCount() +
      this.moteEmitter.getAliveParticleCount()
    );
  }

  remainingBudget() {
    return Math.max(0, this.getCap() - this.getAliveCount());
  }

  _scaledCount(base, min = 1) {
    const scaled = this.isLowSpec() ? Math.max(min, Math.round(base * 0.65)) : base;
    return Math.min(scaled, this.remainingBudget());
  }

  applyEnabledState(enabled) {
    const on = !!enabled;
    if (!on) {
      this.flameEmitter.killAll();
      this.sparkEmitter.killAll();
      this.emberEmitter.killAll();
      this.debrisEmitter.killAll();
      this.dustEmitter.killAll();
      this.moteEmitter.killAll();
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
    const l = { x, y, r: Math.min(210, radius), a: alpha, _vfxTimed: true };
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

  _addScorchDecal(x, y, scale, duration = 860, alpha = 0.7) {
    while (this.scorchDecals.length >= 6) {
      const oldest = this.scorchDecals.shift();
      if (oldest && oldest.active) oldest.destroy();
    }
    const scorch = this.scene.add.image(x, y, 'vfx_scorch_crack')
      .setDepth(1.5)
      .setRotation(randFloat(0, Math.PI * 2))
      .setScale(scale)
      .setAlpha(alpha);
    this.scorchDecals.push(scorch);
    this.scene.tweens.add({
      targets: scorch,
      alpha: 0,
      duration,
      ease: 'Quad.In',
      onComplete: () => {
        this.scorchDecals = this.scorchDecals.filter((d) => d !== scorch);
        if (scorch.active) scorch.destroy();
      },
    });
    return scorch;
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
    p._spin = 0;
    if (setup) setup(p);
    return p;
  }

  _emitScaled(emitter, x, y, angRad, speed, life, tint, setup) {
    return this._emitDirected(emitter, x, y, angRad, speed, life, tint, setup);
  }

  _emitSpark(x, y, angRad, speed, life, tint, sx = 0.9, sy = 0.75, alpha = 0.95) {
    return this._emitDirected(this.sparkEmitter, x, y, angRad, speed, life, tint, (p) => {
      p._sx0 = sx;
      p._sy0 = sy;
      p._a0 = alpha;
      p.scaleX = sx;
      p.scaleY = sy;
    });
  }

  _emitDust(x, y, angRad, speed, life, tint, scale = 0.85, alpha = 0.45) {
    return this._emitDirected(this.dustEmitter, x, y, angRad, speed, life, tint, (p) => {
      p._s0 = scale;
      p._a0 = alpha;
      p.scaleX = scale * 0.65;
      p.scaleY = scale * 0.65;
    });
  }

  _emitMote(x, y, angRad, speed, life, tint, scale = 0.75, alpha = 0.9, spin = 0) {
    return this._emitDirected(this.moteEmitter, x, y, angRad, speed, life, tint, (p) => {
      p._s0 = scale;
      p._a0 = alpha;
      p._spin = spin;
      p.scaleX = scale;
      p.scaleY = scale;
    });
  }

  spawnRing(x, y, radius, tint, opt = {}) {
    const startScale = opt.startScale ?? 0.22;
    const scaleYFactor = opt.scaleYFactor ?? 1;
    const ring = this.scene.add.image(x, y, 'vfx_ring')
      .setDepth(opt.depth ?? 9220)
      .setBlendMode(opt.blend ?? Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(startScale, startScale * scaleYFactor)
      .setAlpha(opt.alpha ?? 0.78);
    const endScale = (radius * 2.05) / 96;
    this.scene.tweens.add({
      targets: ring,
      scaleX: endScale,
      scaleY: endScale * scaleYFactor,
      alpha: 0,
      duration: opt.duration ?? 280,
      ease: opt.ease ?? 'Cubic.Out',
      onComplete: () => { if (ring.active) ring.destroy(); },
    });
    return ring;
  }

  spawnRuneCircle(x, y, radius, tint, duration = 550, opt = {}) {
    const scaleX = (radius * 2) / 128;
    const scaleY = scaleX * (opt.scaleYFactor ?? 1);
    const r = this.scene.add.image(x, y, 'vfx_rune_ring')
      .setDepth(opt.depth ?? 3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(scaleX * 0.75, scaleY * 0.75)
      .setAlpha(opt.alpha ?? 0.65);
    this.scene.tweens.add({
      targets: r,
      scaleX,
      scaleY,
      rotation: opt.rot ?? 0.8,
      alpha: 0,
      duration,
      ease: 'Quad.Out',
      onComplete: () => { if (r.active) r.destroy(); },
    });
    return r;
  }

  spawnLightPillar(getPosFn, tint, duration = 650, opt = {}) {
    const pos = getPosFn();
    const scaleX = opt.scaleX ?? 1.0;
    const peakSY = opt.scaleY ?? 1.15;
    const peakA = opt.alpha ?? 0.65;
    const pillar = this.scene.add.image(pos.x, pos.y, 'vfx_light_pillar')
      .setOrigin(0.5, 0.92)
      .setDepth(opt.depth ?? 9230)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setScale(scaleX, 0.25)
      .setAlpha(0);
    const syncPos = () => {
      if (!pillar.active) return;
      const p = getPosFn();
      pillar.setPosition(p.x, p.y);
    };
    this.scene.tweens.add({
      targets: pillar,
      scaleY: peakSY,
      alpha: peakA,
      duration: Math.round(duration * 0.28),
      ease: 'Quad.Out',
      onUpdate: syncPos,
      onComplete: () => {
        if (!pillar.active) return;
        this.scene.tweens.add({
          targets: pillar,
          scaleX: scaleX * 0.45,
          scaleY: peakSY * 1.15,
          alpha: 0,
          duration: Math.round(duration * 0.72),
          ease: 'Quad.In',
          onUpdate: syncPos,
          onComplete: () => { if (pillar.active) pillar.destroy(); },
        });
      },
    });
    return pillar;
  }

  drawJaggedArc(g, x1, y1, x2, y2, segs = 4, jitter = 14, outerCol = 0x40c8ff, outerW = 6, coreW = 2) {
    const pts = [{ x: x1, y: y1 }];
    for (let k = 1; k < segs; k++) {
      const t = k / segs;
      pts.push({
        x: Phaser.Math.Linear(x1, x2, t) + randFloat(-jitter, jitter),
        y: Phaser.Math.Linear(y1, y2, t) + randFloat(-jitter, jitter),
      });
    }
    pts.push({ x: x2, y: y2 });
    g.lineStyle(outerW, outerCol, 0.48);
    for (let k = 0; k < pts.length - 1; k++) g.lineBetween(pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y);
    g.lineStyle(coreW, 0xffffff, 0.96);
    for (let k = 0; k < pts.length - 1; k++) g.lineBetween(pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y);
  }

  playSlashImpact(x, y, angle, tint = 0xffffff, opt = {}) {
    if (!this.isEnabled()) return;
    const count = this._scaledCount(opt.count ?? 5);
    for (let i = 0; i < count; i++) {
      const a = angle + randFloat(-0.85, 0.85);
      this._emitSpark(x, y, a, randFloat(110, 220), Math.round(randFloat(150, 230)), i % 2 === 0 ? tint : 0xffffff, 0.85, 0.7, 0.92);
    }
    const star = this.scene.add.image(x, y, 'vfx_hit_star')
      .setDepth(9290)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setRotation(randFloat(-0.4, 0.4))
      .setScale(0.3)
      .setAlpha(0.85);
    this.scene.tweens.add({
      targets: star,
      scale: 0.85,
      alpha: 0,
      duration: 110,
      ease: 'Quad.Out',
      onComplete: () => { if (star.active) star.destroy(); },
    });
    this.addTimedLight(x, y, 72, 0.35, 110);
  }

  spawnBurst(x, y, count, tints, speed = 120, life = 450) {
    if (!this.isEnabled()) return;
    const n = this._scaledCount(count);
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
    const n = this._scaledCount(count);
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
    const count = this._scaledCount(crit ? 9 : 6, crit ? 4 : 3);
    const tints = crit ? CRIT_SPARK_TINTS : HIT_SPARK_TINTS;

    for (let i = 0; i < count; i++) {
      const ang = angle + randFloat(-0.92, 0.92);
      const sp = crit ? randFloat(170, 320) : randFloat(130, 260);
      const life = Math.round(randFloat(170, 260));
      this._emitSpark(x, y, ang, sp, life, pick(tints), randFloat(0.75, 1.15), randFloat(0.65, 0.95), 0.96);
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

  // ---- 翻滾
  playDodge(player, ang) {
    if (!this.isEnabled()) return;
    const dustN = this._scaledCount(4);
    for (let i = 0; i < dustN; i++) {
      const a = ang + Math.PI + randFloat(-0.65, 0.65);
      this._emitDust(player.fx + randFloat(-6, 6), player.fy + randFloat(-4, 4), a, randFloat(35, 85), Math.round(randFloat(240, 340)), pick(DODGE_DUST_TINTS), randFloat(0.65, 0.95), 0.44);
    }
    const sparkN = this._scaledCount(3);
    for (let i = 0; i < sparkN; i++) {
      const a = ang + Math.PI + randFloat(-0.45, 0.45);
      this._emitSpark(player.fx, player.sprite.y, a, randFloat(85, 155), Math.round(randFloat(160, 230)), pick(DODGE_SPARK_TINTS), 0.75, 0.6, 0.8);
    }
  }

  // ---- 火球術 / 裂焰火球 / 爆炸
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
      this._emitSpark(sx, sy, backAng, randFloat(55, 125), Math.round(randFloat(200, 290)), pick(TRAIL_SPARK_TINTS), 0.65, 0.6, 0.88);
    }
  }

  playFireballExplosion(x, y, radius, opt = {}) {
    const enabled = this.isEnabled();

    this.addTimedLight(x, y, Math.min(210, radius * 1.85), enabled ? 0.82 : 0.62, 360);
    this.spawnRing(x, y, radius, 0xff823e, {
      alpha: enabled ? 0.82 : 0.45,
      duration: enabled ? 250 : 180,
    });

    if (!enabled) return;

    this._addScorchDecal(x, y, (radius * 1.65) / 96, 860, 0.7);

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

    const sparkCount = this._scaledCount(opt.isMeteor ? 18 : opt.isSplit ? 7 : 13, 3);
    for (let i = 0; i < sparkCount; i++) {
      const ang = (i / sparkCount) * Math.PI * 2 + randFloat(-0.22, 0.22);
      this._emitSpark(x, y, ang, randFloat(135, 285), Math.round(randFloat(230, 360)), pick(FIRE_SPARK_TINTS), randFloat(0.85, 1.35), randFloat(0.7, 1.05), 0.96);
    }

    const flameCount = this._scaledCount(opt.isMeteor ? 12 : opt.isSplit ? 5 : 8, 2);
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

  // ---- 旋風斬
  createWhirlVisuals(x, y, R) {
    const enabled = this.isEnabled();
    const vortex = this.scene.add.image(x, y + 2, 'vfx_vortex_ring')
      .setDepth(3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xb8e0ff)
      .setScale((R * 2.05) / 128)
      .setAlpha(enabled ? 0.72 : 0.42);
    const outer = this.scene.add.image(x, y + 2, 'vfx_ring')
      .setDepth(3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xd8f0ff)
      .setScale((R * 2.1) / 96)
      .setAlpha(enabled ? 0.45 : 0.32);
    const ring = this.scene.add.image(x, y - 8, 'slash')
      .setScale(1.55)
      .setTint(0xd0e8ff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(9200);
    const ring2 = this.scene.add.image(x, y - 8, 'slash')
      .setScale(1.55)
      .setTint(0xffffff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(9200)
      .setRotation(Math.PI);
    const light = { x, y, r: 140, a: 0.55, _vfxTimed: true };
    this.scene.extraLights.push(light);
    return { fx: [ring, ring2], vortex, outer, light, dustT: 0 };
  }

  updateWhirlVisuals(w, player, dt) {
    const rot = w.t * 0.03;
    const fade = 1 - (w.t / w.dur) * 0.55;
    const enabled = this.isEnabled();
    w.fx.forEach((f, i) => {
      if (f && f.active) {
        f.setPosition(player.fx, player.sprite.y + 4)
          .setRotation(rot + i * Math.PI)
          .setAlpha(0.85 * fade);
      }
    });
    if (w.vortex && w.vortex.active) {
      w.vortex
        .setPosition(player.fx, player.fy + 2)
        .setRotation(rot * 0.85)
        .setAlpha((enabled ? 0.72 : 0.42) * fade);
    }
    if (w.outer && w.outer.active) {
      w.outer
        .setPosition(player.fx, player.fy + 2)
        .setAlpha((enabled ? 0.45 : 0.32) * fade);
    }
    if (w.light) {
      w.light.x = player.fx;
      w.light.y = player.fy;
      w.light.a = 0.55 * fade;
    }

    if (!enabled) return;

    const low = this.isLowSpec();
    const stepMs = low ? 64 : 42;
    w.dustT = (w.dustT || 0) + dt;
    if (w.dustT < stepMs) return;
    w.dustT %= stepMs;
    if (this.remainingBudget() <= 0) return;

    const dustCount = (!low && this.remainingBudget() >= 3) ? 2 : 1;
    for (let i = 0; i < dustCount; i++) {
      if (this.remainingBudget() <= 0) break;
      const a = randFloat(0, Math.PI * 2);
      const rad = randFloat(w.R * 0.55, w.R * 0.95);
      const px = player.fx + Math.cos(a) * rad;
      const py = player.fy + Math.sin(a) * rad * 0.8;
      this._emitDust(px, py, a + Math.PI / 2, randFloat(55, 115), Math.round(randFloat(260, 380)), pick(WHIRL_DUST_TINTS), randFloat(0.8, 1.15), 0.48);
    }

    const sparkCount = (!low && this.remainingBudget() >= 2) ? 2 : 1;
    for (let i = 0; i < sparkCount; i++) {
      if (this.remainingBudget() <= 0) break;
      const a = randFloat(0, Math.PI * 2);
      const rad = randFloat(w.R * 0.45, w.R * 0.92);
      const px = player.fx + Math.cos(a) * rad;
      const py = player.sprite.y + Math.sin(a) * rad * 0.72;
      this._emitSpark(px, py, a + Math.PI / 2, randFloat(110, 195), Math.round(randFloat(140, 210)), pick(WHIRL_SPARK_TINTS), 0.9, 0.7, 0.9);
    }
  }

  destroyWhirlVisuals(w) {
    if (!w) return;
    if (Array.isArray(w.fx)) {
      for (const f of w.fx) if (f && f.active) f.destroy();
    }
    if (w.vortex && w.vortex.active) w.vortex.destroy();
    if (w.outer && w.outer.active) w.outer.destroy();
    if (w.light) {
      const idx = this.scene.extraLights.indexOf(w.light);
      if (idx !== -1) this.scene.extraLights.splice(idx, 1);
      w.light = null;
    }
  }

  playWhirlQuake(x, y, R) {
    const enabled = this.isEnabled();
    this.addTimedLight(x, y, Math.min(200, R * 1.2), 0.72, 340);
    this.spawnRing(x, y, R, 0x58ff98, { alpha: enabled ? 0.78 : 0.45, duration: 360 });
    if (!enabled) return;

    this._addScorchDecal(x, y, (R * 1.45) / 96, 820, 0.65);
    const sparkN = this._scaledCount(12);
    for (let i = 0; i < sparkN; i++) {
      const a = (i / sparkN) * Math.PI * 2 + randFloat(-0.2, 0.2);
      this._emitSpark(x, y, a, randFloat(145, 255), Math.round(randFloat(220, 320)), i % 2 === 0 ? 0xffd860 : 0x58ff98, 1.0, 0.8, 0.95);
    }
    const dustN = this._scaledCount(8);
    for (let i = 0; i < dustN; i++) {
      const a = randFloat(0, Math.PI * 2);
      this._emitDust(x + Math.cos(a) * 24, y + Math.sin(a) * 18, a, randFloat(75, 145), Math.round(randFloat(320, 460)), pick(WHIRL_DUST_TINTS), 1.1, 0.5);
    }
    this.scene.cameras.main.shake(140, 0.0045);
  }

  // ---- 治療術
  playHeal(player) {
    const enabled = this.isEnabled();
    this.spawnRuneCircle(player.fx, player.fy + 4, 46, 0x50ff88, 720, {
      scaleYFactor: 0.54,
      rot: 0.9,
      alpha: enabled ? 0.65 : 0.42,
    });
    this.addTimedLight(player.fx, player.fy - 10, 135, 0.58, 650);
    if (!enabled) return;

    this.spawnLightPillar(() => ({ x: player.fx, y: player.fy + 8 }), 0x48ff80, 720, {
      scaleX: 1.05,
      scaleY: 1.15,
      alpha: 0.65,
    });

    const waveDelays = [0, 130, 270, 410];
    for (const delay of waveDelays) {
      this.scene.time.delayedCall(delay, () => {
        if (!this.isEnabled() || !player.sprite || !player.sprite.active || player.dead) return;
        const moteN = this._scaledCount(4);
        for (let i = 0; i < moteN; i++) {
          const px = player.fx + randFloat(-22, 22);
          const py = player.fy + randFloat(-6, 8);
          const a = -Math.PI / 2 + randFloat(-0.25, 0.25);
          this._emitMote(px, py, a, randFloat(55, 135), Math.round(randFloat(520, 760)), pick(HEAL_MOTE_TINTS), randFloat(0.65, 1.0), 0.92, randFloat(-3, 3));
        }
        if (this.remainingBudget() > 0) {
          const ex = player.fx + randFloat(-18, 18);
          const ey = player.fy + randFloat(-4, 6);
          this._emitDirected(this.emberEmitter, ex, ey, -Math.PI / 2 + randFloat(-0.2, 0.2), randFloat(65, 125), 600, 0x90ffb0, (p) => {
            p._s0 = 0.72;
            p._a0 = 0.85;
            p.scaleX = p._s0;
            p.scaleY = p._s0;
          });
        }
      });
    }
  }

  // ---- 連鎖閃電（含裝備連鎖觸發）
  playChainLightning(pts, opt = {}) {
    if (!pts || pts.length < 2) return;
    const enabled = this.isEnabled();
    const g = this.scene.add.graphics().setDepth(9300).setBlendMode(Phaser.BlendModes.ADD);
    const drawAll = () => {
      g.clear();
      for (let i = 0; i < pts.length - 1; i++) {
        this.drawJaggedArc(g, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 4, 14, 0x40c8ff, opt.isProc ? 4.5 : 6, opt.isProc ? 1.6 : 2.1);
      }
    };
    drawAll();
    this.scene.time.delayedCall(110, () => {
      if (g.active) drawAll();
    });
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 220,
      onComplete: () => { if (g.active) g.destroy(); },
    });

    if (!enabled) return;

    const maxLightNodes = Math.min(4, pts.length - 1);
    for (let i = 1; i < pts.length; i++) {
      const pt = pts[i];
      const sparkN = this._scaledCount(opt.isProc ? 3 : 5);
      for (let k = 0; k < sparkN; k++) {
        const a = randFloat(0, Math.PI * 2);
        this._emitSpark(pt.x, pt.y, a, randFloat(100, 210), Math.round(randFloat(140, 240)), pick(CHAIN_SPARK_TINTS), 0.85, 0.7, 0.94);
      }
      const star = this.scene.add.image(pt.x, pt.y, 'vfx_hit_star')
        .setDepth(9310)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xa0f4ff)
        .setRotation(randFloat(0, Math.PI / 2))
        .setScale(0.35)
        .setAlpha(0.9);
      this.scene.tweens.add({
        targets: star,
        scale: 0.9,
        alpha: 0,
        duration: 130,
        ease: 'Quad.Out',
        onComplete: () => { if (star.active) star.destroy(); },
      });
      if (i <= maxLightNodes) {
        this.addTimedLight(pt.x, pt.y, 95, 0.48, 180);
      }
    }
  }

  // ---- 寒冰新星
  playFrostNova(x, y, R) {
    const enabled = this.isEnabled();
    this.spawnRing(x, y, R, 0x70e8ff, { alpha: enabled ? 0.8 : 0.45, duration: 380 });
    this.addTimedLight(x, y, Math.min(200, R * 1.2), 0.72, 360);
    if (!enabled) return;

    this.spawnRuneCircle(x, y, R * 0.78, 0x90f8ff, 560, { rot: 1.1, alpha: 0.6 });

    const shardN = this._scaledCount(13, 5);
    for (let i = 0; i < shardN; i++) {
      const a = (i / shardN) * Math.PI * 2 + randFloat(-0.2, 0.2);
      this._emitMote(x, y, a, randFloat(140, 250), Math.round(randFloat(320, 460)), pick(FROST_SHARD_TINTS), randFloat(0.7, 1.05), 0.92, randFloat(-5, 5));
    }
    const mistN = this._scaledCount(6, 2);
    for (let i = 0; i < mistN; i++) {
      const a = randFloat(0, Math.PI * 2);
      this._emitDust(x + Math.cos(a) * 18, y + Math.sin(a) * 14, a, randFloat(65, 130), Math.round(randFloat(320, 460)), pick(FROST_MIST_TINTS), 1.05, 0.4);
    }
    this.scene.cameras.main.shake(85, 0.0022);
  }

  // ---- 暗影突襲
  playShadowDashStart(x, y, ang) {
    this._shadowTrailT = 0;
    const enabled = this.isEnabled();
    this.spawnRing(x, y, 48, 0xa850ff, { alpha: enabled ? 0.65 : 0.4, duration: 220 });
    this.addTimedLight(x, y, 115, 0.52, 220);
    if (!enabled) return;

    const dustN = this._scaledCount(4);
    for (let i = 0; i < dustN; i++) {
      const a = ang + Math.PI + randFloat(-0.7, 0.7);
      this._emitDust(x, y, a, randFloat(45, 105), Math.round(randFloat(260, 380)), pick(SHADOW_SMOKE_TINTS), randFloat(0.85, 1.15), 0.5);
    }
    const sparkN = this._scaledCount(6);
    for (let i = 0; i < sparkN; i++) {
      const a = ang + Math.PI + randFloat(-0.55, 0.55);
      this._emitSpark(x, y - 6, a, randFloat(110, 210), Math.round(randFloat(180, 260)), pick(SHADOW_SPARK_TINTS), 0.9, 0.7, 0.92);
    }
  }

  emitShadowTrail(x, y, ang, dt) {
    if (!this.isEnabled()) return;
    const stepMs = this.isLowSpec() ? 44 : 30;
    this._shadowTrailT += dt;
    if (this._shadowTrailT < stepMs) return;
    this._shadowTrailT %= stepMs;
    if (this.remainingBudget() <= 0) return;

    const back = ang + Math.PI;
    this._emitDust(x, y + 6, back + randFloat(-0.4, 0.4), randFloat(30, 70), 260, pick(SHADOW_SMOKE_TINTS), 0.85, 0.45);
    if (this.remainingBudget() > 0) {
      this._emitSpark(x, y, back + randFloat(-0.3, 0.3), randFloat(90, 160), 190, pick(SHADOW_SPARK_TINTS), 0.8, 0.6, 0.88);
    }
  }

  // ---- 烈焰隕石
  createMeteorVisuals(tx, ty, R) {
    const enabled = this.isEnabled();
    const warn = this.scene.add.circle(tx, ty, R, 0xff4010, 0.14).setStrokeStyle(2.5, 0xff8020, 0.85).setDepth(3);
    const rune = this.scene.add.image(tx, ty, 'vfx_rune_ring')
      .setDepth(3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xff5018)
      .setScale((R * 1.95) / 128)
      .setAlpha(enabled ? 0.6 : 0.35);
    const shrinkRing = this.scene.add.image(tx, ty, 'vfx_ring')
      .setDepth(3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xff9838)
      .setScale((R * 2) / 96)
      .setAlpha(enabled ? 0.75 : 0.45);
    this.scene.tweens.add({
      targets: shrinkRing,
      scale: 0.15,
      alpha: 0.9,
      duration: 580,
      ease: 'Quad.In',
    });

    const sx = tx - 140, sy = ty - 320;
    const fallAng = Math.atan2(320, 140);
    const meteor = this.scene.add.image(sx, sy, 'fireball')
      .setScale(2.3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(9350);
    let tail = null;
    if (enabled) {
      tail = this.scene.add.image(sx, sy, 'vfx_flame_wisp')
        .setOrigin(0.8, 0.5)
        .setRotation(fallAng)
        .setTint(0xff7020)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.7)
        .setScale(3.2, 1.5)
        .setDepth(9345);
    }
    return { warn, rune, shrinkRing, meteor, tail, tx, ty, R, fallAng, trailT: 0 };
  }

  updateMeteorTrail(mState, dt) {
    if (!mState || !mState.meteor || !mState.meteor.active) return;
    const now = this.scene.time.now;
    const stepDt = typeof dt === 'number'
      ? dt
      : (mState._lastNow ? Math.min(50, Math.max(0, now - mState._lastNow)) : 16);
    mState._lastNow = now;
    if (mState.rune && mState.rune.active) mState.rune.setRotation(mState.rune.rotation + stepDt * 0.0025);
    const mx = mState.meteor.x, my = mState.meteor.y;
    if (mState.tail && mState.tail.active) {
      mState.tail.setPosition(mx, my);
    }
    if (!this.isEnabled()) return;

    const stepMs = this.isLowSpec() ? 38 : 26;
    mState.trailT = (mState.trailT || 0) + stepDt;
    if (mState.trailT < stepMs) return;
    mState.trailT %= stepMs;
    if (this.remainingBudget() <= 0) return;

    const back = mState.fallAng + Math.PI + randFloat(-0.35, 0.35);
    this._emitDirected(this.flameEmitter, mx + randFloat(-5, 5), my + randFloat(-5, 5), back, randFloat(60, 130), 250, pick(FLAME_TRAIL_TINTS), (p) => {
      p._s0 = 1.05;
      p._a0 = 0.78;
      p.scaleX = 1.05;
      p.scaleY = 1.05;
    });
    if (this.remainingBudget() > 0) {
      this._emitSpark(mx, my, back + randFloat(-0.4, 0.4), randFloat(80, 165), 240, pick(FIRE_SPARK_TINTS), 0.9, 0.75, 0.9);
    }
    if (Math.random() < 0.5 && this.remainingBudget() > 0) {
      const a = randFloat(0, Math.PI * 2);
      const r = randFloat(0, mState.R * 0.7);
      this._emitDirected(this.emberEmitter, mState.tx + Math.cos(a) * r, mState.ty + Math.sin(a) * r, -Math.PI / 2, randFloat(40, 85), 320, 0xff9030, (p) => {
        p._s0 = 0.7;
        p._a0 = 0.85;
        p.scaleX = 0.7;
        p.scaleY = 0.7;
      });
    }
  }

  destroyMeteorVisuals(mState) {
    if (!mState) return;
    if (mState.warn && mState.warn.active) mState.warn.destroy();
    if (mState.rune && mState.rune.active) mState.rune.destroy();
    if (mState.shrinkRing && mState.shrinkRing.active) mState.shrinkRing.destroy();
    if (mState.meteor && mState.meteor.active) mState.meteor.destroy();
    if (mState.tail && mState.tail.active) mState.tail.destroy();
  }

  // ---- 裂地斬
  playCleave(x, y, ang, _R) {
    const enabled = this.isEnabled();
    const cx = x + Math.cos(ang) * 34;
    const cy = y + Math.sin(ang) * 34;
    const sl = this.scene.add.image(cx, cy, 'slash')
      .setRotation(ang)
      .setScale(1.45)
      .setTint(0xff7828)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(9200);
    this.scene.tweens.add({
      targets: sl,
      alpha: 0,
      scale: 1.8,
      duration: 240,
      onComplete: () => { if (sl.active) sl.destroy(); },
    });

    const fx = x + Math.cos(ang) * 58;
    const fy = y + Math.sin(ang) * 58 + 10;
    this.addTimedLight(fx, fy, 155, enabled ? 0.68 : 0.45, 260);
    if (!enabled) return;

    const inner = this.scene.add.image(cx, cy, 'slash')
      .setRotation(ang)
      .setScale(1.25)
      .setTint(0xfff0a0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(9205);
    this.scene.tweens.add({
      targets: inner,
      alpha: 0,
      scale: 1.6,
      duration: 180,
      onComplete: () => { if (inner.active) inner.destroy(); },
    });

    this._addScorchDecal(fx, fy, 1.1, 700, 0.65);

    const sparkN = this._scaledCount(11, 4);
    for (let i = 0; i < sparkN; i++) {
      const a = ang + randFloat(-0.85, 0.85);
      this._emitSpark(fx, fy - 8, a, randFloat(130, 260), Math.round(randFloat(200, 320)), pick(FIRE_SPARK_TINTS), 1.0, 0.78, 0.96);
    }
    const flameN = this._scaledCount(6, 2);
    for (let i = 0; i < flameN; i++) {
      const a = ang + randFloat(-0.75, 0.75);
      this._emitDirected(this.flameEmitter, fx, fy - 8, a, randFloat(55, 130), 260, pick(FIRE_PUFF_TINTS), (p) => {
        p._s0 = 0.85;
        p._a0 = 0.65;
        p.scaleX = 0.85;
        p.scaleY = 0.85;
      });
    }
    this.scene.cameras.main.shake(95, 0.0028);
  }

  // ---- 寒冰長矛
  createIceLanceVisuals(x, y, ang) {
    const sprite = this.scene.add.image(x, y, 'icebolt')
      .setRotation(ang)
      .setScale(1.85, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(y + 20);
    let tail = null;
    if (this.isEnabled()) {
      tail = this.scene.add.image(x, y, 'vfx_flame_wisp')
        .setOrigin(0.8, 0.5)
        .setRotation(ang)
        .setTint(0x70e0ff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.58)
        .setScale(2.1, 0.72)
        .setDepth(y + 19);
    }
    return { sprite, tail };
  }

  updateIceLanceVisuals(pr, dt) {
    const enabled = this.isEnabled();
    const ang = Math.atan2(pr.vy, pr.vx);
    if (pr.tail && pr.tail.active) {
      pr.tail.setVisible(enabled);
      if (enabled) pr.tail.setPosition(pr.x, pr.y).setRotation(ang).setDepth(pr.y + 19);
    }
    if (!enabled) return;

    const low = this.isLowSpec();
    const stepMs = low ? 38 : 26;
    pr.trailT = (pr.trailT || 0) + dt;
    if (pr.trailT < stepMs) return;
    pr.trailT %= stepMs;
    if (this.remainingBudget() <= 0) return;

    const nx = Math.cos(ang), ny = Math.sin(ang);
    const back = ang + Math.PI + randFloat(-0.4, 0.4);
    this._emitMote(pr.x - nx * 8, pr.y - ny * 8, back, randFloat(40, 95), 240, pick(FROST_SHARD_TINTS), 0.6, 0.86, randFloat(-4, 4));
    if (Math.random() < 0.5 && this.remainingBudget() > 0) {
      this._emitDust(pr.x - nx * 10, pr.y - ny * 10, back, randFloat(20, 50), 220, 0x88e4ff, 0.7, 0.32);
    }
  }

  playIceLancePierce(x, y, ang) {
    if (!this.isEnabled()) return;
    const count = this._scaledCount(6);
    for (let i = 0; i < count; i++) {
      const a = ang + randFloat(-0.9, 0.9);
      this._emitMote(x, y, a, randFloat(95, 190), 250, pick(FROST_SHARD_TINTS), 0.75, 0.92, randFloat(-5, 5));
    }
    this.playSlashImpact(x, y, ang, 0x80e8ff, { count: 4 });
    this.addTimedLight(x, y, 90, 0.45, 140);
  }

  playIceLanceEnd(x, y) {
    const enabled = this.isEnabled();
    this.spawnRing(x, y, 44, 0x70d8ff, { alpha: enabled ? 0.72 : 0.4, duration: 200 });
    if (!enabled) return;
    const count = this._scaledCount(8);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + randFloat(-0.2, 0.2);
      this._emitMote(x, y, a, randFloat(75, 155), 260, pick(FROST_SHARD_TINTS), 0.75, 0.88, randFloat(-5, 5));
    }
  }

  // ---- 劇毒迷霧 & 瘟疫擴散
  createPoisonCloudVisuals(x, y, R) {
    const enabled = this.isEnabled();
    const cloud = this.scene.add.circle(x, y, R, 0x38a81c, 0.16)
      .setStrokeStyle(2, 0x88ff48, 0.62)
      .setDepth(3);
    const vortex = this.scene.add.image(x, y, 'vfx_vortex_ring')
      .setDepth(3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x78ff40)
      .setScale((R * 1.95) / 128)
      .setAlpha(enabled ? 0.44 : 0.25);
    const inner = this.scene.add.image(x, y, 'glow')
      .setTint(0x50d828)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale((R * 1.6) / 128)
      .setAlpha(0.26)
      .setDepth(3);
    return { visuals: [cloud, vortex, inner], vortex };
  }

  updatePoisonCloudVisuals(ge, dt) {
    const enabled = this.isEnabled();
    if (ge.vortex && ge.vortex.active) {
      ge.vortex.setRotation(ge.vortex.rotation + dt * 0.0018);
      ge.vortex.setAlpha(enabled ? 0.44 : 0.25);
    }
    if (!enabled) return;

    const stepMs = this.isLowSpec() ? 200 : 140;
    ge.vfxT = (ge.vfxT || 0) + dt;
    if (ge.vfxT < stepMs) return;
    ge.vfxT %= stepMs;
    if (this.remainingBudget() <= 0) return;

    const a = randFloat(0, Math.PI * 2);
    const rad = randFloat(0, ge.r * 0.82);
    const px = ge.x + Math.cos(a) * rad;
    const py = ge.y + Math.sin(a) * rad * 0.82;
    this._emitDust(px, py, -Math.PI / 2 + randFloat(-0.35, 0.35), randFloat(22, 48), 460, pick(POISON_MIST_TINTS), randFloat(0.95, 1.3), 0.36);

    if (Math.random() < 0.45 && this.remainingBudget() > 0) {
      this._emitMote(px, py, -Math.PI / 2 + randFloat(-0.3, 0.3), randFloat(35, 75), 420, 0xb8ff70, 0.55, 0.8, randFloat(-3, 3));
    }
  }

  // ---- 聖光護盾
  playHolyShieldCast(player) {
    const enabled = this.isEnabled();
    this.spawnRing(player.fx, player.sprite.y + 2, 72, 0xffe060, { alpha: enabled ? 0.78 : 0.45, duration: 320 });
    this.addTimedLight(player.fx, player.sprite.y, 145, 0.6, 460);
    if (!enabled) return;

    this.spawnLightPillar(() => ({ x: player.fx, y: player.fy + 8 }), 0xffe470, 620, {
      scaleX: 0.95,
      scaleY: 1.08,
      alpha: 0.62,
    });
    this.spawnRuneCircle(player.fx, player.fy + 4, 52, 0xffe060, 680, {
      scaleYFactor: 0.54,
      rot: -0.9,
      alpha: 0.68,
    });
    const moteN = this._scaledCount(11, 4);
    for (let i = 0; i < moteN; i++) {
      const a = (i / moteN) * Math.PI * 2;
      const px = player.fx + Math.cos(a) * 20;
      const py = player.fy + Math.sin(a) * 10;
      this._emitMote(px, py, -Math.PI / 2 + randFloat(-0.3, 0.3), randFloat(55, 130), Math.round(randFloat(420, 640)), pick(HOLY_MOTE_TINTS), 0.75, 0.92, randFloat(-4, 4));
    }
  }

  // ---- 鮮血狂怒
  playBloodBoilCast(player) {
    this._bloodBoilT = 0;
    const enabled = this.isEnabled();
    this.spawnRing(player.fx, player.sprite.y, 115, 0xff2848, { alpha: enabled ? 0.82 : 0.45, duration: 340 });
    this.addTimedLight(player.fx, player.sprite.y, 145, 0.58, 400);
    if (!enabled) return;

    this.spawnRing(player.fx, player.sprite.y, 76, 0xff8098, { alpha: 0.7, duration: 240 });
    this.spawnLightPillar(() => ({ x: player.fx, y: player.fy + 8 }), 0xff2848, 540, {
      scaleX: 1.0,
      scaleY: 1.1,
      alpha: 0.6,
    });
    this.spawnRuneCircle(player.fx, player.fy + 4, 54, 0xff3050, 600, {
      scaleYFactor: 0.54,
      rot: 1.0,
      alpha: 0.65,
    });
    const sparkN = this._scaledCount(10, 4);
    for (let i = 0; i < sparkN; i++) {
      const a = (i / sparkN) * Math.PI * 2;
      this._emitSpark(player.fx, player.sprite.y, a, randFloat(110, 210), 260, pick(BLOOD_SHARD_TINTS), 0.95, 0.75, 0.92);
    }
    const shardN = this._scaledCount(8, 3);
    for (let i = 0; i < shardN; i++) {
      const px = player.fx + randFloat(-22, 22);
      this._emitMote(px, player.fy, -Math.PI / 2 + randFloat(-0.35, 0.35), randFloat(65, 145), 480, pick(BLOOD_SHARD_TINTS), 0.75, 0.9, randFloat(-4, 4));
    }
    this.scene.cameras.main.shake(90, 0.0025);
  }

  emitBloodBoilTick(player, dt) {
    if (!this.isEnabled()) return;
    const stepMs = this.isLowSpec() ? 230 : 160;
    this._bloodBoilT += dt;
    if (this._bloodBoilT < stepMs) return;
    this._bloodBoilT %= stepMs;
    if (this.remainingBudget() <= 0) return;

    const px = player.fx + randFloat(-16, 16);
    const py = player.fy + randFloat(-4, 4);
    this._emitMote(px, py, -Math.PI / 2 + randFloat(-0.25, 0.25), randFloat(45, 85), 420, pick(BLOOD_SHARD_TINTS), 0.58, 0.8, randFloat(-3, 3));
  }

  // ---- 秘法光球
  createArcaneOrbVisuals(x, y) {
    const sprite = this.scene.add.image(x, y, 'orb')
      .setScale(1.55)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(y + 20);
    let halo = null;
    if (this.isEnabled()) {
      halo = this.scene.add.image(x, y, 'vfx_vortex_ring')
        .setScale(0.42)
        .setTint(0xc878ff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.72)
        .setDepth(y + 19);
    }
    return { sprite, halo };
  }

  updateArcaneOrbVisuals(pr, dt) {
    const pulse = 1.48 + Math.sin(this.scene.time.now * 0.015) * 0.18;
    if (pr.sprite && pr.sprite.active) pr.sprite.setScale(pulse);

    const enabled = this.isEnabled();
    if (pr.halo && pr.halo.active) {
      pr.halo.setVisible(enabled);
      if (enabled) {
        pr.halo.setPosition(pr.x, pr.y).setRotation(pr.halo.rotation + dt * 0.008).setDepth(pr.y + 19);
      }
    }
    if (!enabled) return;

    const stepMs = this.isLowSpec() ? 60 : 42;
    pr.trailT = (pr.trailT || 0) + dt;
    if (pr.trailT < stepMs) return;
    pr.trailT %= stepMs;
    if (this.remainingBudget() <= 0) return;

    const a = randFloat(0, Math.PI * 2);
    this._emitMote(pr.x + Math.cos(a) * 10, pr.y + Math.sin(a) * 10, a + Math.PI / 2, randFloat(25, 65), 260, 0xd890ff, 0.55, 0.85, randFloat(-4, 4));
  }

  playArcaneZap(ox, oy, targets) {
    if (!targets || !targets.length) return;
    const enabled = this.isEnabled();
    const g = this.scene.add.graphics().setDepth(9300).setBlendMode(Phaser.BlendModes.ADD);
    for (const t of targets) {
      this.drawJaggedArc(g, ox, oy, t.x, t.y, 3, 10, 0xb858ff, 4.5, 1.6);
      if (enabled) {
        const sparkN = this._scaledCount(3);
        for (let i = 0; i < sparkN; i++) {
          this._emitSpark(t.x, t.y, randFloat(0, Math.PI * 2), randFloat(85, 165), 180, i % 2 === 0 ? 0xe0a0ff : 0xffffff, 0.75, 0.65, 0.9);
        }
        const star = this.scene.add.image(t.x, t.y, 'vfx_hit_star')
          .setDepth(9310)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xe0a0ff)
          .setScale(0.32)
          .setAlpha(0.85);
        this.scene.tweens.add({
          targets: star,
          scale: 0.78,
          alpha: 0,
          duration: 120,
          onComplete: () => { if (star.active) star.destroy(); },
        });
      }
    }
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 160,
      onComplete: () => { if (g.active) g.destroy(); },
    });
  }

  playArcaneOrbDetonate(x, y, R) {
    const enabled = this.isEnabled();
    this.spawnRing(x, y, R, 0xc070ff, { alpha: enabled ? 0.8 : 0.45, duration: 280 });
    this.addTimedLight(x, y, Math.min(190, R * 1.8), 0.72, 320);
    if (!enabled) return;

    const c = this.scene.add.image(x, y, 'glow')
      .setTint(0xb868ff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.3)
      .setAlpha(0.6)
      .setDepth(9225);
    this.scene.tweens.add({
      targets: c,
      scale: 1.4,
      alpha: 0,
      duration: 240,
      onComplete: () => { if (c.active) c.destroy(); },
    });

    const star = this.scene.add.image(x, y, 'vfx_hit_star')
      .setDepth(9270)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xf0d0ff)
      .setScale(0.4)
      .setAlpha(0.9);
    this.scene.tweens.add({
      targets: star,
      scale: 1.4,
      alpha: 0,
      duration: 160,
      onComplete: () => { if (star.active) star.destroy(); },
    });

    const sparkN = this._scaledCount(12, 4);
    for (let i = 0; i < sparkN; i++) {
      const a = (i / sparkN) * Math.PI * 2 + randFloat(-0.2, 0.2);
      this._emitSpark(x, y, a, randFloat(120, 230), 280, i % 2 === 0 ? 0xd080ff : 0xffffff, 0.9, 0.75, 0.94);
    }
    const moteN = this._scaledCount(8, 3);
    for (let i = 0; i < moteN; i++) {
      const a = randFloat(0, Math.PI * 2);
      this._emitMote(x, y, a, randFloat(70, 160), 340, 0xe8b8ff, 0.75, 0.9, randFloat(-5, 5));
    }
  }

  // ---- 暗影閃現
  playBlink(ox, oy, bx, by, R, flipX) {
    const enabled = this.isEnabled();
    // 離場印記與殘影
    const departRing = this.scene.add.image(ox, oy - 6, 'vfx_ring')
      .setDepth(9220)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x9040ff)
      .setScale(0.8)
      .setAlpha(enabled ? 0.72 : 0.4);
    this.scene.tweens.add({
      targets: departRing,
      scale: 0.1,
      alpha: 0,
      duration: 190,
      ease: 'Quad.In',
      onComplete: () => { if (departRing.active) departRing.destroy(); },
    });

    // 落地範圍圈與照明
    this.spawnRing(bx, by, R, 0xd088ff, { alpha: enabled ? 0.8 : 0.45, duration: 300 });
    this.addTimedLight(bx, by, 155, 0.7, 300);
    if (!enabled) return;

    const ghost = this.scene.add.image(ox, oy - 12, 'player')
      .setAlpha(0.5)
      .setTint(0x9040ff)
      .setFlipX(flipX)
      .setDepth(oy - 1);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 240,
      onComplete: () => { if (ghost.active) ghost.destroy(); },
    });

    const line = this.scene.add.graphics().setDepth(9240).setBlendMode(Phaser.BlendModes.ADD);
    line.lineStyle(5, 0xc070ff, 0.5);
    line.lineBetween(ox, oy - 8, bx, by - 8);
    line.lineStyle(1.8, 0xffffff, 0.9);
    line.lineBetween(ox, oy - 8, bx, by - 8);
    this.scene.tweens.add({
      targets: line,
      alpha: 0,
      duration: 180,
      onComplete: () => { if (line.active) line.destroy(); },
    });

    this.spawnRuneCircle(bx, by + 2, R * 0.75, 0xa858ff, 420, { rot: 0.9, alpha: 0.6 });

    const smokeN = this._scaledCount(4);
    for (let i = 0; i < smokeN; i++) {
      this._emitDust(ox, oy - 6, randFloat(0, Math.PI * 2), randFloat(35, 85), 290, pick(SHADOW_SMOKE_TINTS), 0.95, 0.48);
    }
    const sparkN = this._scaledCount(12, 4);
    for (let i = 0; i < sparkN; i++) {
      const a = (i / sparkN) * Math.PI * 2 + randFloat(-0.2, 0.2);
      this._emitSpark(bx, by - 8, a, randFloat(120, 230), 280, pick(SHADOW_SPARK_TINTS), 0.9, 0.75, 0.95);
    }
    const moteN = this._scaledCount(6, 2);
    for (let i = 0; i < moteN; i++) {
      this._emitMote(bx, by - 8, randFloat(0, Math.PI * 2), randFloat(70, 150), 340, 0xe0a8ff, 0.7, 0.88, randFloat(-4, 4));
    }
  }

  // ---- 天雷裁決
  playThunderBolt(tx, ty, R) {
    const enabled = this.isEnabled();
    const sx = tx + randFloat(-18, 18);
    const sy = ty - 260;
    const g = this.scene.add.graphics().setDepth(9350).setBlendMode(Phaser.BlendModes.ADD);
    this.drawJaggedArc(g, sx, sy, tx, ty, 6, 16, 0xffe848, 7, 2.5);
    if (enabled) {
      for (let b = 0; b < 2; b++) {
        const bx = Phaser.Math.Linear(sx, tx, 0.45 + b * 0.25) + randFloat(-10, 10);
        const by = Phaser.Math.Linear(sy, ty, 0.45 + b * 0.25);
        this.drawJaggedArc(g, bx, by, bx + (b === 0 ? -34 : 34), by + 56, 3, 9, 0xffe848, 3.5, 1.2);
      }
    }
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 220,
      onComplete: () => { if (g.active) g.destroy(); },
    });

    this.spawnRing(tx, ty, R, 0xffe848, { alpha: enabled ? 0.82 : 0.45, duration: 250 });
    this.addTimedLight(tx, ty, 150, enabled ? 0.72 : 0.5, 240);
    if (!enabled) return;

    this.spawnLightPillar(() => ({ x: tx, y: ty + 6 }), 0xfff078, 180, {
      scaleX: 0.65,
      scaleY: 1.5,
      alpha: 0.65,
    });
    this._addScorchDecal(tx, ty, 0.9, 550, 0.58);

    const star = this.scene.add.image(tx, ty, 'vfx_hit_star')
      .setDepth(9360)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffffff)
      .setRotation(randFloat(0, Math.PI / 2))
      .setScale(0.45)
      .setAlpha(0.95);
    this.scene.tweens.add({
      targets: star,
      scale: 1.35,
      alpha: 0,
      duration: 145,
      onComplete: () => { if (star.active) star.destroy(); },
    });

    const sparkN = this._scaledCount(10, 4);
    for (let i = 0; i < sparkN; i++) {
      const a = (i / sparkN) * Math.PI * 2 + randFloat(-0.2, 0.2);
      this._emitSpark(tx, ty, a, randFloat(140, 260), 260, pick(THUNDER_SPARK_TINTS), 0.95, 0.75, 0.96);
    }
    this.scene.cameras.main.shake(70, 0.0022);
  }

  // ---- 劍刃風暴
  createBladeStormVisuals(x, y, R) {
    const enabled = this.isEnabled();
    this.spawnRing(x, y, R, 0xa0ecff, { alpha: enabled ? 0.72 : 0.4, duration: 280 });
    this.addTimedLight(x, y, 130, 0.5, 220);

    const sx = (R * 2.15) / 128;
    const orbitRing = this.scene.add.image(x, y, 'vfx_vortex_ring')
      .setDepth(3)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x88e0ff)
      .setScale(sx, sx * 0.72)
      .setAlpha(enabled ? 0.34 : 0.18);
    return { orbitRing };
  }

  updateBladeStormVisuals(ob, player, time, dt) {
    const enabled = this.isEnabled();
    if (ob.orbitRing && ob.orbitRing.active) {
      ob.orbitRing
        .setPosition(player.fx, player.fy + 2)
        .setRotation(time * 0.0075)
        .setAlpha(enabled ? 0.34 : 0.18);
    }
    if (!enabled) return;

    const stepMs = this.isLowSpec() ? 125 : 85;
    ob.sparkT = (ob.sparkT || 0) + dt;
    if (ob.sparkT < stepMs) return;
    ob.sparkT %= stepMs;
    if (this.remainingBudget() <= 0 || !ob.blades || !ob.blades.length) return;

    const idx = Math.floor(Math.random() * ob.blades.length);
    const b = ob.blades[idx];
    if (b && b.active) {
      const a = time * 0.0075 + (idx * Math.PI * 2) / ob.blades.length;
      this._emitSpark(b.x, b.y, a + Math.PI / 2, randFloat(75, 135), 180, 0xa8f0ff, 0.75, 0.6, 0.85);
    }
  }

  // ---- 靈魂收割
  playSoulNova(player, R, struckEnemies, healAmount) {
    const enabled = this.isEnabled();
    this.spawnRing(player.fx, player.fy, R, 0xff58b0, { alpha: enabled ? 0.82 : 0.45, duration: 420 });
    this.addTimedLight(player.fx, player.fy, Math.min(200, R * 1.1), 0.75, 380);
    if (!enabled) return;

    this.spawnRuneCircle(player.fx, player.fy + 4, R * 0.82, 0xe03890, 560, { rot: -0.95, alpha: 0.62 });
    this.spawnLightPillar(() => ({ x: player.fx, y: player.fy + 8 }), 0xff68b8, 420, {
      scaleX: 1.1,
      scaleY: 1.2,
      alpha: 0.62,
    });

    const shardN = this._scaledCount(13, 5);
    for (let i = 0; i < shardN; i++) {
      const a = (i / shardN) * Math.PI * 2 + randFloat(-0.2, 0.2);
      this._emitMote(player.fx, player.fy - 8, a, randFloat(150, 265), 380, pick(SOUL_SHARD_TINTS), randFloat(0.75, 1.05), 0.92, randFloat(-5, 5));
    }
    const sparkN = this._scaledCount(8, 3);
    for (let i = 0; i < sparkN; i++) {
      const a = randFloat(0, Math.PI * 2);
      this._emitSpark(player.fx, player.fy - 8, a, randFloat(140, 250), 280, pick(SOUL_SHARD_TINTS), 0.9, 0.75, 0.92);
    }
    this.scene.cameras.main.shake(110, 0.003);

    if (healAmount > 0 && Array.isArray(struckEnemies) && struckEnemies.length) {
      const drainCount = Math.min(5, struckEnemies.length);
      for (let i = 0; i < drainCount; i++) {
        const e = struckEnemies[i];
        const sx = e.fx, sy = e.sprite ? e.sprite.y : e.fy;
        const wisp = this.scene.add.image(sx, sy, 'vfx_flame_wisp')
          .setDepth(9290)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setTint(0xff80c8)
          .setScale(0.55)
          .setAlpha(0.9);
        this.scene.tweens.add({
          targets: wisp,
          x: player.fx,
          y: player.sprite.y,
          scale: 0.28,
          alpha: 0.35,
          duration: 300,
          ease: 'Quad.In',
          onUpdate: () => {
            if (!wisp.active) return;
          },
          onComplete: () => {
            if (wisp.active) wisp.destroy();
            if (i === 0 && player.sprite && player.sprite.active && !player.dead) {
              const star = this.scene.add.image(player.fx, player.sprite.y, 'vfx_hit_star')
                .setDepth(9295)
                .setBlendMode(Phaser.BlendModes.ADD)
                .setTint(0xff98d0)
                .setScale(0.35)
                .setAlpha(0.85);
              this.scene.tweens.add({
                targets: star,
                scale: 0.95,
                alpha: 0,
                duration: 140,
                onComplete: () => { if (star.active) star.destroy(); },
              });
            }
          },
        });
      }
    }
  }

  destroy() {
    this.flameEmitter?.destroy();
    this.sparkEmitter?.destroy();
    this.emberEmitter?.destroy();
    this.debrisEmitter?.destroy();
    this.dustEmitter?.destroy();
    this.moteEmitter?.destroy();
    for (const dec of this.scorchDecals) {
      if (dec && dec.active) dec.destroy();
    }
    this.scorchDecals = [];
  }
}
