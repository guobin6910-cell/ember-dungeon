import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const buildDir = path.join(rootDir, 'build');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, rowStart + 1);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function hexToRgba(hex, a = 255) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, a];
}

function renderBase32() {
  const size = 32;
  const buf = new Uint8Array(size * size * 4);

  const setPx = (x, y, [r, g, b, a]) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = a;
  };

  const getPx = (x, y) => {
    const idx = (y * size + x) * 4;
    return [buf[idx], buf[idx + 1], buf[idx + 2], buf[idx + 3]];
  };

  const blendPx = (x, y, [sr, sg, sb, sa]) => {
    if (x < 0 || x >= size || y < 0 || y >= size || sa === 0) return;
    const [dr, dg, db, da] = getPx(x, y);
    if (da === 0) {
      setPx(x, y, [sr, sg, sb, sa]);
      return;
    }
    const alpha = sa / 255;
    const r = Math.round(sr * alpha + dr * (1 - alpha));
    const g = Math.round(sg * alpha + dg * (1 - alpha));
    const b = Math.round(sb * alpha + db * (1 - alpha));
    setPx(x, y, [r, g, b, Math.max(da, sa)]);
  };

  const cVoid = hexToRgba('#070404');
  const cObsidian = hexToRgba('#120908');
  const cObsidianMid = hexToRgba('#1b0e0b');
  const cBronzeDark = hexToRgba('#5e3b18');
  const cBronze = hexToRgba('#8a5a28');
  const cGold = hexToRgba('#d8a050');
  const cGoldBright = hexToRgba('#f2c878');

  const cEmberDeep = hexToRgba('#8f1804');
  const cFlameRed = hexToRgba('#ff3000');
  const cFlameOrange = hexToRgba('#ff7018');
  const cFlameYellow = hexToRgba('#ffc840');
  const cFlameCore = hexToRgba('#fff5c0');

  // Beveled dark obsidian shield/crest with forged bronze border
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      // Chamfered corners for octagonal dark-fantasy crest
      const dx = Math.min(x - 1, size - 2 - x);
      const dy = Math.min(y - 1, size - 2 - y);
      if (dx + dy < 3) continue;

      const isOuterEdge =
        x === 1 || x === size - 2 || y === 1 || y === size - 2 || dx + dy === 3;
      const isInnerRim =
        !isOuterEdge &&
        (x === 2 || x === size - 3 || y === 2 || y === size - 3 || dx + dy === 4);
      const isBevel =
        !isOuterEdge &&
        !isInnerRim &&
        (x === 3 || x === size - 4 || y === 3 || y === size - 4 || dx + dy === 5);

      if (isOuterEdge) {
        setPx(x, y, y < 12 ? cBronze : cBronzeDark);
      } else if (isInnerRim) {
        const isCornerAccent = (dx <= 4 && dy <= 4) || (x <= 4 && y <= 4) || (x >= size - 5 && y <= 4);
        setPx(x, y, isCornerAccent || y < 8 ? cGoldBright : cGold);
      } else if (isBevel) {
        setPx(x, y, cVoid);
      } else {
        // Subtle radial warmth inside obsidian crest
        const cx = x - 15.5;
        const cy = y - 16.5;
        const dist = Math.hypot(cx, cy);
        setPx(x, y, dist < 9.5 ? cObsidianMid : cObsidian);
      }
    }
  }

  // Corner forged rivets
  const rivets = [
    [4, 4], [27, 4], [4, 27], [27, 27],
  ];
  for (const [rx, ry] of rivets) {
    setPx(rx, ry, cGoldBright);
  }

  // Soft ember glow bed at bottom of flame
  for (let y = 7; y <= 26; y++) {
    for (let x = 6; x <= 25; x++) {
      const dist = Math.hypot((x - 15.5) * 1.15, (y - 18.5) * 0.9);
      if (dist < 8.5) {
        const a = Math.round(Math.max(0, 1 - dist / 8.5) * 90);
        blendPx(x, y, [255, 68, 12, a]);
      }
    }
  }

  // Charcoal ember coals at base of flame
  for (let x = 10; x <= 21; x++) {
    setPx(x, 25, cBronzeDark);
  }
  for (let x = 11; x <= 20; x++) {
    setPx(x, 24, x % 2 === 0 ? cEmberDeep : cFlameRed);
  }

  // Pixel-art central ember flame (symmetric + subtle flicker)
  // Row-by-row spans [y, left, right, palette]
  const flameMask = [
    '................', // 6
    '.......##.......', // 7
    '......####......', // 8
    '.....######.....', // 9
    '.....#######....', // 10
    '....########....', // 11
    '...##########...', // 12
    '...####OO####...', // 13
    '..####OOOO####..', // 14
    '..###OOOOOO###..', // 15
    '..###OOYYOO###..', // 16
    '.###OOYYYYOO###.', // 17
    '.###OYYYYYYO###.', // 18
    '.##OOYYWWYYOO##.', // 19
    '.##OOYYWWYYOO##.', // 20
    '..#OOYYWWYYOO#..', // 21
    '..#OOYYYYYYOO#..', // 22
    '...#OOYYYYOO#...', // 23
    '....##OOOO##....', // 24
  ];

  const startY = 6;
  const startX = 8;
  for (let row = 0; row < flameMask.length; row++) {
    const line = flameMask[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === '.') continue;
      const px = startX + col;
      const py = startY + row;
      if (ch === '#') setPx(px, py, cFlameRed);
      else if (ch === 'O') setPx(px, py, cFlameOrange);
      else if (ch === 'Y') setPx(px, py, cFlameYellow);
      else if (ch === 'W') setPx(px, py, cFlameCore);
    }
  }

  // Extra pixel flicker tips & floating embers
  setPx(15, 6, cFlameOrange);
  setPx(16, 7, cFlameYellow);
  setPx(15, 8, cFlameYellow);
  setPx(14, 10, cFlameOrange);
  setPx(17, 11, cFlameOrange);

  // Rising pixel sparks
  setPx(10, 9, cFlameYellow);
  setPx(21, 10, cFlameOrange);
  setPx(9, 13, cFlameRed);
  setPx(22, 14, cFlameYellow);
  setPx(13, 5, cFlameCore);
  setPx(19, 6, cFlameYellow);

  return buf;
}

function scaleNearest(src, srcSize, dstSize) {
  if (srcSize === dstSize) return new Uint8Array(src);
  const dst = new Uint8Array(dstSize * dstSize * 4);
  for (let y = 0; y < dstSize; y++) {
    const sy = Math.floor((y * srcSize) / dstSize);
    for (let x = 0; x < dstSize; x++) {
      const sx = Math.floor((x * srcSize) / dstSize);
      const sIdx = (sy * srcSize + sx) * 4;
      const dIdx = (y * dstSize + x) * 4;
      dst[dIdx] = src[sIdx];
      dst[dIdx + 1] = src[sIdx + 1];
      dst[dIdx + 2] = src[sIdx + 2];
      dst[dIdx + 3] = src[sIdx + 3];
    }
  }
  return dst;
}

function downsampleBox2x2(src, srcSize) {
  const dstSize = srcSize >> 1;
  const dst = new Uint8Array(dstSize * dstSize * 4);
  for (let y = 0; y < dstSize; y++) {
    for (let x = 0; x < dstSize; x++) {
      let sumA = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const sIdx = ((y * 2 + dy) * srcSize + (x * 2 + dx)) * 4;
          const a = src[sIdx + 3];
          sumA += a;
          sumR += src[sIdx] * a;
          sumG += src[sIdx + 1] * a;
          sumB += src[sIdx + 2] * a;
        }
      }
      const dIdx = (y * dstSize + x) * 4;
      if (sumA === 0) {
        dst[dIdx] = 0;
        dst[dIdx + 1] = 0;
        dst[dIdx + 2] = 0;
        dst[dIdx + 3] = 0;
      } else {
        dst[dIdx] = Math.round(sumR / sumA);
        dst[dIdx + 1] = Math.round(sumG / sumA);
        dst[dIdx + 2] = Math.round(sumB / sumA);
        dst[dIdx + 3] = Math.round(sumA / 4);
      }
    }
  }
  return dst;
}

function encodeDib32(size, rgba) {
  const headerSize = 40;
  const xorSize = size * size * 4;
  const andRowStride = Math.ceil(size / 32) * 4;
  const andSize = andRowStride * size;
  const buf = Buffer.alloc(headerSize + xorSize + andSize);

  buf.writeUInt32LE(40, 0); // biSize
  buf.writeInt32LE(size, 4); // biWidth
  buf.writeInt32LE(size * 2, 8); // biHeight (XOR + AND)
  buf.writeUInt16LE(1, 12); // biPlanes
  buf.writeUInt16LE(32, 14); // biBitCount
  buf.writeUInt32LE(0, 16); // biCompression (BI_RGB)
  buf.writeUInt32LE(xorSize, 20); // biSizeImage

  // Bottom-up BGRA XOR pixels
  let p = headerSize;
  for (let y = size - 1; y >= 0; y--) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      buf[p++] = rgba[idx + 2]; // B
      buf[p++] = rgba[idx + 1]; // G
      buf[p++] = rgba[idx]; // R
      buf[p++] = rgba[idx + 3]; // A
    }
  }

  // Bottom-up 1bpp AND mask (bit=1 where alpha === 0)
  for (let row = 0; row < size; row++) {
    const srcY = size - 1 - row;
    const rowOffset = headerSize + xorSize + row * andRowStride;
    for (let x = 0; x < size; x++) {
      const alpha = rgba[(srcY * size + x) * 4 + 3];
      if (alpha === 0) {
        buf[rowOffset + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }

  return buf;
}

function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: ICO
  header.writeUInt16LE(entries.length, 4);

  const dirSize = entries.length * 16;
  let offset = 6 + dirSize;
  const dirEntries = [];
  const payloads = [];

  for (const entry of entries) {
    const dir = Buffer.alloc(16);
    dir[0] = entry.size >= 256 ? 0 : entry.size;
    dir[1] = entry.size >= 256 ? 0 : entry.size;
    dir[2] = 0; // color count
    dir[3] = 0; // reserved
    dir.writeUInt16LE(1, 4); // planes
    dir.writeUInt16LE(32, 6); // bitCount
    dir.writeUInt32LE(entry.data.length, 8);
    dir.writeUInt32LE(offset, 12);
    dirEntries.push(dir);
    payloads.push(entry.data);
    offset += entry.data.length;
  }

  return Buffer.concat([header, ...dirEntries, ...payloads]);
}

function main() {
  fs.mkdirSync(buildDir, { recursive: true });

  const base32 = renderBase32();
  const rgba16 = downsampleBox2x2(base32, 32);
  const rgba32 = base32;
  const rgba48 = scaleNearest(base32, 32, 48);
  const rgba256 = scaleNearest(base32, 32, 256);

  const png256 = encodePng(256, 256, rgba256);
  const pngPath = path.join(buildDir, 'icon.png');
  fs.writeFileSync(pngPath, png256);

  const ico = encodeIco([
    { size: 16, data: encodeDib32(16, rgba16) },
    { size: 32, data: encodeDib32(32, rgba32) },
    { size: 48, data: encodeDib32(48, rgba48) },
    { size: 256, data: png256 },
  ]);
  const icoPath = path.join(buildDir, 'icon.ico');
  fs.writeFileSync(icoPath, ico);

  console.log(`Generated ${pngPath} (${png256.length} bytes)`);
  console.log(`Generated ${icoPath} (${ico.length} bytes)`);
}

main();

