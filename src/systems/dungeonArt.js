import floorUrl from '../../assets/dungeon-floor-512.png';
import wallUrl from '../../assets/dungeon-wall-512.png';
import backdropUrl from '../../assets/dungeon-backdrop-1280.png';
import { TILE } from './textures.js';

export const ART_KEYS = {
  BACKDROP: 'dungeon_backdrop',
  FLOOR: 'dungeon_floor',
  FLOOR_TILE: 'dungeon_floor_256',
  WALL: 'dungeon_wall',
  WALL_ATLAS: 'dungeon_wall_atlas',
};

// 依 4 大生態系微調寫實材質明暗與色調，維持地城原本的昏暗氛圍與敵我辨識度
export const BIOME_ART_STYLES = {
  ember: { floorTint: 0xb0a8a2, wallTint: 0xa89f98, capColor: [18, 15, 14] },
  blood: { floorTint: 0xba8c92, wallTint: 0xb2848c, capColor: [22, 11, 13] },
  frost: { floorTint: 0x84a8c4, wallTint: 0x80a2be, capColor: [13, 19, 27] },
  abyss: { floorTint: 0xa4889a, wallTint: 0xa88a88, capColor: [16, 10, 13] },
};

export function getBiomeArtStyle(biomeId) {
  return BIOME_ART_STYLES[biomeId] || BIOME_ART_STYLES.ember;
}

const preloadedGames = new WeakMap();

export function hasBackdropArt(game) {
  return !!game?.textures?.exists(ART_KEYS.BACKDROP);
}

export function isDungeonArtReady(game) {
  return !!(game?.textures?.exists(ART_KEYS.FLOOR) && game?.textures?.exists(ART_KEYS.WALL));
}

export function fitCoverSprite(imgObj, targetW, targetH) {
  if (!imgObj || !imgObj.width || !imgObj.height) return imgObj;
  const s = Math.max(targetW / imgObj.width, targetH / imgObj.height);
  imgObj.setScale(s);
  return imgObj;
}

/**
 * 以非阻塞方式並行載入並於背景解碼 3 張地城美術圖，確保低階手機不會卡在啟動畫面。
 */
export function preloadDungeonArt(game) {
  if (!game) return null;
  const existing = preloadedGames.get(game);
  if (existing) return existing;

  const tracker = {
    errors: new Set(),
    readyEmitted: false,
  };
  preloadedGames.set(game, tracker);

  const sources = [
    [ART_KEYS.BACKDROP, backdropUrl],
    [ART_KEYS.FLOOR, floorUrl],
    [ART_KEYS.WALL, wallUrl],
  ];

  for (const [key, url] of sources) {
    if (game.textures.exists(key)) continue;
    const img = new Image();
    img.decoding = 'async';
    try {
      const resolved = new URL(url, window.location.href);
      if (resolved.protocol !== 'data:' && resolved.origin !== window.location.origin) {
        img.crossOrigin = 'anonymous';
      }
    } catch { /* ignore */ }
    img.onload = () => {
      const finalize = () => {
        if (game.isDestroyed) return;
        if (!game.textures.exists(key)) {
          game.textures.addImage(key, img);
        }
        game.events.emit(`dungeonArtLoaded:${key}`);
        game.events.emit('dungeonArtLoaded', key);
        if (isDungeonArtReady(game) && !tracker.readyEmitted) {
          tracker.readyEmitted = true;
          game.events.emit('dungeonArtReady');
        }
      };
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {}).then(finalize);
      } else {
        finalize();
      }
    };
    img.onerror = () => {
      tracker.errors.add(key);
      if (!game.isDestroyed) {
        game.events.emit(`dungeonArtError:${key}`);
      }
    };
    img.src = url;
  }

  if (isDungeonArtReady(game) && !tracker.readyEmitted) {
    tracker.readyEmitted = true;
    game.events.emit('dungeonArtReady');
  }

  return tracker;
}

/**
 * 將載入完成的地板／牆面原圖烘焙為省效能的 POT 平鋪圖、單層牆面圖集與生態系遮罩地磚。
 */
export function ensureDungeonArtTextures(scene, biome) {
  const style = getBiomeArtStyle(biome?.id);

  // 1. 256×256 POT 無縫地板材質（精準 2x 縮放匹配 48px 格子與行動端 WebGL1 相容）
  if (!scene.textures.exists(ART_KEYS.FLOOR_TILE)) {
    const floorImg = scene.textures.get(ART_KEYS.FLOOR).getSourceImage();
    const tex = scene.textures.createCanvas(ART_KEYS.FLOOR_TILE, 256, 256);
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(floorImg, 0, 0, 256, 256);
    tex.refresh();
  }

  // 2. 單塊牆面圖集（192×72）：嚴禁垂直重複，保留上方亮面／下方暗面並左右無縫
  if (!scene.textures.exists(ART_KEYS.WALL_ATLAS)) {
    const wallImg = scene.textures.get(ART_KEYS.WALL).getSourceImage();
    const atlas = scene.textures.createCanvas(ART_KEYS.WALL_ATLAS, 192, 72);
    const ctx = atlas.getContext();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 左半 144px 並排兩張 72×72（1:1 比例、完整 0..512 高度只畫一次），切出 3 張 48×72 無縫牆段
    ctx.drawImage(wallImg, 0, 0, 72, 72);
    ctx.drawImage(wallImg, 72, 0, 72, 72);
    const ao = ctx.createLinearGradient(0, 68, 0, 72);
    ao.addColorStop(0, 'rgba(0,0,0,0)');
    ao.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = ao;
    ctx.fillRect(0, 68, 144, 4);

    atlas.add('w0', 0, 0, 0, 48, 72);
    atlas.add('w1', 0, 48, 0, 48, 72);
    atlas.add('w2', 0, 96, 0, 48, 72);

    // 右側 48×48 單塊戰術石柱牆面（1:1 比例、上方亮下方暗，供北側鄰接地板的孤立柱體使用）
    ctx.drawImage(wallImg, 144, 0, 48, 48);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(144, 0, 48, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(144, 46, 48, 2);
    atlas.add('pillar', 0, 144, 0, 48, 48);

    atlas.refresh();
  }

  // 3. 生態系遮罩地磚集（地板格完全透明以露出底層平鋪，牆頂與虛空保留暗石遮罩）
  const maskKey = `tiles_dungeon_mask_${biome?.id || 'ember'}`;
  if (!scene.textures.exists(maskKey)) {
    const wallImg = scene.textures.get(ART_KEYS.WALL).getSourceImage();
    const maskTex = scene.textures.createCanvas(maskKey, TILE * 8, TILE);
    const ctx = maskTex.getContext();
    const [r, g, b] = style.capColor;

    // Tile 0：房外深黑虛空遮罩
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, TILE, TILE);

    // Tile 4：房間左／右／南側牆頂，取牆面下方陰影紋理並融入深色邊框基調
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(wallImg, 0, 320, 192, 192, 4 * TILE, 0, TILE, TILE);
    ctx.fillStyle = `rgba(${r},${g},${b},0.72)`;
    ctx.fillRect(4 * TILE, 0, TILE, TILE);

    // Tile 5：北牆背板底色（上方覆蓋 depth 0.5 的單塊牆面精靈）
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(5 * TILE, 0, TILE, TILE);

    maskTex.refresh();
  }

  return { maskKey, style };
}

