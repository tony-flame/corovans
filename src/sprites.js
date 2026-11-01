// Спрайты рисуются кодом в offscreen-canvas — внешних ассетов нет.
function make(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  return c;
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Куртизанки переехали в courtesan-sprite.js: четыре стиля по 96×184.
export { buildCourtesan, courtesanStyleOf, SPOT_STYLE } from "./courtesan-sprite.js";

function guard(ctx, tabard, trim) {
  // копьё
  rect(ctx, 9, 6, 2, 76, "#5b4127");
  ctx.fillStyle = "#b8bcc4";
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(15, 12);
  ctx.lineTo(5, 12);
  ctx.closePath();
  ctx.fill();
  // сапоги и ноги
  rect(ctx, 16, 68, 8, 14, "#2b2119");
  rect(ctx, 28, 68, 8, 14, "#2b2119");
  rect(ctx, 18, 56, 7, 14, "#4a3a2a");
  rect(ctx, 27, 56, 7, 14, "#4a3a2a");
  // туника
  rect(ctx, 15, 32, 22, 28, tabard);
  rect(ctx, 15, 32, 22, 3, trim);
  rect(ctx, 24, 32, 4, 28, trim);
  // руки
  rect(ctx, 11, 36, 5, 18, "#7d5b3e");
  rect(ctx, 36, 34, 5, 20, "#7d5b3e");
  // голова и шлем
  ellipse(ctx, 26, 24, 8, 9, "#b98d66");
  rect(ctx, 17, 17, 18, 7, "#7d838f");
  rect(ctx, 17, 22, 18, 3, "#565c68");
  rect(ctx, 23, 25, 6, 9, "#565c68");
  // ремень
  rect(ctx, 15, 50, 22, 3, "#241a12");
  rect(ctx, 23, 49, 5, 6, "#c9a24a");
}

export function buildSprites() {
  return {
    guard: make(48, 84, (ctx) => guard(ctx, "#2f4468", "#8f7434")),
    village_guard: make(48, 84, (ctx) => guard(ctx, "#6d2b25", "#c9a24a")),

    driver: make(48, 84, (ctx) => {
      rect(ctx, 14, 70, 9, 12, "#2a2119");
      rect(ctx, 27, 70, 9, 12, "#2a2119");
      // плащ
      ctx.fillStyle = "#6b5638";
      ctx.beginPath();
      ctx.moveTo(24, 22);
      ctx.lineTo(42, 76);
      ctx.lineTo(6, 76);
      ctx.closePath();
      ctx.fill();
      rect(ctx, 20, 46, 8, 4, "#3c2f1e");
      // капюшон и лицо
      ellipse(ctx, 24, 24, 10, 11, "#5c4a2e");
      ellipse(ctx, 24, 26, 7, 8, "#a97f5b");
      ellipse(ctx, 22, 25, 1.4, 1.4, "#241a12");
      ellipse(ctx, 27, 25, 1.4, 1.4, "#241a12");
      // кнут
      ctx.strokeStyle = "#4b3520";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(38, 44);
      ctx.quadraticCurveTo(46, 56, 40, 66);
      ctx.stroke();
    }),

    // Заглушка: настоящий спрайт подставляется из buildCourtesan() по варианту.
    courtesan: make(48, 92, () => {}),

    // ── Гражданские: фон мира ──

    peasant_w: make(48, 84, (ctx) => {
      // длинная юбка и платок
      ctx.fillStyle = "#5a4a38";
      ctx.beginPath();
      ctx.moveTo(24, 38);
      ctx.lineTo(38, 82);
      ctx.lineTo(10, 82);
      ctx.closePath();
      ctx.fill();
      rect(ctx, 20, 34, 8, 22, "#6b5a44");
      rect(ctx, 14, 40, 5, 16, "#c9a882");
      rect(ctx, 29, 40, 5, 16, "#c9a882");
      ellipse(ctx, 24, 26, 8, 9, "#d8b894");
      ctx.fillStyle = "#8a3a3a";
      ctx.beginPath();
      ctx.moveTo(15, 24);
      ctx.quadraticCurveTo(24, 12, 33, 24);
      ctx.lineTo(33, 28);
      ctx.lineTo(15, 28);
      ctx.closePath();
      ctx.fill();
      rect(ctx, 21, 26, 2, 2, "#2a1d16");
      rect(ctx, 26, 26, 2, 2, "#2a1d16");
    }),

    peasant_m: make(48, 84, (ctx) => {
      rect(ctx, 17, 68, 8, 14, "#3a2a1e");
      rect(ctx, 25, 68, 8, 14, "#3a2a1e");
      rect(ctx, 16, 36, 18, 32, "#6b5638");
      rect(ctx, 20, 36, 3, 32, "#7d6644");
      rect(ctx, 12, 40, 5, 18, "#c9a882");
      rect(ctx, 33, 40, 5, 18, "#c9a882");
      ellipse(ctx, 24, 26, 8, 9, "#c9a07a");
      rect(ctx, 15, 18, 18, 6, "#4a3a28");
      rect(ctx, 16, 24, 16, 2, "#3a2a1e");
      rect(ctx, 21, 27, 2, 2, "#2a1d16");
      rect(ctx, 26, 27, 2, 2, "#2a1d16");
      // вилы
      rect(ctx, 38, 30, 2, 46, "#5b4127");
      rect(ctx, 35, 26, 8, 2, "#8a8578");
    }),

    greengrocer: make(50, 84, (ctx) => {
      ctx.fillStyle = "#4a5a3a";
      ctx.beginPath();
      ctx.moveTo(24, 40);
      ctx.lineTo(38, 82);
      ctx.lineTo(10, 82);
      ctx.closePath();
      ctx.fill();
      rect(ctx, 14, 46, 20, 4, "#8a7a4a");
      ellipse(ctx, 24, 26, 8, 9, "#d8b894");
      rect(ctx, 15, 18, 18, 7, "#c9a24a");
      rect(ctx, 21, 28, 2, 2, "#2a1d16");
      rect(ctx, 26, 28, 2, 2, "#2a1d16");
      // корзина с зеленью
      rect(ctx, 34, 60, 14, 12, "#8a6a3a");
      ellipse(ctx, 38, 60, 4, 3, "#3d632d");
      ellipse(ctx, 44, 60, 4, 3, "#547f38");
    }),

    drunk: make(48, 84, (ctx) => {
      rect(ctx, 17, 70, 8, 12, "#2b2119");
      rect(ctx, 25, 70, 8, 12, "#2b2119");
      ctx.fillStyle = "#5a4a3a";
      ctx.beginPath();
      ctx.moveTo(24, 38);
      ctx.lineTo(36, 76);
      ctx.lineTo(12, 76);
      ctx.closePath();
      ctx.fill();
      rect(ctx, 12, 44, 5, 16, "#c9a07a");
      rect(ctx, 33, 44, 5, 16, "#c9a07a");
      ellipse(ctx, 24, 27, 8, 9, "#c9a07a");
      ellipse(ctx, 21, 27, 1.6, 1.6, "#6a2a2a");
      ellipse(ctx, 27, 27, 1.6, 1.6, "#6a2a2a");
      ctx.fillStyle = "#8a7d68";
      ctx.beginPath();
      ctx.moveTo(20, 32);
      ctx.quadraticCurveTo(24, 38, 29, 32);
      ctx.closePath();
      ctx.fill();
      // бутылка
      rect(ctx, 38, 52, 5, 14, "#3a4a2a");
      rect(ctx, 39, 46, 3, 7, "#3a4a2a");
    }),

    beggar: make(48, 80, (ctx) => {
      ctx.fillStyle = "#4a4038";
      ctx.beginPath();
      ctx.moveTo(24, 44);
      ctx.lineTo(36, 78);
      ctx.lineTo(12, 78);
      ctx.closePath();
      ctx.fill();
      // капюшон
      ellipse(ctx, 24, 30, 10, 11, "#5a5048");
      ellipse(ctx, 24, 32, 7, 8, "#8a7060");
      rect(ctx, 21, 30, 2, 2, "#2a1d16");
      rect(ctx, 26, 30, 2, 2, "#2a1d16");
      rect(ctx, 12, 48, 5, 14, "#8a7060");
      // чашка
      ellipse(ctx, 38, 68, 5, 4, "#6b6357");
    }),

    traveler: make(48, 86, (ctx) => {
      rect(ctx, 17, 72, 8, 12, "#3a2a1e");
      rect(ctx, 25, 72, 8, 12, "#3a2a1e");
      // плащ
      ctx.fillStyle = "#3a4a5a";
      ctx.beginPath();
      ctx.moveTo(24, 30);
      ctx.lineTo(38, 76);
      ctx.lineTo(10, 76);
      ctx.closePath();
      ctx.fill();
      rect(ctx, 12, 42, 5, 18, "#c9a882");
      rect(ctx, 33, 42, 5, 18, "#c9a882");
      ellipse(ctx, 24, 24, 8, 9, "#c9a07a");
      rect(ctx, 14, 15, 20, 5, "#4a3a28");
      rect(ctx, 16, 20, 16, 2, "#3a2a1e");
      rect(ctx, 21, 25, 2, 2, "#2a1d16");
      rect(ctx, 26, 25, 2, 2, "#2a1d16");
      // посох и котомка
      rect(ctx, 38, 34, 2, 44, "#5b4127");
      ellipse(ctx, 12, 60, 6, 7, "#6b5a3a");
    }),

    merchant: make(48, 84, (ctx) => {
      rect(ctx, 16, 72, 7, 10, "#2a2119");
      rect(ctx, 27, 72, 7, 10, "#2a2119");
      ctx.fillStyle = "#4c2a55";
      ctx.beginPath();
      ctx.moveTo(24, 20);
      ctx.lineTo(42, 78);
      ctx.lineTo(6, 78);
      ctx.closePath();
      ctx.fill();
      rect(ctx, 24, 20, 2, 58, "#7d4a88");
      rect(ctx, 10, 66, 28, 4, "#c9a24a");
      ellipse(ctx, 24, 22, 8, 9, "#b98d66");
      // борода
      ctx.fillStyle = "#d7d0c2";
      ctx.beginPath();
      ctx.moveTo(18, 26);
      ctx.quadraticCurveTo(24, 40, 30, 26);
      ctx.closePath();
      ctx.fill();
      // шляпа
      ellipse(ctx, 24, 15, 16, 4, "#3a2142");
      ellipse(ctx, 24, 9, 8, 7, "#3a2142");
      rect(ctx, 21, 6, 6, 3, "#c9a24a");
      // кошель
      ellipse(ctx, 38, 58, 5, 7, "#6b4a26");
      rect(ctx, 36, 52, 4, 3, "#c9a24a");
    }),

    wagon: make(112, 78, (ctx) => {
      // колеса
      for (const wx of [24, 86]) {
        ellipse(ctx, wx, 62, 15, 15, "#3a2918");
        ellipse(ctx, wx, 62, 11, 11, "#6b4a2a");
        ellipse(ctx, wx, 62, 3, 3, "#2a1d10");
        ctx.strokeStyle = "#3a2918";
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI;
          ctx.beginPath();
          ctx.moveTo(wx + Math.cos(a) * 11, 62 + Math.sin(a) * 11);
          ctx.lineTo(wx - Math.cos(a) * 11, 62 - Math.sin(a) * 11);
          ctx.stroke();
        }
      }
      // кузов
      rect(ctx, 8, 34, 96, 26, "#5c4026");
      rect(ctx, 8, 34, 96, 3, "#7d5b38");
      rect(ctx, 8, 56, 96, 4, "#3a2918");
      rect(ctx, 14, 38, 6, 18, "#4a321e");
      rect(ctx, 92, 38, 6, 18, "#4a321e");
      // тент
      ctx.fillStyle = "#c9b98c";
      ctx.beginPath();
      ctx.moveTo(10, 36);
      ctx.quadraticCurveTo(56, -2, 102, 36);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#8f7f57";
      ctx.lineWidth = 2;
      for (let i = 1; i < 5; i++) {
        const x = 10 + (92 / 5) * i;
        ctx.beginPath();
        ctx.moveTo(x, 36);
        ctx.quadraticCurveTo(56 + (x - 56) * 0.55, 10, x, 36);
        ctx.stroke();
      }
      ctx.strokeStyle = "#6b5b3a";
      ctx.beginPath();
      ctx.moveTo(10, 36);
      ctx.quadraticCurveTo(56, -2, 102, 36);
      ctx.stroke();
      // сундук на виду
      rect(ctx, 46, 42, 20, 12, "#7a5228");
      rect(ctx, 46, 42, 20, 2, "#c9a24a");
      rect(ctx, 54, 44, 3, 10, "#c9a24a");
    }),

    chest: make(44, 34, (ctx) => {
      rect(ctx, 4, 12, 36, 20, "#6b4623");
      rect(ctx, 4, 12, 36, 3, "#8d6335");
      ctx.fillStyle = "#7d5429";
      ctx.beginPath();
      ctx.moveTo(4, 12);
      ctx.quadraticCurveTo(22, 0, 40, 12);
      ctx.closePath();
      ctx.fill();
      rect(ctx, 4, 24, 36, 3, "#3c2915");
      rect(ctx, 18, 12, 8, 20, "#c9a24a");
      rect(ctx, 21, 20, 3, 5, "#3c2915");
      rect(ctx, 4, 16, 3, 14, "#c9a24a");
      rect(ctx, 37, 16, 3, 14, "#c9a24a");
    }),

    // Ель: конус из ярусов, тёмная хвоя.
    pine: make(64, 132, (ctx) => {
      rect(ctx, 29, 96, 7, 36, "#3a2a18");
      rect(ctx, 29, 96, 2, 36, "#4a3620");
      // ярусы снизу вверх, каждый уже предыдущего
      const tiers = [
        [32, 112, 30, 18],
        [32, 94, 26, 16],
        [32, 78, 22, 15],
        [32, 62, 17, 13],
        [32, 46, 12, 11],
        [32, 32, 7, 9],
      ];
      for (let i = 0; i < tiers.length; i++) {
        const [x, y, rx, ry] = tiers[i];
        ellipse(ctx, x, y, rx, ry, i % 2 === 0 ? "#1e3a24" : "#25452a");
      }
      // блики на хвое
      for (let i = 0; i < 18; i++) {
        const x = 10 + ((i * 29) % 44);
        const y = 30 + ((i * 41) % 82);
        ellipse(ctx, x, y, 2, 1.6, "#315a33");
      }
      // верхушка
      ellipse(ctx, 32, 22, 4, 8, "#2a4c2c");
    }),

    // Сухое дерево: голый ствол и кривые ветви.
    deadTree: make(64, 116, (ctx) => {
      rect(ctx, 28, 46, 8, 70, "#4a4038");
      rect(ctx, 28, 46, 2.5, 70, "#5a5048");
      ctx.strokeStyle = "#4a4038";
      ctx.lineWidth = 3;
      const branches = [
        [32, 66, 12, 44],
        [32, 58, 52, 36],
        [32, 78, 50, 58],
        [32, 52, 20, 26],
        [32, 86, 14, 66],
      ];
      for (const [x1, y1, x2, y2] of branches) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      // сучья второго порядка
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, 50);
      ctx.lineTo(8, 40);
      ctx.moveTo(48, 40);
      ctx.lineTo(56, 30);
      ctx.moveTo(48, 62);
      ctx.lineTo(58, 58);
      ctx.stroke();
    }),

    // Колонна: каменный столб с базой и капителью.
    pillar: make(36, 150, (ctx) => {
      rect(ctx, 12, 14, 12, 122, "#8a8578");
      rect(ctx, 13, 14, 4, 122, "#a5a094");
      rect(ctx, 18, 14, 3, 122, "#6d6b64");
      // база
      rect(ctx, 6, 130, 24, 12, "#9a9488");
      rect(ctx, 6, 130, 24, 3, "#a5a094");
      // капитель
      rect(ctx, 5, 6, 26, 10, "#9a9488");
      rect(ctx, 5, 6, 26, 3, "#b0aa9e");
      // каннелюры
      for (let x = 14; x < 23; x += 3) rect(ctx, x, 20, 1, 108, "#7a7568");
    }),

    // Алтарь: каменный блок с чашей и свечами.
    altar: make(64, 56, (ctx) => {
      rect(ctx, 6, 24, 52, 30, "#8a8578");
      rect(ctx, 6, 24, 52, 4, "#a5a094");
      rect(ctx, 10, 14, 44, 12, "#9a9488");
      rect(ctx, 10, 14, 44, 3, "#b0aa9e");
      // чаша
      ellipse(ctx, 32, 12, 9, 4, "#c9a24a");
      ellipse(ctx, 32, 11, 6, 2.5, "#8f7434");
      // свечи
      rect(ctx, 14, 4, 3, 12, "#e8e0d0");
      rect(ctx, 46, 4, 3, 12, "#e8e0d0");
      ellipse(ctx, 15.5, 2, 2, 3, "#ffcf6a");
      ellipse(ctx, 47.5, 2, 2, 3, "#ffcf6a");
      // ткань на алтаре
      rect(ctx, 12, 30, 40, 14, "#6d1f2e");
      rect(ctx, 12, 30, 40, 2, "#c9a24a");
    }),

    // Трон: высокое кресло.
    throne: make(56, 92, (ctx) => {
      rect(ctx, 10, 40, 36, 42, "#4a3a28");
      rect(ctx, 12, 42, 32, 38, "#6d1f2e");
      rect(ctx, 24, 42, 8, 38, "#c9a24a");
      // спинка
      rect(ctx, 10, 8, 36, 34, "#4a3a28");
      rect(ctx, 14, 12, 28, 26, "#6d1f2e");
      rect(ctx, 26, 12, 4, 26, "#c9a24a");
      // подлокотники
      rect(ctx, 4, 52, 10, 6, "#5a4630");
      rect(ctx, 42, 52, 10, 6, "#5a4630");
      // ножки
      rect(ctx, 10, 80, 6, 10, "#3a2a1c");
      rect(ctx, 40, 80, 6, 10, "#3a2a1c");
    }),

    // Стойка: деревянная барная стойка.
    counter: make(72, 44, (ctx) => {
      rect(ctx, 4, 8, 64, 10, "#7a5228");
      rect(ctx, 4, 8, 64, 3, "#8d6335");
      rect(ctx, 8, 18, 56, 22, "#5c4026");
      for (let x = 14; x < 62; x += 12) rect(ctx, x, 20, 3, 18, "#4a321e");
      rect(ctx, 4, 40, 64, 3, "#3a2918");
    }),

    tree: make(64, 108, (ctx) => {
      rect(ctx, 28, 58, 9, 50, "#4a3520");
      rect(ctx, 28, 58, 3, 50, "#5f4629");
      const blobs = [
        [32, 30, 24, 20],
        [17, 44, 17, 15],
        [47, 44, 18, 16],
        [32, 14, 18, 14],
        [20, 22, 14, 12],
        [45, 24, 13, 11],
      ];
      for (const [x, y, rx, ry] of blobs) {
        ellipse(ctx, x, y, rx, ry, "#2c4a22");
      }
      for (const [x, y, rx, ry] of blobs) {
        ellipse(ctx, x - 3, y - 3, rx * 0.7, ry * 0.7, "#3d632d");
      }
      for (let i = 0; i < 12; i++) {
        const x = 8 + ((i * 37) % 48);
        const y = 10 + ((i * 23) % 46);
        ellipse(ctx, x, y, 2.5, 2.5, "#547f38");
      }
    }),

    rock: make(58, 38, (ctx) => {
      ctx.fillStyle = "#6d6b64";
      ctx.beginPath();
      ctx.moveTo(4, 36);
      ctx.lineTo(12, 14);
      ctx.lineTo(26, 5);
      ctx.lineTo(44, 12);
      ctx.lineTo(55, 30);
      ctx.lineTo(48, 36);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#8a877e";
      ctx.beginPath();
      ctx.moveTo(12, 14);
      ctx.lineTo(26, 5);
      ctx.lineTo(34, 16);
      ctx.lineTo(18, 24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#54524c";
      ctx.beginPath();
      ctx.moveTo(18, 24);
      ctx.lineTo(34, 16);
      ctx.lineTo(44, 12);
      ctx.lineTo(55, 30);
      ctx.lineTo(34, 34);
      ctx.closePath();
      ctx.fill();
    }),

    campfire: make(48, 38, (ctx) => {
      ellipse(ctx, 24, 32, 20, 5, "#3a2918");
      ctx.strokeStyle = "#4a321e";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(10, 33);
      ctx.lineTo(38, 26);
      ctx.moveTo(10, 26);
      ctx.lineTo(38, 33);
      ctx.stroke();
      ctx.fillStyle = "#d3541f";
      ctx.beginPath();
      ctx.moveTo(24, 5);
      ctx.quadraticCurveTo(36, 20, 31, 29);
      ctx.lineTo(17, 29);
      ctx.quadraticCurveTo(12, 20, 24, 5);
      ctx.fill();
      ctx.fillStyle = "#f0a52c";
      ctx.beginPath();
      ctx.moveTo(24, 13);
      ctx.quadraticCurveTo(31, 22, 28, 29);
      ctx.lineTo(20, 29);
      ctx.quadraticCurveTo(17, 22, 24, 13);
      ctx.fill();
      ctx.fillStyle = "#ffe08a";
      ctx.beginPath();
      ctx.moveTo(24, 21);
      ctx.quadraticCurveTo(27, 25, 26, 29);
      ctx.lineTo(22, 29);
      ctx.quadraticCurveTo(21, 25, 24, 21);
      ctx.fill();
    }),

    barrel: make(34, 44, (ctx) => {
      ctx.fillStyle = "#6b4623";
      ctx.beginPath();
      ctx.moveTo(4, 6);
      ctx.quadraticCurveTo(0, 22, 4, 40);
      ctx.lineTo(30, 40);
      ctx.quadraticCurveTo(34, 22, 30, 6);
      ctx.closePath();
      ctx.fill();
      rect(ctx, 6, 6, 22, 3, "#8d6335");
      rect(ctx, 2, 14, 30, 3, "#3f3f45");
      rect(ctx, 1, 27, 32, 3, "#3f3f45");
      rect(ctx, 4, 38, 26, 3, "#3a2918");
    }),

    crate: make(42, 42, (ctx) => {
      rect(ctx, 4, 6, 34, 32, "#6b4a28");
      rect(ctx, 4, 6, 34, 3, "#8d6335");
      rect(ctx, 4, 35, 34, 3, "#3a2918");
      ctx.strokeStyle = "#4a321e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(7, 9);
      ctx.lineTo(35, 35);
      ctx.moveTo(35, 9);
      ctx.lineTo(7, 35);
      ctx.stroke();
    }),

    sign: make(38, 58, (ctx) => {
      rect(ctx, 17, 20, 5, 38, "#4a321e");
      rect(ctx, 3, 6, 32, 22, "#6b4a28");
      rect(ctx, 3, 6, 32, 2, "#8d6335");
      rect(ctx, 7, 12, 24, 2, "#c9b98c");
      rect(ctx, 7, 17, 18, 2, "#c9b98c");
      rect(ctx, 7, 22, 22, 2, "#c9b98c");
    }),

    // Осёдланная лошадь: седло, узда, стремена.
    horseSaddled: make(84, 72, (ctx) => {
      // ноги
      rect(ctx, 18, 46, 6, 24, "#4a3020");
      rect(ctx, 30, 46, 6, 24, "#4a3020");
      rect(ctx, 56, 46, 6, 24, "#4a3020");
      rect(ctx, 68, 46, 6, 24, "#4a3020");
      // копыта
      rect(ctx, 18, 66, 6, 4, "#241a12");
      rect(ctx, 30, 66, 6, 4, "#241a12");
      rect(ctx, 56, 66, 6, 4, "#241a12");
      rect(ctx, 68, 66, 6, 4, "#241a12");
      // корпус
      ellipse(ctx, 45, 38, 28, 17, "#6b4628");
      ellipse(ctx, 45, 34, 26, 12, "#7d5432");
      // шея и голова
      ctx.fillStyle = "#6b4628";
      ctx.beginPath();
      ctx.moveTo(64, 34);
      ctx.lineTo(74, 10);
      ctx.lineTo(84, 14);
      ctx.lineTo(76, 40);
      ctx.closePath();
      ctx.fill();
      ellipse(ctx, 78, 12, 9, 7, "#5c3c22");
      // уши
      rect(ctx, 72, 2, 3, 6, "#5c3c22");
      rect(ctx, 80, 3, 3, 5, "#5c3c22");
      // глаз
      ellipse(ctx, 80, 10, 1.5, 1.5, "#120d08");
      // морда
      rect(ctx, 82, 14, 4, 6, "#4a3020");
      // грива
      rect(ctx, 68, 8, 5, 26, "#2e1d10");
      // хвост
      ctx.strokeStyle = "#2e1d10";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(18, 30);
      ctx.quadraticCurveTo(6, 42, 12, 60);
      ctx.stroke();
      // седло
      ctx.fillStyle = "#5a3a1e";
      ctx.beginPath();
      ctx.moveTo(38, 24);
      ctx.quadraticCurveTo(46, 18, 56, 24);
      ctx.lineTo(54, 32);
      ctx.lineTo(40, 32);
      ctx.closePath();
      ctx.fill();
      rect(ctx, 40, 30, 16, 3, "#3a2414");
      // подпруга
      rect(ctx, 46, 32, 3, 22, "#3a2414");
      // стремя
      ctx.strokeStyle = "#8f7434";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(48, 46);
      ctx.lineTo(52, 52);
      ctx.stroke();
      rect(ctx, 49, 52, 7, 3, "#8f7434");
      // узда
      rect(ctx, 74, 10, 12, 2, "#8f7434");
      rect(ctx, 76, 16, 2, 8, "#8f7434");
    }),

    // Голова лошади для вида от первого лица: крупно, снизу кадра.
    horseHead: make(150, 90, (ctx) => {
      // шея, уходит вниз за край
      ctx.fillStyle = "#6b4628";
      ctx.beginPath();
      ctx.moveTo(40, 90);
      ctx.lineTo(52, 40);
      ctx.lineTo(104, 34);
      ctx.lineTo(124, 90);
      ctx.closePath();
      ctx.fill();
      // голова
      ellipse(ctx, 82, 34, 30, 22, "#7d5432");
      // морда
      ellipse(ctx, 46, 46, 22, 14, "#8d6440");
      // ноздри
      ellipse(ctx, 32, 44, 3, 4, "#2e1d10");
      ellipse(ctx, 32, 52, 3, 4, "#2e1d10");
      // лицевая кость
      rect(ctx, 62, 14, 4, 34, "#6b4628");
      // глаза
      ellipse(ctx, 78, 26, 6, 5, "#2e1d10");
      ellipse(ctx, 78, 26, 3, 3, "#120d08");
      ellipse(ctx, 100, 24, 5, 4, "#2e1d10");
      // уши
      ctx.fillStyle = "#6b4628";
      ctx.beginPath();
      ctx.moveTo(66, 12);
      ctx.lineTo(60, 0);
      ctx.lineTo(76, 6);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(96, 8);
      ctx.lineTo(94, -2);
      ctx.lineTo(106, 6);
      ctx.closePath();
      ctx.fill();
      // грива по краю шеи
      ctx.fillStyle = "#2e1d10";
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.moveTo(100 + i * 4, 30 + i * 6);
        ctx.lineTo(112 + i * 4, 26 + i * 6);
        ctx.lineTo(108 + i * 4, 40 + i * 6);
        ctx.closePath();
        ctx.fill();
      }
      // уздечка
      rect(ctx, 40, 34, 46, 3, "#8f7434");
      rect(ctx, 44, 30, 3, 16, "#8f7434");
    }),

    // Конюшня: навес на столбах, сено, изгородь.
    stable: make(104, 88, (ctx) => {
      // столбы
      rect(ctx, 8, 34, 6, 50, "#5a3a1e");
      rect(ctx, 90, 34, 6, 50, "#5a3a1e");
      // крыша-навес
      ctx.fillStyle = "#6b4a28";
      ctx.beginPath();
      ctx.moveTo(2, 38);
      ctx.lineTo(52, 10);
      ctx.lineTo(102, 38);
      ctx.closePath();
      ctx.fill();
      rect(ctx, 2, 36, 100, 4, "#4a321e");
      // задняя стенка
      rect(ctx, 14, 42, 76, 42, "#4a321e");
      // сено
      ellipse(ctx, 34, 68, 20, 12, "#c9b25a");
      ellipse(ctx, 60, 70, 16, 10, "#b8a04a");
      // изгородь
      for (let x = 12; x < 96; x += 18) {
        rect(ctx, x, 76, 4, 12, "#5a3a1e");
      }
      rect(ctx, 10, 78, 88, 3, "#6b4a28");
      // ведро
      rect(ctx, 78, 76, 8, 8, "#6b6357");
    }),

    horse: make(76, 64, (ctx) => {
      // ноги
      rect(ctx, 16, 40, 5, 22, "#4a3020");
      rect(ctx, 27, 40, 5, 22, "#4a3020");
      rect(ctx, 50, 40, 5, 22, "#4a3020");
      rect(ctx, 61, 40, 5, 22, "#4a3020");
      // корпус
      ellipse(ctx, 41, 34, 25, 15, "#6b4628");
      // шея и голова
      ctx.fillStyle = "#6b4628";
      ctx.beginPath();
      ctx.moveTo(58, 30);
      ctx.lineTo(68, 10);
      ctx.lineTo(76, 14);
      ctx.lineTo(68, 36);
      ctx.closePath();
      ctx.fill();
      ellipse(ctx, 71, 12, 8, 6, "#5c3c22");
      // грива и хвост
      rect(ctx, 62, 10, 4, 22, "#2e1d10");
      ctx.strokeStyle = "#2e1d10";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(16, 26);
      ctx.quadraticCurveTo(6, 36, 10, 52);
      ctx.stroke();
      // глаз
      ellipse(ctx, 73, 10, 1.2, 1.2, "#120d08");
      // сбруя
      rect(ctx, 40, 28, 30, 3, "#8f7434");
    }),

    corpse: make(52, 24, (ctx) => {
      ellipse(ctx, 26, 18, 24, 6, "#4a1512");
      ellipse(ctx, 24, 13, 18, 7, "#3b2b22");
      ellipse(ctx, 13, 11, 8, 6, "#5a4636");
      rect(ctx, 30, 10, 14, 5, "#2a2119");
      ellipse(ctx, 24, 12, 3, 2, "#6d1c16");
    }),

    // ── Живность ──

    cow: make(84, 62, (ctx) => {
      for (const lx of [16, 28, 54, 66]) rect(ctx, lx, 42, 7, 20, "#3b2a1e");
      ellipse(ctx, 42, 32, 28, 16, "#e6ddcd");
      // пятна
      ellipse(ctx, 32, 26, 10, 7, "#332c25");
      ellipse(ctx, 54, 36, 8, 6, "#332c25");
      // голова
      ellipse(ctx, 72, 22, 12, 10, "#e6ddcd");
      ellipse(ctx, 78, 28, 7, 5, "#d8cbb6");
      ellipse(ctx, 74, 20, 2, 2, "#1c1712");
      // рога и уши
      rect(ctx, 66, 12, 3, 6, "#c9b98c");
      rect(ctx, 76, 13, 3, 5, "#c9b98c");
      ellipse(ctx, 64, 20, 4, 2, "#c9b98c");
      // вымя и хвост
      ellipse(ctx, 40, 46, 6, 4, "#e0a89a");
      ctx.strokeStyle = "#3b2a1e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(15, 28);
      ctx.quadraticCurveTo(8, 38, 13, 48);
      ctx.stroke();
    }),

    goat: make(64, 56, (ctx) => {
      for (const lx of [14, 22, 40, 48]) rect(ctx, lx, 38, 5, 16, "#4a3a2a");
      ellipse(ctx, 32, 30, 20, 12, "#cfc4b0");
      ellipse(ctx, 54, 20, 9, 8, "#cfc4b0");
      // борода
      ctx.fillStyle = "#8a7d68";
      ctx.beginPath();
      ctx.moveTo(56, 26);
      ctx.lineTo(58, 36);
      ctx.lineTo(52, 28);
      ctx.closePath();
      ctx.fill();
      // рога
      ctx.strokeStyle = "#8a7d68";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(50, 13);
      ctx.quadraticCurveTo(46, 4, 52, 2);
      ctx.moveTo(57, 12);
      ctx.quadraticCurveTo(62, 4, 58, 1);
      ctx.stroke();
      ellipse(ctx, 56, 19, 1.6, 1.6, "#1c1712");
      rect(ctx, 54, 24, 4, 3, "#b9a992");
    }),

    fox: make(62, 40, (ctx) => {
      for (const lx of [14, 22, 40, 48]) rect(ctx, lx, 27, 5, 11, "#3a2214");
      ellipse(ctx, 32, 22, 20, 10, "#b4561e");
      // хвост
      ctx.fillStyle = "#c86a28";
      ctx.beginPath();
      ctx.moveTo(14, 18);
      ctx.quadraticCurveTo(2, 16, 4, 28);
      ctx.quadraticCurveTo(10, 24, 14, 24);
      ctx.fill();
      ellipse(ctx, 5, 26, 4, 3, "#e8dcc8");
      // голова
      ellipse(ctx, 52, 16, 9, 7, "#c86a28");
      ctx.fillStyle = "#c86a28";
      ctx.beginPath();
      ctx.moveTo(56, 12);
      ctx.lineTo(62, 8);
      ctx.lineTo(57, 18);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(52, 11);
      ctx.lineTo(50, 3);
      ctx.lineTo(57, 10);
      ctx.closePath();
      ctx.fill();
      ellipse(ctx, 56, 17, 1.6, 1.6, "#1c1712");
      ellipse(ctx, 60, 19, 2, 1.4, "#1c1712");
      // белая грудь
      ellipse(ctx, 44, 24, 6, 4, "#e8dcc8");
    }),

    // ── Куртизанка: цвета подставляются из варианта ──

    well: make(56, 54, (ctx) => {
      ellipse(ctx, 28, 44, 22, 8, "#5a5348");
      rect(ctx, 8, 18, 6, 26, "#6b6357");
      rect(ctx, 42, 18, 6, 26, "#6b6357");
      ellipse(ctx, 28, 46, 16, 6, "#2a2a2e");
      ellipse(ctx, 28, 45, 12, 4, "#1a2a33");
      // крыша
      ctx.fillStyle = "#6b4a28";
      ctx.beginPath();
      ctx.moveTo(4, 20);
      ctx.lineTo(28, 4);
      ctx.lineTo(52, 20);
      ctx.closePath();
      ctx.fill();
      rect(ctx, 26, 8, 3, 18, "#8d6335");
      rect(ctx, 25, 24, 6, 5, "#4a321e");
    }),

    fence: make(48, 34, (ctx) => {
      for (const fx of [4, 20, 36]) {
        rect(ctx, fx, 6, 5, 26, "#6b4a28");
        rect(ctx, fx, 6, 2, 26, "#8d6335");
      }
      rect(ctx, 2, 13, 44, 4, "#7a5228");
      rect(ctx, 2, 23, 44, 4, "#7a5228");
    }),

    haystack: make(60, 56, (ctx) => {
      ellipse(ctx, 30, 46, 26, 10, "#8a7a3a");
      ctx.fillStyle = "#c9b25a";
      ctx.beginPath();
      ctx.moveTo(6, 46);
      ctx.quadraticCurveTo(30, 2, 54, 46);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#a89440";
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(12 + i * 7, 44);
        ctx.quadraticCurveTo(28 + i * 2, 24 + i * 2, 22 + i * 6, 12 + i);
        ctx.stroke();
      }
    }),

    milestone: make(30, 46, (ctx) => {
      rect(ctx, 12, 14, 7, 30, "#8a8578");
      rect(ctx, 13, 14, 3, 30, "#a5a094");
      rect(ctx, 4, 6, 23, 12, "#9a9488");
      rect(ctx, 6, 10, 19, 2, "#4a463f");
      rect(ctx, 6, 14, 13, 2, "#4a463f");
    }),

    windmill: make(96, 118, (ctx) => {
      // башня
      ctx.fillStyle = "#8a7f68";
      ctx.beginPath();
      ctx.moveTo(30, 112);
      ctx.lineTo(38, 34);
      ctx.lineTo(58, 34);
      ctx.lineTo(66, 112);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#6b6252";
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(34 + i * 2, 106 - i * 18);
        ctx.lineTo(62 - i * 2, 106 - i * 18);
        ctx.stroke();
      }
      rect(ctx, 40, 96, 16, 16, "#3a2a1c");
      // крыша
      ctx.fillStyle = "#6b4a28";
      ctx.beginPath();
      ctx.moveTo(30, 34);
      ctx.lineTo(48, 12);
      ctx.lineTo(66, 34);
      ctx.closePath();
      ctx.fill();
      // лопасти
      ctx.strokeStyle = "#5c4a30";
      ctx.lineWidth = 4;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(48, 40);
        ctx.lineTo(48 + Math.cos(a) * 42, 40 + Math.sin(a) * 42);
        ctx.stroke();
      }
      ctx.fillStyle = "#bfae82";
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.save();
        ctx.translate(48, 40);
        ctx.rotate(a);
        ctx.fillRect(10, -4, 34, 8);
        ctx.restore();
      }
      ellipse(ctx, 48, 40, 5, 5, "#3a2a1c");
    }),

    basket: make(30, 26, (ctx) => {
      ctx.fillStyle = "#8a6a3a";
      ctx.beginPath();
      ctx.moveTo(6, 10);
      ctx.lineTo(24, 10);
      ctx.lineTo(21, 22);
      ctx.lineTo(9, 22);
      ctx.closePath();
      ctx.fill();
      rect(ctx, 5, 8, 20, 3, "#a8894f");
      ctx.strokeStyle = "#a8894f";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(15, 8, 6, Math.PI, 0);
      ctx.stroke();
      ellipse(ctx, 12, 8, 3, 2, "#c94a3e");
      ellipse(ctx, 17, 7, 3, 2, "#b8a23a");
    }),

    bush: make(56, 48, (ctx) => {
      const blobs = [[18, 32, 14, 12], [36, 30, 16, 13], [27, 22, 15, 12]];
      for (const [x, y, rx, ry] of blobs) ellipse(ctx, x, y, rx, ry, "#2c4a22");
      for (const [x, y, rx, ry] of blobs) ellipse(ctx, x - 2, y - 3, rx * 0.65, ry * 0.65, "#3d632d");
    }),
  };
}
