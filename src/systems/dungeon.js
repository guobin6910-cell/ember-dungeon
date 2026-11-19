import { TILE } from './textures.js';

const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export const BIOMES = [
  {
    id: 'ember',
    name: '焦石地窟',
    tiles: 'tiles',
    torchTint: 0xff6a10,
    fogTint: 0xa0a0b8,
    dark: 0x060308,
    darkAlpha: 0.93,
    bossType: 'bone',
    pool: ['skeleton', 'archer', 'bat', 'spider'],
    elites: ['gargoyle'],
  },
  {
    id: 'blood',
    name: '血霧墓穴',
    tiles: 'tiles_blood',
    torchTint: 0xff2828,
    fogTint: 0xc05060,
    dark: 0x0d0205,
    darkAlpha: 0.93,
    bossType: 'blood',
    pool: ['skeleton', 'bat', 'necromancer', 'assassin', 'spider'],
    elites: ['gargoyle'],
  },
  {
    id: 'frost',
    name: '霜骨深淵',
    tiles: 'tiles_frost',
    torchTint: 0x40c8ff,
    fogTint: 0x70b0e0,
    dark: 0x030812,
    darkAlpha: 0.93,
    bossType: 'frost',
    pool: ['archer', 'frost_mage', 'assassin', 'necromancer'],
    elites: ['gargoyle', 'golem'],
  },
  {
    id: 'abyss',
    name: '烈焰王座',
    tiles: 'tiles_abyss',
    torchTint: 0xff5510,
    fogTint: 0xd06030,
    dark: 0x0a0208,
    darkAlpha: 0.94,
    bossType: 'abyss',
    pool: ['skeleton', 'necromancer', 'assassin', 'frost_mage', 'bat', 'spider'],
    elites: ['gargoyle', 'golem'],
  },
];

export function getBiome(floor = 1) {
  return BIOMES[(Math.max(1, floor) - 1) % BIOMES.length];
}

function carveCorridor(carve, a, b) {
  const horizFirst = Math.random() < 0.5;
  const hLine = (x1, x2, y) => {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      for (let d = -1; d <= 1; d++) carve(x, y + d);
    }
  };
  const vLine = (y1, y2, x) => {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      for (let d = -1; d <= 1; d++) carve(x + d, y);
    }
  };
  if (horizFirst) { hLine(a.cx, b.cx, a.cy); vLine(a.cy, b.cy, b.cx); }
  else { vLine(a.cy, b.cy, a.cx); hLine(a.cx, b.cx, b.cy); }
}

/**
 * 產生多變拓撲的地城（起始方位、分岔、迴廊與戰術石柱每次不同），最後一間為主線 Boss 房。
 */
export function generateDungeon(floor = 1) {
  const W = 120, H = 90;
  const mainCount = Math.min(11, 7 + Math.floor((floor - 1) / 2));
  const biome = getBiome(floor);

  for (let attempt = 0; attempt < 240; attempt++) {
    const rooms = [];
    const side = R(0, 3); // 0:左, 1:右, 2:上, 3:下
    const fw = 10, fh = 9;
    let fx, fy, dirs;
    if (side === 0) {
      fx = 4; fy = R(12, H - fh - 12);
      dirs = ['r', 'r', 'u', 'd'];
    } else if (side === 1) {
      fx = W - fw - 4; fy = R(12, H - fh - 12);
      dirs = ['l', 'l', 'u', 'd'];
    } else if (side === 2) {
      fx = R(14, W - fw - 14); fy = 4;
      dirs = ['d', 'd', 'l', 'r'];
    } else {
      fx = R(14, W - fw - 14); fy = H - fh - 4;
      dirs = ['u', 'u', 'l', 'r'];
    }
    rooms.push({ x: fx, y: fy, w: fw, h: fh, boss: false, parent: -1 });

    let ok = true;
    const fits = (x, y, w, h, pad = 3) => {
      if (x < 3 || y < 3 || x + w > W - 3 || y + h > H - 3) return false;
      return !rooms.some((o) => x < o.x + o.w + pad && x + w + pad > o.x && y < o.y + o.h + pad && y + h + pad > o.y);
    };

    const tryPlaceAround = (prev, w, h, dirChoices) => {
      const pcx = prev.x + Math.floor(prev.w / 2), pcy = prev.y + Math.floor(prev.h / 2);
      for (let t = 0; t < 70; t++) {
        const dir = dirChoices[R(0, dirChoices.length - 1)];
        const gap = R(4, 9);
        let x, y;
        if (dir === 'r') { x = prev.x + prev.w + gap; y = pcy - Math.floor(h / 2) + R(-5, 5); }
        else if (dir === 'l') { x = prev.x - gap - w; y = pcy - Math.floor(h / 2) + R(-5, 5); }
        else if (dir === 'u') { y = prev.y - gap - h; x = pcx - Math.floor(w / 2) + R(-6, 6); }
        else { y = prev.y + prev.h + gap; x = pcx - Math.floor(w / 2) + R(-6, 6); }
        if (fits(x, y, w, h, 3)) return { x, y, w, h };
      }
      return null;
    };

    for (let i = 1; i < mainCount; i++) {
      const boss = i === mainCount - 1;
      const w = boss ? 21 : R(9, 15);
      const h = boss ? 17 : R(8, 12);
      const placed = tryPlaceAround(rooms[i - 1], w, h, dirs);
      if (!placed) { ok = false; break; }
      rooms.push({ ...placed, boss, parent: i - 1 });
    }
    if (!ok) continue;

    // 1~2 個分岔支線房（不含起點與 Boss 房）
    const branchTarget = R(1, 2);
    for (let b = 0; b < branchTarget; b++) {
      const hostIdx = R(1, mainCount - 2);
      const w = R(9, 12), h = R(8, 11);
      const placed = tryPlaceAround(rooms[hostIdx], w, h, ['u', 'd', 'l', 'r']);
      if (placed) rooms.push({ ...placed, boss: false, branch: true, parent: hostIdx });
    }

    const grid = new Uint8Array(W * H);
    const carve = (x, y) => { if (x > 1 && y > 1 && x < W - 2 && y < H - 2) grid[y * W + x] = 1; };
    rooms.forEach((rm, i) => {
      rm.index = i;
      rm.cx = rm.x + Math.floor(rm.w / 2);
      rm.cy = rm.y + Math.floor(rm.h / 2);
      for (let y = rm.y; y < rm.y + rm.h; y++) for (let x = rm.x; x < rm.x + rm.w; x++) carve(x, y);
    });

    // 主線＋支線走廊
    for (let i = 1; i < rooms.length; i++) {
      const rm = rooms[i];
      carveCorridor(carve, rooms[rm.parent], rm);
    }

    // 1~2 條額外迴廊（不連 Boss 房）
    let loops = 0;
    for (let t = 0; t < 25 && loops < 2; t++) {
      const a = R(1, rooms.length - 1), b = R(1, rooms.length - 1);
      if (a === b || rooms[a].boss || rooms[b].boss || rooms[a].parent === b || rooms[b].parent === a) continue;
      const dist = Math.hypot(rooms[a].cx - rooms[b].cx, rooms[a].cy - rooms[b].cy);
      if (dist >= 14 && dist <= 34) {
        carveCorridor(carve, rooms[a], rooms[b]);
        loops++;
      }
    }

    // 大型普通房有 35% 機率加入對稱戰術石柱
    rooms.forEach((rm, i) => {
      if (i === 0 || rm.boss || rm.w < 11 || rm.h < 10) return;
      if (Math.random() > 0.35) return;
      const px1 = rm.x + 3, px2 = rm.x + rm.w - 4;
      const py1 = rm.y + 3, py2 = rm.y + rm.h - 4;
      grid[py1 * W + px1] = 0;
      grid[py1 * W + px2] = 0;
      grid[py2 * W + px1] = 0;
      grid[py2 * W + px2] = 0;
    });

    const d = new Dungeon(W, H, grid, rooms);
    d.biome = biome;
    d.floor = floor;
    d.isVillage = false;
    return d;
  }
  throw new Error('地城產生失敗');
}

/**
 * 產生安全區域「餘燼村」地圖
 */
export function generateVillage() {
  const W = 36, H = 26;
  const grid = new Uint8Array(W * H);
  const carve = (x, y) => { if (x > 1 && y > 1 && x < W - 2 && y < H - 2) grid[y * W + x] = 1; };
  // 主廣場
  for (let y = 6; y <= 20; y++) for (let x = 5; x <= 30; x++) carve(x, y);
  // 鐵匠舖內凹區（左上）& 傳送聖殿內凹區（右上）
  for (let y = 4; y < 6; y++) for (let x = 6; x <= 13; x++) carve(x, y);
  for (let y = 4; y < 6; y++) for (let x = 23; x <= 29; x++) carve(x, y);

  const rooms = [{ index: 0, x: 5, y: 6, w: 26, h: 15, cx: 18, cy: 13, boss: false }];
  const d = new Dungeon(W, H, grid, rooms);
  d.isVillage = true;
  d.floor = 0;
  d.biome = {
    id: 'village',
    name: '餘燼村',
    tiles: 'tiles_village',
    torchTint: 0xffa040,
    fogTint: 0xb0a088,
    dark: 0x100a06,
    darkAlpha: 0.38,
  };
  d.landmarks = {
    spawn: { x: 18, y: 16 },
    campfire: { x: 18, y: 12 },
    fountain: { x: 18, y: 8 },
    smith: { x: 9, y: 9 },
    forge: { x: 8, y: 6 },
    anvil: { x: 11, y: 9 },
    portal: { x: 26, y: 8 },
    dummy: { x: 10, y: 17 },
  };
  // 全村預設探索完成
  for (let i = 0; i < W * H; i++) {
    if (d.tiles[Math.floor(i / W)][i % W] !== 0) d.explored[i] = 1;
  }
  d.newlyExplored = [];
  for (let i = 0; i < W * H; i++) if (d.explored[i]) d.newlyExplored.push(i);
  return d;
}

export class Dungeon {
  constructor(W, H, grid, rooms) {
    this.W = W; this.H = H; this.grid = grid; this.rooms = rooms;
    this.explored = new Uint8Array(W * H);
    this.tiles = this.buildTiles();
  }
  isFloor(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < this.W && ty < this.H && this.grid[ty * this.W + tx] === 1;
  }
  walkableAt(wx, wy) {
    return this.isFloor(Math.floor(wx / TILE), Math.floor(wy / TILE));
  }
  buildTiles() {
    const { W, H } = this;
    const data = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < W; x++) {
        if (this.isFloor(x, y)) {
          const r = Math.random();
          row.push(r < 0.5 ? 1 : r < 0.78 ? 2 : r < 0.88 ? 3 : r < 0.96 ? 6 : 7);
        } else if (this.isFloor(x, y + 1)) {
          row.push(5);
        } else {
          let near = false;
          for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (this.isFloor(x + dx, y + dy)) { near = true; break; }
          row.push(near ? 4 : 0);
        }
      }
      data.push(row);
    }
    return data;
  }
  roomAt(wx, wy) {
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    return this.rooms.find((r) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) || null;
  }
  randomFloorInRoom(room, margin = 1) {
    for (let i = 0; i < 60; i++) {
      const tx = R(room.x + margin, room.x + room.w - 1 - margin);
      const ty = R(room.y + margin, room.y + room.h - 1 - margin);
      if (this.isFloor(tx, ty)) return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
    }
    return { x: room.cx * TILE + TILE / 2, y: room.cy * TILE + TILE / 2 };
  }
  /** 找到最近的可走格 */
  nearestFloor(tx, ty, maxR = 4) {
    if (this.isFloor(tx, ty)) return { x: tx, y: ty };
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = 1e9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (this.isFloor(tx + dx, ty + dy)) {
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = { x: tx + dx, y: ty + dy }; }
        }
      }
      if (best) return best;
    }
    return null;
  }
  /** 直線視線檢查（含身體半徑） */
  lineClear(x1, y1, x2, y2, radius = 0) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) return true;
    const steps = Math.ceil(len / 10);
    const nx = -dy / len * radius, ny = dx / len * radius;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x1 + dx * t, y = y1 + dy * t;
      if (!this.walkableAt(x, y)) return false;
      if (radius && (!this.walkableAt(x + nx, y + ny) || !this.walkableAt(x - nx, y - ny))) return false;
    }
    return true;
  }
}
