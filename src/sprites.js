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

// Гражданские приходят из person.js: они 96×184, как куртизанки.
import { buildPeople } from "./person.js";

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

function poly(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

// Куртизанки переехали в courtesan-sprite.js: четыре стиля по 96×184.
export { buildCourtesan, courtesanStyleOf, SPOT_STYLE } from "./courtesan-sprite.js";
// Гражданские — в person.js, там же 96×184 и та же голова.
export { buildPeople, buildPerson, PERSON_KINDS, PERSON_W, PERSON_H } from "./person.js";

function guard(ctx, tabard, trim) {
  const steel = "#7d838f";
  const steelDark = "#565c68";
  const skin = "#b98d66";

  // копьё: от земли до наконечника над головой
  rect(ctx, 24, 8, 4, 168, "#5b4127");
  ctx.fillStyle = "#b8bcc4";
  ctx.beginPath();
  ctx.moveTo(26, 0);
  ctx.lineTo(36, 26);
  ctx.lineTo(16, 26);
  ctx.closePath();
  ctx.fill();
  // перевязь наконечника
  rect(ctx, 22, 26, 8, 4, "#8a9098");

  // сапоги и ноги
  rect(ctx, 40, 148, 14, 34, "#2b2119");
  rect(ctx, 56, 148, 14, 34, "#2b2119");
  rect(ctx, 42, 176, 17, 8, "#1d1712");
  rect(ctx, 53, 176, 17, 8, "#1d1712");
  rect(ctx, 43, 118, 11, 34, "#4a3a2a");
  rect(ctx, 56, 118, 11, 34, "#4a3a2a");

  // туника
  rect(ctx, 38, 62, 34, 60, tabard);
  // затемнение по краю — объём
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(38, 62, 5, 60);
  // отделка
  rect(ctx, 38, 62, 34, 5, trim);
  rect(ctx, 52, 62, 6, 60, trim);
  // кольчуга на груди
  rect(ctx, 40, 70, 30, 16, "#5a6068");
  for (let i = 0; i < 4; i++) rect(ctx, 42 + i * 7, 72, 5, 1, "#7a808a");

  // руки
  rect(ctx, 30, 66, 10, 42, tabard);
  rect(ctx, 70, 64, 10, 44, tabard);
  rect(ctx, 31, 104, 9, 12, skin);
  rect(ctx, 70, 104, 9, 12, skin);

  // ремень
  rect(ctx, 36, 112, 38, 7, "#241a12");
  rect(ctx, 51, 110, 8, 11, "#c9a24a");

  // голова и шлем
  ellipse(ctx, 55, 46, 16, 17, skin);
  rect(ctx, 37, 32, 36, 12, steel);
  rect(ctx, 37, 42, 36, 5, steelDark);
  // наносник
  rect(ctx, 52, 42, 6, 18, steelDark);
  // глаза под шлемом
  rect(ctx, 44, 46, 4, 3, "#241a12");
  rect(ctx, 62, 46, 4, 3, "#241a12");
  // борода
  ctx.fillStyle = "#4a3a28";
  ctx.beginPath();
  ctx.moveTo(45, 58);
  ctx.quadraticCurveTo(55, 68, 65, 58);
  ctx.closePath();
  ctx.fill();
}

// Мардо-скупщик. Раньше жил внутри блока гражданских и был снесён
// вместе с ними — вернул отдельной функцией.
function merchantSprite(ctx) {
  const robe = "#4c2a55";
  const robeLight = "#7d4a88";
  const skin = "#b98d66";

  // сапоги
  rect(ctx, 34, 150, 13, 32, "#2a2119");
  rect(ctx, 51, 150, 13, 32, "#2a2119");
  rect(ctx, 32, 176, 16, 8, "#1d1712");
  rect(ctx, 51, 176, 16, 8, "#1d1712");

  // балахон
  poly(ctx, [[36, 58], [64, 58], [78, 184], [22, 184]], robe);
  // тень по краю
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(22, 62, 8, 122);
  // светлая полоса по центру
  rect(ctx, 46, 62, 4, 122, robeLight);
  // пояс с золотом
  rect(ctx, 26, 128, 44, 8, "#c9a24a");
  rect(ctx, 40, 126, 14, 12, "#8a6a2a");
  ellipse(ctx, 47, 132, 5, 4, "#e0c45a");

  // руки
  rect(ctx, 24, 70, 12, 46, robe);
  rect(ctx, 64, 70, 12, 44, robe);
  ellipse(ctx, 30, 120, 6, 7, skin);
  ellipse(ctx, 70, 118, 6, 7, skin);

  // голова
  ellipse(ctx, 50, 40, 16, 18, skin);
  // борода
  ctx.fillStyle = "#d7d0c2";
  ctx.beginPath();
  ctx.moveTo(38, 48);
  ctx.quadraticCurveTo(50, 80, 62, 48);
  ctx.closePath();
  ctx.fill();
  // глаза
  rect(ctx, 42, 38, 4, 3, "#241a12");
  rect(ctx, 56, 38, 4, 3, "#241a12");
  // нос
  rect(ctx, 49, 44, 3, 5, "#9c6f4c");
  // шляпа с пером
  ellipse(ctx, 50, 26, 26, 6, "#3a2142");
  ellipse(ctx, 50, 14, 15, 12, "#3a2142");
  rect(ctx, 44, 8, 12, 5, "#c9a24a");
  poly(ctx, [[66, 4], [72, 22], [66, 20]], "#8a2a3a");

  // кошель на боку
  ellipse(ctx, 74, 96, 10, 13, "#6b4a26");
  rect(ctx, 70, 84, 8, 5, "#c9a24a");
  ellipse(ctx, 74, 100, 4, 4, "#c9a24a");
}

export function buildSprites() {
  return {
    // Гражданские: 96×184 из person.js, ключи совпадают с spriteKey.
    ...buildPeople(),

    guard: make(96, 184, (ctx) => guard(ctx, "#2f4468", "#8f7434")),
    village_guard: make(96, 184, (ctx) => guard(ctx, "#6d2b25", "#c9a24a")),
    merchant: make(96, 184, (ctx) => merchantSprite(ctx)),

    driver: make(96, 184, (ctx) => {
      const cloak = "#6b5638";
      const cloakDark = "#574529";

      // сапоги
      rect(ctx, 34, 148, 14, 34, "#2a2119");
      rect(ctx, 52, 148, 14, 34, "#2a2119");
      rect(ctx, 32, 176, 17, 8, "#1d1712");
      rect(ctx, 51, 176, 17, 8, "#1d1712");

      // плащ
      poly(ctx, [[36, 56], [66, 56], [80, 184], [20, 184]], cloak);
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(20, 60, 9, 122);
      // подкладка и застёжка
      rect(ctx, 47, 62, 4, 118, cloakDark);
      ellipse(ctx, 49, 96, 7, 7, "#c9a24a");
      ellipse(ctx, 49, 98, 4, 4, "#8a6a2a");

      // руки
      rect(ctx, 26, 72, 11, 44, cloak);
      rect(ctx, 66, 70, 11, 44, cloak);
      ellipse(ctx, 32, 120, 6, 7, "#a97f5b");
      ellipse(ctx, 72, 118, 6, 7, "#a97f5b");

      // капюшон
      poly(ctx, [[32, 52], [68, 52], [64, 26], [50, 18], [36, 26]], "#5c4a2e");
      ellipse(ctx, 50, 38, 16, 18, "#5c4a2e");
      // лицо в тени капюшона
      ellipse(ctx, 50, 42, 12, 14, "#a97f5b");
      ellipse(ctx, 50, 38, 12, 10, "rgba(0,0,0,0.28)");
      // глаза с бликом
      rect(ctx, 43, 41, 4, 3, "#f0e8dc");
      rect(ctx, 54, 41, 4, 3, "#f0e8dc");
      rect(ctx, 44, 41, 2, 3, "#241a12");
      rect(ctx, 56, 41, 2, 3, "#241a12");
      // борода
      ctx.fillStyle = "#4a3a28";
      ctx.beginPath();
      ctx.moveTo(40, 52);
      ctx.quadraticCurveTo(50, 70, 62, 52);
      ctx.closePath();
      ctx.fill();

      // кнут
      ctx.strokeStyle = "#4b3520";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(76, 96);
      ctx.quadraticCurveTo(92, 128, 80, 160);
      ctx.stroke();
    }),

    // Заглушка: настоящий спрайт подставляется из buildCourtesan() по варианту.
    courtesan: make(48, 92, () => {}),

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

    // Терн: колючий куст, тёмный, с шипами.
    thorn: make(52, 40, (ctx) => {
      ellipse(ctx, 26, 30, 22, 10, "#1e2418");
      // ветки
      ctx.strokeStyle = "#2a2a20";
      ctx.lineWidth = 2;
      const branches = [
        [26, 30, 8, 16], [26, 30, 44, 14], [26, 30, 18, 8],
        [26, 30, 36, 6], [26, 30, 12, 26], [26, 30, 40, 24],
      ];
      for (const [x1, y1, x2, y2] of branches) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      // листва
      for (const [x, y, r] of [[12, 18, 7], [40, 16, 6], [20, 10, 6], [34, 8, 5], [14, 26, 5], [38, 26, 5]]) {
        ellipse(ctx, x, y, r, r * 0.8, "#2f3a24");
      }
      // шипы
      ctx.fillStyle = "#6a6458";
      for (let i = 0; i < 14; i++) {
        const x = 6 + ((i * 37) % 40);
        const y = 6 + ((i * 23) % 28);
        ctx.fillRect(x, y, 1.5, 3);
      }
    }),

    // Крестьянская хижина: маленькая, соломенная крыша, входимая.
    hut: make(74, 76, (ctx) => {
      // стены
      rect(ctx, 8, 34, 58, 38, "#6b5a44");
      rect(ctx, 8, 34, 58, 3, "#7d6b52");
      // брёвна
      for (let y = 38; y < 70; y += 6) {
        rect(ctx, 8, y, 58, 1.5, "#5a4a38");
      }
      // соломенная крыша
      ctx.fillStyle = "#b8a04a";
      ctx.beginPath();
      ctx.moveTo(2, 36);
      ctx.lineTo(37, 4);
      ctx.lineTo(72, 36);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#c9b25a";
      ctx.beginPath();
      ctx.moveTo(4, 34);
      ctx.lineTo(37, 6);
      ctx.lineTo(70, 34);
      ctx.closePath();
      ctx.fill();
      // стебли соломы по краю
      ctx.strokeStyle = "#a08a3a";
      ctx.lineWidth = 1;
      for (let i = 0; i < 18; i++) {
        const t = i / 18;
        const x = 4 + t * 66;
        ctx.beginPath();
        ctx.moveTo(x, 34);
        ctx.lineTo(x + 1, 30);
        ctx.stroke();
      }
      // дверь
      rect(ctx, 30, 52, 14, 20, "#3a2a1c");
      rect(ctx, 31, 53, 12, 18, "#4a3624");
      ellipse(ctx, 40, 62, 1.5, 1.5, "#c9a24a");
      // окно-щель
      rect(ctx, 15, 44, 9, 8, "#2a3a4a");
      rect(ctx, 18, 44, 1.5, 8, "#4a3624");
      rect(ctx, 15, 47, 9, 1.5, "#4a3624");
      rect(ctx, 51, 44, 9, 8, "#2a3a4a");
      rect(ctx, 54, 44, 1.5, 8, "#4a3624");
      rect(ctx, 51, 47, 9, 1.5, "#4a3624");
    }),

    hedge: make(60, 30, (ctx) => {
      ellipse(ctx, 30, 18, 28, 11, "#2a3a22");
      ellipse(ctx, 30, 14, 24, 9, "#35522a");
      for (let i = 0; i < 10; i++) {
        const x = 6 + ((i * 29) % 48);
        ellipse(ctx, x, 10 + ((i * 17) % 10), 3, 2.5, "#406232");
      }
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

    // ── Кладбище у собора ──
    tombstone: make(40, 52, (ctx) => {
      // могильный холмик
      ellipse(ctx, 20, 48, 17, 5, "#3a3428");
      // плита со скруглённым верхом
      ctx.fillStyle = "#6e6a60";
      ctx.beginPath();
      ctx.moveTo(9, 48);
      ctx.lineTo(9, 20);
      ctx.arc(20, 20, 11, Math.PI, 0);
      ctx.lineTo(31, 48);
      ctx.closePath();
      ctx.fill();
      rect(ctx, 9, 20, 22, 3, "#7f7b70");
      // трещина и мох
      ctx.strokeStyle = "#4e4a42";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, 26);
      ctx.lineTo(19, 33);
      ctx.lineTo(17, 40);
      ctx.stroke();
      ellipse(ctx, 26, 44, 5, 3, "#3f4a2e");
      // крест
      rect(ctx, 19, 12, 2, 9, "#5e5a52");
      rect(ctx, 16, 15, 8, 2, "#5e5a52");
    }),

    // ── Фонарь: столб с горящим фонарём ──
    lamp: make(32, 108, (ctx) => {
      // столб
      rect(ctx, 14, 42, 4, 62, "#2a2620");
      rect(ctx, 13, 42, 6, 3, "#3a342c");
      ellipse(ctx, 16, 104, 7, 3, "#2a2620");
      // корпус фонаря
      rect(ctx, 8, 24, 16, 20, "#3a3428");
      rect(ctx, 10, 26, 12, 16, "#c9a24a");
      rect(ctx, 15, 26, 2, 16, "#3a3428");
      rect(ctx, 10, 33, 12, 2, "#3a3428");
      // огонь — плотное ядро, без полупрозрачного ореола:
      // альфа в спрайтах не сохраняется и ореол превращался в белый столб.
      ellipse(ctx, 16, 34, 3, 4, "#ffe9a0");
      ellipse(ctx, 16, 35, 1.5, 2.5, "#ffffff");
      // крышка
      ctx.fillStyle = "#2e2a22";
      ctx.beginPath();
      ctx.moveTo(6, 24);
      ctx.lineTo(16, 14);
      ctx.lineTo(26, 24);
      ctx.closePath();
      ctx.fill();
    }),

    // ── Скамья ──
    bench: make(64, 34, (ctx) => {
      rect(ctx, 4, 14, 56, 4, "#6a5236");   // сиденье
      rect(ctx, 4, 6, 56, 3, "#6a5236");    // спинка
      rect(ctx, 6, 9, 3, 6, "#5a442c");
      rect(ctx, 55, 9, 3, 6, "#5a442c");
      rect(ctx, 6, 18, 3, 12, "#5a442c");   // ножки
      rect(ctx, 55, 18, 3, 12, "#5a442c");
      rect(ctx, 4, 15, 56, 1, "#7d6244");
    }),

    // ── Знамя на древке ──
    banner: make(48, 130, (ctx) => {
      // древко
      rect(ctx, 22, 6, 4, 122, "#4a3a26");
      ellipse(ctx, 24, 127, 6, 3, "#3a2c1c");
      // полотнище с вырезом снизу
      ctx.fillStyle = "#7a1f1f";
      ctx.beginPath();
      ctx.moveTo(14, 12);
      ctx.lineTo(34, 12);
      ctx.lineTo(34, 84);
      ctx.lineTo(24, 74);
      ctx.lineTo(14, 84);
      ctx.closePath();
      ctx.fill();
      // золотая кайма
      ctx.strokeStyle = "#c9a24a";
      ctx.lineWidth = 2;
      ctx.stroke();
      // герб: башня
      rect(ctx, 20, 40, 8, 18, "#c9a24a");
      rect(ctx, 20, 36, 2, 4, "#c9a24a");
      rect(ctx, 23, 36, 2, 4, "#c9a24a");
      rect(ctx, 26, 36, 2, 4, "#c9a24a");
      rect(ctx, 23, 46, 2, 5, "#5a1414");
      // наконечник
      ctx.fillStyle = "#c9a24a";
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(29, 8);
      ctx.lineTo(19, 8);
      ctx.closePath();
      ctx.fill();
    }),
  };
}
