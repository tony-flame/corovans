// Карта 120×120, коллизии, актёры и стоянка каравана.
// Мир строится зонами: деревня, тракт, поворот, стойбище, поля, лес, руины.
// Координаты — код, не данные.

import { createRng, hashSeed } from "./rng.js";

export const TILE = {
  GRASS: 0,
  BRICK: 1,
  WOOD: 2,
  STONE: 3,
  ROAD: 4,
  DIRT: 5,
  // Фахверк: кирпич или штукатурка с тёмным каркасом.
  BRICK_FRAME: 6,
  PLASTER_FRAME: 7,
  // Вода: непроходима, анимируется в рендере.
  WATER: 8,
};

export const MAP_W = 200;
export const MAP_H = 200;

// ── Зоны мира (карта 200×200) ────────────────────────────────────────
// Все зоны заданы в АБСОЛЮТНЫХ координатах карты. Деревенская застройка
// внутри createWorld() по-прежнему пишется старыми координатами и
// сдвигается на +40 — так проверенные места деревни остались на месте.
export const ZONES = {
  // Старый город: плотная застройка вокруг площади.
  VILLAGE: { x0: 46, y0: 108, x1: 84, y1: 144 },
  SQUARE: { x0: 54, y0: 124, x1: 70, y1: 132 },
  // Большой тракт на восток и поворот на север, к стойбищу.
  ROAD_EAST: { y0: 126, y1: 127, x0: 44, x1: 141 },
  TURN_NORTH: { x0: 138, y0: 66, x1: 139, y1: 126 },
  CAMP: { x0: 132, y0: 58, x1: 150, y1: 80 },
  FIELDS: { x0: 86, y0: 104, x1: 130, y1: 124 },
  RUINS: { x0: 100, y0: 80, x1: 110, y1: 90 },
  FOREST: { x0: 70, y0: 60, x1: 100, y1: 100 },
  // Новые крупные объекты.
  // Часовня (88..98, 132..144) и рынок разведены: рынок восточнее.
  CATHEDRAL: { x0: 152, y0: 96, x1: 182, y1: 140 },
  RATHOUSE: { x0: 152, y0: 56, x1: 176, y1: 84 },
  HOVELS: { x0: 92, y0: 152, x1: 124, y1: 184 },
  MARKET: { x0: 104, y0: 130, x1: 128, y1: 148 },
};

export const SPAWN = { x: 52.5, y: 132.5 };
// Мардо стоит в стороне от патруля стража. Раньше он был в 4.5 юнитах от
// поста, а страж при wanted > 0 атакует с 22 — то есть единственный способ
// заплатить штраф находился ровно там, где бьют из-за штрафа.
export const MERCHANT_POS = { x: 52.5, y: 138.5 };
export const COURTESAN_POS = { x: 66.5, y: 119.5 };

// Четыре куртизанки в разных местах. Ключ места — то, чем запоминается дружба.
export const COURTESAN_SPOTS_POS = {
  square: { x: 66.5, y: 119.5 },
  inn: { x: 100.5, y: 119.6 },
  forest: { x: 86.5, y: 92.5 },
  camp: { x: 135.5, y: 71.5 },
};
export const WAGON_BASE = { x: 142.4, y: 68.1 };

let nextActorId = 1;

// Единственное определение «это стена». ray.js импортирует его отсюда:
// раньше функция была продублирована, и новый тайл сделал бы стену
// проходимой насквозь, но по-прежнему видимой.
export function isWallTile(t) {
  return (
    t === TILE.BRICK ||
    t === TILE.WOOD ||
    t === TILE.STONE ||
    t === TILE.BRICK_FRAME ||
    t === TILE.PLASTER_FRAME
  );
}

// Вода: пройти нельзя, но и стеной не является — она низкая и видно сквозь.
export function isWaterTile(t) {
  return t === TILE.WATER;
}

// Дорога: по ней нельзя ставить деревья и кусты, иначе лес перегородит тракт.
export function isRoadTile(t) {
  return t === TILE.ROAD || t === TILE.DIRT;
}

// Раскладки стоянки по архетипам (смещения от WAGON_BASE внутри зоны лагеря).
export const CAMP_LAYOUTS = {
  road_camp: {
    label: "Дорожный лагерь",
    wagon: [0, 0],
    driver: [0.1, -1.8],
    guardSpots: [
      [-2.1, 2.1],
      [2.4, 1.5],
      [-2.3, -0.5],
      [2.9, 3.3],
      [-2.9, 3.3],
    ],
    extra: [],
  },
  night_camp: {
    label: "Ночёвка",
    wagon: [0, 0],
    driver: [0.9, -1.5],
    guardSpots: [
      [-1.2, 1.3],
      [1.3, 2.3],
      [-1.3, -1.2],
      [1.9, -0.1],
      [-2.7, 0.3],
    ],
    extra: [[-2.7, -1.1, { asleep: true }]],
  },
  fortified_post: {
    label: "Укреплённый пост",
    wagon: [0, 0],
    driver: [0.1, -1.8],
    guardSpots: [
      [-2.7, 2.9],
      [2.7, 2.5],
      [-2.5, -1.2],
      [3.1, -0.7],
      [0.2, 3.9],
    ],
    extra: [],
  },
  double_wagon: {
    label: "Двойной фургон",
    wagon: [0, 0],
    driver: [0.1, -1.8],
    secondWagon: [2.6, -2.9],
    guardSpots: [
      [-2.1, 2.1],
      [2.4, 1.5],
      [-2.3, -0.5],
      [2.9, 3.3],
      [-2.9, 3.3],
    ],
    extra: [],
  },
};

const CAMP_ORIGIN = { x: WAGON_BASE.x, y: WAGON_BASE.y };

export function createWorld() {
  const map = new Uint8Array(MAP_W * MAP_H).fill(TILE.GRASS);

  // Старая карта была 120×120. Вся застройка деревни сдвинута на +40 по
  // обеим осям: так проверенные координаты остаются валидными, а вокруг
  // появляется место под собор, ратушу и хижины.
  const V = 40;

  const setTile = (x, y, t) => {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (cx >= 0 && cy >= 0 && cx < MAP_W && cy < MAP_H) map[cy * MAP_W + cx] = t;
  };
  const getTile = (x, y) => {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H) return TILE.STONE;
    return map[cy * MAP_W + cx];
  };
  const fillAbs = (x0, y0, x1, y1, t) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) setTile(x, y, t);
    }
  };
  // Деревенские координаты — со сдвигом.
  const fillRect = (x0, y0, x1, y1, t) => fillAbs(x0 + V, y0 + V, x1 + V, y1 + V, t);
  // Открытая коробка: стены по периметру и проём с одной стороны.
  const hollowRect = (x0, y0, x1, y1, t, gate) => {
    fillRect(x0, y0, x1, y1, t);
    fillRect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, TILE.DIRT);
    if (gate === "south") fillRect(Math.floor((x0 + x1) / 2), y1, Math.floor((x0 + x1) / 2), y1, TILE.DIRT);
    else if (gate === "north") fillRect(Math.floor((x0 + x1) / 2), y0, Math.floor((x0 + x1) / 2), y0, TILE.DIRT);
    else if (gate === "west") fillRect(x0, Math.floor((y0 + y1) / 2), x0, Math.floor((y0 + y1) / 2), TILE.DIRT);
    else if (gate === "east") fillRect(x1, Math.floor((y0 + y1) / 2), x1, Math.floor((y0 + y1) / 2), TILE.DIRT);
  };
  // То же, но в абсолютных координатах карты.
  const hollowAbs = (x0, y0, x1, y1, t, gate) => {
    fillAbs(x0, y0, x1, y1, t);
    fillAbs(x0 + 1, y0 + 1, x1 - 1, y1 - 1, TILE.DIRT);
    const mx = Math.floor((x0 + x1) / 2);
    const my = Math.floor((y0 + y1) / 2);
    if (gate === "south") fillAbs(mx, y1, mx, y1, TILE.DIRT);
    else if (gate === "north") fillAbs(mx, y0, mx, y0, TILE.DIRT);
    else if (gate === "west") fillAbs(x0, my, x0, my, TILE.DIRT);
    else if (gate === "east") fillAbs(x1, my, x1, my, TILE.DIRT);
  };

  // Дом с окнами: сплошной блок, но фасады получают оконную текстуру.
  // windowed — какой стороне дать окна: "s" (юг), "n", "e", "w" или массив.
  const addWalls = new Map();
  const house = (x0, y0, x1, y1, t, windowed = "s") => {
    fillRect(x0, y0, x1, y1, t);
    const sides = Array.isArray(windowed) ? windowed : [windowed];
    const windowTile = t === TILE.WOOD ? "wood_window"
      : t === TILE.PLASTER_FRAME ? "plaster_window"
      : "brick_window";

    // Жилой дом — значит, из трубы идёт дым. Сараи (hollowRect) труб
    // не получают: в них не топят.
    addChimney(x0, y0, x1, y1);

    for (const side of sides) {
      const setWin = (x, y) => addWalls.set(`${x + V},${y + V}`, windowTile);
      if (side === "s") for (let x = x0 + 1; x < x1; x += 2) setWin(x, y1);
      else if (side === "n") for (let x = x0 + 1; x < x1; x += 2) setWin(x, y0);
      else if (side === "w") for (let y = y0 + 1; y < y1; y += 2) setWin(x0, y);
      else if (side === "e") for (let y = y0 + 1; y < y1; y += 2) setWin(x1, y);
    }
  };
  // Абсолютные координаты для новых крупных объектов.
  const houseAbs = (x0, y0, x1, y1, t, windowed = "s") => {
    fillAbs(x0, y0, x1, y1, t);
    const sides = Array.isArray(windowed) ? windowed : [windowed];
    const windowTile = t === TILE.WOOD ? "wood_window"
      : t === TILE.PLASTER_FRAME ? "plaster_window"
      : "brick_window";

    for (const side of sides) {
      const setWin = (x, y) => addWalls.set(`${x},${y}`, windowTile);
      if (side === "s") for (let x = x0 + 1; x < x1; x += 2) setWin(x, y1);
      else if (side === "n") for (let x = x0 + 1; x < x1; x += 2) setWin(x, y0);
      else if (side === "w") for (let y = y0 + 1; y < y1; y += 2) setWin(x0, y);
      else if (side === "e") for (let y = y0 + 1; y < y1; y += 2) setWin(x1, y);
    }
  };

  // Трубы: дым идёт из жилых домов, а не из собора и ратуши.
  // Труба ставится на крышу детерминированно, чтобы у одного дома
  // она не переезжала при каждом построении мира.
  const chimneys = [];
  const addChimney = (x0, y0, x1, y1, abs = false) => {
    const rng = createRng(hashSeed(`chimney:${x0}:${y0}:${x1}:${y1}`));
    // У самого края, а не в центре: труба в середине крыши читается
    // как столб, торчащий из конька.
    const nearWest = rng() < 0.5;
    const cx = nearWest ? x0 + 0.6 : x1 - 0.6;
    const cy = y0 + 0.5 + Math.floor(rng() * Math.max(1, y1 - y0));
    chimneys.push({
      x: abs ? cx : cx + V,
      y: abs ? cy : cy + V,
      // Чуть выше конька. Высота в тех же единицах, что и стена:
      // стена дома — 0.5, крыша над карнизом добавляет ещё ~0.22.
      height: 0.82,
      seed: Math.floor(rng() * 997),
    });
  };

  // ── Границы мира ──
  fillAbs(0, 0, MAP_W - 1, 0, TILE.STONE);
  fillAbs(0, MAP_H - 1, MAP_W - 1, MAP_H - 1, TILE.STONE);
  fillAbs(0, 0, 0, MAP_H - 1, TILE.STONE);
  fillAbs(MAP_W - 1, 0, MAP_W - 1, MAP_H - 1, TILE.STONE);

  // ── Тракт на восток и поворот на север ──
  fillAbs(ZONES.ROAD_EAST.x0, ZONES.ROAD_EAST.y0, ZONES.ROAD_EAST.x1, ZONES.ROAD_EAST.y1, TILE.ROAD);
  fillAbs(ZONES.TURN_NORTH.x0, ZONES.TURN_NORTH.y0, ZONES.TURN_NORTH.x1, ZONES.TURN_NORTH.y1, TILE.ROAD);

  // ── Деревня: улицы, площадь ──
  fillRect(8, 96, 40, 97, TILE.ROAD); // нижняя улица
  fillRect(8, 80, 40, 81, TILE.ROAD); // верхняя улица
  fillRect(18, 82, 19, 95, TILE.ROAD); // переулок
  fillAbs(ZONES.SQUARE.x0, ZONES.SQUARE.y0, ZONES.SQUARE.x1, ZONES.SQUARE.y1, TILE.DIRT);

  // ── Вода: озеро на юго-западе и река западнее леса ──
  // В деревенских координатах (со сдвигом V).
  for (let y = 108; y <= 116; y++) {
    for (let x = 4; x <= 22; x++) {
      const dx = (x - 13) / 8.5;
      const dy = (y - 112) / 4.5;
      const d = dx * dx + dy * dy;
      if (d < 0.85 + ((x * 7 + y * 13) % 5) * 0.05) {
        setTile(x + V, y + V, TILE.WATER);
      }
    }
  }

  // Река: извилистая полоса с севера на юг, западнее леса.
  let riverX = 24;
  for (let y = 30; y <= 62; y++) {
    riverX += ((y * 17) % 5) - 2;
    riverX = Math.max(21, Math.min(26, riverX));
    setTile(riverX + V, y + V, TILE.WATER);
    setTile(riverX + 1 + V, y + V, TILE.WATER);
    if (y % 7 === 0) setTile(riverX + 2 + V, y + V, TILE.WATER);
  }

  // Река кончается севернее тракта, поэтому мост не нужен:
  // тракт идёт по y=86..87 и воды там нет.

  // ── Ряд A — север деревни. Фахверк с окнами на юг, к улице. ──
  house(9, 70, 13, 74, TILE.WOOD, "s");
  house(16, 70, 20, 74, TILE.BRICK_FRAME, "s");
  house(24, 70, 28, 74, TILE.PLASTER_FRAME, "s");
  house(32, 70, 36, 74, TILE.BRICK_FRAME, "s");

  // Ряд B — между верхней улицей и площадью
  house(9, 83, 13, 86, TILE.PLASTER_FRAME, "n");
  house(23, 83, 27, 86, TILE.BRICK_FRAME, "n");

  // Ряд C — юг деревни
  house(8, 99, 12, 103, TILE.STONE, "n");
  house(15, 99, 19, 103, TILE.WOOD, "n");
  house(24, 99, 28, 103, TILE.BRICK, "n");
  house(31, 99, 35, 103, TILE.STONE, "n");

  // Дворы: сараи (входимые) и заборы
  hollowRect(31, 84, 35, 88, TILE.WOOD, "south");

  // ── Общественные здания в деревне ──
  // Небольшая часовня 10×12, входимая с запада.
  fillRect(48, 92, 58, 104, TILE.STONE);
  fillRect(49, 93, 57, 103, TILE.DIRT);
  fillRect(48, 97, 48, 99, TILE.DIRT);
  fillRect(56, 96, 57, 100, TILE.STONE);

  // Дом старосты: 14×10, входимый вестибюль.
  fillRect(72, 90, 86, 100, TILE.BRICK_FRAME);
  fillRect(73, 91, 85, 99, TILE.DIRT);
  fillRect(79, 99, 81, 99, TILE.DIRT);

  // ── Таверна у тракта: входимая, со стойкой ──
  fillRect(66, 78, 74, 86, TILE.WOOD);
  fillRect(67, 79, 73, 85, TILE.DIRT);
  fillRect(70, 85, 70, 85, TILE.DIRT); // вход с юга
  // Стойка внутри
  fillRect(68, 80, 72, 80, TILE.WOOD);

  // ── Придорожные постройки за городом ──
  fillRect(50, 74, 54, 78, TILE.PLASTER_FRAME); // придорожный дом
  fillRect(58, 74, 62, 78, TILE.BRICK_FRAME); // корчма
  hollowRect(52, 92, 56, 96, TILE.WOOD, "north"); // сарай у дороги

  // ── Руины: входимые ──
  hollowAbs(ZONES.RUINS.x0, ZONES.RUINS.y0, ZONES.RUINS.x0 + 6, ZONES.RUINS.y0 + 6, TILE.STONE, "east");
  hollowRect(76, 44, 81, 49, TILE.STONE, "south");

  // ── Стойбище ──
  fillAbs(ZONES.CAMP.x0, ZONES.CAMP.y0, ZONES.CAMP.x1, ZONES.CAMP.y1, TILE.DIRT);

  // ── Улицы новых кварталов ──
  // Без них собор, ратуша и квартал хижин стояли бы в глухой траве.
  fillAbs(139, 116, 151, 118, TILE.ROAD);   // подъезд к западному порталу собора
  fillAbs(138, 54, 165, 55, TILE.ROAD);     // к северным воротам ратуши
  fillAbs(138, 55, 139, 66, TILE.ROAD);     // смычка с поворотом на север
  fillAbs(100, 126, 101, 184, TILE.ROAD);   // улица квартала хижин (восточнее часовни)
  fillAbs(100, 160, 122, 161, TILE.ROAD);   // поперечный переулок
  fillAbs(150, 140, 183, 141, TILE.ROAD);   // обход собора с юга
  // Рынок: подъезд от тракта и связка с улицей хижин.
  fillAbs(104, 128, 105, 130, TILE.ROAD);
  fillAbs(100, 148, 128, 149, TILE.ROAD);
  fillAbs(127, 130, 128, 149, TILE.ROAD);

  // ── Собор: готика, 30×44, две башни по фасаду ──
  // Неф с контрфорсами и стрельчатыми окнами, вход с запада.
  const CX0 = ZONES.CATHEDRAL.x0;
  const CY0 = ZONES.CATHEDRAL.y0;
  const CX1 = ZONES.CATHEDRAL.x1;
  const CY1 = ZONES.CATHEDRAL.y1;

  fillAbs(CX0, CY0, CX1, CY1, TILE.STONE);
  // внутренний неф
  fillAbs(CX0 + 4, CY0 + 4, CX1 - 4, CY1 - 4, TILE.DIRT);
  // алтарь на востоке
  fillAbs(CX1 - 6, CY0 + 17, CX1 - 4, CY0 + 25, TILE.STONE);

  // Две башни по фасаду: выше за счёт отдельного материала и зубцов.
  houseAbs(CX0, CY0 - 8, CX0 + 7, CY0 + 5, TILE.BRICK_FRAME, ["w", "n"]);
  houseAbs(CX1 - 7, CY0 - 8, CX1, CY0 + 5, TILE.BRICK_FRAME, ["e", "n"]);
  // контрфорсы по бокам нефа
  for (let y = CY0 + 8; y < CY1 - 4; y += 6) {
    fillAbs(CX0, y, CX0 + 1, y + 2, TILE.STONE);
    fillAbs(CX1 - 1, y, CX1, y + 2, TILE.STONE);
  }
  // Портал режется ПОСЛЕ контрфорсов: иначе они замуровывают вход.
  // Три тайла в ширину: семь превращали фасад в дыру.
  fillAbs(CX0, CY0 + 19, CX0 + 4, CY0 + 21, TILE.DIRT);

  // Высокие стены: рейкастер рисует все стены одной высоты, поэтому собор
  // и ратуша выглядели бы забором. Верх стены растягивается множителем.
  const tallTiles = new Map();
  const markTall = (x0, y0, x1, y1, mul) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) tallTiles.set(`${x},${y}`, mul);
    }
  };
  // Скины: собор — готический камень, ратуша — замковая кладка.
  // Ключ тот же "x,y", значение — имя текстуры из textures.walls.
  const skinTiles = new Map();
  const skin = (x0, y0, x1, y1, name) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) skinTiles.set(`${x},${y}`, name);
    }
  };
  // Собор: корпус 4.5, башни 9 — готика не бывает в три метра.
  markTall(CX0, CY0, CX1, CY1, 4.5);
  markTall(CX0, CY0 - 8, CX0 + 7, CY0 + 5, 9);
  markTall(CX1 - 7, CY0 - 8, CX1, CY0 + 5, 9);
  // Готический камень только на стены: пол и неф остаются полом.
  for (let y = CY0 - 8; y <= CY1; y++) {
    for (let x = CX0; x <= CX1; x++) {
      if (isWallTile(getTile(x, y))) skinTiles.set(`${x},${y}`, "gothic");
    }
  }

  // ── Интерьер собора ──
  // Без этого собор был пустой коробкой: заходишь — и просто большая комната.
  // Два ряда колонн делят неф на три части, как в настоящей готике.
  // Колонны стоят ВПЛОТНУЮ к стенам нефа, а не посреди зала: иначе
  // центральный проход заставлен и обзор перекрыт собственной колонной.
  for (let y = CY0 + 8; y <= CY1 - 12; y += 6) {
    fillAbs(CX0 + 4, y, CX0 + 5, y + 1, TILE.STONE);
    fillAbs(CX1 - 5, y, CX1 - 4, y + 1, TILE.STONE);
  }
  // Боковые часовни: ниши в стенах нефа, по три с каждой стороны.
  for (let i = 0; i < 3; i++) {
    const ny = CY0 + 10 + i * 11;
    // вырез в западной стене — углубление в часовню
    fillAbs(CX0 + 1, ny, CX0 + 5, ny + 4, TILE.DIRT);
    fillAbs(CX0 + 1, ny, CX0 + 1, ny + 4, TILE.STONE);
    // и в восточной
    fillAbs(CX1 - 5, ny, CX1 - 1, ny + 4, TILE.DIRT);
    fillAbs(CX1 - 1, ny, CX1 - 1, ny + 4, TILE.STONE);
  }
  // Скамьи: короткие перегородки у самых стен, чтобы не мешать проходу.
  // Раньше они стояли на CX0+9..CX0+12 — прямо в нефе.
  for (let i = 0; i < 4; i++) {
    const sy = CY0 + 12 + i * 6;
    fillAbs(CX0 + 5, sy, CX0 + 7, sy, TILE.WOOD);
    fillAbs(CX1 - 7, sy, CX1 - 5, sy, TILE.WOOD);
  }
  // Хоры: двухступенчатый помост перед алтарём. По центру оставлен
  // широкий проход — иначе хоры перегораживают неф и к алтарю не пройти.
  const choirY = CY1 - 16;
  fillAbs(CX0 + 6, choirY, CX0 + 12, choirY + 3, TILE.STONE);
  fillAbs(CX1 - 12, choirY, CX1 - 6, choirY + 3, TILE.STONE);
  // Алтарь в восточном конце центрального прохода.
  fillAbs(CX1 - 10, choirY + 1, CX1 - 9, choirY + 2, TILE.STONE);

  // ── Ратуша: башня с зубцами, 24×28 ──
  const RX0 = ZONES.RATHOUSE.x0;
  const RY0 = ZONES.RATHOUSE.y0;
  const RX1 = ZONES.RATHOUSE.x1;
  const RY1 = ZONES.RATHOUSE.y1;

  houseAbs(RX0, RY0, RX1, RY1, TILE.BRICK_FRAME, ["n", "e", "w"]);
  // вестибюль
  fillAbs(RX0 + 4, RY0 + 4, RX1 - 4, RY1 - 4, TILE.DIRT);
  // Зубцы по периметру: только по внешней кромке северной и южной стены.
  // Внутрь они не лезут — иначе зал уменьшается, а вход перекрывается.
  for (let x = RX0 + 1; x < RX1; x += 4) {
    fillAbs(x, RY1, x + 1, RY1, TILE.STONE);
    fillAbs(x, RY0, x + 1, RY0, TILE.STONE);
  }

  // Ратуша: башня Тауэра — массивная, но ниже собора.
  markTall(RX0, RY0, RX1, RY1, 3.2);
  markTall(RX0 + 6, RY0 + 7, RX0 + 10, RY0 + 11, 5.5);
  markTall(RX1 - 10, RY0 + 7, RX1 - 6, RY0 + 11, 5.5);
  for (let y = RY0; y <= RY1; y++) {
    for (let x = RX0; x <= RX1; x++) {
      if (isWallTile(getTile(x, y))) skinTiles.set(`${x},${y}`, "castle");
    }
  }

  // ── Интерьер ратуши ──
  // Пустой зал читался как «просто большая стена». Теперь здесь есть
  // на что смотреть: два ряда колонн, возвышение с троном, ниши в стенах.
  // Колонны делят зал на центральный проход и боковые галереи.
  // Стоят у самых стен: в центре зала колонна перекрывает весь обзор.
  for (let y = RY0 + 9; y <= RY1 - 11; y += 6) {
    fillAbs(RX0 + 4, y, RX0 + 5, y + 1, TILE.STONE);
    fillAbs(RX1 - 5, y, RX1 - 4, y + 1, TILE.STONE);
  }
  // Возвышение в южном конце: помост, но с проходом по центру,
  // иначе к трону не подойти.
  fillAbs(RX0 + 5, RY1 - 8, RX0 + 9, RY1 - 6, TILE.STONE);
  fillAbs(RX1 - 9, RY1 - 8, RX1 - 5, RY1 - 6, TILE.STONE);
  fillAbs(RX0 + 11, RY1 - 7, RX0 + 13, RY1 - 6, TILE.STONE);
  // Ниши-альковы по бокам: стража стоит в них.
  fillAbs(RX0 + 1, RY0 + 10, RX0 + 4, RY0 + 13, TILE.DIRT);
  fillAbs(RX1 - 4, RY0 + 10, RX1 - 1, RY0 + 13, TILE.DIRT);
  // Стол с картами у входа: перегородка с проходом с обеих сторон.
  fillAbs(RX0 + 9, RY0 + 9, RX0 + 15, RY0 + 10, TILE.WOOD);

  // Вход ПОСЛЕДНИМ: зубцы, колонны и помост иначе замуровывают проём.
  fillAbs(RX0 + 11, RY0, RX0 + 13, RY0 + 4, TILE.DIRT);

  // ── Квартал хижин: кривые улочки и лачуги ──
  const HX0 = ZONES.HOVELS.x0;
  const HY0 = ZONES.HOVELS.y0;
  const HX1 = ZONES.HOVELS.x1;
  const HY1 = ZONES.HOVELS.y1;
  fillAbs(HX0, HY0, HX1, HY1, TILE.DIRT);
  // Лачуги расставлены вручную: сеткой они либо сливались в забор,
  // либо давали две штуки на весь квартал. Между домами — переулки.
  // Материал и высота разные, иначе ряд одинаковых коробок читается
  // как одна длинная стена.
  const hovelBlocks = [
    [96, 154], [104, 154], [114, 156],
    [96, 168], [106, 168], [116, 170],
    [104, 176], [114, 178],
  ];
  const hovelMats = [TILE.WOOD, TILE.PLASTER_FRAME, TILE.BRICK, TILE.WOOD];
  for (let i = 0; i < hovelBlocks.length; i++) {
    const [hx, hy] = hovelBlocks[i];
    const w = 4 + (i % 2);
    const h = 3 + (i % 3);
    const mat = hovelMats[i % hovelMats.length];
    fillAbs(hx, hy, hx + w, hy + h, mat);
    // Низкие лачуги: чуть ниже обычного дома, каждая по-своему.
    const lowH = 0.78 + (i % 3) * 0.08;
    for (let y = hy; y <= hy + h; y++) {
      for (let x = hx; x <= hx + w; x++) tallTiles.set(`${x},${y}`, lowH);
    }
  }

  // ── Рынок между деревней и собором ──
  fillAbs(ZONES.MARKET.x0, ZONES.MARKET.y0, ZONES.MARKET.x1, ZONES.MARKET.y1, TILE.DIRT);

  // Лес строится пропами ниже — старые «дырки в траве» убраны.

  // Оконные тайлы записываются в отдельную карту имён: сама карта хранит
  // номера TILE, а текстура окна выбирается по имени. Собираем их здесь,
  // ПОСЛЕ всех построек, чтобы проёмы и стены не перезаписали окна.
  const windowTiles = addWalls;

  const props = [];
  // Деревенские пропсы заданы в старых координатах — сдвигаем на V.
  // Растительность на дороге отбрасывается: лес поверх тракта перекрывал путь.
  const VEGETATION = new Set(["tree", "pine", "deadTree", "bush", "thorn", "hedge", "rock"]);
  const addProp = (sprite, x, y, r, scale, solid = true, blocksSight = false) => {
    const ax = x + V;
    const ay = y + V;
    if (VEGETATION.has(sprite) && isRoadTile(getTile(ax, ay))) return;
    props.push({ sprite, x: ax, y: ay, r, scale, solid, blocksSight });
  };
  // Абсолютные координаты — для собора, ратуши и прочего нового.
  const addPropAbs = (sprite, x, y, r, scale, solid = true, blocksSight = false) => {
    if (VEGETATION.has(sprite) && isRoadTile(getTile(x, y))) return;
    props.push({ sprite, x, y, r, scale, solid, blocksSight });
  };

  // ── Кустарники терна и крестьянские хижины ──
  const thornSpots = [
    [12, 88], [20, 84], [28, 96], [36, 92], [44, 90],
    [18, 102], [26, 104], [34, 98], [48, 88], [52, 96],
    [6, 94], [40, 70], [46, 74], [56, 92], [62, 88],
  ];
  for (const [x, y] of thornSpots) addProp("thorn", x, y, 0.34, 0.8, true, true);

  // Хижины: маленькие дома по краю деревни.
  const huts = [
    [4, 78], [6, 106], [40, 78], [44, 100], [52, 68],
  ];
  for (const [x, y] of huts) addProp("hut", x, y, 0.75, 1.05, true, true);

  // Живые изгороди вдоль улиц.
  for (let x = 20; x <= 34; x += 3) addProp("hedge", x, 100.5, 0.4, 0.7, true, false);

  // ── Лес: кластеры, а не сетка ──
  // Сетка с равным шагом читалась как ряды. Теперь — пятна густоты
  // с прогалинами между ними, детерминированно от сида.
  const forestRng = createRng(hashSeed("forest"));
  const forestTrees = [];

  // 12 центров кластеров внутри зоны леса.
  // Зона леса (70..100, 60..100) не должна залезать на рынок (104..128, 130..148).
  const clusters = [];
  for (let i = 0; i < 12; i++) {
    clusters.push({
      x: ZONES.FOREST.x0 + 4 + forestRng() * (ZONES.FOREST.x1 - ZONES.FOREST.x0 - 8),
      y: ZONES.FOREST.y0 + 4 + forestRng() * (ZONES.FOREST.y1 - ZONES.FOREST.y0 - 8),
      r: 4 + forestRng() * 5,
      density: 0.45 + forestRng() * 0.35,
    });
  }

  for (let y = ZONES.FOREST.y0 + 1; y < ZONES.FOREST.y1; y += 0.9) {
    for (let x = ZONES.FOREST.x0 + 1; x < ZONES.FOREST.x1; x += 0.9) {
      // Коридор к руинам всегда чист (x ≈ 88-90).
      if (x > 86 && x < 91) continue;

      // Насколько точка близка к какому-то кластеру.
      let best = 0;
      for (const c of clusters) {
        const d = Math.hypot(x - c.x, y - c.y);
        if (d < c.r) {
          const weight = (1 - d / c.r) * c.density;
          if (weight > best) best = weight;
        }
      }

      if (best <= 0) continue;
      if (forestRng() > best * 1.6) continue;

      forestTrees.push([
        x + (forestRng() - 0.5) * 0.7,
        y + (forestRng() - 0.5) * 0.7,
        forestRng(),
      ]);
    }
  }

  for (const [x, y, roll] of forestTrees) {
    // Тракт и все новые улицы должны оставаться чистыми: дерево посреди
    // дороги — это не атмосфера, это столб в лицо.
    if (isRoadTile(getTile(x, y))) continue;
    const kind = roll > 0.86 ? "deadTree" : roll > 0.42 ? "pine" : "tree";
    addProp(kind, x, y, kind === "pine" ? 0.42 : 0.36, kind === "pine" ? 1.45 : 1.4, true, true);
  }

  // ── Конюшня у корчмы ──
  addProp("stable", 76.5, 88.5, 0.9, 1.1, true, true);

  // ── Пропы: часовня, дом старосты, таверна ──
  addProp("altar", 57.5, 99, 0.45, 0.85, true, false);
  // Колонны в часовне
  addProp("pillar", 52.5, 96.5, 0.35, 1.4, true, true);
  addProp("pillar", 52.5, 102.5, 0.35, 1.4, true, true);
  addProp("pillar", 56.5, 96.5, 0.35, 1.4, true, true);
  addProp("pillar", 56.5, 102.5, 0.35, 1.4, true, true);
  // Колонны дома старосты
  addProp("pillar", 78.5, 95.5, 0.35, 1.5, true, true);
  addProp("pillar", 86.5, 95.5, 0.35, 1.5, true, true);
  addProp("throne", 82.5, 93.5, 0.5, 1.1, true, false);
  // Таверна: стойка и бочки
  addProp("counter", 70.5, 80.6, 0.55, 0.7, true, false);
  addProp("barrel", 68.5, 84.2, 0.3, 0.55, true, false);
  addProp("barrel", 72.5, 84.2, 0.3, 0.55, true, false);

  // Пропсы стоянки НЕ ставятся здесь: они переезжают вместе с фургоном
  // и создаются в spawnCamp, иначе на новой площадке фургон стоял бы
  // один, а костёр, ящики и бочки оставались на старой.

  // ── Пропы: деревня ──
  addProp("well", 22.2, 88.4, 0.5, 0.9, true, true);
  addProp("sign", 26.0, 97.6, 0.22, 0.8, true, false);
  addProp("basket", 24.4, 89.6, 0.2, 0.4, true, false);
  addProp("basket", 27.2, 90.8, 0.2, 0.4, true, false);
  addProp("haystack", 37.5, 86.5, 0.55, 0.9, true, true);
  addProp("haystack", 38.5, 101.5, 0.55, 0.9, true, true);

  // Заборы по краю деревни
  for (let x = 6; x <= 42; x += 2) {
    addProp("fence", x, 106.5, 0.3, 0.7, true, false);
    addProp("fence", x, 67.4, 0.3, 0.7, true, false);
  }

  // ── Пропы: дорога ──
  addProp("milestone", 44.5, 85.2, 0.2, 0.6, true, false);
  addProp("milestone", 78.5, 85.2, 0.2, 0.6, true, false);
  addProp("windmill", 96.5, 60.5, 1.2, 1.6, true, true);

  // ── Деревья ──
  const trees = [
    // вокруг деревни
    [6.5, 78], [42.5, 76], [5.5, 100], [43.5, 99],
    [46, 70], [64, 70], [70, 78], [88, 72],
    // дорога
    [48, 82], [56, 84], [68, 84], [72, 90], [84, 84], [90, 90],
    // лес
    [32, 22], [40, 28], [48, 34], [36, 44], [44, 52], [52, 24],
    [30, 36], [54, 44], [58, 32], [46, 20], [34, 56], [56, 56],
  ];
  for (const [x, y] of trees) addProp("tree", x, y, 0.36, 1.5, true, true);

  // ── Деревья у новых кварталов (абсолютные координаты) ──
  const eastTrees = [
    [146, 96], [186, 100], [186, 114], [184, 128], [186, 142],
    [140, 148], [132, 152], [128, 168], [136, 180],
    [184, 148], [150, 44], [130, 54], [126, 62],
  ];
  for (const [x, y] of eastTrees) addPropAbs("tree", x, y, 0.36, 1.5, true, true);

  const bushes = [
    [16, 88], [30, 86], [12, 78], [40, 82], [21, 72],
    [62, 82], [74, 86], [88, 78], [56, 68], [72, 68],
    [38, 30], [50, 40], [42, 50], [60, 52], [34, 48],
  ];
  for (const [x, y] of bushes) addProp("bush", x, y, 0.32, 0.7, true, true);

  const rocks = [
    [14, 104], [36, 104], [44, 92], [66, 66], [90, 80],
    [62, 46], [78, 48], [68, 42], [74, 52],
    [26, 64], [50, 62],
  ];
  for (const [x, y] of rocks) addProp("rock", x, y, 0.48, 0.65, true, true);

  // ── Пропсы новых кварталов ──
  // Собор: надгробия, фонари, коновязь у портала.
  for (let i = 0; i < 6; i++) {
    addPropAbs("tombstone", 154 + i * 5, 94, 0.3, 0.55, true, false);
  }
  addPropAbs("lamp", 147.5, 114, 0.2, 0.9, true, false);
  addPropAbs("lamp", 152.5, 122, 0.2, 0.9, true, false);
  addPropAbs("bench", 146.5, 120, 0.35, 0.6, true, false);
  addPropAbs("bench", 146.5, 112, 0.35, 0.6, true, false);

  // Ратуша: стража, знамёна, коновязь.
  addPropAbs("banner", 154.5, 58, 0.3, 1.2, true, false);
  addPropAbs("banner", 174.5, 58, 0.3, 1.2, true, false);
  addPropAbs("bench", 152.5, 56.5, 0.35, 0.6, true, false);
  addPropAbs("well", 145.5, 60.5, 0.5, 0.9, true, true);

  // Рынок: прилавки, корзины, бочки — плотнее, чтобы площадь не была пустой.
  // Часовня занимает 88..98 по x, поэтому рынок начинается с 104.
  addPropAbs("counter", 108.5, 132.5, 0.55, 0.7, true, false);
  addPropAbs("counter", 108.5, 137.5, 0.55, 0.7, true, false);
  addPropAbs("counter", 116.5, 134.5, 0.55, 0.7, true, false);
  addPropAbs("counter", 122.5, 139.5, 0.55, 0.7, true, false);
  addPropAbs("basket", 106.5, 135.5, 0.2, 0.4, true, false);
  addPropAbs("basket", 110.5, 140.5, 0.2, 0.4, true, false);
  addPropAbs("basket", 114.5, 132.5, 0.2, 0.4, true, false);
  addPropAbs("barrel", 106.5, 141.5, 0.3, 0.55, true, false);
  addPropAbs("barrel", 120.5, 136.5, 0.3, 0.55, true, false);
  addPropAbs("barrel", 124.5, 142.5, 0.3, 0.55, true, false);
  addPropAbs("lamp", 112.5, 130.5, 0.2, 0.9, true, false);
  addPropAbs("lamp", 122.5, 146.5, 0.2, 0.9, true, false);

  // Квартал хижин: колодцы, заборы, костры.
  addPropAbs("well", 104.5, 166.5, 0.5, 0.9, true, true);
  addPropAbs("haystack", 110.5, 155.5, 0.55, 0.9, true, true);
  addPropAbs("haystack", 118.5, 170.5, 0.55, 0.9, true, true);
  addPropAbs("sign", 103.5, 150.5, 0.22, 0.8, true, false);
  addPropAbs("thorn", 108.5, 158.5, 0.34, 0.8, true, true);
  addPropAbs("thorn", 116.5, 154.5, 0.34, 0.8, true, true);
  addPropAbs("thorn", 120.5, 176.5, 0.34, 0.8, true, true);

  const actors = [];

  const merchant = makeActor("merchant", MERCHANT_POS.x, MERCHANT_POS.y, {
    hp: 9999,
    maxHp: 9999,
    speed: 0,
    viewRange: 0,
  });
  actors.push(merchant);

  const villageGuard = makeActor("village_guard", 22.5 + V, 94.5 + V, {
    hp: 70,
    maxHp: 70,
    damage: 10,
    speed: 2.2,
    viewRange: 9,
    patrol: [
      { x: 22.5 + V, y: 94.5 + V },
      { x: 30.5 + V, y: 94.5 + V },
      { x: 30.5 + V, y: 88.5 + V },
      { x: 22.5 + V, y: 88.5 + V },
    ],
  });
  actors.push(villageGuard);

  const courtesan = makeActor("courtesan", COURTESAN_POS.x, COURTESAN_POS.y, {
    hp: 9999,
    maxHp: 9999,
    speed: 0,
    viewRange: 0,
    spriteKey: "courtesan",
    spot: "square",
  });
  actors.push(courtesan);

  // Остальные куртизанки: тот же вид, другие места.
  const courtesans = [courtesan];
  for (const spot of ["inn", "forest", "camp"]) {
    const pos = COURTESAN_SPOTS_POS[spot];
    if (!pos) continue;
    const extra = makeActor("courtesan", pos.x, pos.y, {
      hp: 9999,
      maxHp: 9999,
      speed: 0,
      viewRange: 0,
      spriteKey: "courtesan",
      spot,
    });
    actors.push(extra);
    courtesans.push(extra);
  }

  const world = {
    map,
    props,
    actors,
    merchant,
    villageGuard,
    courtesan,
    courtesans,
    merchants: undefined,
    civilians: [],
    // Лошади: конюшенная и (по разблокировке) личная.
    horses: [],
    // Фасады с окнами: ключ "x,y" → имя текстуры стены.
    windowTiles,
    // Высокие здания: ключ "x,y" → множитель высоты стены.
    tallTiles,
    // Скины зданий: ключ "x,y" → имя текстуры стены.
    skinTiles,
    // Титан живёт отдельно от actors: spawnCamp его не трогает,
    // а диспетчер врагов не принимает его за стражника.
    titan: null,
    spawn: { ...SPAWN },
    wagon: { ...WAGON_BASE },
    // Сид забега: от него зависит, где встанет стоянка. Ставится снаружи,
    // в main.js; по умолчанию 0 — тогда стоянка на первой площадке.
    seed: 0,
    // Текущая площадка стоянки. Заполняется в spawnCamp.
    campSite: CAMP_SITES[0],
    campOrigin: { ...CAMP_SITES[0] },
    tier: 1,
    wagonLooted: false,
    campGuards: [],
    animals: [],
    archetype: "road_camp",
    layout: CAMP_LAYOUTS.road_camp,
    dormantGuards: [],
    secondWagon: null,
    // Трубы жилых домов: источник дыма. Считаются один раз при
    // построении мира и не меняются.
    chimneys,
  };

  spawnCamp(world, 1);
  return world;
}

// Единая фабрика актёров.
export function makeActor(kind, x, y, options = {}) {
  return {
    id: nextActorId++,
    kind,
    spriteKey: kind,
    x,
    y,
    r: kind === "driver" ? 0.3 : 0.32,
    hp: 40,
    maxHp: 40,
    damage: 7,
    speed: 2,
    viewRange: 8,
    state: "idle",
    suspicion: 0,
    attackCd: 0,
    angle: 0,
    patrol: [],
    patrolIndex: 0,
    homeX: x,
    homeY: y,
    alive: true,
    alertTimer: 0,
    lostTimer: 0,
    lastSeenX: null,
    lastSeenY: null,
    asleep: false,
    ...options,
  };
}

function guardPatrol(x, y) {
  return [
    { x, y },
    { x: x + 1.4, y: y + 1.2 },
    { x: x + 0.6, y: y + 2.2 },
    { x: x - 0.8, y: y + 1.0 },
  ];
}

// Позиции стоянки: несколько разметанных полян внутри зоны лагеря.
// Пустая зона CAMP — это 132..150 x 58..80. Точки выбраны так, чтобы
// вокруг фургона хватало места под стражу, костёр и лошадь.
export const CAMP_SITES = [
  { x: 142.4, y: 68.1 }, // прежняя, у дороги
  { x: 138.5, y: 62.0 }, // у северного края
  { x: 146.0, y: 75.0 }, // южнее, ближе к лесу
  { x: 136.0, y: 72.5 }, // западнее, у поворота
  { x: 145.5, y: 63.0 }, // северо-восток зоны
];

// Какую площадку занять: детерминированно от сида забега и тира.
export function campSiteFor(seed, tier) {
  const rng = createRng(hashSeed(`camp-site:${seed}:${tier}`));
  return CAMP_SITES[Math.floor(rng() * CAMP_SITES.length) % CAMP_SITES.length];
}

function campPoint(offset, origin = CAMP_ORIGIN) {
  return [origin.x + offset[0], origin.y + offset[1]];
}

// tuning приходит из style.js (tuningFor).
export function spawnCamp(world, tier, tuning = null) {
  const archetype = (tuning && tuning.archetype) || "road_camp";
  const layout = CAMP_LAYOUTS[archetype] || CAMP_LAYOUTS.road_camp;
  const mods = tuning || {};

  // Стоянка переезжает: площадка выбирается по сиду забега и тиру,
  // чтобы каждый караван стоял в новом месте, но перезагрузка
  // возвращала тот же лагерь.
  const site = campSiteFor(world.seed || 0, tier);
  world.campSite = site;
  const origin = { x: site.x, y: site.y };
  world.campOrigin = origin;
  const point = (offset) => campPoint(offset, origin);

  world.actors = world.actors.filter((a) => a.kind !== "guard" && a.kind !== "driver");
  world.tier = tier;
  world.wagonLooted = false;
  world.archetype = archetype;
  world.layout = layout;

  const [wx, wy] = point(layout.wagon);
  world.wagon = { x: wx, y: wy };

  // ── Пропсы стоянки ──
  // Переезжают вместе с фургоном. Сначала убираем прошлые, иначе
  // на карте копились бы лагеря от каждого каравана.
  world.props = world.props.filter((p) => !p.campProp);
  const campProp = (sprite, dx, dy, r, scale, blocksSight) => {
    world.props.push({
      sprite,
      x: wx + dx,
      y: wy + dy,
      r,
      scale,
      solid: true,
      blocksSight,
      campProp: true,
    });
  };
  world.props.push({
    sprite: "wagon",
    x: wx,
    y: wy,
    r: 1.15,
    scale: 0.95,
    solid: true,
    blocksSight: true,
    campProp: true,
  });
  campProp("horse", 2.8, -1.2, 0.55, 0.85, true);
  campProp("campfire", -3.1, -1.3, 0.32, 0.5, false);
  campProp("crate", -1.4, -1.7, 0.36, 0.6, false);
  campProp("crate", 3.3, 2.8, 0.36, 0.6, false);
  campProp("barrel", -3.0, 1.8, 0.32, 0.55, false);
  campProp("barrel", 3.5, -2.0, 0.32, 0.55, false);

  const hpScale = mods.hp || 1;
  const damageScale = mods.damage || 1;
  const viewScale = mods.viewRange || 1;
  const baseCount = tier + 1;
  const guardCount = Math.min(
    Math.max(1, baseCount + (mods.guardCountDelta || 0)),
    layout.guardSpots.length
  );

  world.campGuards = [];
  world.dormantGuards = [];

  for (let i = 0; i < guardCount; i++) {
    const [x, y] = point(layout.guardSpots[i]);
    // Баланс: на первом тире двое стражей снимали ~63 HP и убивали новичка.
    // 26 + tier*12 при тире 1 даёт 38 HP вместо 52.
    const hp = Math.round((26 + tier * 12) * hpScale);
    const guard = makeActor("guard", x, y, {
      hp,
      maxHp: hp,
      damage: Math.max(4, Math.round((5 + tier * 1.5) * damageScale)),
      speed: 2.0 + tier * 0.08,
      viewRange: (8 + tier * 0.4) * viewScale,
      angle: Math.PI / 2,
      patrol: guardPatrol(x, y),
      patrolIndex: 1,
    });
    world.actors.push(guard);
    world.campGuards.push(guard);
  }

  for (const [ox, oy, opts] of layout.extra || []) {
    const [x, y] = point([ox, oy]);
    const hp = Math.round((20 + tier * 9) * hpScale);
    const sleeper = makeActor("guard", x, y, {
      hp,
      maxHp: hp,
      damage: Math.max(4, Math.round((4 + tier * 1.5) * damageScale)),
      speed: 2.0 + tier * 0.08,
      viewRange: (7 + tier * 0.4) * viewScale,
      angle: Math.PI / 2,
      patrol: [{ x, y }],
      asleep: true,
      ...(opts || {}),
    });
    world.actors.push(sleeper);
    world.campGuards.push(sleeper);
    world.dormantGuards.push(sleeper);
  }

  const [dx, dy] = point(layout.driver);
  const driverHp = Math.round((22 + tier * 6) * hpScale);
  const driver = makeActor("driver", dx, dy, {
    hp: driverHp,
    maxHp: driverHp,
    damage: 3,
    speed: 2.6,
    viewRange: 7 * viewScale,
    angle: Math.PI / 2,
    patrol: [{ x: dx, y: dy }],
    homeX: dx,
    homeY: dy,
  });
  world.actors.push(driver);
  world.campGuards.push(driver);

  world.secondWagon = null;
  if (layout.secondWagon) {
    const [sx, sy] = point(layout.secondWagon);
    world.secondWagon = { x: sx, y: sy, looted: false };
  }

  return world;
}

// Добор спящих стражей, если игрок нашумел рядом.
export function wakeSleepers(world, x, y, radius = 7) {
  let woken = 0;
  for (const guard of world.dormantGuards || []) {
    if (!guard.alive || !guard.asleep) continue;
    if (Math.hypot(guard.x - x, guard.y - y) > radius) continue;
    guard.asleep = false;
    guard.suspicion = Math.max(guard.suspicion, 0.9);
    guard.state = "return";
    woken++;
  }
  return woken;
}

export function isSolid(world, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H) return true;
  const tile = world.map[cy * MAP_W + cx];
  // Вода непроходима, но для рендера стен это не стена: вода рисуется полом.
  return isWallTile(tile) || isWaterTile(tile);
}

export function tileAt(world, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H) return TILE.STONE;
  return world.map[cy * MAP_W + cx];
}

export function circleHitsWall(world, x, y, r) {
  if (isSolid(world, x, y)) return true;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    if (isSolid(world, x + Math.cos(a) * r, y + Math.sin(a) * r)) return true;
  }
  return false;
}

export function canStand(world, x, y, r, ignore = null) {
  if (circleHitsWall(world, x, y, r)) return false;

  for (const prop of world.props) {
    if (!prop.solid) continue;
    const dx = x - prop.x;
    const dy = y - prop.y;
    if (dx * dx + dy * dy < (r + prop.r) * (r + prop.r)) return false;
  }

  for (const actor of world.actors) {
    if (actor === ignore || !actor.alive) continue;
    const dx = x - actor.x;
    const dy = y - actor.y;
    if (dx * dx + dy * dy < (r + actor.r) * (r + actor.r)) return false;
  }

  for (const animal of world.animals || []) {
    if (!animal.alive) continue;
    const dx = x - animal.x;
    const dy = y - animal.y;
    if (dx * dx + dy * dy < (r + animal.r) * (r + animal.r)) return false;
  }

  // Гражданские блокируют, но их радиус меньше, чтобы не запирать проходы.
  // ignore обязателен: без него гражданский блокирует сам себя и не может
  // сдвинуться ни на шаг (паника от титана упиралась в собственное тело).
  for (const person of world.civilians || []) {
    if (!person.alive || person === ignore) continue;
    const dx = x - person.x;
    const dy = y - person.y;
    const pr = (person.r || 0.3) * 0.85;
    if (dx * dx + dy * dy < (r + pr) * (r + pr)) return false;
  }

  // Лошади блокируют, но чуть меньше своего визуального размера.
  for (const horse of world.horses || []) {
    if (!horse.alive) continue;
    const dx = x - horse.x;
    const dy = y - horse.y;
    const hr = (horse.r || 0.55) * 0.8;
    if (dx * dx + dy * dy < (r + hr) * (r + hr)) return false;
  }
  return true;
}

// Движение по осям отдельно — позволяет скользить вдоль стен.
export function moveActor(world, actor, dx, dy, r = actor.r) {
  if (dx !== 0 && canStand(world, actor.x + dx, actor.y, r, actor)) actor.x += dx;
  if (dy !== 0 && canStand(world, actor.x, actor.y + dy, r, actor)) actor.y += dy;
}

function pointSegmentDistance(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;
  let t = lenSq > 0 ? ((px - x1) * vx + (py - y1) * vy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + vx * t;
  const cy = y1 + vy * t;
  return Math.hypot(px - cx, py - cy);
}

export function lineOfSight(world, x1, y1, x2, y2) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.ceil(dist / 0.12);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isSolid(world, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
  }
  for (const prop of world.props) {
    if (!prop.blocksSight) continue;
    if (pointSegmentDistance(prop.x, prop.y, x1, y1, x2, y2) < prop.r * 0.85) return false;
  }
  return true;
}

export function nearestInteraction(world, player) {
  const candidates = [];

  if (!world.wagonLooted) {
    candidates.push({
      type: "wagon",
      x: world.wagon.x,
      y: world.wagon.y,
      radius: 2.5,
      label: "Удерживайте E — обыскать фургон",
    });
  }

  if (world.secondWagon && !world.secondWagon.looted) {
    candidates.push({
      type: "wagon",
      x: world.secondWagon.x,
      y: world.secondWagon.y,
      radius: 2.3,
      label: "Удерживайте E — обыскать второй фургон",
      second: true,
    });
  }

  const merchant = world.merchant;
  candidates.push({
    type: "merchant",
    x: merchant.x,
    y: merchant.y,
    radius: 2.3,
    label: "E — поговорить со скупщиком",
  });

  if (world.courtesan) {
    const c = world.courtesan;
    candidates.push({
      type: "courtesan",
      spot: c.spot || "square",
      x: c.x,
      y: c.y,
      radius: 2.2,
      label: `E — подойти к ${c.displayName || "куртизанке"}`,
    });
  }

  // Остальные куртизанки: каждая отдельная цель со своим ключом места.
  for (const c of world.courtesans || []) {
    if (c === world.courtesan) continue;
    candidates.push({
      type: "courtesan",
      spot: c.spot,
      x: c.x,
      y: c.y,
      radius: 2.2,
      label: `E — подойти к ${c.displayName || "куртизанке"}`,
    });
  }

  // Гражданские: с ними можно поговорить.
  for (const c of world.civilians || []) {
    candidates.push({
      type: "civilian",
      civilianId: c.id,
      x: c.x,
      y: c.y,
      radius: 1.9,
      label: `E — заговорить (${c.label})`,
    });
  }

  // Лошади: сесть в седло.
  for (const h of world.horses || []) {
    if (!h.alive) continue;
    candidates.push({
      type: "horse",
      horseId: h.id,
      x: h.x,
      y: h.y,
      radius: 2.0,
      label: `E — сесть на ${h.label.toLowerCase()}`,
    });
  }

  // Титан: единственный, с кем можно договориться.
  if (world.titan && world.titan.alive) {
    candidates.push({
      type: "titan",
      x: world.titan.x,
      y: world.titan.y,
      radius: 3.2,
      label: "E — заговорить с титаном",
    });
  }

  let best = null;
  for (const c of candidates) {
    const dist = Math.hypot(player.x - c.x, player.y - c.y);
    if (dist <= c.radius && (!best || dist < best.dist)) best = { ...c, dist };
  }
  return best;
}

// ── Проверки карты (используются тестами) ───────────────────────────

// Проходимость по тайлам и препятствиям: есть ли путь от точки до точки.
export function hasPath(world, from, to, radius = 0.3) {
  if (!canStand(world, from.x, from.y, radius)) {
    // Старт может быть занят актёром — проверяем только стены.
    if (isSolid(world, from.x, from.y)) return false;
  }

  const startX = Math.floor(from.x);
  const startY = Math.floor(from.y);
  const goalX = Math.floor(to.x);
  const goalY = Math.floor(to.y);

  if (isSolid(world, goalX + 0.5, goalY + 0.5)) return false;

  const seen = new Uint8Array(MAP_W * MAP_H);
  const queue = [[startX, startY]];
  seen[startY * MAP_W + startX] = 1;

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (queue.length) {
    const [cx, cy] = queue.shift();
    if (cx === goalX && cy === goalY) return true;

    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const index = ny * MAP_W + nx;
      if (seen[index]) continue;
      if (isWallTile(map_safe(world, nx, ny))) continue;
      seen[index] = 1;
      queue.push([nx, ny]);
    }
  }

  return false;
}

function map_safe(world, x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return TILE.STONE;
  return world.map[y * MAP_W + x];
}
