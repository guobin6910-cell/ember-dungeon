export const DEFAULT_DIFFICULTY = 'normal';

export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    name: '簡單',
    color: '#78e890',
    hex: 0x58c870,
    hpMul: 0.72,
    dmgMul: 0.70,
    trapMul: 0.70,
    xpMul: 0.90,
    goldMul: 0.90,
    mfBonus: 0,
    runeMul: 0.85,
    shardBonus: 0,
    short: '怪血 72% · 怪傷 70% · 掉寶 +0%',
    desc: '怪物血量與傷害降低，適合輕鬆體驗與手機遊玩',
  },
  normal: {
    id: 'normal',
    name: '普通',
    color: '#ffd880',
    hex: 0xd8a040,
    hpMul: 1.0,
    dmgMul: 1.0,
    trapMul: 1.0,
    xpMul: 1.0,
    goldMul: 1.0,
    mfBonus: 0,
    runeMul: 1.0,
    shardBonus: 0,
    short: '怪血 100% · 怪傷 100% · 掉寶 +0%',
    desc: '標準暗黑地城平衡體驗',
  },
  hard: {
    id: 'hard',
    name: '困難',
    color: '#ff9848',
    hex: 0xe87028,
    hpMul: 1.55,
    dmgMul: 1.40,
    trapMul: 1.35,
    xpMul: 1.35,
    goldMul: 1.40,
    mfBonus: 0.35,
    runeMul: 1.35,
    shardBonus: 1,
    short: '怪血 155% · 怪傷 140% · 掉寶 +35% · 經驗 +35%',
    desc: '怪物大幅強化，經驗、金幣、掉寶率與符文率顯著提升',
  },
  hell: {
    id: 'hell',
    name: '地獄',
    color: '#ff4868',
    hex: 0xd82848,
    hpMul: 2.35,
    dmgMul: 1.95,
    trapMul: 1.80,
    xpMul: 1.85,
    goldMul: 2.00,
    mfBonus: 0.80,
    runeMul: 1.80,
    shardBonus: 2,
    short: '怪血 235% · 怪傷 195% · 掉寶 +80% · 經驗 +85%',
    desc: '極限深淵試煉！高風險換取海量經驗、金幣、特殊裝備與符文',
  },
};

export const DIFFICULTY_LIST = [
  DIFFICULTIES.easy,
  DIFFICULTIES.normal,
  DIFFICULTIES.hard,
  DIFFICULTIES.hell,
];

export function getDifficulty(id) {
  return DIFFICULTIES[id] || DIFFICULTIES.normal;
}

