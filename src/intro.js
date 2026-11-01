// Заставки: три процедурные картинки на canvas, без внешних файлов.
//   dusk  — сумеречный тракт, силуэт фургона и одинокая фигура
//   death — красная пелена и упавший меч
//   gold  — золото, монеты и корона
// Детерминированы сидом: одна и та же заставка не «дышит» между кадрами.
//
// Модуль чистый: рисует в переданный ctx и ничего не знает про игру.
// Это позволяет тестировать его в Node с заглушкой canvas.

import { createRng, hashSeed } from "./rng.js";

export const INTRO_W = 960;
export const INTRO_H = 320;

// Сумеречная дорога: небо, лес силуэтом, тракт, фургон, фигура.
function drawDusk(ctx, rng) {
  // небо: градиент от багрового к тёмно-синему
  const sky = ctx.createLinearGradient(0, 0, 0, INTRO_H * 0.62);
  sky.addColorStop(0, "#1a1626");
  sky.addColorStop(0.45, "#3a2438");
  sky.addColorStop(0.78, "#8a4a3a");
  sky.addColorStop(1, "#c9743e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, INTRO_W, INTRO_H * 0.62);

  // солнце у горизонта — тлеющий диск
  ctx.fillStyle = "rgba(224, 140, 70, 0.5)";
  ctx.beginPath();
  ctx.arc(INTRO_W * 0.72, INTRO_H * 0.56, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(248, 190, 120, 0.75)";
  ctx.beginPath();
  ctx.arc(INTRO_W * 0.72, INTRO_H * 0.56, 26, 0, Math.PI * 2);
  ctx.fill();

  // облачные полосы
  for (let i = 0; i < 14; i++) {
    const y = 20 + rng() * INTRO_H * 0.42;
    const w = 70 + rng() * 240;
    const x = rng() * INTRO_W - w * 0.3;
    const a = 0.05 + rng() * 0.12;
    ctx.fillStyle = `rgba(200, 130, 110, ${a})`;
    ctx.fillRect(x, y, w, 2 + rng() * 5);
  }

  // лес на горизонте: рваная линия, деревья разной высоты и с прогалинами.
  // Ровный шаг превращал силуэт в частокол.
  ctx.fillStyle = "#161420";
  const baseY = INTRO_H * 0.6;
  ctx.beginPath();
  ctx.moveTo(0, baseY + 26);
  let x = 0;
  while (x < INTRO_W) {
    const gap = rng() < 0.18 ? 14 + rng() * 26 : 0;
    if (gap > 0) {
      ctx.lineTo(x + gap * 0.5, baseY + 6);
      x += gap;
      continue;
    }
    const h = 12 + rng() * 54;
    const w = 8 + rng() * 20;
    // ель — треугольник с зубчатым краем
    ctx.lineTo(x + w * 0.5, baseY - h);
    ctx.lineTo(x + w, baseY + 4);
    x += w;
  }
  ctx.lineTo(INTRO_W, INTRO_H);
  ctx.lineTo(0, INTRO_H);
  ctx.closePath();
  ctx.fill();

  // ближние деревья поверх — крупнее и темнее, чтобы был второй план
  for (let i = 0; i < 5; i++) {
    const tx = 20 + rng() * (INTRO_W - 40);
    const th = 46 + rng() * 40;
    ctx.fillStyle = "#0d0b12";
    ctx.beginPath();
    ctx.moveTo(tx, baseY + 18 - th);
    ctx.lineTo(tx + 14, baseY + 20);
    ctx.lineTo(tx - 14, baseY + 20);
    ctx.closePath();
    ctx.fill();
  }

  // земля
  const ground = ctx.createLinearGradient(0, baseY + 20, 0, INTRO_H);
  ground.addColorStop(0, "#2a2218");
  ground.addColorStop(1, "#0e0c0a");
  ctx.fillStyle = ground;
  ctx.fillRect(0, baseY + 20, INTRO_W, INTRO_H - baseY - 20);

  // тракт из жёлтого кирпича, уходящий в точку
  const horizonX = INTRO_W * 0.62;
  const horizonY = baseY + 22;
  ctx.fillStyle = "#6a5a32";
  ctx.beginPath();
  ctx.moveTo(horizonX - 8, horizonY);
  ctx.lineTo(horizonX + 8, horizonY);
  ctx.lineTo(INTRO_W * 0.96, INTRO_H);
  ctx.lineTo(INTRO_W * 0.12, INTRO_H);
  ctx.closePath();
  ctx.fill();
  // поперечные швы: чем ближе, тем шире
  ctx.strokeStyle = "rgba(20, 16, 10, 0.55)";
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    const y = horizonY + (INTRO_H - horizonY) * t * t;
    const halfW = 8 + (INTRO_W * 0.42 - 8) * t * t;
    ctx.lineWidth = 1 + t * 2;
    ctx.beginPath();
    ctx.moveTo(horizonX - halfW, y);
    ctx.lineTo(horizonX + halfW, y);
    ctx.stroke();
  }

  // фургон силуэтом у горизонта
  const wagonX = horizonX - 34;
  const wagonY = horizonY + 16;
  ctx.fillStyle = "#100e0c";
  ctx.fillRect(wagonX - 22, wagonY - 20, 44, 20);
  ctx.beginPath();
  ctx.arc(wagonX - 14, wagonY + 2, 7, 0, Math.PI * 2);
  ctx.arc(wagonX + 14, wagonY + 2, 7, 0, Math.PI * 2);
  ctx.fill();
  // дышло
  ctx.fillRect(wagonX + 22, wagonY - 8, 20, 3);

  // одинокая фигура на переднем плане, спиной
  const fx = INTRO_W * 0.44;
  const fy = INTRO_H * 0.92;
  const fh = 96;
  ctx.fillStyle = "#0a0908";
  // плащ
  ctx.beginPath();
  ctx.moveTo(fx, fy - fh);
  ctx.lineTo(fx + 20, fy);
  ctx.lineTo(fx - 20, fy);
  ctx.closePath();
  ctx.fill();
  // голова
  ctx.beginPath();
  ctx.arc(fx, fy - fh - 6, 11, 0, Math.PI * 2);
  ctx.fill();
  // меч в руке
  ctx.fillStyle = "#3a3630";
  ctx.fillRect(fx + 20, fy - fh - 6, 3, 52);

  // пыль в воздухе
  for (let i = 0; i < 40; i++) {
    const px = rng() * INTRO_W;
    const py = INTRO_H * 0.5 + rng() * INTRO_H * 0.5;
    const a = 0.05 + rng() * 0.18;
    ctx.fillStyle = `rgba(240, 200, 150, ${a})`;
    ctx.fillRect(px, py, 1.5, 1.5);
  }
}

// Смерть: красная пелена, упавший меч, темнота по краям.
function drawDeath(ctx, rng) {
  ctx.fillStyle = "#0a0406";
  ctx.fillRect(0, 0, INTRO_W, INTRO_H);

  // кровавая пелена сверху
  const veil = ctx.createLinearGradient(0, 0, 0, INTRO_H);
  veil.addColorStop(0, "rgba(120, 16, 20, 0.85)");
  veil.addColorStop(0.5, "rgba(60, 8, 12, 0.55)");
  veil.addColorStop(1, "rgba(8, 4, 6, 0.9)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, INTRO_W, INTRO_H);

  // потёки
  for (let i = 0; i < 22; i++) {
    const x = rng() * INTRO_W;
    const w = 2 + rng() * 9;
    const h = 40 + rng() * 190;
    const a = 0.08 + rng() * 0.25;
    ctx.fillStyle = `rgba(150, 22, 26, ${a})`;
    ctx.fillRect(x, 0, w, h);
  }

  // упавший меч: лежит по диагонали
  ctx.save();
  ctx.translate(INTRO_W * 0.5, INTRO_H * 0.68);
  ctx.rotate(-0.28);
  // клинок
  ctx.fillStyle = "#8a8e96";
  ctx.fillRect(-150, -5, 210, 10);
  // блик по клинку
  ctx.fillStyle = "#c8ccd4";
  ctx.fillRect(-150, -5, 210, 3);
  // гарда
  ctx.fillStyle = "#4a3a26";
  ctx.fillRect(60, -20, 10, 40);
  // рукоять
  ctx.fillStyle = "#3a2a1c";
  ctx.fillRect(70, -6, 46, 12);
  ctx.fillStyle = "#c9a24a";
  ctx.beginPath();
  ctx.arc(120, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // тёмные углы
  const vig = ctx.createRadialGradient(
    INTRO_W * 0.5, INTRO_H * 0.5, INTRO_H * 0.2,
    INTRO_W * 0.5, INTRO_H * 0.5, INTRO_W * 0.62
  );
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, INTRO_W, INTRO_H);
}

// Победа: золото, монеты, корона.
function drawGold(ctx, rng) {
  const back = ctx.createRadialGradient(
    INTRO_W * 0.5, INTRO_H * 0.45, 20,
    INTRO_W * 0.5, INTRO_H * 0.5, INTRO_W * 0.6
  );
  back.addColorStop(0, "#5a4418");
  back.addColorStop(0.5, "#241a08");
  back.addColorStop(1, "#0a0804");
  ctx.fillStyle = back;
  ctx.fillRect(0, 0, INTRO_W, INTRO_H);

  // лучи
  ctx.save();
  ctx.translate(INTRO_W * 0.5, INTRO_H * 0.44);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + rng() * 0.1;
    const len = 120 + rng() * 200;
    ctx.strokeStyle = `rgba(216, 178, 90, ${0.06 + rng() * 0.1})`;
    ctx.lineWidth = 6 + rng() * 16;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();

  // гора монет
  for (let i = 0; i < 90; i++) {
    const cx = INTRO_W * 0.5 + (rng() - 0.5) * INTRO_W * 0.72;
    const spread = 1 - Math.abs(cx - INTRO_W * 0.5) / (INTRO_W * 0.36);
    const baseY = INTRO_H * 0.96;
    const top = INTRO_H * (0.74 - spread * 0.12);
    const cy = top + rng() * (baseY - top);
    const rx = 7 + rng() * 6;
    ctx.fillStyle = rng() > 0.6 ? "#e0c45a" : "#b8963a";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, rx * 0.62, rng() * 0.6 - 0.3, 0, Math.PI * 2);
    ctx.fill();
    // блик
    ctx.fillStyle = "rgba(255, 244, 200, 0.45)";
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.25, cy - rx * 0.2, rx * 0.3, rx * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // корона по центру — с тенью и объёмом, иначе плоский жёлтый силуэт
  const crownX = INTRO_W * 0.5;
  const crownY = INTRO_H * 0.42;
  // тень под короной
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(crownX, crownY + 44, 70, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // задняя грань
  ctx.fillStyle = "#8a6a24";
  ctx.beginPath();
  ctx.moveTo(crownX - 58, crownY + 34);
  ctx.lineTo(crownX - 58, crownY);
  ctx.lineTo(crownX - 30, crownY + 18);
  ctx.lineTo(crownX, crownY - 22);
  ctx.lineTo(crownX + 30, crownY + 18);
  ctx.lineTo(crownX + 58, crownY);
  ctx.lineTo(crownX + 58, crownY + 34);
  ctx.closePath();
  ctx.fill();
  // передняя грань
  ctx.fillStyle = "#d8b25a";
  ctx.beginPath();
  ctx.moveTo(crownX - 58, crownY + 30);
  ctx.lineTo(crownX - 58, crownY - 4);
  ctx.lineTo(crownX - 30, crownY + 14);
  ctx.lineTo(crownX, crownY - 26);
  ctx.lineTo(crownX + 30, crownY + 14);
  ctx.lineTo(crownX + 58, crownY - 4);
  ctx.lineTo(crownX + 58, crownY + 30);
  ctx.closePath();
  ctx.fill();
  // блик по левому скату
  ctx.fillStyle = "rgba(255, 244, 200, 0.4)";
  ctx.beginPath();
  ctx.moveTo(crownX - 58, crownY - 4);
  ctx.lineTo(crownX - 30, crownY + 14);
  ctx.lineTo(crownX, crownY - 26);
  ctx.lineTo(crownX, crownY - 16);
  ctx.lineTo(crownX - 30, crownY + 20);
  ctx.lineTo(crownX - 58, crownY + 4);
  ctx.closePath();
  ctx.fill();
  // обод
  ctx.fillStyle = "#b8963a";
  ctx.fillRect(crownX - 58, crownY + 24, 116, 10);
  ctx.fillStyle = "rgba(255, 244, 200, 0.25)";
  ctx.fillRect(crownX - 58, crownY + 24, 116, 3);
  // самоцветы
  const gems = ["#8a1f2a", "#2a4a8a", "#2a7a3a", "#8a1f2a"];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = gems[i];
    ctx.beginPath();
    ctx.arc(crownX - 42 + i * 28, crownY + 29, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(crownX - 44 + i * 28, crownY + 26, 2, 2);
  }

  // блики-искры
  for (let i = 0; i < 26; i++) {
    const sx = rng() * INTRO_W;
    const sy = rng() * INTRO_H;
    const r = 1 + rng() * 2.5;
    ctx.fillStyle = `rgba(255, 248, 210, ${0.2 + rng() * 0.5})`;
    ctx.fillRect(sx, sy, r, r);
  }
}

const SCENES = {
  dusk: { draw: drawDusk, seed: "intro-dusk" },
  death: { draw: drawDeath, seed: "intro-death" },
  gold: { draw: drawGold, seed: "intro-gold" },
};

export const INTRO_KINDS = Object.keys(SCENES);

// Рисует заставку в ctx. Сид фиксирован, поэтому картинка одна и та же
// при каждом вызове — заставка не должна мерцать при перерисовке.
export function drawIntro(ctx, kind = "dusk") {
  const scene = SCENES[kind] || SCENES.dusk;
  const rng = createRng(hashSeed(scene.seed));
  scene.draw(ctx, rng);
  return { width: INTRO_W, height: INTRO_H };
}

// Отдаёт заставку готовым canvas: main.js вставляет его в DOM.
export function buildIntroCanvas(kind = "dusk", doc = globalThis.document) {
  if (!doc) return null;
  const c = doc.createElement("canvas");
  c.width = INTRO_W;
  c.height = INTRO_H;
  c.className = "intro-art";
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  drawIntro(ctx, kind);
  return c;
}
