export const FONT = '"Microsoft JhengHei", "PingFang TC", "Noto Sans TC", "Heiti TC", sans-serif';
export const SERIF = '"Noto Serif TC", "PMingLiU", "Songti TC", "Microsoft JhengHei", serif';

export function txt(scene, x, y, text, size = 18, color = '#e8dcc0', extra = {}) {
  return scene.add.text(x, y, text, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    stroke: '#000000',
    strokeThickness: Math.max(2, Math.round(size / 6)),
    ...extra,
  });
}

export const QUALITY_COLORS = { white: '#e8e8e8', blue: '#6aa8ff', gold: '#f0c040', special: '#ff8038', book: '#55f0b8', rune: '#e098ff' };
export const QUALITY_HEX = { white: 0xd0d0d0, blue: 0x4f8cff, gold: 0xf0b030, special: 0xff6820, book: 0x40d898, rune: 0xc870ff };
export const QUALITY_NAMES = { white: '普通', blue: '魔法', gold: '傳奇', special: '特殊', book: '秘典', rune: '符文' };

