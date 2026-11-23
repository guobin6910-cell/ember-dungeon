export const MAX_SOCKETS = 6;

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
  fortune: {
    id: 'fortune', name: '尋寶光環', runes: ['crit', 'holy'],
    color: '#ffe048', hex: 0xffe048,
    short: '掉寶率+45% 金幣+40% 爆擊+5%',
    desc: '掉寶率 +45%、金幣掉落 +40%、爆擊率 +5%',
    bonus: { magicFind: 0.45, goldFind: 0.40, critChance: 0.05 },
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
  storm_blade: {
    id: 'storm_blade', name: '雷霆斬光環', runes: ['flame', 'wind', 'crit'],
    color: '#60e8ff', hex: 0x60e8ff,
    short: '攻+18 攻速+22% 爆擊+8% 電弧+22% 雷環',
    desc: '攻擊 +18、攻速 +22%、爆擊 +8%、電弧追擊 +22%、周圍雷電衝擊',
    bonus: { atk: 18, atkSpeed: 0.22, critChance: 0.08, chainProc: 0.22 },
    auraTick: 'storm',
  },
  blood_reaper: {
    id: 'blood_reaper', name: '血月收割光環', runes: ['blood', 'flame', 'wind', 'crit'],
    color: '#ff2858', hex: 0xff2858,
    short: '攻+22% 吸血+16% 爆+10% 爆傷+45% 移速+15%',
    desc: '攻擊力 +22%、吸血 +16%、爆擊 +10%、爆傷 +45%、移速 +15%',
    bonus: { atkPct: 0.22, lifesteal: 0.16, critChance: 0.10, critDmg: 0.45, moveSpeed: 0.15 },
  },
  frostfire_domain: {
    id: 'frostfire_domain', name: '霜炎領域光環', runes: ['flame', 'frost', 'arcane', 'crit'],
    color: '#c878ff', hex: 0xc878ff,
    short: '技傷+35% 全技+1 CD-18% 減耗18% 霜炎雙環',
    desc: '技能傷害 +35%、全技能 +1、冷卻 -18%、耗魔 -18%、冰霜反擊 +22%、同時啟動烈焰與寒霜光環',
    bonus: { spellPowerBonus: 0.35, allSkills: 1, cdr: 0.18, manaCostRed: 0.18, novaProc: 0.22 },
    auraTick: 'frostfire',
  },
  aegis_bastion: {
    id: 'aegis_bastion', name: '聖盾壁壘光環', runes: ['thorn', 'frost', 'holy', 'blood'],
    color: '#ffe088', hex: 0xffe088,
    short: '防+28 血+160 減傷+20% 反傷+110% 回血2.5%/s',
    desc: '防禦 +28、生命 +160、減傷 +20%、反傷 +110%、每秒回血 2.5%',
    bonus: { def: 28, hp: 160, dmgRed: 0.20, thorns: 1.10, hpRegenPct: 0.025 },
  },
  abyss_warlord: {
    id: 'abyss_warlord', name: '深淵戰神光環', runes: ['blood', 'flame', 'wind', 'crit', 'holy'],
    color: '#ff5828', hex: 0xff5828,
    short: '攻+32% 攻速+30% 爆+14% 爆傷+65% 吸血18% 烈焰環',
    desc: '攻擊力 +32%、攻速 +30%、爆擊 +14%、爆傷 +65%、吸血 +18%、減傷 +12%、電弧 +25%、周圍烈焰灼燒',
    bonus: { atkPct: 0.32, atkSpeed: 0.30, critChance: 0.14, critDmg: 0.65, lifesteal: 0.18, dmgRed: 0.12, chainProc: 0.25 },
    auraTick: 'burn',
  },
  astral_sovereign: {
    id: 'astral_sovereign', name: '星穹大法師光環', runes: ['flame', 'frost', 'wind', 'arcane', 'holy'],
    color: '#90b8ff', hex: 0x90b8ff,
    short: '全技+2 技傷+50% CD-26% 減耗25% 回魔+220% 雷環',
    desc: '全技能 +2、技能傷害 +50%、冷卻 -26%、耗魔 -25%、回魔 +220%、翻滾冷卻 -25%、周圍雷電衝擊',
    bonus: { allSkills: 2, spellPowerBonus: 0.50, cdr: 0.26, manaCostRed: 0.25, mpRegenBonus: 2.2, dodgeCdr: 0.25 },
    auraTick: 'storm',
  },
  ember_sovereign: {
    id: 'ember_sovereign', name: '餘燼神王光環', runes: ['blood', 'flame', 'frost', 'wind', 'arcane', 'holy'],
    color: '#ffaa28', hex: 0xffaa28,
    short: '全技+2 攻+38% 技傷+55% CD-28% 減傷22% 滅世環',
    desc: '全技能 +2、攻擊力 +38%、技能傷害 +55%、冷卻 -28%、減傷 +22%、吸血 +20%、移速 +25%、每秒回血 3%、週期釋放滅世餘燼波',
    bonus: { allSkills: 2, atkPct: 0.38, spellPowerBonus: 0.55, cdr: 0.28, dmgRed: 0.22, lifesteal: 0.20, moveSpeed: 0.25, hpRegenPct: 0.03 },
    auraTick: 'cataclysm',
  },
  eternal_plunder: {
    id: 'eternal_plunder', name: '永劫天命光環', runes: ['blood', 'thorn', 'wind', 'arcane', 'crit', 'holy'],
    color: '#ffe868', hex: 0xffe868,
    short: '全技+2 掉寶+90% 金幣+80% 爆+18% 爆傷+80% 雷環',
    desc: '全技能 +2、掉寶率 +90%、金幣 +80%、爆擊 +18%、爆傷 +80%、反傷 +120%、擊殺回血 +35 / 回魔 +25、周圍雷電衝擊',
    bonus: { allSkills: 2, magicFind: 0.90, goldFind: 0.80, critChance: 0.18, critDmg: 0.80, thorns: 1.20, onKillHp: 35, onKillMp: 25 },
    auraTick: 'storm',
  },
};

export const RUNEWORD_LIST = Object.values(RUNEWORD_DEFS);
const RUNEWORDS_BY_SIZE = [...RUNEWORD_LIST].sort((a, b) => b.runes.length - a.runes.length);

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
  for (const rw of RUNEWORDS_BY_SIZE) {
    if (rw.runes.length <= runeIds.length && containsAll(runeIds, rw.runes)) return rw;
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

