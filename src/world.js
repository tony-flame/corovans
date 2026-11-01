// Карта 120×120, коллизии, актёры и стоянка каравана.
// Мир строится зонами: деревня, тракт, поворот, стойбище, поля, лес, руины.
// Координаты — код, не данные.

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

export const MAP_W = 120;
export const MAP_H = 120;

// ── Зоны мира ───────────────────────────────────────────────────────
export const ZONES = {
  VILLAGE: { x0: 6, y0: 68, x1: 44, y1: 104 },
  SQUARE: { x0: 14, y0: 84, x1: 30, y1: 92 },
  ROAD_EAST: { y0: 86, y1: 87, x0: 4, x1: 104 },
  TURN_NORTH: { x0: 98, y0: 26, x1: 99, y1: 86 },
  CAMP: { x0: 92, y0: 18, x1: 110, y1: 40 },
  FIELDS: { x0: 46, y0: 70, x1: 90, y1: 100 },
  RUINS: { x0: 60, y0: 40, x1: 70, y1: 50 },
  FOREST: { x0: 30, y0: 20, x1: 60, y1: 60 },
};

export const SPAWN = { x: 12.5, y: 92.5 };
export const MERCHANT_POS = { x: 20.5, y: 90.5 };
export const COURTESAN_POS = { x: 26.5, y: 79.5 };

// Четыре куртизанки в разных местах. Ключ места — то, чем запоминается дружба.
export const COURTESAN_SPOTS_POS = {
  square: { x: 26.5, y: 79.5 },
  inn: { x: 60.5, y: 79.6 },
  forest: { x: 46.5, y: 52.5 },
  camp: { x: 95.5, y: 31.5 },
};
export const WAGON_BASE = { x: 102.4, y: 28.1 };

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
  const fillRect = (x0, y0, x1, y1, t) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) setTile(x, y, t);
    }
  };
  // Открытая коробка: стены по периметру и проём с одной стороны.
  const hollowRect = (x0, y0, x1, y1, t, gate) => {
    fillRect(x0, y0, x1, y1, t);
    fillRect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, TILE.DIRT);
    if (gate === "south") fillRect(Math.floor((x0 + x1) / 2), y1, Math.floor((x0 + x1) / 2), y1, TILE.DIRT);
    else if (gate === "north") fillRect(Math.floor((x0 + x1) / 2), y0, Math.floor((x0 + x1) / 2), y0, TILE.DIRT);
    else if (gate === "west") fillRect(x0, Math.floor((y0 + y1) / 2), x0, Math.floor((y0 + y1) / 2), TILE.DIRT);
    else if (gate === "east") fillRect(x1, Math.floor((y0 + y1) / 2), x1, Math.floor((y0 + y1) / 2), TILE.DIRT);
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

    for (const side of sides) {
      const setWin = (x, y) => addWalls.set(`${x},${y}`, windowTile);
      if (side === "s") for (let x = x0 + 1; x < x1; x += 2) setWin(x, y1);
      else if (side === "n") for (let x = x0 + 1; x < x1; x += 2) setWin(x, y0);
      else if (side === "w") for (let y = y0 + 1; y < y1; y += 2) setWin(x0, y);
      else if (side === "e") for (let y = y0 + 1; y < y1; y += 2) setWin(x1, y);
    }
  };

  // ── Границы мира ──
  fillRect(0, 0, MAP_W - 1, 0, TILE.STONE);
  fillRect(0, MAP_H - 1, MAP_W - 1, MAP_H - 1, TILE.STONE);
  fillRect(0, 0, 0, MAP_H - 1, TILE.STONE);
  fillRect(MAP_W - 1, 0, MAP_W - 1, MAP_H - 1, TILE.STONE);

  // ── Тракт на восток и поворот на север ──
  fillRect(ZONES.ROAD_EAST.x0, ZONES.ROAD_EAST.y0, ZONES.ROAD_EAST.x1, ZONES.ROAD_EAST.y1, TILE.ROAD);
  fillRect(ZONES.TURN_NORTH.x0, ZONES.TURN_NORTH.y0, ZONES.TURN_NORTH.x1, ZONES.TURN_NORTH.y1, TILE.ROAD);

  // ── Деревня: улицы, площадь ──
  fillRect(8, 96, 40, 97, TILE.ROAD); // нижняя улица
  fillRect(8, 80, 40, 81, TILE.ROAD); // верхняя улица
  fillRect(18, 82, 19, 95, TILE.ROAD); // переулок
  fillRect(ZONES.SQUARE.x0, ZONES.SQUARE.y0, ZONES.SQUARE.x1, ZONES.SQUARE.y1, TILE.DIRT);

  // ── Вода: озеро на юго-западе и река западнее леса ──
  // Важно: вода НЕ должна пересекаться с домами и дорогами — поэтому
  // озеро вынесено ниже деревни (y >= 108), а река идёт западнее леса.
  for (let y = 108; y <= 116; y++) {
    for (let x = 4; x <= 22; x++) {
      const dx = (x - 13) / 8.5;
      const dy = (y - 112) / 4.5;
      const d = dx * dx + dy * dy;
      if (d < 0.85 + ((x * 7 + y * 13) % 5) * 0.05) {
        setTile(x, y, TILE.WATER);
      }
    }
  }

  // Река: извилистая полоса с севера на юг, западнее леса (лес начинается с x=30).
  let riverX = 24;
  for (let y = 30; y <= 62; y++) {
    riverX += ((y * 17) % 5) - 2;
    riverX = Math.max(21, Math.min(26, riverX));
    setTile(riverX, y, TILE.WATER);
    setTile(riverX + 1, y, TILE.WATER);
    if (y % 7 === 0) setTile(riverX + 2, y, TILE.WATER);
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

  // ── Храм: крупное здание на востоке деревни, входимое ──
  // Корпус 12×14 с нефом внутри и входом с запада.
  fillRect(48, 92, 60, 106, TILE.STONE);
  fillRect(49, 93, 59, 105, TILE.DIRT); // внутренний пол
  // Вход: проём в западной стене
  fillRect(48, 98, 48, 100, TILE.DIRT);
  // Алтарь — выступ в восточной стене
  fillRect(58, 97, 59, 101, TILE.STONE);
  // ── Дворец/ратуша: северо-восток, входимый вестибюль ──
  fillRect(72, 90, 92, 104, TILE.BRICK_FRAME);
  fillRect(73, 91, 91, 103, TILE.DIRT);
  // Вход с юга
  fillRect(81, 103, 83, 103, TILE.DIRT);
  // Колонны внутри вестибюля (пропы добавятся позже)
  fillRect(78, 95, 78, 95, TILE.STONE);
  fillRect(86, 95, 86, 95, TILE.STONE);

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
  hollowRect(ZONES.RUINS.x0, ZONES.RUINS.y0, ZONES.RUINS.x0 + 6, ZONES.RUINS.y0 + 6, TILE.STONE, "east");
  hollowRect(76, 44, 81, 49, TILE.STONE, "south");

  // ── Стойбище ──
  fillRect(ZONES.CAMP.x0, ZONES.CAMP.y0, ZONES.CAMP.x1, ZONES.CAMP.y1, TILE.DIRT);

  // Лес строится пропами ниже — старые «дырки в траве» убраны.

  // Оконные тайлы записываются в отдельную карту имён: сама карта хранит
  // номера TILE, а текстура окна выбирается по имени. Собираем их здесь,
  // ПОСЛЕ всех построек, чтобы проёмы и стены не перезаписали окна.
  const windowTiles = addWalls;

  const props = [];
  const addProp = (sprite, x, y, r, scale, solid = true, blocksSight = false) => {
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

  // ── Лес: настоящие деревья, а не дырки в траве ──
  // Тропа идёт через лес к руинам, поэтому оставляем коридор x≈48-50.
  const forestTrees = [];
  for (let y = ZONES.FOREST.y0 + 1; y <= ZONES.FOREST.y1 - 1; y += 2.2) {
    for (let x = ZONES.FOREST.x0 + 1; x <= ZONES.FOREST.x1 - 1; x += 2.4) {
      // Коридор к руинам
      if (x > 46 && x < 51) continue;
      // Разрежение ближе к краю, чтобы лес не был стеной
      const edge = Math.min(
        x - ZONES.FOREST.x0,
        ZONES.FOREST.x1 - x,
        y - ZONES.FOREST.y0,
        ZONES.FOREST.y1 - y
      );
      if (edge < 3 && (Math.round(x * 3 + y * 7) % 3 !== 0)) continue;

      forestTrees.push([x + ((Math.round(y * 13) % 7) - 3) * 0.12, y]);
    }
  }
  for (let i = 0; i < forestTrees.length; i++) {
    const [x, y] = forestTrees[i];
    // Треть — ели, каждая седьмая — сухая.
    const kind = i % 7 === 0 ? "deadTree" : i % 3 === 0 ? "pine" : "tree";
    addProp(kind, x, y, kind === "pine" ? 0.42 : 0.36, kind === "pine" ? 1.45 : 1.4, true, true);
  }

  // ── Конюшня у корчмы ──
  addProp("stable", 76.5, 88.5, 0.9, 1.1, true, true);

  // ── Пропы: храм, дворец, таверна ──
  addProp("altar", 57.5, 99, 0.45, 0.85, true, false);
  // Колонны в храме
  addProp("pillar", 52.5, 96.5, 0.35, 1.4, true, true);
  addProp("pillar", 52.5, 102.5, 0.35, 1.4, true, true);
  addProp("pillar", 56.5, 96.5, 0.35, 1.4, true, true);
  addProp("pillar", 56.5, 102.5, 0.35, 1.4, true, true);
  // Колонны дворца
  addProp("pillar", 78.5, 95.5, 0.35, 1.5, true, true);
  addProp("pillar", 86.5, 95.5, 0.35, 1.5, true, true);
  addProp("throne", 82.5, 93.5, 0.5, 1.1, true, false);
  // Таверна: стойка и бочки
  addProp("counter", 70.5, 80.6, 0.55, 0.7, true, false);
  addProp("barrel", 68.5, 84.2, 0.3, 0.55, true, false);
  addProp("barrel", 72.5, 84.2, 0.3, 0.55, true, false);

  // ── Пропы: стоянка ──
  addProp("wagon", WAGON_BASE.x, WAGON_BASE.y, 1.15, 0.95, true, true);
  addProp("horse", WAGON_BASE.x + 2.8, WAGON_BASE.y - 1.2, 0.55, 0.85, true, true);
  addProp("campfire", WAGON_BASE.x - 3.1, WAGON_BASE.y - 1.3, 0.32, 0.5, true, false);
  addProp("crate", WAGON_BASE.x - 1.4, WAGON_BASE.y - 1.7, 0.36, 0.6, true, false);
  addProp("crate", WAGON_BASE.x + 3.3, WAGON_BASE.y + 2.8, 0.36, 0.6, true, false);
  addProp("barrel", WAGON_BASE.x - 3.0, WAGON_BASE.y + 1.8, 0.32, 0.55, true, false);
  addProp("barrel", WAGON_BASE.x + 3.5, WAGON_BASE.y - 2.0, 0.32, 0.55, true, false);

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
    // восток
    [104, 60], [108, 46], [100, 44], [112, 32], [106, 22],
    [86, 60], [92, 64], [80, 64],
  ];
  for (const [x, y] of trees) addProp("tree", x, y, 0.36, 1.5, true, true);

  const bushes = [
    [16, 88], [30, 86], [12, 78], [40, 82], [21, 72],
    [62, 82], [74, 86], [88, 78], [56, 68], [72, 68],
    [38, 30], [50, 40], [42, 50], [60, 52], [34, 48],
    [96, 70], [104, 52], [100, 36], [110, 40],
  ];
  for (const [x, y] of bushes) addProp("bush", x, y, 0.32, 0.7, true, true);

  const rocks = [
    [14, 104], [36, 104], [44, 92], [66, 66], [90, 80],
    [62, 46], [78, 48], [68, 42], [74, 52],
    [102, 50], [110, 28], [96, 34], [104, 18],
    [26, 64], [50, 62],
  ];
  for (const [x, y] of rocks) addProp("rock", x, y, 0.48, 0.65, true, true);

  const actors = [];

  const merchant = makeActor("merchant", MERCHANT_POS.x, MERCHANT_POS.y, {
    hp: 9999,
    maxHp: 9999,
    speed: 0,
    viewRange: 0,
  });
  actors.push(merchant);

  const villageGuard = makeActor("village_guard", 22.5, 94.5, {
    hp: 70,
    maxHp: 70,
    damage: 10,
    speed: 2.2,
    viewRange: 9,
    patrol: [
      { x: 22.5, y: 94.5 },
      { x: 30.5, y: 94.5 },
      { x: 30.5, y: 88.5 },
      { x: 22.5, y: 88.5 },
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
    // Титан живёт отдельно от actors: spawnCamp его не трогает,
    // а диспетчер врагов не принимает его за стражника.
    titan: null,
    spawn: { ...SPAWN },
    wagon: { ...WAGON_BASE },
    tier: 1,
    wagonLooted: false,
    campGuards: [],
    animals: [],
    archetype: "road_camp",
    layout: CAMP_LAYOUTS.road_camp,
    dormantGuards: [],
    secondWagon: null,
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

function campPoint(offset) {
  return [CAMP_ORIGIN.x + offset[0], CAMP_ORIGIN.y + offset[1]];
}

// tuning приходит из style.js (tuningFor).
export function spawnCamp(world, tier, tuning = null) {
  const archetype = (tuning && tuning.archetype) || "road_camp";
  const layout = CAMP_LAYOUTS[archetype] || CAMP_LAYOUTS.road_camp;
  const mods = tuning || {};

  world.actors = world.actors.filter((a) => a.kind !== "guard" && a.kind !== "driver");
  world.tier = tier;
  world.wagonLooted = false;
  world.archetype = archetype;
  world.layout = layout;

  const [wx, wy] = campPoint(layout.wagon);
  world.wagon = { x: wx, y: wy };

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
    const [x, y] = campPoint(layout.guardSpots[i]);
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
    const [x, y] = campPoint([ox, oy]);
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

  const [dx, dy] = campPoint(layout.driver);
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
    const [sx, sy] = campPoint(layout.secondWagon);
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
  for (const person of world.civilians || []) {
    if (!person.alive) continue;
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
