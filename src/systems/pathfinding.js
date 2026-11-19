import { TILE } from './textures.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** A* 尋路（8 方向，不切牆角） */
export class PathFinder {
  constructor(dungeon) {
    this.d = dungeon;
    const n = dungeon.W * dungeon.H;
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.seen = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.run = 0;
  }

  find(sx, sy, tx, ty, maxNodes = 5000) {
    const d = this.d, W = d.W;
    if (!d.isFloor(sx, sy) || !d.isFloor(tx, ty)) return null;
    if (sx === tx && sy === ty) return [];
    const run = ++this.run;
    const heapI = [], heapF = [];
    const push = (i, f) => {
      heapI.push(i); heapF.push(f);
      let k = heapI.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heapF[p] <= heapF[k]) break;
        [heapI[p], heapI[k]] = [heapI[k], heapI[p]];
        [heapF[p], heapF[k]] = [heapF[k], heapF[p]];
        k = p;
      }
    };
    const pop = () => {
      const top = heapI[0];
      const li = heapI.pop(), lf = heapF.pop();
      if (heapI.length) {
        heapI[0] = li; heapF[0] = lf;
        let k = 0;
        for (;;) {
          const l = k * 2 + 1, r = l + 1;
          let m = k;
          if (l < heapI.length && heapF[l] < heapF[m]) m = l;
          if (r < heapI.length && heapF[r] < heapF[m]) m = r;
          if (m === k) break;
          [heapI[m], heapI[k]] = [heapI[k], heapI[m]];
          [heapF[m], heapF[k]] = [heapF[k], heapF[m]];
          k = m;
        }
      }
      return top;
    };
    const h = (x, y) => {
      const ax = Math.abs(x - tx), ay = Math.abs(y - ty);
      return Math.max(ax, ay) + 0.4142 * Math.min(ax, ay);
    };
    const s = sy * W + sx, t = ty * W + tx;
    this.seen[s] = run; this.g[s] = 0; this.parent[s] = -1;
    push(s, h(sx, sy));
    let expanded = 0;
    while (heapI.length) {
      const cur = pop();
      if (cur === t) {
        const path = [];
        let c = t;
        while (c !== s) { path.push({ x: c % W, y: (c / W) | 0 }); c = this.parent[c]; }
        return path.reverse();
      }
      if (this.closed[cur] === run) continue;
      this.closed[cur] = run;
      if (++expanded > maxNodes) return null;
      const cx = cur % W, cy = (cur / W) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!d.isFloor(nx, ny)) continue;
        if (dx && dy && (!d.isFloor(cx + dx, cy) || !d.isFloor(cx, cy + dy))) continue;
        const ni = ny * W + nx;
        if (this.closed[ni] === run) continue;
        const ng = this.g[cur] + (dx && dy ? 1.4142 : 1);
        if (this.seen[ni] !== run || ng < this.g[ni]) {
          this.seen[ni] = run; this.g[ni] = ng; this.parent[ni] = cur;
          push(ni, ng + h(nx, ny));
        }
      }
    }
    return null;
  }

  /** 世界座標尋路並做路徑平滑，回傳世界座標點陣列 */
  worldPath(fx, fy, wx, wy, radius = 12, maxNodes = 5000) {
    const d = this.d;
    const sx = Math.floor(fx / TILE), sy = Math.floor(fy / TILE);
    let tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    let exact = true;
    if (!d.isFloor(tx, ty)) {
      const n = d.nearestFloor(tx, ty, 4);
      if (!n) return null;
      tx = n.x; ty = n.y; exact = false;
    }
    let start = { x: sx, y: sy };
    if (!d.isFloor(sx, sy)) {
      const n = d.nearestFloor(sx, sy, 2);
      if (!n) return null;
      start = n;
    }
    const tiles = this.find(start.x, start.y, tx, ty, maxNodes);
    if (!tiles) return null;
    const pts = tiles.map((p) => ({ x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2 }));
    if (exact) {
      if (pts.length) pts[pts.length - 1] = { x: wx, y: wy };
      else pts.push({ x: wx, y: wy });
    } else if (!pts.length) {
      pts.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
    }
    // 路徑平滑（拉繩法）
    const out = [];
    let ax = fx, ay = fy, i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !d.lineClear(ax, ay, pts[j].x, pts[j].y, radius)) j--;
      out.push(pts[j]);
      ax = pts[j].x; ay = pts[j].y;
      i = j + 1;
    }
    return out;
  }
}

