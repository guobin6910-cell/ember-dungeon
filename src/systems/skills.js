export const MAX_SKILL_LV = 20;
export const MAX_EFFECTIVE_SKILL_LV = 30;

export const SKILL_DEFS = {
  fire: {
    id: 'fire',
    name: '火球',
    icon: 'sk_fire',
    mp: 12,
    cd: 1500,
    starter: true,
    desc: '遠程火球範圍火焰爆炸',
  },
  whirl: {
    id: 'whirl',
    name: '旋風斬',
    icon: 'sk_whirl',
    mp: 20,
    cd: 5000,
    starter: true,
    desc: '高速旋轉三段範圍斬擊',
  },
  heal: {
    id: 'heal',
    name: '治療',
    icon: 'sk_heal',
    mp: 25,
    cd: 10000,
    starter: true,
    desc: '回復生命（受智力加成）',
  },
  chain: {
    id: 'chain',
    name: '連鎖閃電',
    icon: 'sk_chain',
    mp: 18,
    cd: 4000,
    starter: false,
    desc: '敵群間跳躍連鎖電擊',
  },
  nova: {
    id: 'nova',
    name: '寒冰新星',
    icon: 'sk_nova',
    mp: 22,
    cd: 6500,
    starter: false,
    desc: '冰環傷害並大幅減速敵人',
  },
  dash: {
    id: 'dash',
    name: '暗影突襲',
    icon: 'sk_dash',
    mp: 16,
    cd: 4500,
    starter: false,
    desc: '無敵穿刺重創路徑敵人',
  },
  meteor: {
    id: 'meteor',
    name: '烈焰隕石',
    icon: 'sk_meteor',
    mp: 32,
    cd: 8500,
    starter: false,
    desc: '游標召喚天降範圍隕石',
  },
  cleave: {
    id: 'cleave',
    name: '裂地斬',
    icon: 'sk_cleave',
    mp: 18,
    cd: 3800,
    starter: false,
    desc: '前方扇形火焰重斬並擊退敵人',
  },
  ice_lance: {
    id: 'ice_lance',
    name: '寒冰長矛',
    icon: 'sk_ice_lance',
    mp: 15,
    cd: 2200,
    starter: false,
    desc: '發射穿透型冰槍並減速沿途敵人',
  },
  poison_cloud: {
    id: 'poison_cloud',
    name: '劇毒迷霧',
    icon: 'sk_poison_cloud',
    mp: 24,
    cd: 7500,
    starter: false,
    desc: '游標處施放持續毒霧傷害並緩速',
  },
  holy_shield: {
    id: 'holy_shield',
    name: '聖光護盾',
    icon: 'sk_holy_shield',
    mp: 26,
    cd: 12000,
    starter: false,
    desc: '生成吸收傷害的聖光護盾（8秒）',
  },
  blood_boil: {
    id: 'blood_boil',
    name: '鮮血狂怒',
    icon: 'sk_blood_boil',
    mp: 22,
    cd: 14000,
    starter: false,
    desc: '7秒內提升攻擊35%、攻速25%與吸血15%',
  },
  arcane_orb: {
    id: 'arcane_orb',
    name: '秘法光球',
    icon: 'sk_arcane_orb',
    mp: 20,
    cd: 4200,
    starter: false,
    desc: '緩慢推進並電擊周圍敵人的秘法球',
  },
  blink: {
    id: 'blink',
    name: '暗影閃現',
    icon: 'sk_blink',
    mp: 14,
    cd: 4800,
    starter: false,
    desc: '瞬移至游標方向並於落點引爆暗影',
  },
  thunder_strike: {
    id: 'thunder_strike',
    name: '天雷裁決',
    icon: 'sk_thunder_strike',
    mp: 28,
    cd: 6200,
    starter: false,
    desc: '連續召喚多道落雷轟擊敵群',
  },
  blade_storm: {
    id: 'blade_storm',
    name: '劍刃風暴',
    icon: 'sk_blade_storm',
    mp: 25,
    cd: 8000,
    starter: false,
    desc: '召喚3把環繞飛劍持續切割周圍敵人',
  },
  soul_nova: {
    id: 'soul_nova',
    name: '靈魂收割',
    icon: 'sk_soul_nova',
    mp: 26,
    cd: 9000,
    starter: false,
    desc: '大範圍靈魂爆發並將25%傷害化為生命',
  },
};

export const SKILL_LIST = Object.values(SKILL_DEFS);

export function getSkillData(id, level = 1, opts = {}) {
  const def = SKILL_DEFS[id];
  if (!def) return null;
  const lv = Math.max(1, Math.min(MAX_EFFECTIVE_SKILL_LV, level));
  const powerMult = 1 + (lv - 1) * 0.16;
  const baseCd = Math.round(def.cd * Math.pow(0.965, lv - 1));
  const cdr = Math.min(0.60, Math.max(0, opts.cdr || 0));
  const cd = Math.max(300, Math.round(baseCd * (1 - cdr)));
  const manaRed = Math.min(0.50, Math.max(0, opts.manaCostRed || 0));
  const mp = Math.max(1, Math.round(def.mp * (1 - manaRed)));
  return {
    ...def,
    level: lv,
    powerMult,
    cd,
    mp,
    baseCd,
  };
}
