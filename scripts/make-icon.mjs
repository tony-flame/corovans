// Иконка приложения: 256×256 PNG + ICO-обёртка.
// Рисуется кодом, без внешних ассетов — как всё остальное в проекте.
// Запускается один раз: npm run icon (или вручную node scripts/make-icon.mjs).
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SIZE = 256;

// ── Пиксели ────────────────────────────────────────────────────────
const px = new Uint8Array(SIZE * SIZE * 4);

function set(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
  px[i + 3] = a;
}

function rect(x0, y0, w, h, r, g, b, a = 255) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) set(x, y, r, g, b, a);
  }
}

// Круг с мягким краем: сглаживание по покрытию пикселя.
function disc(cx, cy, radius, r, g, b, a = 255) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius - 1); y <= cy + radius + 1; y++) {
    for (let x = Math.floor(cx - radius - 1); x <= cx + radius + 1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > (radius + 1) * (radius + 1)) continue;
      // Покрытие: 1 внутри, 0 снаружи, плавно на границе.
      const cover = Math.max(0, Math.min(1, radius + 0.5 - Math.sqrt(d2)));
      if (cover <= 0) continue;
      const i = (y * SIZE + x) * 4;
      const alpha = (a / 255) * cover;
      const dst = px[i + 3] / 255;
      const out = alpha + dst * (1 - alpha);
      if (out <= 0) continue;
      px[i] = (r * alpha + px[i] * dst * (1 - alpha)) / out;
      px[i + 1] = (g * alpha + px[i + 1] * dst * (1 - alpha)) / out;
      px[i + 2] = (b * alpha + px[i + 2] * dst * (1 - alpha)) / out;
      px[i + 3] = out * 255;
    }
  }
}

// Многоугольник через заливку чётностью — просто и без зависимостей.
function poly(points, r, g, b, a = 255) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, py] of points) {
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const crossings = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if (y1 === y2) continue;
      if ((y >= y1 && y < y2) || (y >= y2 && y < y1)) {
        const t = (y - y1) / (y2 - y1);
        crossings.push(x1 + t * (x2 - x1));
      }
    }
    crossings.sort((p, q) => p - q);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      for (let x = Math.ceil(crossings[i]); x <= Math.floor(crossings[i + 1]); x++) {
        set(x, y, r, g, b, a);
      }
    }
  }
}

// ── Рисунок: ночной тракт, фургон, монета ──────────────────────────

// Фон: тёмный круг с багровым низом (сумерки).
for (let y = 0; y < SIZE; y++) {
  const t = y / SIZE;
  const r = Math.round(16 + t * 74);
  const g = Math.round(14 + t * 26);
  const b = Math.round(26 + t * 12);
  for (let x = 0; x < SIZE; x++) {
    const dx = x - SIZE / 2;
    const dy = y - SIZE / 2;
    const cover = Math.max(0, Math.min(1, SIZE / 2 - 6 - Math.hypot(dx, dy)));
    if (cover > 0) set(x, y, r, g, b, Math.round(255 * cover));
  }
}

// Солнце у горизонта.
disc(170, 150, 26, 196, 116, 60, 150);
disc(170, 150, 16, 232, 170, 96, 210);

// Тракт из жёлтого кирпича, уходящий в точку.
poly(
  [
    [96, 148],
    [160, 148],
    [206, 232],
    [50, 232],
  ],
  178,
  146,
  70
);
// Полосы на тракте.
for (let i = 1; i <= 7; i++) {
  const t = i / 8;
  const y = 148 + (232 - 148) * t * t;
  const halfW = 32 + (78 - 32) * t * t;
  rect(Math.round(128 - halfW), Math.round(y), Math.round(halfW * 2), 2, 108, 86, 40);
}

// Фургон силуэтом.
rect(92, 128, 62, 26, 20, 16, 14);
disc(104, 158, 9, 12, 10, 8);
disc(142, 158, 9, 12, 10, 8);
rect(154, 132, 22, 4, 20, 16, 14);

// Монета поверх — герб игры.
disc(128, 74, 40, 44, 34, 18, 255);
disc(128, 74, 36, 216, 178, 90, 255);
disc(128, 74, 30, 186, 148, 70, 255);
disc(128, 74, 27, 230, 194, 108, 255);
// Буква «К»: вертикаль и два луча из середины.
rect(110, 54, 9, 40, 120, 90, 34);
poly(
  [
    [119, 74],
    [137, 52],
    [145, 52],
    [127, 74],
  ],
  120,
  90,
  34
);
poly(
  [
    [127, 74],
    [145, 96],
    [137, 96],
    [119, 74],
  ],
  120,
  90,
  34
);
// Блик на монете.
disc(112, 58, 7, 250, 232, 176, 120);

// ── PNG ────────────────────────────────────────────────────────────
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng() {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // бит на канал
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Каждая строка начинается с байта фильтра 0 (none).
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── ICO ────────────────────────────────────────────────────────────
// Формат ICO с одной PNG-записью: современные Windows это понимают.
function encodeIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count

  const entry = Buffer.alloc(16);
  entry[0] = 0; // ширина 256 кодируется нулём
  entry[1] = 0; // высота
  entry[2] = 0; // палитра
  entry[3] = 0;
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12); // смещение данных

  return Buffer.concat([header, entry, png]);
}

const png = encodePng();
mkdirSync(join(ROOT, "electron"), { recursive: true });
writeFileSync(join(ROOT, "electron", "icon.png"), png);
writeFileSync(join(ROOT, "electron", "icon.ico"), encodeIco(png));

console.log(`icon.png: ${png.length} bytes`);
console.log(`icon.ico: ${encodeIco(png).length} bytes`);
