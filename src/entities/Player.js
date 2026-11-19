import Phaser from 'phaser';

export const PLAYER_FOOT = 12;
export const PLAYER_R = 10;

export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.shadow = scene.add.image(x, y, 'shadowtex').setScale(0.75, 0.32);
    this.sprite = scene.physics.add.sprite(x, y - PLAYER_FOOT, 'player');
    this.sprite.body.setCircle(PLAYER_R, 18 - PLAYER_R, 24 + PLAYER_FOOT - PLAYER_R);
    this.sword = scene.add.image(x, y, 'sword').setOrigin(0.5, 0.82);
    this.path = [];
    this.speed = 190;
    this.facing = 1;
    this.walkT = 0;
    this.swing = null; // {t, dur, angle}
    this.dodge = null; // {t, dur, vx, vy}
    this.dash = null;  // {t, dur, vx, vy, angle, onTick}
    this.dodgeCd = 0;
    this.dodgeMaxCd = 1200;
    this.attackCd = 0;
    this.invuln = 0;
    this.slowT = 0;
    this.hurtFlashT = 0;
    this._wasSlow = false;
    this.stuckT = 0;
    this.lastPos = { x, y };
    this.dead = false;
  }

  get fx() { return this.sprite.x; }
  get fy() { return this.sprite.y + PLAYER_FOOT; }

  setPath(pts) { this.path = pts || []; this.stuckT = 0; }
  stop() { this.path = []; this.sprite.body.setVelocity(0, 0); }
  get moving() { return this.path.length > 0; }

  applySlow(ms) {
    this.slowT = Math.max(this.slowT, ms);
  }

  flashHurt() {
    this.hurtFlashT = 110;
    this.sprite.setTintFill(0xff3030);
  }

  startSwing(angle, dur = 260) {
    this.swing = { t: 0, dur, angle };
    this.facing = Math.cos(angle) >= 0 ? 1 : -1;
  }

  startDodge(angle, dist = 190, dur = 260) {
    const sp = dist / (dur / 1000);
    this.dodge = { t: 0, dur, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, angle };
    this.dash = null;
    this.facing = Math.cos(angle) >= 0 ? 1 : -1;
    this.path = [];
  }

  startDash(angle, dist = 280, dur = 200, onTick = null) {
    const sp = dist / (dur / 1000);
    this.dash = { t: 0, dur, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, angle, onTick };
    this.dodge = null;
    this.facing = Math.cos(angle) >= 0 ? 1 : -1;
    this.path = [];
  }

  update(dt, speedMul = 1) {
    const body = this.sprite.body;
    const s = this.sprite;
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.slowT = Math.max(0, this.slowT - dt);

    if (this.hurtFlashT > 0) {
      this.hurtFlashT -= dt;
      if (this.hurtFlashT <= 0) {
        if (this.slowT > 0) s.setTint(0x80d0ff);
        else s.clearTint();
      }
    } else {
      const slow = this.slowT > 0;
      if (slow !== this._wasSlow) {
        this._wasSlow = slow;
        if (slow) s.setTint(0x80d0ff);
        else s.clearTint();
      }
    }

    if (this.dead) { body.setVelocity(0, 0); return; }

    if (this.dodge) {
      this.dodge.t += dt;
      body.setVelocity(this.dodge.vx, this.dodge.vy);
      const p = this.dodge.t / this.dodge.dur;
      s.setAngle(this.facing * p * 360);
      s.setScale(1, 0.85 + Math.abs(Math.sin(p * Math.PI)) * -0.15 + 0.15);
      if (this.dodge.t >= this.dodge.dur) {
        this.dodge = null;
        s.setAngle(0);
        s.setScale(1);
        body.setVelocity(0, 0);
      }
    } else if (this.dash) {
      this.dash.t += dt;
      body.setVelocity(this.dash.vx, this.dash.vy);
      if (this.dash.onTick) this.dash.onTick(dt);
      if (this.dash.t >= this.dash.dur) {
        this.dash = null;
        body.setVelocity(0, 0);
      }
    } else if (this.path.length) {
      const p = this.path[0];
      const dx = p.x - this.fx, dy = p.y - this.fy;
      const d = Math.hypot(dx, dy);
      const baseSp = this.speed * speedMul;
      const curSp = this.slowT > 0 ? baseSp * 0.6 : baseSp;
      if (d < 6) {
        this.path.shift();
        if (!this.path.length) body.setVelocity(0, 0);
      } else {
        const sp = Math.min(curSp, d / (dt / 1000) || curSp);
        body.setVelocity((dx / d) * sp, (dy / d) * sp);
        if (Math.abs(dx) > 3) this.facing = dx > 0 ? 1 : -1;
      }
      // 卡住偵測
      const moved = Math.hypot(this.fx - this.lastPos.x, this.fy - this.lastPos.y);
      if (moved < 0.4) { this.stuckT += dt; if (this.stuckT > 350) this.stop(); }
      else this.stuckT = 0;
    } else {
      body.setVelocity(0, 0);
    }
    this.lastPos.x = this.fx; this.lastPos.y = this.fy;

    // 走路動畫
    const moving = body.velocity.length() > 5 && !this.dodge && !this.dash;
    if (moving) {
      this.walkT += dt;
      s.setAngle(Math.sin(this.walkT * 0.018) * 7);
    } else if (!this.dodge) {
      this.walkT = 0;
      s.setAngle(s.angle * 0.8);
    }
    s.setFlipX(this.facing < 0);
    s.setDepth(this.fy);
    this.shadow.setPosition(this.fx, this.fy + 2).setDepth(2);

    // 劍
    const hx = s.x + this.facing * 11, hy = s.y + 6;
    this.sword.setPosition(hx, hy).setDepth(this.fy + 1).setVisible(!this.dodge);
    if (this.swing) {
      this.swing.t += dt;
      const p = Math.min(1, this.swing.t / this.swing.dur);
      const e = Phaser.Math.Easing.Cubic.Out(p);
      const a = this.swing.angle + Math.PI / 2 + (-1.6 + e * 3.2) * this.facing;
      this.sword.setRotation(a);
      if (p >= 1) this.swing = null;
    } else {
      this.sword.setRotation(this.facing * 0.5 + (moving ? Math.sin(this.walkT * 0.018) * 0.15 : 0));
    }
  }
}
