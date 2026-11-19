import { effectiveStats } from './systems/items.js';
import { MAX_SKILL_LV, MAX_EFFECTIVE_SKILL_LV } from './systems/skills.js';
import { RUNE_DEFS, getItemRuneword, emptyRunePouch } from './systems/runes.js';

/** 玩家共享狀態（GameScene 與 UIScene 共用） */
export const state = {};

export const SLOTS = ['weapon', 'helm', 'armor', 'cloak', 'gloves', 'boots', 'amulet', 'accessory'];
export const SLOT_NAMES = {
  weapon: '武器',
  helm: '頭盔',
  armor: '盔甲',
  cloak: '披風',
  gloves: '護手',
  boots: '鞋子',
  amulet: '項鍊',
  accessory: '戒指',
};
export const INV_SIZE = 24;

export function resetState() {
  const eq = {};
  for (const s of SLOTS) eq[s] = null;
  Object.assign(state, {
    level: 1,
    xp: 0,
    gold: 0,
    shards: 0,
    kills: 0,
    points: 0,
    mode: 'village',
    floor: 0,
    maxFloor: 1,
    clearedFloors: 0,
    base: { str: 10, vit: 10, int: 10 },
    inventory: [],
    equipment: eq,
    skillLevels: { fire: 1, whirl: 1, heal: 1 },
    skillBar: ['fire', 'whirl', 'heal', null, null],
    runes: emptyRunePouch(),
    buffs: { frenzy: 0, arcane: 0, bloodBoil: 0, shield: 0 },
    shield: 0,
    shieldMax: 0,
    startTime: Date.now(),
    victory: false,
    dead: false,
  });
  const s = getStats();
  state.hp = s.maxHp;
  state.mp = s.maxMp;
}

export function xpToNext(level) {
  return Math.floor(40 * Math.pow(level, 1.6));
}

function applyBonusObj(g, obj) {
  if (!obj) return;
  for (const k in obj) {
    if (k in g && typeof obj[k] === 'number') g[k] += obj[k];
  }
}

export function gearTotals() {
  const g = {
    atk: 0, def: 0, hp: 0, mp: 0,
    lifesteal: 0, thorns: 0, moveSpeed: 0, atkSpeed: 0,
    cdr: 0, manaCostRed: 0, critChance: 0, critDmg: 0,
    dmgRed: 0, onKillHp: 0, onKillMp: 0, hpRegenPct: 0,
    mpRegenBonus: 0, goldFind: 0, magicFind: 0, chainProc: 0, novaProc: 0,
    dodgeCdr: 0, allSkills: 0,
    skillBonuses: {},
    activeAuras: [],
  };
  const auraMap = new Map();

  for (const slot of SLOTS) {
    const it = state.equipment[slot];
    if (!it) continue;

    applyBonusObj(g, effectiveStats(it));

    if (it.runes) {
      for (const rId of it.runes) applyBonusObj(g, RUNE_DEFS[rId]?.bonus);
      const rw = getItemRuneword(it);
      if (rw) {
        applyBonusObj(g, rw.bonus);
        const cur = auraMap.get(rw.id);
        if (cur) cur.stacks++;
        else auraMap.set(rw.id, { def: rw, stacks: 1 });
      }
    }

    if (it.specials) {
      for (const af of it.specials) {
        if (af.type === 'skillLv') {
          g.skillBonuses[af.skillId] = (g.skillBonuses[af.skillId] || 0) + af.val;
        } else if (af.type in g) {
          g[af.type] += af.val;
        }
      }
    }
  }

  g.activeAuras = Array.from(auraMap.values());
  return g;
}

export function getStats() {
  const g = gearTotals();
  const { str, vit, int } = state.base;
  const frenzyMul = state.buffs && state.buffs.frenzy > 0 ? 1.4 : 1;
  const bloodBoil = state.buffs && state.buffs.bloodBoil > 0;
  const bloodAtkMul = bloodBoil ? 1.35 : 1;
  return {
    str, vit, int,
    attack: Math.round((4 + str * 1.2 + g.atk) * frenzyMul * bloodAtkMul),
    defense: Math.round(g.def + vit * 0.3),
    maxHp: Math.round(60 + vit * 8 + g.hp),
    maxMp: Math.round(30 + int * 4 + g.mp),
    spellPower: 1 + int * 0.06,
    lifesteal: Math.min(0.50, g.lifesteal) + (bloodBoil ? 0.15 : 0),
    thorns: Math.min(2.50, g.thorns),
    moveSpeed: Math.min(0.85, g.moveSpeed),
    atkSpeed: Math.min(0.80, g.atkSpeed) + (bloodBoil ? 0.25 : 0),
    cdr: Math.min(0.60, g.cdr),
    manaCostRed: Math.min(0.50, g.manaCostRed),
    critChance: Math.min(0.75, 0.10 + g.critChance),
    critDmg: 1.8 + g.critDmg,
    dmgRed: Math.min(0.45, g.dmgRed),
    onKillHp: g.onKillHp,
    onKillMp: g.onKillMp,
    hpRegenPct: g.hpRegenPct,
    mpRegenBonus: g.mpRegenBonus,
    goldFind: Math.min(2.0, g.goldFind),
    magicFind: Math.min(2.50, g.magicFind),
    chainProc: Math.min(0.50, g.chainProc),
    novaProc: Math.min(0.50, g.novaProc),
    dodgeCdr: Math.min(0.50, g.dodgeCdr),
    allSkills: g.allSkills,
    skillBonuses: g.skillBonuses,
    activeAuras: g.activeAuras,
  };
}

export function getEffectiveSkillLevel(skillId) {
  const base = state.skillLevels[skillId] || 0;
  if (!base) return 0;
  const s = getStats();
  return Math.min(MAX_EFFECTIVE_SKILL_LV, base + s.allSkills + (s.skillBonuses[skillId] || 0));
}

export function socketRune(item, runeId) {
  if (!item || item.kind !== 'equip' || !RUNE_DEFS[runeId]) return { ok: false, reason: 'invalid' };
  if ((state.runes[runeId] || 0) <= 0) return { ok: false, reason: 'none' };
  if (!item.runes) item.runes = [];
  if ((item.sockets || 0) <= item.runes.length) return { ok: false, reason: 'full' };
  item.runes.push(runeId);
  state.runes[runeId]--;
  clampVitals();
  return { ok: true, runeword: getItemRuneword(item) };
}

export function unsocketRunes(item) {
  if (!item || !item.runes || !item.runes.length) return 0;
  const n = item.runes.length;
  for (const rId of item.runes) {
    if (state.runes && rId in state.runes) state.runes[rId]++;
  }
  item.runes = [];
  clampVitals();
  return n;
}

/** 加經驗，回傳升了幾級 */
export function addXp(amount) {
  state.xp += amount;
  let ups = 0;
  while (state.xp >= xpToNext(state.level)) {
    state.xp -= xpToNext(state.level);
    state.level++;
    state.points += 5;
    ups++;
  }
  if (ups) {
    const s = getStats();
    state.hp = s.maxHp;
    state.mp = s.maxMp;
  }
  return ups;
}

export function clampVitals() {
  const s = getStats();
  state.hp = Math.min(state.hp, s.maxHp);
  state.mp = Math.min(state.mp, s.maxMp);
}

export function allocate(attr) {
  if (state.points <= 0) return false;
  const before = getStats();
  state.base[attr]++;
  state.points--;
  const after = getStats();
  state.hp += after.maxHp - before.maxHp;
  state.mp += after.maxMp - before.maxMp;
  return true;
}

export function equip(invIndex) {
  const item = state.inventory[invIndex];
  if (!item || item.kind === 'book') return false;
  const old = state.equipment[item.slot];
  state.equipment[item.slot] = item;
  state.inventory.splice(invIndex, 1);
  if (old) state.inventory.splice(invIndex, 0, old);
  clampVitals();
  return true;
}

export function unequip(slot) {
  const item = state.equipment[slot];
  if (!item || state.inventory.length >= INV_SIZE) return false;
  state.equipment[slot] = null;
  state.inventory.push(item);
  clampVitals();
  return true;
}

export function useSkillBook(invIndex) {
  const item = state.inventory[invIndex];
  if (!item || item.kind !== 'book') return { ok: false, reason: 'invalid' };
  const skillId = item.skillId;
  const cur = state.skillLevels[skillId] || 0;
  if (cur === 0) {
    state.skillLevels[skillId] = 1;
    if (!state.skillBar.includes(skillId)) {
      const emptyIdx = state.skillBar.indexOf(null);
      if (emptyIdx !== -1) state.skillBar[emptyIdx] = skillId;
    }
    state.inventory.splice(invIndex, 1);
    return { ok: true, learned: true, skillId, level: 1 };
  }
  if (cur >= MAX_SKILL_LV) {
    return { ok: false, reason: 'maxed', skillId };
  }
  state.skillLevels[skillId] = cur + 1;
  state.inventory.splice(invIndex, 1);
  return { ok: true, learned: false, skillId, level: cur + 1 };
}

export function assignSkillSlot(slotIdx, skillId) {
  if (slotIdx < 0 || slotIdx >= state.skillBar.length) return false;
  if (skillId && !state.skillLevels[skillId]) return false;
  const old = state.skillBar[slotIdx];
  const prevIdx = skillId ? state.skillBar.indexOf(skillId) : -1;
  state.skillBar[slotIdx] = skillId;
  if (prevIdx !== -1 && prevIdx !== slotIdx) {
    state.skillBar[prevIdx] = old || null;
  }
  return true;
}

export function elapsedText() {
  const s = Math.floor((Date.now() - state.startTime) / 1000);
  return `${Math.floor(s / 60)} 分 ${String(s % 60).padStart(2, '0')} 秒`;
}

resetState();
