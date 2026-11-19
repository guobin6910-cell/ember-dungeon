import { state, resetState, getStats, SLOTS } from '../state.js';
import { emptyRunePouch } from './runes.js';
import { syncNextItemId } from './items.js';

export const SAVE_KEY = 'ember_dungeon_save_v1';

export function saveGame() {
  try {
    const payload = {
      v: 1,
      savedAt: Date.now(),
      elapsedMs: Math.max(0, Date.now() - (state.startTime || Date.now())),
      level: state.level,
      xp: state.xp,
      gold: state.gold,
      shards: state.shards,
      kills: state.kills,
      points: state.points,
      maxFloor: state.maxFloor,
      clearedFloors: state.clearedFloors,
      base: state.base,
      inventory: state.inventory,
      equipment: state.equipment,
      skillLevels: state.skillLevels,
      skillBar: state.skillBar,
      runes: state.runes,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function getSaveMeta() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || typeof data.level !== 'number') return null;
    return {
      level: data.level,
      maxFloor: data.maxFloor || 1,
      clearedFloors: data.clearedFloors || 0,
      kills: data.kills || 0,
      gold: data.gold || 0,
      savedAt: data.savedAt || 0,
    };
  } catch {
    return null;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || typeof data.level !== 'number') return false;

    resetState();
    state.level = Math.max(1, data.level);
    state.xp = Math.max(0, data.xp || 0);
    state.gold = Math.max(0, data.gold || 0);
    state.shards = Math.max(0, data.shards || 0);
    state.kills = Math.max(0, data.kills || 0);
    state.points = Math.max(0, data.points || 0);
    state.maxFloor = Math.max(1, data.maxFloor || 1);
    state.clearedFloors = Math.max(0, data.clearedFloors || 0);
    if (data.base) {
      state.base = {
        str: Math.max(1, data.base.str || 10),
        vit: Math.max(1, data.base.vit || 10),
        int: Math.max(1, data.base.int || 10),
      };
    }

    state.inventory = Array.isArray(data.inventory) ? data.inventory : [];
    const eq = {};
    for (const slot of SLOTS) eq[slot] = (data.equipment && data.equipment[slot]) || null;
    state.equipment = eq;

    if (data.skillLevels && typeof data.skillLevels === 'object') {
      state.skillLevels = { ...data.skillLevels };
    }
    if (Array.isArray(data.skillBar)) {
      state.skillBar = Array.from({ length: 5 }, (_, i) => data.skillBar[i] || null);
    }
    state.runes = { ...emptyRunePouch(), ...(data.runes || {}) };

    let maxId = 0;
    for (const it of state.inventory) if (it && it.id > maxId) maxId = it.id;
    for (const slot of SLOTS) {
      const eqIt = state.equipment[slot];
      if (eqIt && eqIt.id > maxId) maxId = eqIt.id;
    }
    syncNextItemId(maxId);

    state.startTime = Date.now() - Math.max(0, data.elapsedMs || 0);
    state.mode = 'village';
    state.floor = 0;
    state.dead = false;
    state.victory = false;
    const s = getStats();
    state.hp = s.maxHp;
    state.mp = s.maxMp;
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

