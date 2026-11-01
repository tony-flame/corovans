// Гражданские: 96×184, той же школы, что и куртизанки.
// Раньше они были 48×84 с глазами в два пикселя и рядом с куртизанкой
// выглядели картонными болванчиками. Голова берётся из courtesan-sprite.js
// (head), чтобы в одной сцене не жили два разных лица.
//
// Координаты тела: шея кончается на y≈54, плечи y≈60, земля y=184.

import { head, blood as bloodSpots } from "./courtesan-sprite.js";

const W = 96;
const H = 184;

function make(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  return c;
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function oval(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function poly(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

// Мягкая вертикальная тень по центру ткани — объём без градиентов.
function foldShade(ctx, x, y, w, h, alpha = 0.16) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fillRect(x, y, w, h);
}

// ── Крестьянка: длинная юбка, платок, корзина ──
function peasantWoman(ctx) {
  const skirt = "#5a4a38";
  const blouse = "#a89478";
  const shawl = "#7a3a34";

  // юбка
  poly(ctx, [[34, 92], [62, 92], [72, 184], [24, 184]], skirt);
  // складки
  for (const fx of [36, 46, 56, 66]) {
    foldShade(ctx, fx, 96, 2, 86, 0.2);
  }
  // передник
  poly(ctx, [[41, 96], [55, 96], [58, 178], [38, 178]], "#b8a888");
  foldShade(ctx, 47, 100, 2, 76, 0.12);

  // кофта
  px(ctx, 34, 62, 28, 34, blouse);
  foldShade(ctx, 44, 62, 2, 34, 0.14);
  // рукава
  px(ctx, 26, 66, 10, 34, blouse);
  px(ctx, 60, 66, 10, 34, blouse);
  // кисти
  px(ctx, 27, 98, 9, 10, "#c9a07a");
  px(ctx, 60, 98, 9, 10, "#c9a07a");

  // платок на плечах
  poly(ctx, [[32, 62], [64, 62], [58, 82], [48, 92], [38, 82]], shawl);
  px(ctx, 36, 62, 24, 3, "#8d4640");

  // корзина в руке
  poly(ctx, [[68, 104], [84, 104], [81, 122], [71, 122]], "#8a6a3a");
  px(ctx, 67, 101, 18, 3, "#a8894f");
  oval(ctx, 73, 101, 4, 3, "#c94a3e");
  oval(ctx, 80, 100, 4, 3, "#b8a23a");

  head(ctx, {
    skin: "#d8ae8a",
    skinShadow: "#b88f68",
    hair: "#5a3a22",
    hairstyle: "updo",
    eyeColor: "#4a4238",
    brow: "#4a3020",
  });
  // Платок только на макушке: опущенный ниже, он закрывал глаза и рот.
  poly(ctx, [[31, 22], [65, 22], [64, 14], [48, 9], [32, 14]], shawl);
  px(ctx, 34, 18, 28, 3, "#8d4640");
  // концы платка по бокам, у щёк, а не на лице
  px(ctx, 29, 22, 4, 14, shawl);
  px(ctx, 63, 22, 4, 14, shawl);
}

// ── Крестьянин: рубаха, жилет, лапти ──
function peasantMan(ctx) {
  const shirt = "#b8a888";
  const vest = "#4a3a28";
  const pants = "#3a3228";

  // штаны
  px(ctx, 34, 128, 12, 48, pants);
  px(ctx, 50, 128, 12, 48, pants);
  foldShade(ctx, 44, 132, 2, 44, 0.18);
  // лапти
  px(ctx, 32, 176, 16, 8, "#6a5436");
  px(ctx, 48, 176, 16, 8, "#6a5436");
  // обмотки
  px(ctx, 34, 158, 12, 6, "#8a7450");
  px(ctx, 50, 158, 12, 6, "#8a7450");

  // рубаха
  px(ctx, 30, 62, 36, 70, shirt);
  foldShade(ctx, 45, 62, 3, 70, 0.12);
  // жилет
  px(ctx, 30, 66, 11, 64, vest);
  px(ctx, 55, 66, 11, 64, vest);
  // пуговицы
  for (let i = 0; i < 4; i++) px(ctx, 47, 74 + i * 14, 2, 2, "#c9a24a");
  // пояс
  px(ctx, 30, 124, 36, 6, "#3a2a1c");
  px(ctx, 45, 123, 6, 8, "#8a6a3a");

  // руки
  px(ctx, 22, 68, 9, 46, shirt);
  px(ctx, 65, 68, 9, 46, shirt);
  px(ctx, 23, 110, 8, 12, "#c9a07a");
  px(ctx, 65, 110, 8, 12, "#c9a07a");

  // вилы в руке
  px(ctx, 78, 40, 3, 130, "#6b4a2a");
  px(ctx, 74, 36, 3, 22, "#8a9098");
  px(ctx, 82, 36, 3, 22, "#8a9098");
  px(ctx, 74, 56, 11, 3, "#8a9098");

  head(ctx, {
    skin: "#c9a07a",
    skinShadow: "#a8805c",
    hair: "#4a3020",
    hairstyle: "updo",
    eyeColor: "#4a4238",
    brow: "#3a2418",
    beard: "short",
    beardColor: "#5a3f28",
  });
  // шапка
  oval(ctx, 48, 20, 15, 8, "#6a5436");
  px(ctx, 33, 22, 30, 5, "#7d6542");
}

// ── Торговка зеленью: фартук, лоток, пучки зелени ──
function greengrocer(ctx) {
  const dress = "#5e6a3a";
  const apron = "#d8d0b8";

  // юбка
  poly(ctx, [[32, 96], [64, 96], [74, 184], [22, 184]], dress);
  for (const fx of [34, 44, 54, 64]) foldShade(ctx, fx, 100, 2, 82, 0.18);
  // фартук
  poly(ctx, [[38, 98], [58, 98], [62, 180], [34, 180]], apron);
  foldShade(ctx, 48, 102, 2, 76, 0.1);
  // карман
  px(ctx, 41, 128, 14, 12, "#c4bca4");
  px(ctx, 41, 128, 14, 1, "#a8a08c");

  // лиф
  px(ctx, 33, 62, 30, 38, dress);
  px(ctx, 34, 62, 28, 3, "#6e7a46");
  // руки
  px(ctx, 25, 66, 10, 40, "#c9a07a");
  px(ctx, 61, 66, 10, 40, "#c9a07a");

  // лоток на руках
  px(ctx, 18, 104, 60, 5, "#8a6a3a");
  px(ctx, 18, 109, 3, 10, "#6a5436");
  px(ctx, 75, 109, 3, 10, "#6a5436");
  // зелень на лотке
  for (const [x, c] of [[24, "#3f6a32"], [33, "#4f7a3a"], [42, "#8a9a3a"], [51, "#3f6a32"], [60, "#6a8a3a"], [69, "#4f7a3a"]]) {
    oval(ctx, x, 100, 5, 5, c);
    oval(ctx, x + 1, 98, 3, 3, "#7aa054");
  }

  head(ctx, {
    skin: "#d8ae8a",
    skinShadow: "#b88f68",
    hair: "#6a4a2a",
    hairstyle: "updo",
    eyeColor: "#4a4238",
    brow: "#4a3020",
  });
  // Косынка на макушке, не на лице.
  poly(ctx, [[31, 22], [65, 22], [64, 14], [48, 9], [32, 14]], "#c2b48a");
  px(ctx, 34, 18, 28, 3, "#d2c49a");
  px(ctx, 29, 22, 4, 10, "#c2b48a");
  px(ctx, 63, 22, 4, 10, "#c2b48a");
}

// ── Пьяница: мятая рубаха, фляга, красный нос ──
function drunk(ctx) {
  const shirt = "#8a8272";
  const pants = "#3a3428";

  px(ctx, 33, 126, 13, 46, pants);
  px(ctx, 51, 126, 13, 46, pants);
  // один сапог снят
  px(ctx, 31, 172, 17, 10, "#3a2a1c");
  px(ctx, 53, 174, 15, 8, "#8a7450");
  foldShade(ctx, 43, 130, 2, 42, 0.2);

  // рубаха, наполовину выправлена
  px(ctx, 28, 62, 40, 68, shirt);
  foldShade(ctx, 46, 62, 3, 68, 0.14);
  // расстёгнутый ворот
  poly(ctx, [[40, 62], [56, 62], [48, 82]], "#c9a07a");
  // пятно
  oval(ctx, 36, 108, 7, 5, "#6a6252");
  // ремень на бёдрах
  px(ctx, 28, 122, 40, 5, "#2a2018");

  // руки
  px(ctx, 20, 66, 9, 44, shirt);
  px(ctx, 67, 64, 9, 40, shirt);
  px(ctx, 21, 108, 8, 10, "#c9a07a");
  px(ctx, 67, 102, 8, 10, "#c9a07a");

  // фляга у рта
  px(ctx, 70, 96, 12, 16, "#5a4a32");
  px(ctx, 72, 92, 8, 5, "#6a5a3e");
  px(ctx, 74, 90, 4, 3, "#4a3a26");

  head(ctx, {
    skin: "#c9a07a",
    skinShadow: "#a8805c",
    hair: "#6a6058",
    hairstyle: "updo",
    eyeColor: "#5a5248",
    brow: "#5a5048",
    beard: "short",
    beardColor: "#8a8078",
  });
  // красный нос и опухшие глаза
  oval(ctx, 48, 31, 4, 4, "#c0564a");
  px(ctx, 39, 26, 7, 1, "#8a4a44");
  px(ctx, 51, 26, 7, 1, "#8a4a44");
  // помятая шапка
  oval(ctx, 48, 18, 14, 7, "#4a4038");
  px(ctx, 36, 20, 24, 3, "#5a5048");
}

// ── Нищий: рваный плащ, чаша, босые ноги ──
function beggar(ctx) {
  const cloak = "#4a4038";
  const patch = "#6a5a48";

  // босые ноги
  px(ctx, 38, 168, 8, 16, "#b88f68");
  px(ctx, 52, 168, 8, 16, "#b88f68");
  oval(ctx, 41, 182, 6, 3, "#a8805c");
  oval(ctx, 55, 182, 6, 3, "#a8805c");

  // рваный плащ до земли
  poly(ctx, [[28, 62], [68, 62], [76, 176], [62, 168], [56, 178], [46, 166], [38, 176], [22, 176]], cloak);
  foldShade(ctx, 46, 66, 3, 110, 0.2);
  // заплаты
  px(ctx, 34, 104, 12, 10, patch);
  px(ctx, 54, 130, 10, 9, patch);
  px(ctx, 40, 148, 9, 8, patch);
  // дыры
  oval(ctx, 30, 140, 3, 4, "#2a2420");
  oval(ctx, 62, 118, 3, 3, "#2a2420");

  // капюшон
  poly(ctx, [[30, 56], [66, 56], [64, 30], [48, 20], [32, 30]], cloak);
  oval(ctx, 48, 36, 12, 14, "#2a2420");

  // руки с чашей
  px(ctx, 24, 84, 8, 22, "#b88f68");
  px(ctx, 64, 84, 8, 18, "#b88f68");
  poly(ctx, [[38, 118], [58, 118], [55, 130], [41, 130]], "#7a6a4a");
  px(ctx, 37, 116, 22, 3, "#9a8a62");
  oval(ctx, 48, 116, 9, 2, "#3a3028");

  head(ctx, {
    skin: "#b88f68",
    skinShadow: "#96704e",
    hair: "#5a5048",
    hairstyle: "updo",
    eyeColor: "#4a4238",
    brow: "#4a4038",
    beard: "full",
    beardColor: "#8a8078",
  });
}

// ── Путник: плащ, посох, котомка ──
function traveler(ctx) {
  const cloak = "#3a4a5a";
  const cloakLight = "#4a5a6a";

  // сапоги
  px(ctx, 34, 156, 12, 28, "#3a2a1e");
  px(ctx, 50, 156, 12, 28, "#3a2a1e");
  px(ctx, 32, 176, 15, 8, "#2a1e14");
  px(ctx, 49, 176, 15, 8, "#2a1e14");

  // плащ с разрезом
  poly(ctx, [[30, 60], [66, 60], [74, 172], [22, 172]], cloak);
  foldShade(ctx, 47, 62, 3, 108, 0.22);
  // подкладка видна в разрезе
  poly(ctx, [[44, 66], [52, 66], [56, 168], [40, 168]], cloakLight);
  // застёжка
  oval(ctx, 48, 70, 4, 4, "#c9a24a");
  // капюшон откинут
  poly(ctx, [[30, 58], [66, 58], [60, 44], [48, 40], [36, 44]], cloakLight);

  // руки
  px(ctx, 22, 72, 9, 44, cloak);
  px(ctx, 65, 72, 9, 44, cloak);
  px(ctx, 23, 112, 8, 10, "#c9a07a");
  px(ctx, 65, 110, 8, 10, "#c9a07a");

  // посох
  px(ctx, 76, 44, 4, 136, "#5b4127");
  oval(ctx, 78, 42, 5, 4, "#6b4f30");

  // котомка через плечо
  ctx.strokeStyle = "#7a5a3a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(38, 64);
  ctx.lineTo(66, 100);
  ctx.stroke();
  oval(ctx, 70, 106, 11, 10, "#6b5a3a");
  px(ctx, 68, 98, 6, 4, "#5a4a2e");

  head(ctx, {
    skin: "#c9a07a",
    skinShadow: "#a8805c",
    hair: "#4a3020",
    hairstyle: "updo",
    eyeColor: "#3a4a5a",
    brow: "#3a2418",
    beard: "short",
    beardColor: "#4a3020",
  });
  // шляпа с полями
  oval(ctx, 48, 20, 19, 5, "#4a3a28");
  oval(ctx, 48, 13, 10, 8, "#4a3a28");
  px(ctx, 39, 17, 18, 2, "#c9a24a");
}

// ── Священник: ряса со столами, молитвенник, посох с крестом ──
function priest(ctx) {
  const robe = "#241f2e";
  const robeLight = "#332c40";

  // подол рясы
  poly(ctx, [[32, 60], [64, 60], [74, 184], [22, 184]], robe);
  for (const fx of [32, 44, 56, 66]) foldShade(ctx, fx, 64, 3, 118, 0.24);
  // столы — светлые вертикальные полосы
  px(ctx, 40, 60, 3, 124, robeLight);
  px(ctx, 53, 60, 3, 124, robeLight);
  // пояс-шнур
  px(ctx, 30, 118, 36, 4, "#4a4058");
  oval(ctx, 48, 122, 3, 5, "#4a4058");

  // руки с молитвенником
  px(ctx, 24, 70, 9, 42, robe);
  px(ctx, 63, 70, 9, 42, robe);
  px(ctx, 25, 108, 8, 10, "#c9a07a");
  px(ctx, 63, 108, 8, 10, "#c9a07a");
  // книга
  px(ctx, 34, 112, 28, 18, "#4a2028");
  px(ctx, 35, 113, 26, 16, "#d7cbb0");
  px(ctx, 47, 113, 2, 16, "#b8a888");
  for (let i = 0; i < 3; i++) {
    px(ctx, 38, 117 + i * 4, 8, 1, "#a89a80");
    px(ctx, 52, 117 + i * 4, 8, 1, "#a89a80");
  }

  // посох с крестом
  px(ctx, 78, 46, 4, 134, "#5b4127");
  px(ctx, 72, 44, 16, 4, "#c9a24a");
  px(ctx, 78, 32, 4, 16, "#c9a24a");

  head(ctx, {
    skin: "#d8ae8a",
    skinShadow: "#b88f68",
    hair: "#8a8078",
    hairstyle: "updo",
    eyeColor: "#3a4a5a",
    brow: "#7a7068",
    beard: "short",
    beardColor: "#a89e96",
  });
  // тонзура: выбритая макушка
  oval(ctx, 48, 16, 8, 6, "#d8ae8a");
  oval(ctx, 48, 15, 5, 4, "#c9a07a");
  // седые пряди по бокам
  px(ctx, 33, 22, 4, 12, "#a89e96");
  px(ctx, 59, 22, 4, 12, "#a89e96");
}

// ── Рыночный торговец: кафтан, фартук, весы ──
function marketTrader(ctx) {
  const coat = "#6a4a26";
  const coatLight = "#7d5a30";
  const apron = "#a08a62";

  // штаны и сапоги
  px(ctx, 34, 140, 13, 34, "#3a2a1e");
  px(ctx, 50, 140, 13, 34, "#3a2a1e");
  px(ctx, 32, 172, 16, 10, "#2a1e14");
  px(ctx, 49, 172, 16, 10, "#2a1e14");

  // кафтан
  poly(ctx, [[28, 60], [68, 60], [72, 146], [24, 146]], coat);
  foldShade(ctx, 47, 62, 3, 84, 0.18);
  // лацканы
  poly(ctx, [[40, 60], [48, 60], [44, 92]], coatLight);
  poly(ctx, [[56, 60], [48, 60], [52, 92]], coatLight);

  // фартук
  poly(ctx, [[36, 92], [60, 92], [64, 152], [32, 152]], apron);
  foldShade(ctx, 48, 96, 2, 54, 0.12);
  // карман с монетами
  px(ctx, 38, 122, 16, 12, "#8a7450");
  oval(ctx, 42, 120, 3, 3, "#c9a24a");
  oval(ctx, 48, 119, 3, 3, "#d8b45a");

  // руки
  px(ctx, 20, 66, 10, 44, coat);
  px(ctx, 66, 66, 10, 40, coat);
  px(ctx, 21, 106, 9, 10, "#c9a07a");
  px(ctx, 66, 102, 9, 10, "#c9a07a");

  // весы в руке
  px(ctx, 74, 60, 3, 56, "#8a6a3a");
  px(ctx, 62, 62, 28, 3, "#8a6a3a");
  px(ctx, 61, 65, 1, 12, "#6a5436");
  px(ctx, 90, 65, 1, 12, "#6a5436");
  oval(ctx, 61, 78, 7, 3, "#a8894f");
  oval(ctx, 90, 78, 7, 3, "#a8894f");
  oval(ctx, 61, 76, 5, 2, "#c9a24a");

  head(ctx, {
    skin: "#c9a07a",
    skinShadow: "#a8805c",
    hair: "#3a2a1e",
    hairstyle: "updo",
    eyeColor: "#4a3a28",
    brow: "#2a1e14",
    beard: "short",
    beardColor: "#3a2a1e",
  });
  // шапка с меховой опушкой
  px(ctx, 32, 12, 32, 9, "#3a2a1e");
  px(ctx, 32, 20, 32, 3, "#7a6a58");
  px(ctx, 36, 8, 24, 5, "#4a3626");
}

// ── Стражник ратуши: кираса, алебарда, тяжёлый плащ ──
function throneGuard(ctx) {
  const cloak = "#2a1e2e";
  const steel = "#5a6068";
  const steelLight = "#767c86";

  // сапоги
  px(ctx, 32, 156, 14, 28, "#22242a");
  px(ctx, 50, 156, 14, 28, "#22242a");
  px(ctx, 30, 176, 17, 8, "#15171c");
  px(ctx, 49, 176, 17, 8, "#15171c");

  // плащ за спиной шире плеч
  poly(ctx, [[26, 58], [70, 58], [82, 176], [14, 176]], cloak);
  foldShade(ctx, 48, 62, 3, 112, 0.25);

  // кольчуга на ногах
  px(ctx, 34, 132, 12, 26, "#4a5058");
  px(ctx, 50, 132, 12, 26, "#4a5058");

  // кираса
  poly(ctx, [[30, 62], [66, 62], [70, 128], [26, 128]], steel);
  px(ctx, 30, 62, 36, 3, steelLight);
  px(ctx, 32, 76, 32, 2, steelLight);
  px(ctx, 32, 96, 32, 2, steelLight);
  // центральное ребро
  px(ctx, 47, 64, 2, 62, "#4a5058");
  // ремень
  px(ctx, 28, 120, 40, 6, "#2a1e14");
  oval(ctx, 48, 123, 5, 5, "#c9a24a");

  // наплечники
  oval(ctx, 28, 64, 12, 10, steelLight);
  oval(ctx, 68, 64, 12, 10, steelLight);
  oval(ctx, 28, 62, 9, 7, "#8a9098");
  oval(ctx, 68, 62, 9, 7, "#8a9098");

  // руки в кольчуге
  px(ctx, 20, 72, 9, 44, "#4a5058");
  px(ctx, 67, 72, 9, 44, "#4a5058");
  px(ctx, 21, 114, 8, 10, steel);
  px(ctx, 67, 114, 8, 10, steel);

  // алебарда
  px(ctx, 84, 16, 4, 160, "#4a3a26");
  poly(ctx, [[86, 12], [94, 30], [86, 46]], "#9aa0a8");
  px(ctx, 84, 30, 8, 3, "#8a9098");
  poly(ctx, [[86, 160], [90, 148], [82, 148]], "#8a9098");

  head(ctx, {
    skin: "#c9a07a",
    skinShadow: "#a8805c",
    hair: "#3a2a1e",
    hairstyle: "updo",
    eyeColor: "#3a4a5a",
    brow: "#3a2418",
    beard: "short",
    beardColor: "#4a3626",
  });
  // шлем-бацинет
  oval(ctx, 48, 20, 17, 14, steelLight);
  px(ctx, 31, 20, 34, 8, steelLight);
  px(ctx, 31, 26, 34, 3, "#3a4048");
  // прорезь для глаз
  px(ctx, 38, 24, 8, 3, "#15171c");
  px(ctx, 50, 24, 8, 3, "#15171c");
  // наносник
  px(ctx, 46, 22, 4, 12, "#5a6068");
  // плюмаж
  px(ctx, 46, 2, 4, 10, "#7a1f1f");
  oval(ctx, 48, 4, 7, 4, "#8a2a2a");
}

const BODIES = {
  peasant_w: peasantWoman,
  peasant_m: peasantMan,
  greengrocer: greengrocer,
  drunk: drunk,
  beggar: beggar,
  traveler: traveler,
  priest: priest,
  market_trader: marketTrader,
  throne_guard: throneGuard,
};

// Список видов, для которых есть большой спрайт.
export const PERSON_KINDS = Object.keys(BODIES);

export const PERSON_W = W;
export const PERSON_H = H;

// Опции по умолчанию: часть гражданских в крови, часть нет.
// Это косметика, кровь не влияет ни на что в логике.
export function buildPerson(kind, options = {}) {
  const draw = BODIES[kind];
  if (!draw) return null;

  return make(W, H, (ctx) => {
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
    if (options.bloodied) bloodSpots(ctx);
  });
}

// Все спрайты разом: ключи совпадают с spriteKey гражданских.
export function buildPeople() {
  const out = {};
  for (const kind of PERSON_KINDS) {
    out[kind] = buildPerson(kind);
  }
  return out;
}
