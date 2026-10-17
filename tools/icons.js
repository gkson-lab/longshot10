// Draws the app icon (two reel cells reading "10" over a brass bar) from plain shapes, so it
// looks the same everywhere, and writes icon.svg, icon-192.png and icon-512.png.
//   node tools/icons.js
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Rounded rectangles on a 512 grid, painted in order.
const SHAPES = [
  { x: 0, y: 0, w: 512, h: 512, r: 96, fill: '#0c0c10' },
  { x: 93, y: 125, w: 154, h: 262, r: 27, fill: '#2c2c37' }, // cell borders
  { x: 265, y: 125, w: 154, h: 262, r: 27, fill: '#2c2c37' },
  { x: 99, y: 131, w: 142, h: 250, r: 21, fill: '#060608' }, // cells
  { x: 271, y: 131, w: 142, h: 250, r: 21, fill: '#060608' },
  { x: 158, y: 176, w: 30, h: 160, r: 6, fill: '#f6f1e3' }, // "1"
  { x: 132, y: 176, w: 50, h: 28, r: 6, fill: '#f6f1e3' },
  { x: 128, y: 314, w: 90, h: 26, r: 6, fill: '#f6f1e3' },
  { x: 294, y: 176, w: 96, h: 164, r: 42, fill: '#f6f1e3' }, // "0"
  { x: 322, y: 204, w: 40, h: 108, r: 18, fill: '#060608' },
  { x: 96, y: 410, w: 320, h: 16, r: 8, fill: '#d6a84a' }, // brass bar
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n`
  + SHAPES.map(s => `  <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" fill="${s.fill}"/>`).join('\n')
  + '\n</svg>\n';

function inside(s, px, py) {
  if (px < s.x || py < s.y || px > s.x + s.w || py > s.y + s.h) return false;
  const cx = Math.min(Math.max(px, s.x + s.r), s.x + s.w - s.r);
  const cy = Math.min(Math.max(py, s.y + s.r), s.y + s.h - s.r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= s.r * s.r;
}
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

// 4x4 supersampling per pixel; corners outside the background stay transparent.
function raster(size) {
  const px = Buffer.alloc(size * size * 4), k = 512 / size, SS = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const X = (x + (sx + 0.5) / SS) * k, Y = (y + (sy + 0.5) / SS) * k;
      let c = null;
      for (const s of SHAPES) if (inside(s, X, Y)) c = s.fill;
      if (c) { const [cr, cg, cb] = rgb(c); r += cr; g += cg; b += cb; a++; }
    }
    const i = (y * size + x) * 4;
    if (a) { px[i] = r / a; px[i + 1] = g / a; px[i + 2] = b / a; }
    px[i + 3] = Math.round((255 * a) / (SS * SS));
  }
  return px;
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = buf => { let c = -1; for (const byte of buf) c = CRC[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4), crc = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type), data]);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const px = raster(size), rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) px.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const root = path.join(__dirname, '..');
fs.writeFileSync(path.join(root, 'icon.svg'), svg);
for (const size of [192, 512]) fs.writeFileSync(path.join(root, `icon-${size}.png`), png(size));
console.log('wrote icon.svg, icon-192.png, icon-512.png');
