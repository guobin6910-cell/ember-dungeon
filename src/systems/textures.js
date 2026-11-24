import Phaser from 'phaser';
import { RUNE_LIST } from './runes.js';

export const TILE = 48;
const PX = 3; // 每個「像素」的實際大小

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (c, d = 0) => `rgb(${clamp(c[0] + d)},${clamp(c[1] + d)},${clamp(c[2] + d)})`;

function nearest(tex) {
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** 由字串陣列繪製像素圖 */
function pixTex(scene, key, rows, pal, s = PX) {
  if (scene.textures.exists(key)) return;
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const tex = scene.textures.createCanvas(key, w * s, h * s);
  const ctx = tex.getContext();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * s, y * s, s, s);
    }
  });
  tex.refresh();
  nearest(tex);
}

function canvasTex(scene, key, w, h, draw, pixel = false) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  draw(tex.getContext(), w, h);
  tex.refresh();
  if (pixel) nearest(tex);
}

// ---------------------------------------------------------------- 角色
const OUT = '#120e0c';

const PLAYER = [
  '....kkkk....',
  '...kSSSSk...',
  '..kSSsssSk..',
  '..ksddddsk..',
  '..ksdeedsk..',
  '...kssssk...',
  '.rrkyyyykrr.',
  'rrksSSSSskrr',
  'rrksSssSskrr',
  '.rkksyysskr.',
  '.rkkssssk.r.',
  '..kbbbbbbk..',
  '...kss.ssk..',
  '...kss.ssk..',
  '..kkk..kkk..',
  '............',
];
const PLAYER_PAL = { k: OUT, S: '#c8ccd4', s: '#7d828c', d: '#1f1b1a', e: '#ffb347', y: '#c9a227', r: '#7a1515', b: '#4a2e1a' };

const SWORD = [
  '..W..',
  '.WWs.',
  '.WWs.',
  '.WWs.',
  '.WWs.',
  '.WWs.',
  '.WWs.',
  '.WWs.',
  '.WWs.',
  'yyyyy',
  '..b..',
  '..b..',
  '..y..',
];
const SWORD_PAL = { W: '#dfe3ea', s: '#8d939c', y: '#c9a227', b: '#5a3a1e' };

const SKELETON = [
  '....kkkk....',
  '...kwwwwk...',
  '..kwwwwwWk..',
  '..kwrkkrWk..',
  '..kwwkkwWk..',
  '...kwwwwk...',
  '....kWWk....',
  '..kkwwwwkk..',
  '.kwakWWkawk.',
  '.kw.kwwk.wk.',
  '..k.kWWk.k..',
  '....kwwk....',
  '...kw..wk...',
  '...kw..wk...',
  '..kkw..wkk..',
  '............',
];
const SKELETON_PAL = { k: OUT, w: '#d9d2bc', W: '#9e967f', r: '#ff3a1a', a: '#5b4636' };

const ARCHER = [
  '....hhhh....',
  '...hHHHHh...',
  '..hHwwwwHh..',
  '..hHrkkrHh..',
  '..hHwkkwHh.b',
  '...hwwwwh.bl',
  '....kWWk.b.l',
  '..hhhhhhhb.l',
  '.hH.hHHhbk.l',
  '.kw.hhhh.b.l',
  '..k.kWWk..bl',
  '....kwwk...b',
  '...kw..wk...',
  '...kw..wk...',
  '..kkw..wkk..',
  '............',
];
const ARCHER_PAL = { k: OUT, w: '#d9d2bc', W: '#9e967f', r: '#7cff3a', h: '#3b2a4f', H: '#251a33', b: '#7a5030', l: '#bbbbbb' };

const GARGOYLE = [
  '..k..........k..',
  '.kGk..kkkk..kGk.',
  '.kGGkkggggkkGGk.',
  'nnkGkgLggLgkGknn',
  'nGnkggrggrggknGn',
  'nGGnkggkkggknGGn',
  'nGGnkgggggggknGn',
  'nGnkgLggggggLgkn',
  'nnkggLggggggLggk',
  '.kgggkgLLgkgggk.',
  '.kgGkkggggkkGgk.',
  '..kk.kgggGk.kk..',
  '....kgGkkGgk....',
  '...kgGk..kGgk...',
  '..kLLk....kLLk..',
  '..kkk......kkk..',
];
const GARGOYLE_PAL = { k: OUT, g: '#6b7075', G: '#43474b', L: '#9aa0a5', r: '#ffae00', n: '#2b2d30' };

const BOSS = [
  'h..................h',
  'hh................hh',
  '.hh....kkkkkk....hh.',
  '..hhkkkPPPPPPkkkhh..',
  '...hkPPppppppPPkh...',
  '....kPpeeppeepPk....',
  '....kPppppppppPk....',
  '...kkkPpkffkpPkkk...',
  '..kAAAkPpffpPkAAAk..',
  '.kAAaaakkppkkaaaAAk.',
  'kAAaaaaaappaaaaaaAAk',
  'kAapppaaaffaaapppaAk',
  'kAkpppkaaAAaakpppkAk',
  '.kkpPpkaaAAaakpPpkk.',
  '..kpppkaaaaaakpppk..',
  '..kkkkkaaffaakkkkk..',
  '......kppkkppk......',
  '.....kpppkkpppk.....',
  '.....kPPk..kPPk.....',
  '....kkkkk..kkkkk....',
];
const BOSS_PAL = { k: '#0a0507', h: '#d8c8a0', p: '#4a1020', P: '#82203a', e: '#ffe14a', a: '#24222e', A: '#5a5870', f: '#ff6a00' };

// ---------------------------------------------------------------- 物品圖示
const ICON_WEAPON = [
  '.............WW.',
  '............WWs.',
  '...........WWs..',
  '..........WWs...',
  '.........WWs....',
  '........WWs.....',
  '.......WWs......',
  '..y...WWs.......',
  '...y.WWs........',
  '....yWs.........',
  '....yy..........',
  '...b.yy.........',
  '..b...y.........',
  '.b..............',
  'y...............',
  '................',
];
const ICON_ARMOR = [
  '................',
  '..kkk......kkk..',
  '.kSSskkkkkksSSk.',
  '.kSsssSSSSsssSk.',
  '.kssskSSSSksssk.',
  '..kkskSyySkskk..',
  '....kSSyySSk....',
  '....kSSSSSSk....',
  '....ksSSSSsk....',
  '....kssyysk.....',
  '....kbbbbbbk....',
  '....ksssSssk....',
  '....kssssssk....',
  '.....kkkkkk.....',
  '................',
  '................',
];
const ICON_HELM = [
  '................',
  '................',
  '.....kkkkkk.....',
  '....kSSSSSsk....',
  '...kSSSyySssk...',
  '...kSSSyySssk...',
  '..kSSSSyySsssk..',
  '..ksSSkkkkSssk..',
  '..kssk....ksk...',
  '..kssk.kk.ksk...',
  '..kssk.kk.ksk...',
  '..kssskkkksssk..',
  '...kkk....kkk...',
  '................',
  '................',
  '................',
];
const ICON_ACC = [
  '................',
  '................',
  '.....kkkkkk.....',
  '....kRRRRRrk....',
  '....krWWWrrk....',
  '....krrrrrrk....',
  '...kyyyyyyyyk...',
  '..kyykkkkkkyyk..',
  '.kyyk......kyyk.',
  '.kyk........kyk.',
  '.kyk........kyk.',
  '..kyk......kyk..',
  '...kyykkkkyyk...',
  '....kyyyyyyk....',
  '.....kkkkkk.....',
  '................',
];
const ICON_AMULET = [
  '................',
  '....yyyyyyyy....',
  '...y........y...',
  '..y..........y..',
  '..y..........y..',
  '...y........y...',
  '....y......y....',
  '.....y....y.....',
  '......kyyk......',
  '.....kCCCCk.....',
  '....kCWcccCk....',
  '....kcccccck....',
  '.....kcccck.....',
  '......kkkk......',
  '................',
  '................',
];
const ICON_CLOAK = [
  '................',
  '.....kkkkkk.....',
  '....kyyyyyyk....',
  '...kPPppppPPk...',
  '...kpPppppPpk...',
  '..kPPppppppPPk..',
  '..kPppppppppPk..',
  '.kPpppppppppPPk.',
  '.kpppppPPpppppk.',
  '.kppppppppppppk.',
  'kPppppppppppppPk',
  'kppppkppppkppppk',
  'kpppk..kk..kpppk',
  '.kkk........kkk.',
  '................',
  '................',
];
const ICON_GLOVES = [
  '................',
  '................',
  '..kk.kk.kk......',
  '.kSSkSSkSSk.....',
  '.kssssssssk.kk..',
  '.kSssssSSSkkSSk.',
  '.ksssssssssSSSk.',
  '.kBbbbbbbbBsssk.',
  '..kBbbbbbbBbbk..',
  '..kyyyyyyyyyyk..',
  '...kBbbbbbbBk...',
  '...kBbbbbbbBk...',
  '...kkkkkkkkkk...',
  '................',
  '................',
  '................',
];
const ICON_BOOTS = [
  '................',
  '....kkkkkk......',
  '...kBbbbbBk.....',
  '...kBbbbbBk.....',
  '...kyyyyyyk.....',
  '...kBbbbbBk.....',
  '...kBbbbbBk.....',
  '...kBbbbbBk.....',
  '...kBbbbbbBkkk..',
  '..kBbbbbbbbBBbk.',
  '..kBBBBbbbbbbBk.',
  '..ksssssssssssk.',
  '..kkkkkkkkkkkkk.',
  '................',
  '................',
  '................',
];
const ICON_PAL = { k: OUT, W: '#dfe3ea', s: '#7d828c', S: '#bfc4cc', y: '#d4a82a', b: '#5a3a1e', B: '#8c5a30', r: '#b01830', R: '#ff8090', c: '#30a8e0', C: '#a0f0ff', p: '#5c2458', P: '#923878' };

const COIN = [
  '.kkkk.',
  'kyyYyk',
  'kyYyyk',
  'kyyyyk',
  '.kkkk.',
];
const COIN_PAL = { k: '#5a3d0a', y: '#e0b030', Y: '#fff0a0' };

const BONES = [
  '................',
  '................',
  '..ww........w...',
  '...ww......ww...',
  '....wwwwwwww....',
  '...ww......ww...',
  '..w..........w..',
  '................',
  '.......w........',
  '......ww........',
  '.....wwww.......',
  '......ww........',
  '.......w........',
  '................',
  '................',
  '................',
];
const SKULL = [
  '................',
  '................',
  '................',
  '................',
  '.....kkkkk......',
  '....kwwwwwk.....',
  '...kwwwwwwwk....',
  '...kwkkwkkwk....',
  '...kwkkwkkwk....',
  '....kwwkwwk.....',
  '....kwkwkwk.....',
  '.....kkkkk......',
  '................',
  '................',
  '................',
  '................',
];
const BONE_PAL = { k: '#2a2420', w: '#b8b09a' };

const TORCH0 = [
  '...y....',
  '..yo....',
  '..ooy...',
  '.yoroy..',
  '.orrro..',
  '.orRro..',
  '..rRr...',
  '..kbk...',
  '..kbk...',
  '.kkbkk..',
  '..kbk...',
  '..kbk...',
  '...k....',
];
const TORCH1 = [
  '....y...',
  '...oy...',
  '..yoo...',
  '.yoroy..',
  '.orrro..',
  '.orRro..',
  '..rRr...',
  '..kbk...',
  '..kbk...',
  '.kkbkk..',
  '..kbk...',
  '..kbk...',
  '...k....',
];
const TORCH2 = [
  '........',
  '..y.y...',
  '..oyo...',
  '.yoroy..',
  '.orrro..',
  '.orRro..',
  '..rRr...',
  '..kbk...',
  '..kbk...',
  '.kkbkk..',
  '..kbk...',
  '..kbk...',
  '...k....',
];
const TORCH_PAL = { y: '#fff3a0', o: '#ffb030', r: '#ff5a10', R: '#fff8e0', k: '#151010', b: '#5a3a1e' };

const ARROW = [
  'k.........ww',
  'kkkkkkkkkwww',
  'k.........ww',
];
const ARROW_PAL = { k: '#6a4a2a', w: '#d0d0d0' };

// ---------------------------------------------------------------- 新怪物（5種）
const BAT = [
  '.kk........kk.',
  'kRRk......kRRk',
  'kRrrkk..kkrrRk',
  '.krrrkmmkrrrk.',
  '..krrkmmkrrk..',
  '...kkmbbmkk...',
  '....kmwwmk....',
  '.....kmmk.....',
  '......kk......',
  '..............',
];
const BAT_PAL = { k: OUT, R: '#a81828', r: '#6a0e18', m: '#3c1420', b: '#ff4040', w: '#f0e0d0' };

const NECROMANCER = [
  '....pppp....',
  '...pPPPPp...',
  '..pPddddPp..',
  '..pPdeedPp.s',
  '..pPddddPp.k',
  '...pppppp.sk',
  '....kppk..k.',
  '..kkppppkks.',
  '.kpPpPPpPkk.',
  '.kppkppkppk.',
  '..k.kPPk.k..',
  '....kppk....',
  '...kp..pk...',
  '...kp..pk...',
  '..kkp..pkk..',
  '............',
];
const NECRO_PAL = { k: OUT, p: '#5c2878', P: '#36154a', d: '#140c1a', e: '#d060ff', s: '#dcd4c0' };

const ASSASSIN = [
  '....kkkk....',
  '...kddddk...',
  '..kdDDDDdk..',
  '..kddeeddk..',
  '..kddddddk..',
  '...kddddk...',
  '..kkdVVdkk..',
  '.kdDkDDkDdk.',
  'wdk.kddk.kdw',
  'w...kddk...w',
  '....kDDk....',
  '....kddk....',
  '...kd..dk...',
  '...kd..dk...',
  '..kkd..dkk..',
  '............',
];
const ASSASSIN_PAL = { k: OUT, d: '#282430', D: '#18141e', e: '#ff3060', V: '#701848', w: '#d0d8e0' };

const FROST_MAGE = [
  '....cccc....',
  '...cCCCCc...',
  '..cCddddCc..',
  '..cCdeedCc.g',
  '..cCddddCc.b',
  '...cccccc.gb',
  '....kcck..b.',
  '..kkcccckkb.',
  '.kcCcCCcCck.',
  '.kcckcckcck.',
  '..k.kCCk.k..',
  '....kcck....',
  '...kc..ck...',
  '...kc..ck...',
  '..kkc..ckk..',
  '............',
];
const FROST_PAL = { k: OUT, c: '#3070a0', C: '#1c4668', d: '#101c28', e: '#80f0ff', b: '#406080', g: '#b0ffff' };

const GOLEM = [
  '....kkkkkkkk....',
  '...kSSssssSSk...',
  '..kSssffffssSk..',
  '.kSssddffddssSk.',
  '.kssdeeffeedssk.',
  '.ksssddddddsssk.',
  'kSSkksssssskkSSk',
  'kSsfkSSffSSkfsSk',
  'kSssksffffskssSk',
  'kssskssffssksssk',
  '.kkk.kssssk.kkk.',
  '....kssffssk....',
  '...kSSk..kSSk...',
  '...kssk..kssk...',
  '..kSSSk..kSSSk..',
  '..kkkk....kkkk..',
];
const GOLEM_PAL = { k: OUT, S: '#4e484a', s: '#322d2f', d: '#1e1a1b', f: '#ff6a10', e: '#ffe040' };

// ---------------------------------------------------------------- 擴充地城怪物（6 普通 + 2 精英）
const HELLHOUND = [
  'ff.......kk...',
  '.FF.....kddk..',
  '.fFkkkkkdddYYk',
  '..fFFddddddddk',
  '...kdddddddddk',
  '...kddFddddddk',
  '...kddddkkkkk.',
  '..kddk..kddk..',
  '..kffk..kffk..',
  '..kkk...kkk...',
];
const HELLHOUND_PAL = { k: OUT, d: '#4d2a24', f: '#ff6814', F: '#ffb838', Y: '#fff060' };

const BONE_GUARD = [
  '....kkkk....',
  '...kSSsSk...',
  '..kSssssSk..',
  '..kskeeksk..',
  '..kskwwksk..',
  '...kwwwwk...',
  '.kkAAAAAAkk.',
  'kSSkwwwwkMMk',
  'kSskwkkwkMmk',
  'ksskwwwwkMyk',
  '.kkkaaaakMmk',
  '..kSaaaakMMk',
  '...kss.ssk..',
  '...kss.ssk..',
  '..kkk..kkk..',
  '............',
];
const BONE_GUARD_PAL = { k: OUT, S: '#9aa4b0', s: '#626a74', e: '#ff4830', w: '#dfd8c0', A: '#484e58', a: '#30343c', M: '#7a8490', m: '#4c545e', y: '#e0b030' };

const BLOOD_CULTIST = [
  '....rrrr....',
  '...rRRRRr...',
  '..rRddddRr..',
  '..rRdeedRr.b',
  '..rRddddRr.k',
  '...rrrrry.bk',
  '....krrk..k.',
  '..kkyrrkkkb.',
  '.krRrRRrRkk.',
  '.krrkrrkrrk.',
  '..k.kRRk.k..',
  '....krrk....',
  '...kr..rk...',
  '...kr..rk...',
  '..kkr..rkk..',
  '............',
];
const BLOOD_CULTIST_PAL = { k: OUT, r: '#781022', R: '#a81c34', d: '#1a080c', e: '#ff5068', y: '#e0b040', b: '#ff3048' };

const GHOUL = [
  '............',
  '...kkkkkk...',
  '..kggggggk..',
  '..kgeegggk..',
  '..kgkbbkgk..',
  '...kggggk...',
  '.kkbggggbkk.',
  'kggkggggkggk',
  'kbbkggggkbbk',
  'rk.kgbbgk.kr',
  'r..kggggk..r',
  '...kggggk...',
  '...kgg.ggk..',
  '..kggk.kggk.',
  '..kbb...bbk.',
  '............',
];
const GHOUL_PAL = { k: OUT, g: '#8a7e78', e: '#ff3838', b: '#b81c2c', r: '#e02838' };

const FROST_WRAITH = [
  '....cccc....',
  '...cCCCCc...',
  '..cCddddCc..',
  '..cCdwwdCc..',
  '..cCddddCc..',
  '..kcCCCCck..',
  '.kcCCccCCck.',
  'kCCccccccCCk',
  'kc.kcCCck.ck',
  '...kcCCck...',
  '..kccCCcck..',
  '..kc.cc.ck..',
  '...c.cc.c...',
  '....c..c....',
  '.....c......',
  '............',
];
const FROST_WRAITH_PAL = { k: '#0c1c28', c: '#60b8e8', C: '#2a6288', d: '#102434', w: '#d8f8ff' };

const PYRO_DEMON = [
  '.h........h.',
  '.hh.kkkk.hh.',
  '..hkRRRRkh..',
  '..kRrYYrRk..',
  '...kRRRRk...',
  '..kkddddkk..',
  '.kddkffkddk.',
  'fddkRFFRkddf',
  'ff.kRffRk.ff',
  '...kddddk...',
  '...kdRRdk...',
  '..kdd..ddk..',
  '..kdk..kdk..',
  '..kfk..kfk..',
  '..kkk..kkk..',
  '............',
];
const PYRO_DEMON_PAL = { k: OUT, h: '#dfd0a8', R: '#8c2220', r: '#561214', d: '#361418', Y: '#ffe840', f: '#ff6a10', F: '#ffd040' };

const BLOOD_KNIGHT = [
  '.h............h.',
  '.hh..kkkkkk..hh.',
  '..hhkRRRRRRkhh..',
  '...kRddddddRk...',
  '...kRdYYYYdRk...',
  '....kddddddk..WR',
  '.kkkyRRRRRRykkWR',
  'kRRkRryyyyrRkWRk',
  'krrkRrrrrrrRkyk.',
  '.kkkrRRRRRRrkkk.',
  '...krddddddrk...',
  '...kRddddddRk...',
  '...krRkkRrrk....',
  '...krrk.krrk....',
  '..kRRRk.kRRRk...',
  '..kkkk...kkkk...',
];
const BLOOD_KNIGHT_PAL = { k: '#0a0406', h: '#e8d4b0', R: '#b82038', r: '#6a1222', d: '#260a10', Y: '#ffe050', y: '#e0b040', W: '#ffd0d8' };

const FROST_TITAN = [
  '.w............w.',
  'wI...kkkkkk...Iw',
  'II.kkIIIIIIkk.II',
  'IkIIiibbbbiIIkII',
  '.kIiiwbbbbwiiIk.',
  '..kIIbbbbbbIIk..',
  'wIkkkIIIIIIkkkIw',
  'IIkIiIwwwwIiIkII',
  'IikIiiwbbwiiIkII',
  'kkkIIibbbbiiIkkk',
  '..kIIiiiiiiIIk..',
  '...kIIbbbbIIk...',
  '...kIIk..kIIk...',
  '...kIik..kiIk...',
  '..kIIIk..kIIIk..',
  '..kkkk....kkkk..',
];
const FROST_TITAN_PAL = { k: '#081420', I: '#4c8cc0', i: '#88d8f8', b: '#22486c', w: '#d8f8ff' };

const BONE_SPEAR = [
  '........kk..',
  '.kkkkkkkkwk.',
  'kbbbbbrbWWwk',
  '.kkkkkkkkwk.',
  '........kk..',
];
const BONE_SPEAR_PAL = { k: OUT, b: '#c8bea0', r: '#b02820', w: '#ebe4d0', W: '#ffffff' };

// ---------------------------------------------------------------- Boss 變體（3 種新外觀）
const BOSS_BONE = [
  'h..................h',
  'hh................hh',
  '.hh....kkkkkk....hh.',
  '..hhkkkWWWWWWkkkhh..',
  '...hkWWwwwwwwWWkh...',
  '....kWweewweewWk....',
  '....kWwwwwwwwwWk....',
  '...kkkWwkddkwWkkk...',
  '..kAAAkWwddwWkAAAk..',
  '.kAAaaakkwwkkaaaAAk.',
  'kAAaaaaaawwaaaaaaAAk',
  'kAawwwaaaddaaapppaAk',
  'kAkwwwkaaAAaakwwwkAk',
  '.kkwWwkaaAAaakwWwkk.',
  '..kwwwkaaaaaakwwwk..',
  '..kkkkkaaddwakkkkk..',
  '......kwwkkwwk......',
  '.....kwwwkkwwwk.....',
  '.....kWWk..kWWk.....',
  '....kkkkk..kkkkk....',
];
const BOSS_BONE_PAL = { k: '#0a0808', h: '#f0e4c8', w: '#c8bfa4', W: '#ebe4d0', e: '#ff3820', d: '#1e1818', a: '#2e2a2c', A: '#6a6460', p: '#a09880' };

const BOSS_BLOOD = [
  '..hh............hh..',
  '..hph..........hph..',
  '...hph.kkkkkk.hph...',
  '....hhkRRRRRRkhh....',
  '....kRRrrrrrrRRk....',
  '....kRreerreerRk....',
  '....kRrrrrrrrrRk....',
  '...kkkRrkddkrRkkk...',
  '..kBBBkRrddrRkBBBk..',
  '.kBBbbbkkrrkkbbbBBk.',
  'kBBbbbbbbrrbbbbbbBBk',
  'kBbrrrbbbrrbbbrrrbBk',
  'kBkrddkbbBBbbkddrkBk',
  '.kkrRrkbbBBbbkrRrkk.',
  '..krrrkbbbbbbkrrrk..',
  '..kkkkkbbddbbkkkkk..',
  '......krrkkrrk......',
  '.....krrrkkrrrk.....',
  '.....kRRk..kRRk.....',
  '....kkkkk..kkkkk....',
];
const BOSS_BLOOD_PAL = { k: '#0a0406', h: '#e0c0a0', p: '#701020', r: '#7a1020', R: '#b82038', e: '#ffe060', d: '#1a060a', b: '#2a0814', B: '#581228' };

const BOSS_FROST = [
  '.i................i.',
  'ii......iiii......ii',
  '.ii...kkCCCCkk...ii.',
  '..iikkCCccccCCkkii..',
  '...ikCccwwwwccCki...',
  '....kCceewweecCk....',
  '....kCccccccccCk....',
  '...kkkCckggkcCkkk...',
  '..kIIIkCcggcCkIIIk..',
  '.kIIiiikkcckkiiiIIk.',
  'kIIiiiiiicciiiiiiIIk',
  'kIiccciicggciiccciIk',
  'kIkccckiiIIiikccckIk',
  '.kkcCckiiIIiikcCckk.',
  '..kccckiiiiiikccck..',
  '..kkkkkiiggiikkkkk..',
  '......kcckkcck......',
  '.....kccckkccck.....',
  '.....kCCk..kCCk.....',
  '....kkkkk..kkkkk....',
];
const BOSS_FROST_PAL = { k: '#060c14', i: '#c8f4ff', c: '#30709e', C: '#60b0dc', w: '#b8e8ff', e: '#ffffff', g: '#90f8ff', I: '#4a8ab8' };

// ---------------------------------------------------------------- 村莊物件與新圖示
const NPC_SMITH = [
  '....kkkk....',
  '...kppppk...',
  '..kpppppPk..',
  '..kssssssk..',
  '..kskwwksk..',
  '..kbbbbbbk..',
  '...kbbbbk...',
  '.kkllllllkk.',
  'kssllbbllssk',
  'ksskllllkssk',
  'hkk.kllk.kk.',
  'h...kllk....',
  '...kppppk...',
  '...kp..pk...',
  '..kkp..pkk..',
  '............',
];
const SMITH_PAL = { k: OUT, p: '#604030', P: '#483020', s: '#d8a880', w: '#ffffff', b: '#885830', l: '#5a301a', h: '#9aa0a8' };

const ANVIL = [
  '............',
  '.kkkkkkkkkk.',
  'kLLLLLLLLLLk',
  'kksssssssskk',
  '..kksssskk..',
  '....kssk....',
  '...kssssk...',
  '..kssssssk..',
  '.kkkkkkkkkk.',
];
const ANVIL_PAL = { k: OUT, L: '#8a929a', s: '#4c525a' };

const FORGE = [
  '..kkkkkkkkkk..',
  '.kSSSSSSSSSSk.',
  'kSssSSSSSSssSk',
  'kSsSSSSSSSSsSk',
  'kSsSkkkkkkSsSk',
  'kSskffOOOfkSSk',
  'kSskfOOOOOkSSk',
  'kSskOOYYOOkSSk',
  'kSskkkkkkkkSSk',
  '.kkkkkkkkkkkk.',
];
const FORGE_PAL = { k: OUT, S: '#5a504a', s: '#3c3430', f: '#ff4800', O: '#ff9020', Y: '#fff080' };

const CAMPFIRE0 = [
  '....y.....',
  '...oyo....',
  '..yoroy...',
  '..orrro...',
  '.koorook..',
  'kbbkbbkbbk',
  '.kk.kk.kk.',
];
const CAMPFIRE1 = [
  '.....y....',
  '...yoo....',
  '..ooroy...',
  '..yorro...',
  '.koorook..',
  'kbbkbbkbbk',
  '.kk.kk.kk.',
];
const CAMP_PAL = { y: '#fff4a0', o: '#ffb030', r: '#ff5010', k: OUT, b: '#6a4020' };

const FOUNTAIN = [
  '...kkkkkkkk...',
  '..kSSSSSSSSk..',
  '.kSwwwwwwwwSk.',
  'kSwWWwwwwWWwSk',
  'kSwWwwwwwwWwSk',
  'kSwwwwwwwwwwSk',
  '.kSwwwwwwwwSk.',
  '..kSSssssSSk..',
  '...kkkkkkkk...',
];
const FOUNTAIN_PAL = { k: OUT, S: '#7c848c', s: '#484e56', w: '#30a8c8', W: '#90f8ff' };

const DUMMY = [
  '....kkkk....',
  '...kWWWWk...',
  '...kWwwWk...',
  '...kWWWWk...',
  '.kkkkkkkkkk.',
  'kWWwwwwwwWWk',
  '.kkkkkkkkkk.',
  '....kbbk....',
  '....kbbk....',
  '....kbbk....',
  '...kkbbkk...',
  '..kkkkkkkk..',
];
const DUMMY_PAL = { k: OUT, W: '#d8b878', w: '#a88448', b: '#604020' };

const ICON_BOOK = [
  '................',
  '..kkkkkkkkkkk...',
  '.kbbbbbbbbbbbk..',
  '.kbGGGGGGGGGbk..',
  '.kbGbbgbbbgGbk..',
  '.kbGbbgggbbGbk..',
  '.kbGbbgbgbbGbk..',
  '.kbGbbgggbbGbk..',
  '.kbGbbbbbbbGbk..',
  '.kbGGGGGGGGGbk..',
  '.kbbbbbbbbbbbk..',
  '.kpppppppppppk..',
  '..kkkkkkkkkkk...',
  '................',
  '................',
  '................',
];
const BOOK_PAL = { k: OUT, b: '#4c2618', G: '#d8a838', g: '#50ffba', p: '#dcd2b8' };

const SHARD = [
  '...kk...',
  '..kppk..',
  '.kpPPpk.',
  'kpPWWPpk',
  'kpPWWPpk',
  '.kpPPpk.',
  '..kppk..',
  '...kk...',
];
const SHARD_PAL = { k: OUT, p: '#c040ff', P: '#ff80ff', W: '#fff0ff' };

const ESSENCE = [
  '...kk...',
  '..keEk..',
  '.keWWEk.',
  'keWEWEek',
  'keEWWEek',
  '.keEEek.',
  '..keek..',
  '...kk...',
];
const ESSENCE_PAL = { k: OUT, e: '#18a858', E: '#40f490', W: '#d8fff0' };

// ---------------------------------------------------------------- 地城物件、陷阱、祭壇與毒蛛
const PROP_CHEST = [
  '..kkkkkkkkkk..',
  '.kssyyyyyyssk.',
  'ksbbbbbbbbbbSk',
  'ksbyyyyyyyyysk',
  'kkkkkkkkkkkkkk',
  'ksbbyyLLyybbsk',
  'ksbbyyGGyybbsk',
  'ksbbbbbbbbbbSk',
  'kssbbbbbbbbssk',
  '.kkkkkkkkkkkk.',
];
const PROP_CHEST_OPEN = [
  '..kkkkkkkkkk..',
  '.ksbbbbbbbbsk.',
  'ksbYYyYYyYYbsk',
  'ksYYYYYYYYYYsk',
  'kkkkkkkkkkkkkk',
  'ksbbyyLLyybbsk',
  'ksbbyyGGyybbsk',
  'ksbbbbbbbbbbSk',
  'kssbbbbbbbbssk',
  '.kkkkkkkkkkkk.',
];
const CHEST_PAL = { k: OUT, b: '#6e3f1d', s: '#525860', S: '#7c8490', y: '#d4a028', Y: '#ffe868', L: '#fff0a0', G: '#9a7014' };

const PROP_BARREL = [
  '..kkkkkkkk..',
  '.kbbbbbbbbk.',
  'kssssssssssk',
  'kbBbbbbbbBbk',
  'kbBbbbbbbBbk',
  'kssssssssssk',
  'kbBbbbbbbBbk',
  'kbBbbbbbbBbk',
  'kssssssssssk',
  '.kbbbbbbbbk.',
  '..kkkkkkkk..',
];
const BARREL_PAL = { k: OUT, b: '#784824', B: '#543016', s: '#626870' };

const PROP_URN = [
  '...kkkkkk...',
  '..kcccccck..',
  '...kcccck...',
  '..kcCCCCck..',
  '.kcCCcCCCck.',
  '.kccCccCCck.',
  '.kcccCCcCck.',
  '..kcccccck..',
  '..kcCCCCck..',
  '...kkkkkk...',
];
const URN_PAL = { k: OUT, c: '#86523a', C: '#5e3828' };

const PROP_DEBRIS = [
  '............',
  '..bb........',
  '..bbb....cc.',
  '........ccc.',
  '....bb......',
  '...bbb..cc..',
  '.....b...c..',
  '.cc.........',
  '.ccc....bb..',
  '........bb..',
];
const DEBRIS_PAL = { b: '#6a4020', c: '#7a4a34' };

const PROP_SPIKES_DOWN = [
  '.kkkkkkkkkk.',
  'ksskksskkssk',
  'ksdkksdkksdk',
  'kkkkkkkkkkkk',
  'ksskksskkssk',
  'ksdkksdkksdk',
  'kkkkkkkkkkkk',
  'ksskksskkssk',
  'ksdkksdkksdk',
  '.kkkkkkkkkk.',
];
const PROP_SPIKES_UP = [
  '..r......r..',
  '.kWk.kk.kWk.',
  'ksWsksskSWsk',
  'kSWskWWkSWsk',
  'kkskkWWkkskk',
  'kWWsksskSWWk',
  'kSWskWWkSWsk',
  'ksdkkWWkksdk',
  'ksskksskkssk',
  '.kkkkkkkkkk.',
];
const SPIKE_PAL = { k: OUT, s: '#525860', S: '#8a929a', d: '#1a1616', W: '#dce2ea', r: '#d82020' };

const PROP_AXE_TRAP = [
  '......kk......',
  '......ks......',
  '....kksskk....',
  '..kkSSssSSkk..',
  '.kWSSssssSSWk.',
  'kWWSSssssSSWWk',
  'kWWSssssssSWWk',
  '.kWSSssssSSWk.',
  '..kkSSssSSkk..',
  '....kkkkkk....',
];
const AXE_PAL = { k: OUT, s: '#4c5258', S: '#8c949e', W: '#e4eaf2' };

const PROP_SHRINE = [
  '....kkkkkk....',
  '...kcccccck...',
  '..kcCCCCCCck..',
  '..kcCCCCCCck..',
  '...kssssssk...',
  '..kSSSSSSSSk..',
  '.kSsSSSSSSsSk.',
  '.kSsSssssSsSk.',
  '.kSSSSSSSSSSk.',
  'kSSSSSSSSSSSSk',
  'kssssssssssssk',
  '.kkkkkkkkkkkk.',
];
const PROP_SHRINE_USED = [
  '....kkkkkk....',
  '...kddddddk...',
  '..kdDDDDDDdk..',
  '..kdDDDDDDdk..',
  '...kssssssk...',
  '..kSSSSSSSSk..',
  '.kSsSSSSSSsSk.',
  '.kSsSssssSsSk.',
  '.kSSSSSSSSSSk.',
  'kSSSSSSSSSSSSk',
  'kssssssssssssk',
  '.kkkkkkkkkkkk.',
];
const SHRINE_PAL = { k: OUT, s: '#4e5258', S: '#7c828a', c: '#60f0ff', C: '#d0ffff', d: '#363a40', D: '#222428' };

const SPIDER = [
  'k............k',
  '.k..k....k..k.',
  '..kkppppppkk..',
  'k.kppppppppk.k',
  '.kppPPppPPppk.',
  'k.kpppeepppk.k',
  '..kpppeepppk..',
  'k.kppppppppk.k',
  '.k..kppppk..k.',
  'k...k.kk.k...k',
  '....k....k....',
  '..............',
];
const SPIDER_PAL = { k: OUT, p: '#3a1428', P: '#6e2046', e: '#ff3040' };

const PROP_WEB = [
  'w...w.....w..w',
  '.w...w...w..w.',
  '..wwwwwwwwww..',
  '.w..w....w..w.',
  'w..w..ww..w..w',
  '..w..w..w..w..',
  'ww..w....w..ww',
  '..w..w..w..w..',
  'w..w..ww..w..w',
  '.w..w....w..w.',
  '..wwwwwwwwww..',
  'w..w......w..w',
];
const WEB_PAL = { w: 'rgba(220,228,236,0.58)' };

const PROP_BRAZIER0 = [
  '....y..y....',
  '...yoroy....',
  '..yororoy...',
  '..orRRRro...',
  '.koorRrook..',
  'kSSSSSSSSSSk',
  '.kssssssssk.',
  '..kksssskk..',
  '...ks..sk...',
  '..ksk..ksk..',
];
const PROP_BRAZIER1 = [
  '...y...y....',
  '....oyyo....',
  '..yoorroy...',
  '..orRRRro...',
  '.koorRrook..',
  'kSSSSSSSSSSk',
  '.kssssssssk.',
  '..kksssskk..',
  '...ks..sk...',
  '..ksk..ksk..',
];
const BRAZIER_PAL = { k: OUT, s: '#3e4248', S: '#686e78', y: '#fff6a8', o: '#ffaa28', r: '#ff5210', R: '#fff8e4' };

const PROP_CHAINS = [
  '..kk....kk..',
  '.kssk..kssk.',
  '.k..k..k..k.',
  '.kssk..kssk.',
  '..kk....kk..',
  '.kssk..kssk.',
  '.k..k..k..k.',
  '.kssk..kssk.',
  '..kk....kk..',
  '.kssk..kssk.',
];
const CHAIN_PAL = { k: OUT, s: '#707880' };

const PROP_BANNER = [
  '.yyyyyyyyyy.',
  '.krrrrrrrrk.',
  '.krRRrrRRrk.',
  '.krrrYYrrrk.',
  '.krrrYYrrrk.',
  '.krrrrrrrrk.',
  '.krRRrrRRrk.',
  '.krrrrrrrrk.',
  '..krrrrrrk..',
  '...krrrrk...',
  '....krrk....',
  '.....kk.....',
];
const BANNER_PAL = { k: OUT, r: '#7c141c', R: '#a6202a', y: '#c89a28', Y: '#f0c850' };

const PROP_GRAVE = [
  '...kkkkkk...',
  '..kSSSSSSk..',
  '.kSSSssSSSk.',
  '.kSSsddsSSk.',
  '.kSSddddSSk.',
  '.kSSsddsSSk.',
  '.kSSsddsSSk.',
  '.kSSSssSSSk.',
  '.kssssssssk.',
  'kggggggggggk',
  '.kkkkkkkkkk.',
];
const GRAVE_PAL = { k: OUT, S: '#7e848a', s: '#52565a', d: '#303438', g: '#38482e' };

const PROP_RACK = [
  'kkkkkkkkkkkkkk',
  'kbbbbbbbbbbbbk',
  'kWWbWWbbWWbWWk',
  'kWsbWsbWsbWsbk',
  'kWsbWsbWsbWsbk',
  'kyybbyybbyybbk',
  'kbbbbbbbbbbbbk',
  '.kb........bk.',
  '.kb........bk.',
  'kkkk......kkkk',
];
const RACK_PAL = { k: OUT, b: '#683c1c', W: '#e0e6ee', s: '#889098', y: '#d0a22a' };

const PROP_SPOOKY_TREE = [
  '.k....k..k....k.',
  '..k..k....k..k..',
  '...kk..kk..kk...',
  '.k..kbbkkbbk..k.',
  '..kkbbbbbbbbkk..',
  '....kbbBBbbk....',
  '....kbBbbBbk....',
  '.....kbbbbk.....',
  '.....kbBBbk.....',
  '.....kbbbbk.....',
  '....kbbBBbbk....',
  '...kbbbbbbbbk...',
  '..kbbkbbbbkbbk..',
  '.kkkk.kkkk.kkkk.',
];
const TREE_PAL = { k: OUT, b: '#3d2a20', B: '#5a3d2d' };

const ORB_HP = [
  '..kkkk..',
  '.krRRrk.',
  'krRWWrrk',
  'krrrrrrk',
  'krrddrrk',
  '.krrrrk.',
  '..kkkk..',
];
const ORB_HP_PAL = { k: OUT, r: '#d01828', R: '#ff5060', W: '#ffd0d8', d: '#800c14' };
const ORB_MP_PAL = { k: OUT, r: '#2050d0', R: '#6098ff', W: '#d0e8ff', d: '#102878' };

// ---------------------------------------------------------------- 地磚
function makeTileset(scene, key, pal, seed = 1337) {
  if (scene.textures.exists(key)) return;
  const N = 8;
  const tex = scene.textures.createCanvas(key, TILE * N, TILE);
  const ctx = tex.getContext();
  const rnd = mulberry32(seed);
  const P = (ox, x, y, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x * PX, y * PX, PX, PX); };

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, TILE, TILE);

  const floor = (idx, opt = {}) => {
    const ox = idx * TILE;
    const base = opt.base || pal.floor;
    const slabD = [0, 0, 0, 0].map(() => (rnd() - 0.5) * 14);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const row = y < 8 ? 0 : 1;
        const xx = row ? (x + 4) % 16 : x;
        const slab = row * 2 + (xx < 8 ? 0 : 1);
        const mortar = y % 8 === 0 || xx % 8 === 0;
        if (mortar) {
          P(ox, x, y, rnd() < 0.15 ? pal.mortarDark : pal.mortar);
        } else {
          let d = slabD[slab] + (rnd() - 0.5) * 7;
          if (y % 8 === 1 || xx % 8 === 1) d += 5;
          if (y % 8 === 7 || xx % 8 === 7) d -= 5;
          let c = base;
          if (opt.moss && rnd() < 0.2) c = pal.moss;
          P(ox, x, y, rgb(c, d));
          if (rnd() < 0.04) P(ox, x, y, rgb(base, -14));
        }
      }
    }
    if (opt.crack) {
      let cx = 3 + Math.floor(rnd() * 10), cy = 2;
      while (cy < 15) {
        P(ox, cx, cy, pal.crack || '#0e0b0a');
        cy++;
        cx += Math.floor(rnd() * 3) - 1;
        cx = Math.max(1, Math.min(14, cx));
      }
    }
  };
  floor(1);
  floor(2, { base: pal.floorAlt });
  floor(3, { crack: true });

  // 4 牆頂
  {
    const ox = 4 * TILE;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      P(ox, x, y, rgb(pal.wallTop, (rnd() - 0.5) * 8));
    }
  }
  // 5 牆面（磚）
  {
    const ox = 5 * TILE;
    const brickD = {};
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const br = Math.floor(y / 4);
        const off = br % 2 ? 4 : 0;
        const xx = (x + off) % 16;
        const bid = br * 10 + Math.floor(xx / 8);
        if (brickD[bid] === undefined) brickD[bid] = (rnd() - 0.5) * 18;
        const mortar = y % 4 === 3 || xx % 8 === 7;
        if (y === 15) { P(ox, x, y, '#0b0908'); continue; }
        if (mortar) { P(ox, x, y, pal.mortar); continue; }
        let d = brickD[bid] + (rnd() - 0.5) * 8;
        if (y < 2) d += 14;
        if (y % 4 === 0) d += 6;
        P(ox, x, y, rgb(pal.wall, d));
      }
    }
  }
  floor(6, { moss: true });
  floor(7, { base: pal.floorWarm, crack: true });

  tex.refresh();
  nearest(tex);
}

function makeTiles(scene) {
  makeTileset(scene, 'tiles', {
    floor: [42, 38, 37], floorAlt: [38, 35, 35], floorWarm: [46, 40, 38],
    moss: [36, 46, 30], wall: [60, 51, 46], wallTop: [20, 17, 16],
    mortar: '#171312', mortarDark: '#0c0a09', crack: '#0e0b0a',
  }, 1337);
  makeTileset(scene, 'tiles_blood', {
    floor: [48, 30, 34], floorAlt: [42, 26, 30], floorWarm: [54, 32, 34],
    moss: [68, 22, 26], wall: [74, 36, 40], wallTop: [24, 12, 14],
    mortar: '#1a0c0e', mortarDark: '#0e0608', crack: '#380a0e',
  }, 2441);
  makeTileset(scene, 'tiles_frost', {
    floor: [30, 42, 54], floorAlt: [26, 37, 48], floorWarm: [34, 48, 60],
    moss: [46, 82, 98], wall: [48, 66, 84], wallTop: [14, 20, 28],
    mortar: '#101820', mortarDark: '#080e14', crack: '#4090b8',
  }, 3557);
  makeTileset(scene, 'tiles_abyss', {
    floor: [30, 24, 28], floorAlt: [26, 20, 24], floorWarm: [38, 26, 24],
    moss: [74, 28, 16], wall: [56, 32, 30], wallTop: [16, 10, 12],
    mortar: '#160a0c', mortarDark: '#0a0406', crack: '#d84810',
  }, 4663);
  makeTileset(scene, 'tiles_village', {
    floor: [58, 50, 42], floorAlt: [52, 45, 38], floorWarm: [66, 54, 44],
    moss: [44, 62, 36], wall: [82, 62, 46], wallTop: [28, 22, 18],
    mortar: '#221a14', mortarDark: '#14100c', crack: '#2c2218',
  }, 5779);
}

function blood(scene, key, seed) {
  canvasTex(scene, key, 48, 48, (ctx) => {
    const r = mulberry32(seed);
    const blobs = 3 + Math.floor(r() * 4);
    const pts = [];
    for (let i = 0; i < blobs; i++) pts.push([4 + r() * 8, 4 + r() * 8, 1.5 + r() * 3.5]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let inside = false;
      for (const [bx, by, br] of pts) if ((x - bx) ** 2 + (y - by) ** 2 < br * br) inside = true;
      if (!inside && r() < 0.03) inside = true;
      if (inside) {
        ctx.fillStyle = r() < 0.3 ? 'rgba(70,6,8,0.85)' : 'rgba(105,12,14,0.8)';
        ctx.fillRect(x * PX, y * PX, PX, PX);
      }
    }
  }, true);
}

function radial(scene, key, size, stops) {
  canvasTex(scene, key, size, size, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

function skillIcon(scene, key, draw) {
  canvasTex(scene, key, 56, 56, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 56);
    g.addColorStop(0, '#2a2220');
    g.addColorStop(1, '#0e0b0a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 56, 56);
    draw(ctx);
  });
}

export function generateTextures(scene) {
  makeTiles(scene);

  pixTex(scene, 'player', PLAYER, PLAYER_PAL);
  pixTex(scene, 'sword', SWORD, SWORD_PAL);
  pixTex(scene, 'skeleton', SKELETON, SKELETON_PAL);
  pixTex(scene, 'archer', ARCHER, ARCHER_PAL);
  pixTex(scene, 'gargoyle', GARGOYLE, GARGOYLE_PAL, 4);
  pixTex(scene, 'bat', BAT, BAT_PAL);
  pixTex(scene, 'necromancer', NECROMANCER, NECRO_PAL);
  pixTex(scene, 'assassin', ASSASSIN, ASSASSIN_PAL);
  pixTex(scene, 'frost_mage', FROST_MAGE, FROST_PAL);
  pixTex(scene, 'golem', GOLEM, GOLEM_PAL, 4);
  pixTex(scene, 'spider', SPIDER, SPIDER_PAL);
  pixTex(scene, 'hellhound', HELLHOUND, HELLHOUND_PAL);
  pixTex(scene, 'bone_guard', BONE_GUARD, BONE_GUARD_PAL);
  pixTex(scene, 'blood_cultist', BLOOD_CULTIST, BLOOD_CULTIST_PAL);
  pixTex(scene, 'ghoul', GHOUL, GHOUL_PAL);
  pixTex(scene, 'frost_wraith', FROST_WRAITH, FROST_WRAITH_PAL);
  pixTex(scene, 'pyro_demon', PYRO_DEMON, PYRO_DEMON_PAL);
  pixTex(scene, 'blood_knight', BLOOD_KNIGHT, BLOOD_KNIGHT_PAL, 4);
  pixTex(scene, 'frost_titan', FROST_TITAN, FROST_TITAN_PAL, 4);
  pixTex(scene, 'bonespear', BONE_SPEAR, BONE_SPEAR_PAL);

  pixTex(scene, 'prop_chest', PROP_CHEST, CHEST_PAL);
  pixTex(scene, 'prop_chest_open', PROP_CHEST_OPEN, CHEST_PAL);
  pixTex(scene, 'prop_barrel', PROP_BARREL, BARREL_PAL);
  pixTex(scene, 'prop_urn', PROP_URN, URN_PAL);
  pixTex(scene, 'prop_debris', PROP_DEBRIS, DEBRIS_PAL);
  pixTex(scene, 'prop_spikes_down', PROP_SPIKES_DOWN, SPIKE_PAL);
  pixTex(scene, 'prop_spikes_up', PROP_SPIKES_UP, SPIKE_PAL);
  pixTex(scene, 'prop_axe_trap', PROP_AXE_TRAP, AXE_PAL);
  pixTex(scene, 'prop_shrine', PROP_SHRINE, SHRINE_PAL);
  pixTex(scene, 'prop_shrine_used', PROP_SHRINE_USED, SHRINE_PAL);
  pixTex(scene, 'prop_web', PROP_WEB, WEB_PAL);
  pixTex(scene, 'prop_brazier0', PROP_BRAZIER0, BRAZIER_PAL);
  pixTex(scene, 'prop_brazier1', PROP_BRAZIER1, BRAZIER_PAL);
  pixTex(scene, 'prop_chains', PROP_CHAINS, CHAIN_PAL);
  pixTex(scene, 'prop_banner', PROP_BANNER, BANNER_PAL);
  pixTex(scene, 'prop_grave', PROP_GRAVE, GRAVE_PAL);
  pixTex(scene, 'prop_rack', PROP_RACK, RACK_PAL);
  pixTex(scene, 'prop_spooky_tree', PROP_SPOOKY_TREE, TREE_PAL, 4);
  pixTex(scene, 'orb_hp', ORB_HP, ORB_HP_PAL);
  pixTex(scene, 'orb_mp', ORB_HP, ORB_MP_PAL);

  pixTex(scene, 'boss', BOSS, BOSS_PAL, 6);
  pixTex(scene, 'boss_bone', BOSS_BONE, BOSS_BONE_PAL, 6);
  pixTex(scene, 'boss_blood', BOSS_BLOOD, BOSS_BLOOD_PAL, 6);
  pixTex(scene, 'boss_frost', BOSS_FROST, BOSS_FROST_PAL, 6);

  pixTex(scene, 'npc_smith', NPC_SMITH, SMITH_PAL);
  pixTex(scene, 'anvil', ANVIL, ANVIL_PAL);
  pixTex(scene, 'forge', FORGE, FORGE_PAL);
  pixTex(scene, 'campfire0', CAMPFIRE0, CAMP_PAL);
  pixTex(scene, 'campfire1', CAMPFIRE1, CAMP_PAL);
  pixTex(scene, 'fountain', FOUNTAIN, FOUNTAIN_PAL);
  pixTex(scene, 'dummy', DUMMY, DUMMY_PAL);

  pixTex(scene, 'icon_weapon', ICON_WEAPON, ICON_PAL);
  pixTex(scene, 'icon_armor', ICON_ARMOR, ICON_PAL);
  pixTex(scene, 'icon_helm', ICON_HELM, ICON_PAL);
  pixTex(scene, 'icon_cloak', ICON_CLOAK, ICON_PAL);
  pixTex(scene, 'icon_gloves', ICON_GLOVES, ICON_PAL);
  pixTex(scene, 'icon_boots', ICON_BOOTS, ICON_PAL);
  pixTex(scene, 'icon_amulet', ICON_AMULET, ICON_PAL);
  pixTex(scene, 'icon_accessory', ICON_ACC, ICON_PAL);
  pixTex(scene, 'icon_book', ICON_BOOK, BOOK_PAL);
  pixTex(scene, 'shard', SHARD, SHARD_PAL);
  pixTex(scene, 'essence', ESSENCE, ESSENCE_PAL);
  pixTex(scene, 'coin', COIN, COIN_PAL);
  pixTex(scene, 'bones', BONES, BONE_PAL);
  pixTex(scene, 'skull', SKULL, BONE_PAL);
  pixTex(scene, 'torch0', TORCH0, TORCH_PAL);
  pixTex(scene, 'torch1', TORCH1, TORCH_PAL);
  pixTex(scene, 'torch2', TORCH2, TORCH_PAL);
  pixTex(scene, 'arrow', ARROW, ARROW_PAL);

  blood(scene, 'blood0', 11);
  blood(scene, 'blood1', 23);
  blood(scene, 'blood2', 37);

  radial(scene, 'light', 256, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.75)'], [1, 'rgba(255,255,255,0)']]);
  radial(scene, 'glow', 128, [[0, 'rgba(255,255,255,0.9)'], [0.35, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
  radial(scene, 'fireball', 32, [[0, '#fffbe0'], [0.3, '#ffcc40'], [0.6, 'rgba(255,90,10,0.8)'], [1, 'rgba(255,40,0,0)']]);
  radial(scene, 'orb', 32, [[0, '#ffe0ff'], [0.3, '#d050ff'], [0.65, 'rgba(120,10,180,0.8)'], [1, 'rgba(60,0,100,0)']]);
  radial(scene, 'icebolt', 32, [[0, '#ffffff'], [0.3, '#90f8ff'], [0.65, 'rgba(40,160,255,0.85)'], [1, 'rgba(20,80,200,0)']]);
  radial(scene, 'bloodbolt', 32, [[0, '#ffd8d8'], [0.3, '#ff4050'], [0.65, 'rgba(170,10,25,0.85)'], [1, 'rgba(80,0,10,0)']]);
  radial(scene, 'voidbolt', 32, [[0, '#ffffff'], [0.28, '#e070ff'], [0.62, 'rgba(130,20,210,0.88)'], [1, 'rgba(50,0,90,0)']]);
  radial(scene, 'webbolt', 24, [[0, '#ffffff'], [0.4, 'rgba(220,230,240,0.9)'], [1, 'rgba(180,190,200,0)']]);
  radial(scene, 'portal_tex', 96, [[0, '#ffffff'], [0.22, '#c880ff'], [0.55, 'rgba(110,30,220,0.7)'], [0.82, 'rgba(40,10,100,0.25)'], [1, 'rgba(0,0,0,0)']]);
  radial(scene, 'shadowtex', 64, [[0, 'rgba(0,0,0,0.6)'], [0.7, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]);

  canvasTex(scene, 'spark', 6, 6, (ctx) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 6, 6); }, true);
  canvasTex(scene, 'pixel', 3, 3, (ctx) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 3, 3); }, true);

  // 輕量戰鬥特效貼圖（參考 00GameDevs：火焰拖尾、方向性火星、空心衝擊波、受擊星芒、餘燼地裂）
  canvasTex(scene, 'vfx_flame_wisp', 24, 24, (ctx) => {
    const g = ctx.createRadialGradient(13, 12, 1, 12, 12, 11);
    g.addColorStop(0, 'rgba(255,246,204,1)');
    g.addColorStop(0.32, 'rgba(255,154,68,0.92)');
    g.addColorStop(0.68, 'rgba(255,82,24,0.45)');
    g.addColorStop(1, 'rgba(220,48,8,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(12, 12, 11.5, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  canvasTex(scene, 'vfx_spark_streak', 18, 6, (ctx) => {
    const g = ctx.createLinearGradient(0, 3, 18, 3);
    g.addColorStop(0, 'rgba(255,130,30,0)');
    g.addColorStop(0.35, 'rgba(255,196,72,0.85)');
    g.addColorStop(0.75, 'rgba(255,250,224,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.quadraticCurveTo(9, 0, 18, 3);
    ctx.quadraticCurveTo(9, 6, 0, 3);
    ctx.fill();
  });

  canvasTex(scene, 'vfx_ring', 96, 96, (ctx) => {
    const g = ctx.createRadialGradient(48, 48, 28, 48, 48, 47);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.56, 'rgba(255,255,255,0)');
    g.addColorStop(0.74, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.86, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 96, 96);
  });

  canvasTex(scene, 'vfx_hit_star', 32, 32, (ctx) => {
    ctx.translate(16, 16);
    const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
    cg.addColorStop(0, 'rgba(255,255,255,1)');
    cg.addColorStop(0.45, 'rgba(255,244,200,0.7)');
    cg.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(-10, -10, 20, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -1.8);
      ctx.lineTo(15, 0);
      ctx.lineTo(0, 1.8);
      ctx.closePath();
      ctx.fill();
    }
  });

  canvasTex(scene, 'vfx_scorch_crack', 96, 96, (ctx) => {
    const sg = ctx.createRadialGradient(48, 48, 4, 48, 48, 42);
    sg.addColorStop(0, 'rgba(16,6,4,0.62)');
    sg.addColorStop(0.6, 'rgba(16,6,4,0.34)');
    sg.addColorStop(1, 'rgba(16,6,4,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, 96, 96);
    const rays = [0.2, 1.25, 2.35, 3.45, 4.55, 5.55];
    ctx.lineCap = 'round';
    for (let i = 0; i < rays.length; i++) {
      const a = rays[i];
      const len1 = 15 + (i % 2) * 5;
      const len2 = 30 + ((i + 1) % 3) * 5;
      const midA = a + (i % 2 === 0 ? 0.16 : -0.15);
      const x1 = 48 + Math.cos(a) * 5, y1 = 48 + Math.sin(a) * 5;
      const xm = 48 + Math.cos(midA) * len1, ym = 48 + Math.sin(midA) * len1;
      const x2 = 48 + Math.cos(a - 0.06) * len2, y2 = 48 + Math.sin(a - 0.06) * len2;
      ctx.strokeStyle = 'rgba(255,106,24,0.82)';
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(xm, ym); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,208,104,0.95)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(xm, ym); ctx.lineTo(x2, y2); ctx.stroke();
    }
  });

  // 全技能通用可染色輕量特效貼圖（旋風氣流圈、垂直光柱、塵霧、冰晶微粒、符文魔法陣）
  canvasTex(scene, 'vfx_vortex_ring', 128, 128, (ctx) => {
    ctx.translate(64, 64);
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const base = (i * Math.PI) / 2;
      for (let s = 0; s < 14; s++) {
        const t0 = s / 14, t1 = (s + 1) / 14;
        const a0 = base + t0 * 1.18;
        const a1 = base + t1 * 1.18;
        const r0 = 36 + t0 * 21;
        const r1 = 36 + t1 * 21;
        const alpha = Math.sin(t0 * Math.PI) * 0.85;
        ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.6 + Math.sin(t0 * Math.PI) * 4.2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
        ctx.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.stroke();
  });

  canvasTex(scene, 'vfx_light_pillar', 64, 140, (ctx) => {
    for (let y = 0; y < 140; y++) {
      const vFade = y < 110
        ? Math.pow(y / 110, 1.4)
        : Math.max(0, 1 - (y - 110) / 30);
      const hg = ctx.createLinearGradient(0, y, 64, y);
      hg.addColorStop(0, 'rgba(255,255,255,0)');
      hg.addColorStop(0.28, `rgba(255,255,255,${(0.28 * vFade).toFixed(3)})`);
      hg.addColorStop(0.5, `rgba(255,255,255,${(0.95 * vFade).toFixed(3)})`);
      hg.addColorStop(0.72, `rgba(255,255,255,${(0.28 * vFade).toFixed(3)})`);
      hg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(0, y, 64, 1);
    }
  });

  canvasTex(scene, 'vfx_dust_puff', 20, 20, (ctx) => {
    const g = ctx.createRadialGradient(10, 10, 1, 10, 10, 9.5);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 20, 20);
  });

  canvasTex(scene, 'vfx_frost_shard', 16, 16, (ctx) => {
    ctx.translate(8, 8);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 7);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(3.5, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(-3.5, 0);
    ctx.closePath();
    ctx.fill();
  });

  canvasTex(scene, 'vfx_rune_ring', 128, 128, (ctx) => {
    ctx.translate(64, 64);
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 55, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.82)';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 44, Math.sin(a) * 44);
      ctx.lineTo(Math.cos(a) * 55, Math.sin(a) * 55);
      ctx.stroke();
      const ma = a + Math.PI / 8;
      ctx.beginPath();
      ctx.arc(0, 0, 49.5, ma - 0.08, ma + 0.08);
      ctx.stroke();
    }
  });

  // 揮砍弧光
  canvasTex(scene, 'slash', 128, 128, (ctx) => {
    ctx.translate(64, 64);
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,255,255,${0.06 + i * 0.05})`;
      ctx.lineWidth = 3 + i * 0.6;
      ctx.arc(0, 0, 46 + i * 0.8, -1.1 + i * 0.05, 1.1 - i * 0.02);
      ctx.stroke();
    }
  });

  // 霧
  canvasTex(scene, 'fog', 512, 512, (ctx) => {
    const r = mulberry32(99);
    for (let i = 0; i < 70; i++) {
      const x = r() * 512, y = r() * 512, rad = 40 + r() * 110;
      for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        g.addColorStop(0, 'rgba(150,150,170,0.10)');
        g.addColorStop(1, 'rgba(150,150,170,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
  });

  // 暗角
  canvasTex(scene, 'vignette', 1280, 720, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  canvasTex(scene, 'hurtvig', 1280, 720, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.6);
    g.addColorStop(0, 'rgba(160,0,0,0)');
    g.addColorStop(1, 'rgba(160,0,0,0.8)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

  // 技能圖示
  skillIcon(scene, 'sk_fire', (ctx) => {
    const g = ctx.createRadialGradient(28, 32, 2, 28, 30, 22);
    g.addColorStop(0, '#fff6c0'); g.addColorStop(0.4, '#ffaa20'); g.addColorStop(1, 'rgba(200,30,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(28, 6); ctx.quadraticCurveTo(44, 24, 40, 38); ctx.quadraticCurveTo(28, 52, 16, 38); ctx.quadraticCurveTo(12, 24, 28, 6);
    ctx.fill();
  });
  skillIcon(scene, 'sk_whirl', (ctx) => {
    ctx.translate(28, 28);
    for (let i = 0; i < 3; i++) {
      ctx.rotate((Math.PI * 2) / 3);
      ctx.strokeStyle = i === 0 ? '#ffffff' : '#c8ccd4';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, 1.6); ctx.stroke();
      ctx.fillStyle = '#dfe3ea';
      ctx.fillRect(16, -2, 8, 4);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  });
  skillIcon(scene, 'sk_heal', (ctx) => {
    const g = ctx.createRadialGradient(28, 28, 2, 28, 28, 24);
    g.addColorStop(0, 'rgba(160,255,160,0.9)'); g.addColorStop(1, 'rgba(0,80,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 56, 56);
    ctx.fillStyle = '#7dff8a';
    ctx.fillRect(23, 12, 10, 32); ctx.fillRect(12, 23, 32, 10);
    ctx.fillStyle = '#e8ffe8';
    ctx.fillRect(25, 14, 6, 28); ctx.fillRect(14, 25, 28, 6);
  });
  skillIcon(scene, 'sk_dodge', (ctx) => {
    ctx.strokeStyle = '#9ad0ff'; ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.4 + i * 0.3;
      ctx.beginPath(); ctx.moveTo(10 + i * 12, 16); ctx.lineTo(20 + i * 12, 28); ctx.lineTo(10 + i * 12, 40); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
  skillIcon(scene, 'sk_chain', (ctx) => {
    ctx.strokeStyle = '#70e8ff'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(34, 8); ctx.lineTo(18, 27); ctx.lineTo(30, 27); ctx.lineTo(22, 48); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(34, 8); ctx.lineTo(18, 27); ctx.lineTo(30, 27); ctx.lineTo(22, 48); ctx.stroke();
  });
  skillIcon(scene, 'sk_nova', (ctx) => {
    ctx.translate(28, 28);
    ctx.strokeStyle = '#80e8ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(0, 22); ctx.stroke();
    }
    ctx.fillStyle = '#e8ffff'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  });
  skillIcon(scene, 'sk_dash', (ctx) => {
    ctx.strokeStyle = '#c060ff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(10, 42); ctx.lineTo(44, 14); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14, 38); ctx.lineTo(44, 14); ctx.stroke();
    ctx.fillStyle = '#e0a0ff';
    ctx.beginPath(); ctx.moveTo(46, 12); ctx.lineTo(32, 14); ctx.lineTo(40, 24); ctx.closePath(); ctx.fill();
  });
  skillIcon(scene, 'sk_meteor', (ctx) => {
    const g = ctx.createRadialGradient(26, 32, 2, 26, 32, 16);
    g.addColorStop(0, '#fff8d0'); g.addColorStop(0.5, '#ff7818'); g.addColorStop(1, 'rgba(180,20,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(26, 32, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff9830';
    ctx.strokeStyle = '#ff9830'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(32, 24); ctx.lineTo(46, 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22, 20); ctx.lineTo(36, 8); ctx.stroke();
  });
  skillIcon(scene, 'sk_cleave', (ctx) => {
    ctx.strokeStyle = '#ff6820'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(16, 40, 26, -1.35, -0.1); ctx.stroke();
    ctx.strokeStyle = '#ffe080'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(16, 40, 22, -1.25, -0.2); ctx.stroke();
    ctx.strokeStyle = '#e0e6f0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(12, 42); ctx.lineTo(40, 14); ctx.stroke();
  });
  skillIcon(scene, 'sk_ice_lance', (ctx) => {
    ctx.strokeStyle = '#50c8ff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(10, 46); ctx.lineTo(44, 12); ctx.stroke();
    ctx.fillStyle = '#d8f8ff';
    ctx.beginPath(); ctx.moveTo(46, 10); ctx.lineTo(30, 14); ctx.lineTo(42, 26); ctx.closePath(); ctx.fill();
  });
  skillIcon(scene, 'sk_poison_cloud', (ctx) => {
    const g = ctx.createRadialGradient(28, 30, 3, 28, 30, 22);
    g.addColorStop(0, '#90ff50'); g.addColorStop(0.6, 'rgba(60,180,30,0.85)'); g.addColorStop(1, 'rgba(20,70,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(22, 32, 13, 0, Math.PI * 2); ctx.arc(34, 28, 12, 0, Math.PI * 2); ctx.arc(28, 22, 11, 0, Math.PI * 2); ctx.fill();
  });
  skillIcon(scene, 'sk_holy_shield', (ctx) => {
    ctx.fillStyle = 'rgba(255,215,90,0.28)';
    ctx.strokeStyle = '#ffd850'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(28, 8); ctx.lineTo(44, 16); ctx.quadraticCurveTo(44, 36, 28, 48);
    ctx.quadraticCurveTo(12, 36, 12, 16); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff8c8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(28, 17); ctx.lineTo(28, 38); ctx.moveTo(19, 25); ctx.lineTo(37, 25); ctx.stroke();
  });
  skillIcon(scene, 'sk_blood_boil', (ctx) => {
    const g = ctx.createRadialGradient(28, 32, 3, 28, 30, 20);
    g.addColorStop(0, '#ff90a0'); g.addColorStop(0.5, '#d01028'); g.addColorStop(1, 'rgba(90,0,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(28, 8); ctx.quadraticCurveTo(44, 28, 38, 42); ctx.quadraticCurveTo(28, 50, 18, 42); ctx.quadraticCurveTo(12, 28, 28, 8); ctx.fill();
  });
  skillIcon(scene, 'sk_arcane_orb', (ctx) => {
    const g = ctx.createRadialGradient(28, 28, 2, 28, 28, 20);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#b868ff'); g.addColorStop(1, 'rgba(90,20,180,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(28, 28, 20, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e0a8ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(28, 28, 22, 8, -0.5, 0, Math.PI * 2); ctx.stroke();
  });
  skillIcon(scene, 'sk_blink', (ctx) => {
    ctx.strokeStyle = '#9048ff'; ctx.lineWidth = 3;
    ctx.strokeRect(10, 18, 12, 22);
    ctx.fillStyle = '#d090ff'; ctx.fillRect(32, 14, 14, 26);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20, 29); ctx.lineTo(34, 27); ctx.stroke();
  });
  skillIcon(scene, 'sk_thunder_strike', (ctx) => {
    ctx.strokeStyle = '#ffe848'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(32, 6); ctx.lineTo(18, 26); ctx.lineTo(30, 26); ctx.lineTo(20, 48); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(32, 6); ctx.lineTo(18, 26); ctx.lineTo(30, 26); ctx.lineTo(20, 48); ctx.stroke();
  });
  skillIcon(scene, 'sk_blade_storm', (ctx) => {
    ctx.translate(28, 28);
    for (let i = 0; i < 3; i++) {
      ctx.rotate((Math.PI * 2) / 3);
      ctx.fillStyle = '#dfe6f0'; ctx.fillRect(10, -2, 12, 4);
      ctx.fillStyle = '#f0c040'; ctx.fillRect(8, -4, 3, 8);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  });
  skillIcon(scene, 'sk_soul_nova', (ctx) => {
    ctx.strokeStyle = '#e050a0'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(28, 28, 17, 0, Math.PI * 2); ctx.stroke();
    const g = ctx.createRadialGradient(28, 28, 1, 28, 28, 14);
    g.addColorStop(0, '#ffd0ff'); g.addColorStop(1, 'rgba(180,30,100,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(28, 28, 14, 0, Math.PI * 2); ctx.fill();
  });

  // 符文石紋理
  for (const r of RUNE_LIST) {
    canvasTex(scene, `rune_${r.id}`, 36, 36, (ctx) => {
      ctx.beginPath();
      ctx.moveTo(11, 3); ctx.lineTo(25, 3);
      ctx.lineTo(33, 11); ctx.lineTo(33, 25);
      ctx.lineTo(25, 33); ctx.lineTo(11, 33);
      ctx.lineTo(3, 25); ctx.lineTo(3, 11);
      ctx.closePath();
      const grad = ctx.createLinearGradient(4, 4, 32, 32);
      grad.addColorStop(0, '#322b34');
      grad.addColorStop(1, '#120f14');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#080608';
      ctx.stroke();

      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1.3;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.moveTo(12, 6); ctx.lineTo(24, 6);
      ctx.lineTo(30, 12); ctx.lineTo(30, 24);
      ctx.lineTo(24, 30); ctx.lineTo(12, 30);
      ctx.lineTo(6, 24); ctx.lineTo(6, 12);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1;

      const drawGlyph = (lw, col) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (r.id === 'blood') {
          ctx.moveTo(18, 9); ctx.lineTo(24, 19); ctx.lineTo(18, 27); ctx.lineTo(12, 19); ctx.closePath();
          ctx.moveTo(18, 9); ctx.lineTo(18, 27);
        } else if (r.id === 'thorn') {
          ctx.moveTo(18, 8); ctx.lineTo(18, 28);
          ctx.moveTo(12, 13); ctx.lineTo(18, 17); ctx.lineTo(24, 13);
          ctx.moveTo(12, 21); ctx.lineTo(18, 24); ctx.lineTo(24, 21);
        } else if (r.id === 'wind') {
          ctx.moveTo(10, 14); ctx.lineTo(25, 11); ctx.lineTo(11, 20); ctx.lineTo(26, 18);
          ctx.moveTo(13, 25); ctx.lineTo(23, 24);
        } else if (r.id === 'flame') {
          ctx.moveTo(18, 8); ctx.lineTo(25, 21); ctx.lineTo(18, 27); ctx.lineTo(11, 21); ctx.closePath();
          ctx.moveTo(18, 15); ctx.lineTo(18, 25);
        } else if (r.id === 'frost') {
          ctx.moveTo(18, 8); ctx.lineTo(18, 28);
          ctx.moveTo(9, 13); ctx.lineTo(27, 23);
          ctx.moveTo(27, 13); ctx.lineTo(9, 23);
        } else if (r.id === 'arcane') {
          ctx.moveTo(18, 9); ctx.lineTo(26, 18); ctx.lineTo(18, 27); ctx.lineTo(10, 18); ctx.closePath();
          ctx.moveTo(15, 18); ctx.lineTo(18, 15); ctx.lineTo(21, 18); ctx.lineTo(18, 21); ctx.closePath();
        } else if (r.id === 'crit') {
          ctx.moveTo(11, 10); ctx.lineTo(25, 26);
          ctx.moveTo(25, 10); ctx.lineTo(11, 26);
          ctx.moveTo(14, 10); ctx.lineTo(22, 10);
        } else {
          ctx.moveTo(18, 8); ctx.lineTo(18, 28);
          ctx.moveTo(10, 16); ctx.lineTo(26, 16);
          ctx.moveTo(13, 11); ctx.lineTo(23, 11);
        }
        ctx.stroke();
      };
      drawGlyph(3.6, r.color);
      drawGlyph(1.5, '#ffffff');
    });
  }
}

