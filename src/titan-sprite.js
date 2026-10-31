// Титан: 140×260. Один на карту, неубиваемый.
// Ключевой приём — маленькая голова на огромных плечах: мозг читает это
// как «гигант» мгновенно, независимо от деталей.
// Два состояния: calm (глаза тусклее) и hunt (глаза горят, рот открыт).

const W = 140;
const H = 260;

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

// Клочья шерсти: зубчатый край, а не ровная линия.
function furEdge(ctx, x0, x1, y, length, color, step = 5) {
  ctx.fillStyle = color;
  for (let x = x0; x < x1; x += step) {
    const h = length * (0.6 + ((x * 7) % 11) / 18);
    ctx.fillRect(x, y, step - 1, h);
  }
}

function drawTitan(ctx, hunting) {
  const SKIN = "#c9b8a4";
  const SKIN_DARK = "#a89584";
  const FUR = "#2a2320";
  const FUR_LIGHT = "#3d3430";
  const FUR_DARK = "#1a1614";

  // ── Силуэт строится овалами, а не прямоугольниками:
  // сгорбленная масса, а не робот из коробок.

  // Ноги: толстые, слегка расставлены
  oval(ctx, 46, 218, 17, 48, FUR_DARK);
  oval(ctx, 94, 218, 17, 48, FUR_DARK);
  oval(ctx, 44, 250, 20, 12, "#151210");
  oval(ctx, 96, 250, 20, 12, "#151210");

  // Бёдра и низ живота
  oval(ctx, 70, 186, 32, 26, SKIN_DARK);

  // ── Торс: широкий сверху, сужается книзу. Темнее кожи, чтобы
  // не читался как рубашка на фоне шерсти. ──
  ctx.fillStyle = "#8a7a6c";
  ctx.beginPath();
  ctx.moveTo(38, 122);
  ctx.quadraticCurveTo(70, 108, 102, 122);
  ctx.quadraticCurveTo(96, 160, 88, 186);
  ctx.quadraticCurveTo(70, 196, 52, 186);
  ctx.quadraticCurveTo(44, 160, 38, 122);
  ctx.closePath();
  ctx.fill();

  // рёбра: три коротких линии
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = "#7a6a5c";
    ctx.fillRect(48, 138 + i * 10, 44 - i * 6, 2);
  }

  // ── Шерсть по бокам торса: рваные клочья, а не полоса ──
  furEdge(ctx, 22, 50, 128, 66, FUR, 5);
  furEdge(ctx, 90, 118, 128, 66, FUR, 5);
  // шерсть наползает на живот снизу
  furEdge(ctx, 40, 100, 178, 14, FUR, 6);

  // ── Плечи: главная масса. Шире корпуса почти вдвое. ──
  oval(ctx, 70, 112, 70, 32, FUR);
  oval(ctx, 70, 100, 58, 26, FUR_LIGHT);
  // сгорбленность: горб между плеч, поднимается выше головы
  oval(ctx, 70, 90, 38, 22, FUR);
  // клочья по нижнему краю плеч
  furEdge(ctx, 4, 44, 126, 26, FUR, 6);
  furEdge(ctx, 96, 136, 126, 26, FUR, 6);
  // шерсть на плечах: короткие штрихи для фактуры
  for (let i = 0; i < 14; i++) {
    const x = 18 + (i * 9) % 104;
    px(ctx, x, 104 + (i % 4) * 5, 2, 5, FUR_DARK);
  }

  // ── Левая рука с валуном: поднята к лицу ──
  oval(ctx, 22, 148, 15, 34, FUR);
  oval(ctx, 24, 182, 12, 14, SKIN_DARK);

  // валун — крупный, неровный
  ctx.fillStyle = "#63615a";
  ctx.beginPath();
  ctx.moveTo(2, 132);
  ctx.lineTo(28, 114);
  ctx.lineTo(52, 126);
  ctx.lineTo(46, 160);
  ctx.lineTo(14, 162);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#8a877e";
  ctx.beginPath();
  ctx.moveTo(28, 114);
  ctx.lineTo(52, 126);
  ctx.lineTo(38, 134);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#4a4842";
  ctx.beginPath();
  ctx.moveTo(14, 162);
  ctx.lineTo(46, 160);
  ctx.lineTo(40, 170);
  ctx.lineTo(18, 170);
  ctx.closePath();
  ctx.fill();
  // пальцы поверх камня
  for (let i = 0; i < 4; i++) {
    oval(ctx, 12 + i * 6, 142, 3, 10, SKIN);
  }

  // ── Правая рука: опущена, сжата ──
  oval(ctx, 116, 154, 14, 32, FUR);
  oval(ctx, 116, 190, 11, 12, SKIN_DARK);
  for (let i = 0; i < 4; i++) {
    oval(ctx, 108 + i * 5, 202, 2, 6, SKIN);
  }

  // ── Шея: короткая, утоплена в плечи ──
  oval(ctx, 70, 88, 13, 12, SKIN_DARK);

  // ── Голова: маленькая относительно плеч. Это и даёт гиганта. ──
  oval(ctx, 70, 64, 15, 20, SKIN);
  oval(ctx, 70, 77, 11, 8, SKIN);

  // ── Волосы: тёмные пряди, закрывают половину лица ──
  oval(ctx, 70, 50, 18, 15, FUR_DARK);
  oval(ctx, 54, 66, 6, 22, FUR_DARK);
  oval(ctx, 86, 64, 6, 20, FUR_DARK);
  for (let i = 0; i < 6; i++) {
    oval(ctx, 56 + i * 5, 50, 2, 8 + (i % 3) * 4, FUR_DARK);
  }

  // ── Глаза: два пикселя чистого красного, без блика. ──
  if (hunting) {
    px(ctx, 61, 63, 5, 4, "#ff2a1a");
    px(ctx, 74, 63, 5, 4, "#ff2a1a");
    ctx.fillStyle = "rgba(255, 42, 26, 0.25)";
    ctx.fillRect(57, 60, 12, 10);
    ctx.fillRect(71, 60, 12, 10);
  } else {
    px(ctx, 61, 63, 5, 3, "#7a1c14");
    px(ctx, 74, 63, 5, 3, "#7a1c14");
  }

  // ── Рот ──
  if (hunting) {
    oval(ctx, 70, 80, 9, 5, "#2a0e0c");
    for (let i = 0; i < 5; i++) {
      px(ctx, 62 + i * 4, 78, 2, 4, "#d8d0c4");
    }
  } else {
    px(ctx, 63, 80, 14, 2, "#3a1a16");
  }

  // ── Кровь на подбородке: он ест людей ──
  px(ctx, 66, 84, 3, 5, "#7e1518");
  px(ctx, 72, 85, 2, 3, "#7e1518");
  px(ctx, 69, 88, 2, 2, "#5e0f12");
}

export function buildTitan({ hunting = false } = {}) {
  return make(W, H, (ctx) => {
    ctx.imageSmoothingEnabled = false;
    drawTitan(ctx, hunting);
  });
}

export { W as TITAN_W, H as TITAN_H };
