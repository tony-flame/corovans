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

    bush: make(56, 48, (ctx) => {
      const blobs = [[18, 32, 14, 12], [36, 30, 16, 13], [27, 22, 15, 12]];
      for (const [x, y, rx, ry] of blobs) ellipse(ctx, x, y, rx, ry, "#2c4a22");
      for (const [x, y, rx, ry] of blobs) ellipse(ctx, x - 2, y - 3, rx * 0.65, ry * 0.65, "#3d632d");
    }),
  };
}
