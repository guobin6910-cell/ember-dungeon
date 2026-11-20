export const SET_DEFS = {
  bone_warlord: {
    id: 'bone_warlord',
    name: '骸骨戰神',
    bossType: 'bone',
    slots: ['helm', 'armor', 'gloves', 'boots'],
    pieces: {
      helm: '骸骨戰神之盔',
      armor: '骸骨戰神重甲',
      gloves: '骸骨戰神護手',
      boots: '骸骨戰神戰靴',
    },
    bonus2: {
      atkPct: 0.18,
      dmgRed: 0.08,
      skillBonuses: { whirl: 2, cleave: 2 },
    },
    bonus2Desc: '攻擊力 +18%、減傷 +8%、旋風斬與裂地斬等級 +2',
    effect4: 'whirlQuake',
    bonus4Desc: '旋風斬結束時釋放「骸骨震地波」，對周圍 155px 敵人造成 220% 攻擊傷害並強力擊退',
  },
  blood_stalker: {
    id: 'blood_stalker',
    name: '血月獵影',
    bossType: 'blood',
    slots: ['weapon', 'cloak', 'amulet', 'accessory'],
    pieces: {
      weapon: '血月獵影魔刃',
      cloak: '血月暗影披風',
      amulet: '血月獠牙項鍊',
      accessory: '血月誓約之戒',
    },
    bonus2: {
      dodgeCdr: 0.30,
      critDmg: 0.45,
      atkSpeed: 0.15,
    },
    bonus2Desc: '翻滾冷卻 -30%、爆擊傷害 +45%、攻擊速度 +15%',
    effect4: 'dodgeCrit',
    bonus4Desc: '閃避翻滾、暗影突襲或閃現後獲得 4 秒「影殺印記」，下次攻擊必定爆擊且額外 +50% 傷害',
  },
  ember_frost: {
    id: 'ember_frost',
    name: '霜炎秘法',
    bossType: 'frost',
    slots: ['helm', 'cloak', 'gloves', 'amulet'],
    pieces: {
      helm: '霜炎秘法之冠',
      cloak: '霜炎織法披風',
      gloves: '霜炎法術護腕',
      amulet: '霜炎秘典項鍊',
    },
    bonus2: {
      spellPowerBonus: 0.25,
      cdr: 0.12,
      manaCostRed: 0.15,
    },
    bonus2Desc: '技能傷害 +25%、技能冷卻 -12%、技能耗魔 -15%',
    effect4: 'fireSplit',
    bonus4Desc: '火球爆炸時分裂出 3 顆追蹤小火球轟擊敵群；寒冰技能對緩速目標傷害 +40%',
  },
  abyss_plague: {
    id: 'abyss_plague',
    name: '深淵疫主',
    bossType: 'abyss',
    slots: ['armor', 'boots', 'amulet', 'accessory'],
    pieces: {
      armor: '深淵蝕骨魔鎧',
      boots: '深淵踏影長靴',
      amulet: '深淵疫核墜飾',
      accessory: '深淵腐化之戒',
    },
    bonus2: {
      allSkills: 1,
      thorns: 0.50,
      onKillHp: 15,
      onKillMp: 10,
    },
    bonus2Desc: '全技能等級 +1、反傷 +50%、擊殺回血 +15 / 回魔 +10',
    effect4: 'plagueSpread',
    bonus4Desc: '毒霧／靈魂收割影響的敵人死亡時擴散新毒霧並毒爆；擊殺敵人縮短所有技能冷卻 1 秒',
  },
};

export const SET_LIST = Object.values(SET_DEFS);

export const BOSS_SET_MAP = {
  bone: 'bone_warlord',
  blood: 'blood_stalker',
  frost: 'ember_frost',
  abyss: 'abyss_plague',
};

export function getSetDef(setId) {
  return SET_DEFS[setId] || null;
}

export function getBossSetId(bossType) {
  return BOSS_SET_MAP[bossType] || 'bone_warlord';
}

