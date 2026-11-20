import Phaser from 'phaser';
import { SLOTS } from '../state.js';
import { SKILL_DEFS, SKILL_LIST } from './skills.js';
import { MAX_SOCKETS } from './runes.js';
import { SET_DEFS, SET_LIST, getSetDef } from './sets.js';

export const MAX_ENHANCE = 10;

const BASES = {
  weapon: ['短劍', '長劍', '戰斧', '釘錘', '巨劍', '彎刀'],
  helm: ['皮帽', '鐵盔', '角盔', '面甲盔'],
  armor: ['皮甲', '鎖子甲', '鱗甲', '板甲'],
  cloak: ['布披風', '暗影斗篷', '符文披風', '血織披肩'],
  gloves: ['皮護手', '鎖甲手套', '戰士拳套', '秘銀護腕'],
  boots: ['皮靴', '鐵脛靴', '疾風戰靴', '暗影長靴'],
  amulet: ['護符', '項鍊', '墜飾', '聖徽項鍊'],
  accessory: ['鐵戒', '魔戒', '印戒', '寶石指環'],
};
const WHITE_PREFIX = ['破舊的', '普通的', '粗糙的', '生鏽的'];
const BLUE_PREFIX = { atk: '鋒利的', def: '堅固的', hp: '強健的', mp: '奧術的' };
const GOLD_PREFIX = ['餘燼', '深淵', '血月', '亡者', '焚天', '永夜', '灰燼王', '燼火'];
export const STAT_NAMES = { atk: '攻擊', def: '防禦', hp: '生命', mp: '法力' };

let nextId = 1;
const rnd = (a, b) => a + Math.random() * (b - a);

function rollPct(min, max, ilvl, quality, specialMax = max) {
  const cap = quality === 'special' ? specialMax : max;
  const t = Math.min(1, Math.max(0, (ilvl - 1) / 14));
  const base = min + (cap - min) * (0.25 + t * 0.55) * rnd(0.75, 1.25);
  return Math.max(min, Math.min(cap, Math.round(base * 100) / 100));
}

function rollInt(min, max, ilvl, quality, specialMax = max) {
  const cap = quality === 'special' ? specialMax : max;
  const t = Math.min(1, Math.max(0, (ilvl - 1) / 14));
  const base = min + (cap - min) * (0.25 + t * 0.55) * rnd(0.75, 1.25);
  return Math.max(min, Math.min(cap, Math.round(base)));
}

export const SPECIAL_AFFIX_POOL = [
  {
    type: 'cdr', weight: 12,
    roll: (ilvl, q) => ({ type: 'cdr', val: rollPct(0.05, 0.16, ilvl, q, 0.20) }),
    format: (af) => `技能冷卻縮減 -${Math.round(af.val * 100)}%`,
  },
  {
    type: 'skillLv', weight: 12,
    roll: (ilvl, q, spec = {}) => {
      const skillId = spec.skillId || Phaser.Utils.Array.GetRandom(SKILL_LIST).id;
      const maxLv = q === 'special' ? 3 : 2;
      const minLv = Math.max(1, spec.minVal || 1);
      const val = Math.min(maxLv, Phaser.Math.Between(minLv, q === 'special' || ilvl >= 6 ? maxLv : 1));
      return { type: 'skillLv', skillId, val };
    },
    format: (af) => {
      const name = SKILL_DEFS[af.skillId]?.name || af.skillId;
      return `【${name}】技能等級 +${af.val}`;
    },
  },
  {
    type: 'allSkills', weight: 6,
    roll: (ilvl, q) => ({
      type: 'allSkills',
      val: q === 'special' && (ilvl >= 7 || Math.random() < 0.35) ? 2 : 1,
    }),
    format: (af) => `全技能等級 +${af.val}`,
  },
  {
    type: 'lifesteal', weight: 10,
    roll: (ilvl, q) => ({ type: 'lifesteal', val: rollPct(0.03, 0.09, ilvl, q, 0.11) }),
    format: (af) => `攻擊吸血 +${Math.round(af.val * 100)}%`,
  },
  {
    type: 'thorns', weight: 10,
    roll: (ilvl, q) => ({ type: 'thorns', val: rollPct(0.20, 0.60, ilvl, q, 0.75) }),
    format: (af) => `反彈傷害 +${Math.round(af.val * 100)}%`,
  },
  {
    type: 'moveSpeed', weight: 10,
    roll: (ilvl, q) => ({ type: 'moveSpeed', val: rollPct(0.06, 0.18, ilvl, q, 0.22) }),
    format: (af) => `移動速度 +${Math.round(af.val * 100)}%`,
  },
  {
    type: 'atkSpeed', weight: 10,
    roll: (ilvl, q) => ({ type: 'atkSpeed', val: rollPct(0.08, 0.20, ilvl, q, 0.25) }),
    format: (af) => `攻擊速度 +${Math.round(af.val * 100)}%`,
  },
  {
    type: 'critChance', weight: 10,
    roll: (ilvl, q) => ({ type: 'critChance', val: rollPct(0.04, 0.12, ilvl, q, 0.15) }),
    format: (af) => `爆擊率 +${Math.round(af.val * 100)}%`,
  },
  {
    type: 'critDmg', weight: 9,
    roll: (ilvl, q) => ({ type: 'critDmg', val: rollPct(0.15, 0.45, ilvl, q, 0.55) }),
    format: (af) => `爆擊傷害 +${Math.round(af.val * 100)}%`,
  },
  {
    type: 'manaCostRed', weight: 9,
    roll: (ilvl, q) => ({ type: 'manaCostRed', val: rollPct(0.08, 0.20, ilvl, q, 0.24) }),
    format: (af) => `技能耗魔 -${Math.round(af.val * 100)}%`,
  },
  {
    type: 'dmgRed', weight: 9,
    roll: (ilvl, q) => ({ type: 'dmgRed', val: rollPct(0.04, 0.12, ilvl, q, 0.15) }),
    format: (af) => `受到傷害減免 +${Math.round(af.val * 100)}%`,
  },
  {
    type: 'onKillHp', weight: 9,
    roll: (ilvl, q) => ({ type: 'onKillHp', val: rollInt(6, 22, ilvl, q, 28) }),
    format: (af) => `擊殺回血 +${af.val}`,
  },
  {
    type: 'onKillMp', weight: 9,
    roll: (ilvl, q) => ({ type: 'onKillMp', val: rollInt(4, 14, ilvl, q, 18) }),
    format: (af) => `擊殺回魔 +${af.val}`,
  },
  {
    type: 'goldFind', weight: 9,
    roll: (ilvl, q) => ({ type: 'goldFind', val: rollPct(0.15, 0.45, ilvl, q, 0.60) }),
    format: (af) => `金幣掉落 +${Math.round(af.val * 100)}%`,
  },
  {
    type: 'magicFind', weight: 10,
    roll: (ilvl, q) => ({ type: 'magicFind', val: rollPct(0.18, 0.55, ilvl, q, 0.75) }),
    format: (af) => `掉寶率 +${Math.round(af.val * 100)}%`,
  },
  {
    type: 'chainProc', weight: 7,
    roll: (ilvl, q) => ({ type: 'chainProc', val: rollPct(0.12, 0.24, ilvl, q, 0.28) }),
    format: (af) => `攻擊 ${Math.round(af.val * 100)}% 觸發電弧追擊`,
  },
  {
    type: 'novaProc', weight: 7,
    roll: (ilvl, q) => ({ type: 'novaProc', val: rollPct(0.14, 0.26, ilvl, q, 0.30) }),
    format: (af) => `受擊 ${Math.round(af.val * 100)}% 觸發冰霜反擊`,
  },
];

const AFFIX_MAP = Object.fromEntries(SPECIAL_AFFIX_POOL.map((a) => [a.type, a]));

export function formatSpecialAffix(af) {
  if (!af) return '';
  const def = AFFIX_MAP[af.type];
  return def ? def.format(af) : `${af.type} +${af.val}`;
}

export const SPECIAL_UNIQUES = [
  { id: 'ember_blade', slot: 'weapon', name: '《燼血魔刃》', guaranteed: [{ type: 'lifesteal' }, { type: 'skillLv', skillId: 'whirl' }] },
  { id: 'chrono_staff', slot: 'weapon', name: '《時空裂隙之劍》', guaranteed: [{ type: 'cdr' }, { type: 'allSkills' }] },
  { id: 'thorn_mail', slot: 'armor', name: '《棘刺魔鎧》', guaranteed: [{ type: 'thorns' }, { type: 'dmgRed' }] },
  { id: 'shadow_cloak', slot: 'armor', name: '《幽影疾行甲》', guaranteed: [{ type: 'moveSpeed' }, { type: 'skillLv', skillId: 'dash' }] },
  { id: 'abyss_crown', slot: 'helm', name: '《深淵賢者之冠》', guaranteed: [{ type: 'cdr' }, { type: 'skillLv', minVal: 2 }] },
  { id: 'soul_helm', slot: 'helm', name: '《噬魂戰盔》', guaranteed: [{ type: 'critChance' }, { type: 'critDmg' }] },
  { id: 'eternal_charm', slot: 'accessory', name: '《永劫沙漏護符》', guaranteed: [{ type: 'cdr' }, { type: 'allSkills' }] },
  { id: 'greed_ring', slot: 'accessory', name: '《貪婪領主之戒》', guaranteed: [{ type: 'goldFind' }, { type: 'skillLv' }] },
  { id: 'loot_cloak', slot: 'cloak', name: '《劫掠者暗影披風》', guaranteed: [{ type: 'magicFind' }, { type: 'moveSpeed' }] },
  { id: 'inferno_cloak', slot: 'cloak', name: '《焚界炎魔披風》', guaranteed: [{ type: 'cdr' }, { type: 'skillLv', skillId: 'meteor' }] },
  { id: 'blood_gloves', slot: 'gloves', name: '《狂戰嗜血護手》', guaranteed: [{ type: 'atkSpeed' }, { type: 'lifesteal' }] },
  { id: 'thunder_gloves', slot: 'gloves', name: '《雷霆掌控手套》', guaranteed: [{ type: 'chainProc' }, { type: 'skillLv', skillId: 'thunder_strike' }] },
  { id: 'wind_boots', slot: 'boots', name: '《疾風行者戰靴》', guaranteed: [{ type: 'moveSpeed' }, { type: 'cdr' }] },
  { id: 'frost_boots', slot: 'boots', name: '《冰霜踐踏長靴》', guaranteed: [{ type: 'novaProc' }, { type: 'dmgRed' }] },
  { id: 'star_amulet', slot: 'amulet', name: '《命運之星項鍊》', guaranteed: [{ type: 'magicFind' }, { type: 'allSkills' }] },
  { id: 'arcane_amulet', slot: 'amulet', name: '《秘法永恆墜飾》', guaranteed: [{ type: 'cdr' }, { type: 'manaCostRed' }] },
];

function pickWeightedAffix(excludeSet, preferTypes = null) {
  const candidates = SPECIAL_AFFIX_POOL.filter((a) => {
    if (preferTypes && !preferTypes.includes(a.type)) return false;
    return a.type === 'skillLv' || !excludeSet.has(a.type);
  });
  const pool = candidates.length ? candidates : SPECIAL_AFFIX_POOL;
  let total = 0;
  for (const a of pool) total += a.weight;
  let pick = Math.random() * total;
  for (const a of pool) {
    pick -= a.weight;
    if (pick <= 0) return a;
  }
  return pool[0];
}

function rollAffixEntry(spec, ilvl, quality, existing) {
  const def = AFFIX_MAP[spec.type];
  if (!def) return null;
  let af = def.roll(ilvl, quality, spec);
  if (af.type === 'skillLv' && !spec.skillId) {
    const usedSkills = new Set(existing.filter((x) => x.type === 'skillLv').map((x) => x.skillId));
    const avail = SKILL_LIST.filter((s) => !usedSkills.has(s.id));
    if (avail.length) af.skillId = Phaser.Utils.Array.GetRandom(avail).id;
  }
  return af;
}

function rollSpecialAffixes(quality, ilvl, guaranteed = []) {
  if (quality === 'white') return [];
  const list = [];
  const used = new Set();

  if (quality === 'special') {
    for (const g of guaranteed) {
      const af = rollAffixEntry(g, ilvl, quality, list);
      if (af) {
        list.push(af);
        used.add(af.type);
      }
    }
    const needSkillOrCdr = !list.some((a) => a.type === 'cdr' || a.type === 'skillLv' || a.type === 'allSkills');
    const extraDef = pickWeightedAffix(used, needSkillOrCdr ? ['cdr', 'skillLv', 'allSkills'] : null);
    const extra = rollAffixEntry({ type: extraDef.type }, ilvl, quality, list);
    if (extra) list.push(extra);
    return list;
  }

  let count = 0;
  if (quality === 'blue') count = Math.random() < 0.35 ? 1 : 0;
  else if (quality === 'gold') count = Math.random() < 0.85 ? Phaser.Math.Between(1, 2) : 0;
  else if (quality === 'set') count = Phaser.Math.Between(1, 2);

  for (let i = 0; i < count; i++) {
    const def = pickWeightedAffix(used);
    const af = rollAffixEntry({ type: def.type }, ilvl, quality, list);
    if (af) {
      list.push(af);
      used.add(af.type);
    }
  }
  return list;
}

function rollQuality(bonus = 0) {
  const r = Math.random();
  if (r < 0.035 + bonus * 0.3) return 'special';
  if (r < 0.11 + bonus * 0.6) return 'gold';
  if (r < 0.40 + bonus) return 'blue';
  return 'white';
}

function rollSockets(quality) {
  const r = Math.random();
  if (quality === 'special') return r < 0.55 ? 2 : 3;
  if (quality === 'set') return r < 0.20 ? 1 : r < 0.72 ? 2 : 3;
  if (quality === 'gold') {
    if (r < 0.15) return 0;
    if (r < 0.40) return 1;
    if (r < 0.78) return 2;
    return 3;
  }
  if (quality === 'blue') {
    if (r < 0.35) return 0;
    if (r < 0.70) return 1;
    if (r < 0.94) return 2;
    return 3;
  }
  if (r < 0.50) return 0;
  if (r < 0.85) return 1;
  return 2;
}

function affixValue(stat, ilvl, mult) {
  const base = { atk: 2 + ilvl * 1.2, def: 2 + ilvl * 1.0, hp: 10 + ilvl * 5, mp: 6 + ilvl * 3 }[stat];
  return Math.max(1, Math.round(base * rnd(0.7, 1.3) * mult));
}

function rollStats(slot, quality, ilvl) {
  const qm = { white: 1, blue: 1.3, gold: 1.75, set: 1.95, special: 2.1 }[quality] || 1;
  const stats = {};
  if (slot === 'weapon') stats.atk = Math.round((3 + ilvl * 2) * rnd(0.8, 1.2) * qm);
  else if (slot === 'armor') stats.def = Math.round((3 + ilvl * 1.6) * rnd(0.8, 1.2) * qm);
  else if (slot === 'helm') stats.def = Math.round((2 + ilvl * 1.1) * rnd(0.8, 1.2) * qm);
  else if (slot === 'cloak') {
    stats.def = Math.round((1.5 + ilvl * 0.9) * rnd(0.8, 1.2) * qm);
    if (Math.random() < 0.5) stats.mp = Math.round((6 + ilvl * 2.5) * rnd(0.8, 1.2) * qm);
    else stats.hp = Math.round((10 + ilvl * 4) * rnd(0.8, 1.2) * qm);
  } else if (slot === 'gloves') {
    stats.atk = Math.round((2 + ilvl * 1.1) * rnd(0.8, 1.2) * qm);
    stats.def = Math.round((1.5 + ilvl * 0.8) * rnd(0.8, 1.2) * qm);
  } else if (slot === 'boots') {
    stats.def = Math.round((2 + ilvl * 0.9) * rnd(0.8, 1.2) * qm);
    stats.hp = Math.round((10 + ilvl * 4) * rnd(0.8, 1.2) * qm);
  } else if (slot === 'amulet') {
    stats.mp = Math.round((8 + ilvl * 3) * rnd(0.8, 1.2) * qm);
    stats.hp = Math.round((10 + ilvl * 4) * rnd(0.8, 1.2) * qm);
  } else {
    if (Math.random() < 0.5) stats.mp = Math.round((8 + ilvl * 3) * rnd(0.8, 1.2) * qm);
    else stats.hp = Math.round((12 + ilvl * 5) * rnd(0.8, 1.2) * qm);
  }
  const nAff = quality === 'white' ? 0 : quality === 'blue' ? 1 : (quality === 'special' || quality === 'set') ? 3 : Phaser.Math.Between(2, 3);
  const pool = Phaser.Utils.Array.Shuffle(['atk', 'def', 'hp', 'mp']);
  const affixes = [];
  for (let i = 0; i < nAff; i++) {
    const st = pool[i];
    stats[st] = (stats[st] || 0) + affixValue(st, ilvl, qm);
    affixes.push(st);
  }
  return { stats, affixes };
}

export function syncNextItemId(maxId) {
  nextId = Math.max(nextId, (maxId || 0) + 1);
}

/**
 * 產生隨機裝備
 * @param ilvl 物品等級
 * @param bonus 品質加成（0~0.4）
 */
export function generateItem(ilvl, bonus = 0, forceQuality = null, forceSlot = null) {
  const slot = forceSlot || Phaser.Utils.Array.GetRandom(SLOTS);
  const quality = forceQuality || rollQuality(bonus);
  const { stats, affixes } = rollStats(slot, quality, ilvl);
  const sockets = rollSockets(quality);

  if (quality === 'special') {
    const pool = SPECIAL_UNIQUES.filter((u) => u.slot === slot);
    const tpl = Phaser.Utils.Array.GetRandom(pool.length ? pool : SPECIAL_UNIQUES);
    return {
      id: nextId++,
      kind: 'equip',
      slot,
      quality,
      uniqueId: tpl.id,
      name: tpl.name,
      ilvl,
      stats,
      specials: rollSpecialAffixes('special', ilvl, tpl.guaranteed),
      sockets,
      runes: [],
      enhance: 0,
    };
  }

  const base = Phaser.Utils.Array.GetRandom(BASES[slot]);
  let name;
  if (quality === 'white') name = Phaser.Utils.Array.GetRandom(WHITE_PREFIX) + base;
  else if (quality === 'blue') name = BLUE_PREFIX[affixes[0]] + base;
  else name = Phaser.Utils.Array.GetRandom(GOLD_PREFIX) + '之' + base;
  return {
    id: nextId++,
    kind: 'equip',
    slot,
    quality,
    name,
    ilvl,
    stats,
    specials: rollSpecialAffixes(quality, ilvl),
    sockets,
    runes: [],
    enhance: 0,
  };
}

export function generateSetItem(setId = null, ilvl = 1, forceSlot = null, ownedSlots = null) {
  const def = (setId && getSetDef(setId)) || Phaser.Utils.Array.GetRandom(SET_LIST);
  let slot = forceSlot && def.slots.includes(forceSlot) ? forceSlot : null;
  if (!slot) {
    if (ownedSlots && ownedSlots.size) {
      const missing = def.slots.filter((s) => !ownedSlots.has(s));
      if (missing.length && Math.random() < 0.78) slot = Phaser.Utils.Array.GetRandom(missing);
    }
    if (!slot) slot = Phaser.Utils.Array.GetRandom(def.slots);
  }
  const { stats } = rollStats(slot, 'set', ilvl);
  return {
    id: nextId++,
    kind: 'equip',
    slot,
    quality: 'set',
    setId: def.id,
    name: def.pieces[slot],
    ilvl,
    stats,
    specials: rollSpecialAffixes('set', ilvl),
    sockets: rollSockets('set'),
    runes: [],
    enhance: 0,
  };
}

export function generateSkillBook(forceSkillId = null) {
  let id = forceSkillId;
  if (!id) {
    const extra = SKILL_LIST.filter((s) => !s.starter);
    const starter = SKILL_LIST.filter((s) => s.starter);
    const pool = Math.random() < 0.7 && extra.length ? extra : starter;
    id = Phaser.Utils.Array.GetRandom(pool).id;
  }
  const def = SKILL_DEFS[id];
  return {
    id: nextId++,
    kind: 'book',
    skillId: id,
    quality: 'book',
    name: `《${def.name}》技能書`,
    ilvl: 1,
  };
}

export function itemDisplayName(item) {
  if (!item) return '';
  return item.enhance ? `${item.name} +${item.enhance}` : item.name;
}

export function effectiveStats(item, enhanceOverride = null) {
  if (!item || !item.stats) return {};
  const enh = enhanceOverride !== null ? enhanceOverride : (item.enhance || 0);
  const out = {};
  for (const k in item.stats) {
    out[k] = Math.round(item.stats[k] * (1 + enh * 0.15)) + enh;
  }
  return out;
}

export function enhanceCost(item) {
  const qm = { white: 0.8, blue: 1.2, gold: 1.8, set: 2.1, special: 2.4 }[item.quality] || 1;
  return Math.round((25 + item.ilvl * 10) * ((item.enhance || 0) + 1) * qm);
}

export function enhanceItem(item) {
  if (!item || item.kind === 'book' || (item.enhance || 0) >= MAX_ENHANCE) return false;
  item.enhance = (item.enhance || 0) + 1;
  return true;
}

export function reforgeCost(item) {
  const qm = { white: 0.8, blue: 1.2, gold: 2.0, set: 2.1, special: 2.4 }[item.quality] || 1;
  return Math.round((20 + item.ilvl * 8) * qm);
}

export function reforgeItem(item) {
  if (!item || item.kind === 'book') return false;
  const { stats } = rollStats(item.slot, item.quality, item.ilvl);
  item.stats = stats;
  if (item.quality === 'special') {
    const tpl = SPECIAL_UNIQUES.find((u) => u.id === item.uniqueId);
    const guaranteed = tpl ? tpl.guaranteed : [{ type: 'cdr' }];
    item.specials = rollSpecialAffixes('special', item.ilvl, guaranteed);
  } else {
    item.specials = rollSpecialAffixes(item.quality, item.ilvl);
  }
  return true;
}

export function convertSetPieceCost(item) {
  return { gold: 150 + (item?.ilvl || 1) * 15, essence: 1 };
}

export function convertSetPiece(item, ownedSlots = null) {
  if (!item || item.quality !== 'set' || !item.setId) return false;
  const def = getSetDef(item.setId);
  if (!def) return false;
  const others = def.slots.filter((s) => s !== item.slot);
  if (!others.length) return false;
  const missing = ownedSlots && ownedSlots.size ? others.filter((s) => !ownedSlots.has(s)) : [];
  const pool = missing.length ? missing : others;
  const nextSlot = Phaser.Utils.Array.GetRandom(pool);
  const { stats } = rollStats(nextSlot, 'set', item.ilvl || 1);
  item.slot = nextSlot;
  item.name = def.pieces[nextSlot];
  item.stats = stats;
  return true;
}

export function craftSetCost(ilvl) {
  return { gold: 200 + (ilvl || 1) * 25, shards: 3, essence: 2 };
}

export function punchSocketCost(item) {
  const s = item?.sockets || 0;
  return { gold: 80 + (item?.ilvl || 1) * 20 + s * 90, shards: 1 + s };
}

export function punchSocket(item) {
  if (!item || item.kind !== 'equip' || (item.sockets || 0) >= MAX_SOCKETS) return false;
  item.sockets = (item.sockets || 0) + 1;
  if (!item.runes) item.runes = [];
  return true;
}

export function forgeCost(tier, ilvl) {
  if (tier === 'legendary') return { gold: 120 + ilvl * 30, shards: 3 };
  return { gold: 50 + ilvl * 18, shards: 0 };
}

export function dismantleReward(item) {
  const baseShards = { white: 1, blue: 2, gold: 4, set: 5, special: 7 }[item.quality] || 1;
  return {
    gold: itemValue(item),
    shards: baseShards + Math.floor((item.enhance || 0) / 2),
    essence: item.quality === 'set' ? 1 : 0,
  };
}

export function itemValue(item) {
  if (item.kind === 'book') return 45;
  const q = { white: 1, blue: 3, gold: 8, set: 12, special: 14 }[item.quality] || 1;
  return Math.round((5 + item.ilvl * 3) * q * (1 + (item.enhance || 0) * 0.25));
}
