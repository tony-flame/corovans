// Куртизанки: четыре стиля, 96×184. Рисуем кодом, без внешних ассетов.
// Стиль приходит из места (square/inn/forest/camp), цвета — из варианта.
// Второй параметр bloodied добавляет пятна крови поверх.

const W = 96;
const H = 184;

// Своя копия make: модуль не должен зависеть от порядка импортов в sprites.js.
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

// Общая голова: кожа, глаза с радужкой и бликом, брови, нос, губы, румяна.
// Возвращает точку, где заканчивается шея — для ожерелий.
// Экспортируется: гражданские в person.js рисуются той же головой,
// иначе в одной сцене живут два несогласованных лица.
export function head(ctx, opts) {
  const {
    skin = "#e8c4a8",
    skinShadow = "#c9a084",
    hair = "#7a4a2a",
    hairLight = null,
    eyeColor = "#3a5a7a",
    hairstyle = "long",
    brow = "#4a3020",
    beard = "none",
    beardColor = null,
  } = opts;

  // Шея
  px(ctx, 42, 40, 12, 14, skinShadow);
  px(ctx, 43, 40, 10, 13, skin);

  // Волосы СЗАДИ: чуть шире лица, но лицо рисуется поверх.
  if (hairstyle === "long") {
    oval(ctx, 48, 26, 19, 21, hair);
    px(ctx, 30, 26, 7, 44, hair);
    px(ctx, 60, 26, 7, 44, hair);
  } else if (hairstyle === "tail") {
    oval(ctx, 48, 24, 18, 18, hair);
    oval(ctx, 68, 30, 6, 8, hair);
    px(ctx, 66, 34, 6, 26, hair);
    oval(ctx, 68, 60, 4, 5, hair);
  } else if (hairstyle === "updo") {
    // Собранные волосы: гладкий верх и пучок сзади.
    oval(ctx, 48, 24, 17, 16, hair);
    px(ctx, 34, 26, 4, 14, hair);
    px(ctx, 58, 26, 4, 14, hair);
    oval(ctx, 48, 8, 9, 7, hair);
    // ободок
    px(ctx, 36, 22, 24, 1, hairLight || "rgba(255,255,255,0.25)");
  }

  // ЛИЦО: овал уже волос, поверх них.
  oval(ctx, 48, 28, 13, 17, skin);
  // мягкая тень у скул, не отдельным пятном
  oval(ctx, 48, 37, 9, 6, skinShadow);
  oval(ctx, 48, 34, 11, 9, skin);

  // Пряди у лица — только по краю, не на щеках.
  px(ctx, 35, 24, 2, 22, hairLight || hair);
  px(ctx, 59, 24, 2, 22, hairLight || hair);

  // Брови — симметрично вокруг центра 48.
  px(ctx, 39, 22, 6, 1, brow);
  px(ctx, 51, 22, 6, 1, brow);

  // Глаза: центры 42.5 и 53.5, симметрично относительно 48.
  for (const ex of [40, 51]) {
    px(ctx, ex, 26, 5, 3, "#f0e8dc");
    px(ctx, ex + 1, 26, 2, 3, eyeColor);
    px(ctx, ex + 1, 27, 1, 1, "#120d0a");
    px(ctx, ex - 1, 25, 7, 1, "#2a1e16");
  }

  // Нос
  px(ctx, 47, 30, 2, 3, skinShadow);

  // Губы: уже и мягче.
  px(ctx, 45, 38, 7, 1, "#a8343f");
  px(ctx, 46, 39, 5, 2, "#c24a56");
  px(ctx, 47, 39, 2, 1, "#e07a86");

  // Румяна — едва заметные
  oval(ctx, 38, 33, 3, 2, "rgba(200,120,120,0.28)");
  oval(ctx, 58, 33, 3, 2, "rgba(200,120,120,0.28)");

  // Борода: у мужчин лицо другое, иначе все выглядят как женщины.
  if (beard === "full" || beard === "short") {
    const bc = beardColor || hair;
    // щёки и подбородок
    oval(ctx, 48, 40, 11, 8, bc);
    if (beard === "full") {
      oval(ctx, 48, 44, 9, 10, bc);
      px(ctx, 40, 38, 4, 8, bc);
      px(ctx, 53, 38, 4, 8, bc);
    }
    // усы поверх губы
    px(ctx, 43, 36, 11, 2, bc);
    // губы снова видны между усами и бородой
    px(ctx, 46, 38, 5, 2, "#9c4650");
  }

  return { neckY: 54 };
}

// Кровь: пятна на щеке, шее, груди. Не для всех стилей.
export function blood(ctx) {
  const spots = [
    [58, 24, 2, 3],
    [61, 29, 1, 2],
    [55, 33, 2, 2],
    [63, 36, 1, 3],
    [46, 50, 2, 3],
    [52, 57, 1, 2],
    [43, 62, 2, 2],
  ];
  for (const [x, y, w, h] of spots) px(ctx, x, y, w, h, "#7e1518");
}

// ── Стиль: бальная (площадь) ──
function styleBall(ctx, v) {
  const dress = v.dress?.css || "#6d1f2e";
  const hair = v.hair?.css || "#e8e2c8";

  // подол
  ctx.fillStyle = dress;
  ctx.beginPath();
  ctx.moveTo(48, 66);
  ctx.lineTo(76, 172);
  ctx.lineTo(20, 172);
  ctx.closePath();
  ctx.fill();
  // складки
  for (const fx of [30, 40, 56, 66]) {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(fx, 74, 2, 96);
  }
  // блик ткани
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.beginPath();
  ctx.moveTo(48, 68);
  ctx.lineTo(54, 170);
  ctx.lineTo(48, 170);
  ctx.closePath();
  ctx.fill();

  // корсет
  px(ctx, 36, 62, 24, 34, dress);
  px(ctx, 47, 62, 2, 34, "rgba(0,0,0,0.3)");
  // вырез
  oval(ctx, 48, 66, 8, 6, "#e8c4a8");
  px(ctx, 40, 62, 16, 5, "#e8c4a8");

  // руки
  px(ctx, 30, 64, 7, 30, "#e8c4a8");
  px(ctx, 59, 64, 7, 30, "#e8c4a8");
  // перчатки
  px(ctx, 30, 88, 7, 10, dress);
  px(ctx, 59, 88, 7, 10, dress);

  head(ctx, { hair, hairstyle: "long", eyeColor: "#3a6a8a" });

  // ожерелье
  px(ctx, 40, 58, 16, 2, "#c9a24a");
  oval(ctx, 48, 62, 2, 2, "#e8d07a");

  // веер
  ctx.fillStyle = "#efe6d2";
  ctx.beginPath();
  ctx.moveTo(68, 74);
  ctx.lineTo(86, 54);
  ctx.lineTo(82, 84);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#8a7d68";
  ctx.lineWidth = 1;
  ctx.stroke();

  // перья в волосах
  oval(ctx, 66, 14, 4, 10, "#a8303c");
  oval(ctx, 71, 18, 3, 8, "#d8b25a");
}

// ── Стиль: деловая (корчма) — очки, хвост, пиджак, сигарета ──
function styleBusiness(ctx, v) {
  const hair = v.hair?.css || "#2a2018";
  const suit = "#1c1c22";
  const suitLight = "#2a2a32";

  // ноги в чулках
  px(ctx, 38, 140, 8, 40, "#14141a");
  px(ctx, 50, 140, 8, 40, "#14141a");
  // туфли
  px(ctx, 36, 172, 11, 8, "#0e0e12");
  px(ctx, 49, 172, 11, 8, "#0e0e12");

  // пиджак: длинный, свободный
  ctx.fillStyle = suit;
  ctx.beginPath();
  ctx.moveTo(48, 62);
  ctx.lineTo(76, 150);
  ctx.lineTo(20, 150);
  ctx.closePath();
  ctx.fill();
  // лацканы
  ctx.fillStyle = suitLight;
  ctx.beginPath();
  ctx.moveTo(48, 64);
  ctx.lineTo(38, 96);
  ctx.lineTo(48, 110);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(48, 64);
  ctx.lineTo(58, 96);
  ctx.lineTo(48, 110);
  ctx.closePath();
  ctx.fill();

  // рубашка под пиджаком
  px(ctx, 43, 62, 10, 40, "#d8d2c4");
  // чокер
  px(ctx, 42, 56, 12, 3, "#101014");

  // руки
  px(ctx, 26, 66, 7, 44, suit);
  px(ctx, 63, 66, 7, 44, suit);
  px(ctx, 26, 104, 7, 8, "#e0bda2");
  px(ctx, 63, 104, 7, 8, "#e0bda2");

  head(ctx, {
    hair,
    hairstyle: "tail",
    eyeColor: "#4a5a48",
    skin: "#e6c6ac",
    brow: "#2a1e16",
  });

  // очки: оправа и дужки
  px(ctx, 38, 25, 9, 1, "#15151a");
  px(ctx, 51, 25, 9, 1, "#15151a");
  px(ctx, 38, 30, 9, 1, "#15151a");
  px(ctx, 51, 30, 9, 1, "#15151a");
  px(ctx, 38, 25, 1, 6, "#15151a");
  px(ctx, 46, 25, 1, 6, "#15151a");
  px(ctx, 51, 25, 1, 6, "#15151a");
  px(ctx, 59, 25, 1, 6, "#15151a");
  px(ctx, 47, 27, 4, 1, "#15151a");

  // сигарета у губ
  px(ctx, 57, 40, 6, 1, "#e8e0d0");
  px(ctx, 63, 40, 2, 1, "#c94a3e");
  // дым: тонкая струйка
  ctx.fillStyle = "rgba(220, 224, 230, 0.35)";
  ctx.beginPath();
  ctx.moveTo(66, 38);
  ctx.quadraticCurveTo(72, 22, 66, 8);
  ctx.lineTo(70, 8);
  ctx.quadraticCurveTo(76, 24, 70, 38);
  ctx.closePath();
  ctx.fill();
}

// ── Стиль: готическая (лесная сторожка) — платина, камзол с мехом ──
function styleGothic(ctx, v) {
  const hair = "#e8e6de";
  const hairLight = "#f4f2ea";
  const coat = "#15161c";
  const fur = "#3a3a42";

  // тёмная юбка шире — силуэт не должен быть палкой
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(48, 96);
  ctx.lineTo(78, 176);
  ctx.lineTo(18, 176);
  ctx.closePath();
  ctx.fill();
  // блик по ткани
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.moveTo(48, 98);
  ctx.lineTo(58, 174);
  ctx.lineTo(48, 174);
  ctx.closePath();
  ctx.fill();

  // камзол
  px(ctx, 30, 58, 36, 48, coat);
  // меховая отделка по бортам
  px(ctx, 30, 58, 7, 48, fur);
  px(ctx, 59, 58, 7, 48, fur);
  for (let y = 60; y < 106; y += 5) {
    oval(ctx, 33, y, 5, 3, fur);
    oval(ctx, 62, y, 5, 3, fur);
  }
  // плечи с мехом
  oval(ctx, 28, 62, 11, 8, fur);
  oval(ctx, 68, 62, 11, 8, fur);

  // белая блуза с вырезом
  px(ctx, 41, 60, 14, 40, "#efe9dc");
  px(ctx, 43, 70, 10, 6, "#e0d8c8");
  // шнуровка
  for (let y = 78; y < 96; y += 4) px(ctx, 47, y, 4, 1, "#b8ae98");

  // руки
  px(ctx, 21, 68, 7, 38, coat);
  px(ctx, 68, 68, 7, 38, coat);
  px(ctx, 21, 104, 7, 10, "#eae2d4");
  px(ctx, 68, 104, 7, 10, "#eae2d4");

  head(ctx, {
    hair,
    hairLight,
    hairstyle: "long",
    eyeColor: "#4a9ad8",
    skin: "#f0dcd0",
    skinShadow: "#d4b4a8",
    brow: "#8a8478",
  });

  // жемчужное ожерелье: два ряда
  for (let i = 0; i < 9; i++) {
    oval(ctx, 38 + i * 2.4, 55, 1.3, 1.3, "#efeae0");
    oval(ctx, 39 + i * 2.2, 58, 1.2, 1.2, "#e2dcd0");
  }
  // крест-подвеска
  px(ctx, 47, 61, 2, 9, "#c8c8d0");
  px(ctx, 44, 64, 8, 2, "#c8c8d0");
}

// ── Стиль: дорожная (стоянка) — плащ, кинжал, собранные волосы ──
function styleRoad(ctx, v) {
  const hair = v.hair?.css || "#6a4a2a";
  const cloak = "#3a4a52";
  const leather = "#4a3a28";

  // сапоги
  px(ctx, 36, 152, 9, 28, leather);
  px(ctx, 51, 152, 9, 28, leather);
  px(ctx, 34, 176, 13, 6, "#241a12");
  px(ctx, 49, 176, 13, 6, "#241a12");

  // штаны
  px(ctx, 38, 128, 9, 28, "#3a3028");
  px(ctx, 49, 128, 9, 28, "#3a3028");

  // плащ
  ctx.fillStyle = cloak;
  ctx.beginPath();
  ctx.moveTo(48, 62);
  ctx.lineTo(74, 150);
  ctx.lineTo(22, 150);
  ctx.closePath();
  ctx.fill();
  // подол плаща рваный
  for (let x = 22; x < 74; x += 7) px(ctx, x, 148, 4, 5, cloak);
  // застёжка
  px(ctx, 46, 74, 4, 3, "#c9a24a");

  // туника под плащом
  px(ctx, 40, 66, 16, 34, "#5a4a38");

  // руки
  px(ctx, 26, 70, 7, 36, cloak);
  px(ctx, 63, 70, 7, 36, cloak);
  px(ctx, 26, 102, 7, 9, "#d8bca4");
  px(ctx, 63, 102, 7, 9, "#d8bca4");

  head(ctx, {
    hair,
    hairstyle: "updo",
    eyeColor: "#6a5a3a",
    skin: "#d8b498",
    skinShadow: "#b89078",
  });

  // кинжал на поясе
  px(ctx, 62, 112, 3, 16, "#8a8578");
  px(ctx, 60, 108, 7, 4, "#5b4127");

  // сумка через плечо
  ctx.fillStyle = "#6b4a28";
  ctx.beginPath();
  ctx.moveTo(30, 66);
  ctx.lineTo(66, 128);
  ctx.lineTo(62, 132);
  ctx.lineTo(26, 70);
  ctx.closePath();
  ctx.fill();
  oval(ctx, 65, 132, 7, 8, "#6b4a28");
}

const STYLES = {
  ball: styleBall,
  business: styleBusiness,
  gothic: styleGothic,
  road: styleRoad,
};

// Место → стиль. Ключ привязанности совпадает с ключом места.
export const SPOT_STYLE = {
  square: "ball",
  inn: "business",
  forest: "gothic",
  camp: "road",
};

export function buildCourtesan(variant, options = {}) {
  const style = SPOT_STYLE[variant?.spot] || "ball";
  const draw = STYLES[style] || STYLES.ball;
  const bloodied = Boolean(options.bloodied);

  return make(W, H, (ctx) => {
    ctx.imageSmoothingEnabled = false;
    draw(ctx, variant || {});
    if (bloodied) blood(ctx);
  });
}

export function courtesanStyleOf(spot) {
  return SPOT_STYLE[spot] || "ball";
}

export { W as COURTESAN_W, H as COURTESAN_H };
