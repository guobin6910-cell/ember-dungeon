export const MAX_SOCKETS = 3;

export const RUNE_DEFS = {
  blood: {
    id: 'blood', name: '血符', sub: '索爾', glyph: '血', color: '#ff4860', hex: 0xff4860, weight: 20,
    desc: '吸血 +4%', bonus: { lifesteal: 0.04 },
  },
  thorn: {
    id: 'thorn', name: '棘符', sub: '伊奧', glyph: '棘', color: '#b8e040', hex: 0xb8e040, weight: 20,
    desc: '反傷 +25%', bonus: { thorns: 0.25 },
  },
  wind: {
    id: 'wind', name: '風符', sub: '疾', glyph: '風', color: '#50f0d8', hex: 0x50f0d8, weight: 20,
    desc: '移速 +8%', bonus: { moveSpeed: 0.08 },
  },
  flame: {
    id: 'flame', name: '焰符', sub: '拉爾', glyph: '焰', color: '#ff7828', hex: 0xff7828, weight: 20,
    desc: '攻擊 +8', bonus: { atk: 8 },
  },
  frost: {
    id: 'frost', name: '霜符', sub: '圖爾', glyph: '霜', color: '#60c8ff', hex: 0x60c8ff, weight: 18,
    desc: '防禦 +6、生命 +25', bonus: { def: 6, hp: 25 },
  },
  arcane: {
    id: 'arcane', name: '奧符', sub: '盧姆', glyph: '奧', color: '#b078ff', hex: 0xb078ff, weight: 14,
    desc: '冷卻 -5%、法力 +20', bonus: { cdr: 0.05, mp: 20 },
  },
  crit: {
    id: 'crit', name: '噬符', sub: '瑪爾', glyph: '噬', color: '#ffd040', hex: 0xffd040, weight: 14,
    desc: '爆擊 +5%、爆傷 +15%', bonus: { critChance: 0.05, critDmg: 0.15 },
  },
  holy: {
    id: 'holy', name: '聖符', sub: '貝爾', glyph: '聖', color: '#fff0a0', hex: 0xfff0a0, weight: 10,
    desc: '減傷 +5%、生命 +35', bonus: { dmgRed: 0.05, hp: 35 },
  },
};

export const RUNE_LIST = Object.values(RUNE_DEFS);

export const RUNEWORD_DEFS = {
  vampiric: {
    id: 'vampiric', name: '嗜血光環', runes: ['blood', 'flame'],
    color: '#ff3858', hex: 0xff3858,
    short: '吸血+10% 擊殺回血+15',
    desc: '吸血 +10%、擊殺回血 +15',
    bonus: { lifesteal: 0.10, onKillHp: 15 },
  },
  thorns: {
    id: 'thorns', name: '荊棘光環', runes: ['thorn', 'frost'],
    color: '#a8e030', hex: 0xa8e030,
    short: '反傷+65% 防禦+12',
    desc: '反傷 +65%、防禦 +12',
    bonus: { thorns: 0.65, def: 12 },
  },
  haste: {
    id: 'haste', name: '疾風光環', runes: ['wind', 'crit'],
    color: '#40f0d8', hex: 0x40f0d8,
    short: '移速+22% 攻速+20% 閃避CD-20%',
    desc: '移速 +22%、攻速 +20%、翻滾冷卻 -20%',
    bonus: { moveSpeed: 0.22, atkSpeed: 0.20, dodgeCdr: 0.20 },
  },
  ember_burn: {
    id: 'ember_burn', name: '烈焰光環', runes: ['flame', 'arcane'],
    color: '#ff7018', hex: 0xff7018,
    short: '周圍火焰灼燒 技能CD-8%',
    desc: '定期灼燒周圍敵人、技能冷卻 -8%',
    bonus: { cdr: 0.08 },
    auraTick: 'burn',
  },
  frost_aura: {
    id: 'frost_aura', name: '寒霜光環', runes: ['frost', 'wind'],
    color: '#50c8ff', hex: 0x50c8ff,
    short: '周圍冰霜緩速 減傷+10%',
    desc: '持續緩速並凍傷周圍敵人、減傷 +10%',
    bonus: { dmgRed: 0.10 },
    auraTick: 'frost',
  },
  arcane_surge: {
    id: 'arcane_surge', name: '秘法湧動光環', runes: ['arcane', 'wind', 'holy'],
    color: '#b868ff', hex: 0xb868ff,
    short: '全技能+1 CD-18% 減耗15% 回魔+150%',
    desc: '全技能等級 +1、冷卻 -18%、耗魔 -15%、回魔 +150%',
    bonus: { allSkills: 1, cdr: 0.18, manaCostRed: 0.15, mpRegenBonus: 1.5 },
  },
  immortal: {
    id: 'immortal', name: '不滅血棘光環', runes: ['blood', 'thorn', 'holy'],
    color: '#ffd860', hex: 0xffd860,
    short: '吸血+12% 反傷+80% 減傷+15% 回血2%/s',
    desc: '吸血 +12%、反傷 +80%、減傷 +15%、每秒回血 2%',
    bonus: { lifesteal: 0.12, thorns: 0.80, dmgRed: 0.15, hpRegenPct: 0.02 },
  },
  fortune: {
    id: 'fortune', name: '尋寶光環', runes: ['crit', 'holy'],
    color: '#ffe048', hex: 0xffe048,
    short: '掉寶率+45% 金幣+40% 爆擊+5%',
    desc: '掉寶率 +45%、金幣掉落 +40%、爆擊率 +5%',
    bonus: { magicFind: 0.45, goldFind: 0.40, critChance: 0.05 },
  },
};

export const RUNEWORD_LIST = Object.values(RUNEWORD_DEFS);

const RARE_RUNES = new Set(['arcane', 'crit', 'holy']);

export function rollRandomRune(floor = 1) {
  const boost = Math.min(8, Math.max(0, floor - 1) * 1.5);
  let total = 0;
  const weights = RUNE_LIST.map((r) => {
    const w = r.weight + (RARE_RUNES.has(r.id) ? boost : 0);
    total += w;
    return w;
  });
  let pick = Math.random() * total;
  for (let i = 0; i < RUNE_LIST.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return RUNE_LIST[i].id;
  }
  return RUNE_LIST[0].id;
}

function containsAll(have, need) {
  const counts = {};
  for (const r of have) counts[r] = (counts[r] || 0) + 1;
  for (const r of need) {
    if (!counts[r]) return false;
    counts[r]--;
  }
  return true;
}

export function matchRuneword(runeIds) {
  if (!runeIds || runeIds.length < 2) return null;
  if (runeIds.length >= 3) {
    for (const rw of RUNEWORD_LIST) {
      if (rw.runes.length >= 3 && containsAll(runeIds, rw.runes)) return rw;
    }
  }
  for (const rw of RUNEWORD_LIST) {
    if (rw.runes.length === 2 && containsAll(runeIds, rw.runes)) return rw;
  }
  return null;
}

export function getItemRuneword(item) {
  return item && item.runes ? matchRuneword(item.runes) : null;
}

export function runeDisplayName(runeId) {
  const def = RUNE_DEFS[runeId];
  return def ? `${def.name}（${def.sub}）` : runeId;
}

export function emptyRunePouch() {
  const pouch = {};
  for (const r of RUNE_LIST) pouch[r.id] = 0;
  return pouch;
}

