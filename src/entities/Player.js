import Phaser from 'phaser';
import { ensureEntityArtTexture } from '../systems/dungeonArt.js';

export const PLAYER_FOOT = 12;
export const PLAYER_R = 12;

export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.w = 36;
    this.h = 48;
    this.foot = PLAYER_FOOT;
    this.usesCustomArt = false;
    this.shadow = scene.add.image(x, y, 'shadowtex').setScale(0.75, 0.32);
    this.sprite = scene.physics.add.sprite(x, y - this.foot, 'player');
    this.sword = scene.add.image(x, y, 'sword').setOrigin(0.5, 0.82);
    this.syncBody();
    this.path = [];
    this.joyVec = { x: 0, y: 0 };
    this.keyVec = { x: 0, y: 0 };
    this.lastMoveAngle = 0;
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
    this.repathedOnStuck = false;
    this.onStuck = null;
    this.lastPos = { x, y };
    this.dead = false;
    this.applyCustomArt();
  }

  get fx() { return this.sprite.x; }
  get fy() { return this.sprite.y + this.foot; }
  get topY() { return this.sprite.y - this.h / 2; }

  setFootPosition(x, y) {
    this.sprite.setPosition(x, y - this.foot);
  }

  syncBody() {
    if (this.sprite?.body) {
      this.sprite.body.setCircle(PLAYER_R, this.w / 2 - PLAYER_R, this.h / 2 + this.foot - PLAYER_R);
    }
  }

  applyCustomArt() {
    if (this.usesCustomArt || !this.sprite?.active) return false;
    const spec = ensureEntityArtTexture(this.scene, 'player');
    if (!spec) return false;
    const gx = this.fx, gy = this.fy;
    this.usesCustomArt = true;
    this.w = spec.w;
    this.h = spec.h;
    this.foot = spec.foot;
    this.sprite.setTexture(spec.texKey);
    this.sprite.setPosition(gx, gy - this.foot);
    this.syncBody();
    this.shadow.setScale(0.95, 0.36);
    this.sword.setScale(1.15);
    return true;
  }

  setPath(pts) {
    this.path = pts || [];
    this.stuckT = 0;
    this.repathedOnStuck = false;
  }
  setMoveVector(vx, vy) {
    const len = Math.hypot(vx, vy);
    if (len < 0.08) {
      this.joyVec.x = 0;
      this.joyVec.y = 0;
      return;
    }
    const clamp = Math.min(1, len);
    this.joyVec.x = (vx / len) * clamp;
    this.joyVec.y = (vy / len) * clamp;
    this.lastMoveAngle = Math.atan2(this.joyVec.y, this.joyVec.x);
    this.path = [];
    this.stuckT = 0;
  }
  setKeyVector(vx, vy) {
    const len = Math.hypot(vx, vy);
    if (len < 0.08) {
      this.keyVec.x = 0;
      this.keyVec.y = 0;
      return;
    }
    this.keyVec.x = vx / len;
    this.keyVec.y = vy / len;
    this.lastMoveAngle = Math.atan2(this.keyVec.y, this.keyVec.x);
    this.path = [];
    this.stuckT = 0;
  }
  clearJoystick() { this.joyVec.x = 0; this.joyVec.y = 0; }
  clearMoveInputs() { this.joyVec.x = 0; this.joyVec.y = 0; this.keyVec.x = 0; this.keyVec.y = 0; }
  stop() { this.path = []; this.sprite.body.setVelocity(0, 0); }
  get manualVec() {
    if (Math.hypot(this.joyVec.x, this.joyVec.y) > 0.08) return this.joyVec;
    if (Math.hypot(this.keyVec.x, this.keyVec.y) > 0.08) return this.keyVec;
    return null;
  }
  get moving() { return this.path.length > 0 || !!this.manualVec; }

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

    const mVec = this.manualVec;
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
    } else if (mVec) {
      const baseSp = this.speed * speedMul;
      const curSp = this.slowT > 0 ? baseSp * 0.6 : baseSp;
      let vx = mVec.x * curSp;
      let vy = mVec.y * curSp;
      const dg = this.scene?.dungeon;
      // 沿牆角平滑側移防卡
      if (dg) {
        if ((body.blocked.left || body.blocked.right) && Math.abs(mVec.y) < 0.25) {
          const lookX = this.fx + Math.sign(mVec.x) * 24;
          const upFree = dg.walkableAt(lookX, this.fy - 22);
          const downFree = dg.walkableAt(lookX, this.fy + 22);
          if (upFree && !downFree) vy = -curSp * 0.55;
          else if (downFree && !upFree) vy = curSp * 0.55;
        } else if ((body.blocked.up || body.blocked.down) && Math.abs(mVec.x) < 0.25) {
          const lookY = this.fy + Math.sign(mVec.y) * 24;
          const leftFree = dg.walkableAt(this.fx - 22, lookY);
          const rightFree = dg.walkableAt(this.fx + 22, lookY);
          if (leftFree && !rightFree) vx = -curSp * 0.55;
          else if (rightFree && !leftFree) vx = curSp * 0.55;
        }
      }
      body.setVelocity(vx, vy);
      if (Math.abs(mVec.x) > 0.12) this.facing = mVec.x > 0 ? 1 : -1;
      this.stuckT = 0;
    } else if (this.path.length) {
      const p = this.path[0];
      const dx = p.x - this.fx, dy = p.y - this.fy;
      const d = Math.hypot(dx, dy);
      const baseSp = this.speed * speedMul;
      const curSp = this.slowT > 0 ? baseSp * 0.6 : baseSp;
      if (d < 8) {
        this.path.shift();
        if (!this.path.length) body.setVelocity(0, 0);
      } else {
        const sp = Math.min(curSp, d / (dt / 1000) || curSp);
        let vx = (dx / d) * sp;
        let vy = (dy / d) * sp;
        // A* 碰撞牆角滑動輔助
        if ((body.blocked.left && vx < 0) || (body.blocked.right && vx > 0)) {
          const tileCy = Math.floor(this.fy / 48) * 48 + 24;
          const slideDir = Math.abs(dy) >= 6 ? Math.sign(dy) : (Math.sign(tileCy - this.fy) || 1);
          vy = slideDir * sp * 0.92;
        } else if ((body.blocked.up && vy < 0) || (body.blocked.down && vy > 0)) {
          const tileCx = Math.floor(this.fx / 48) * 48 + 24;
          const slideDir = Math.abs(dx) >= 6 ? Math.sign(dx) : (Math.sign(tileCx - this.fx) || 1);
          vx = slideDir * sp * 0.92;
        }
        body.setVelocity(vx, vy);
        this.lastMoveAngle = Math.atan2(dy, dx);
        if (Math.abs(dx) > 3) this.facing = dx > 0 ? 1 : -1;
      }
      // 卡住偵測與嚴格尋路自救
      const moved = Math.hypot(this.fx - this.lastPos.x, this.fy - this.lastPos.y);
      if (moved < 0.5) {
        this.stuckT += dt;
        if (this.stuckT > 220 && !this.repathedOnStuck && this.path.length) {
          this.repathedOnStuck = true;
          const dest = this.path[this.path.length - 1];
          if (this.onStuck) this.onStuck(dest);
        } else if (this.stuckT > 520) {
          this.stop();
        }
      } else {
        this.stuckT = 0;
        this.repathedOnStuck = false;
      }
    } else {
      body.setVelocity(0, 0);
    }
    this.lastPos.x = this.fx; this.lastPos.y = this.fy;

    // 走路與揮劍動作
    const moving = body.velocity.length() > 5 && !this.dodge && !this.dash;
    const tiltAmp = this.usesCustomArt ? 4.5 : 7;
    if (this.swing && !this.dodge && this.usesCustomArt) {
      const sp = Math.min(1, this.swing.t / this.swing.dur);
      s.setAngle(this.facing * Math.sin(sp * Math.PI) * 9);
    } else if (moving) {
      this.walkT += dt;
      s.setAngle(Math.sin(this.walkT * 0.018) * tiltAmp);
    } else if (!this.dodge) {
      this.walkT = 0;
      s.setAngle(s.angle * 0.8);
    }
    s.setFlipX(this.facing < 0);
    s.setDepth(this.fy);
    this.shadow.setPosition(this.fx, this.fy + 1).setDepth(2);

    // 劍
    const hx = s.x + this.facing * (this.usesCustomArt ? 14 : 11), hy = s.y + 6;
    const showSword = !this.dodge && !this.dead && (!this.usesCustomArt || !!this.swing || !!this.scene?.whirl);
    this.sword.setPosition(hx, hy).setDepth(this.fy + 1).setVisible(showSword);
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
