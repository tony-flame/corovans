// Гражданские: фон мира, а не бойцы. Чистый модуль.
// Живут в world.civilians, никогда не попадают в updateGuard.

import { createRng, hashSeed } from "./rng.js";

export const CIVILIAN_KINDS = {
  PEASANT_W: "peasant_w",
  PEASANT_M: "peasant_m",
  GREENGROCER: "greengrocer",
  DRUNK: "drunk",
  BEGGAR: "beggar",
  TRAVELER: "traveler",
};

export const CIVILIAN_DEFS = {
  peasant_w: {
    label: "Крестьянка",
    sprite: "peasant_w",
    speed: 0.5,
    lines: [
      "«Караван снова стоит на севере. Охраны у них — как у герцога.»",
      "«Колодец чистили весной. Вода всё равно с песком.»",
      "«Мой муж ушёл на тракт и не вернулся. Третий месяц.»",
      "«К ночи в деревне тихо. Слишком тихо, если спросишь меня.»",
    ],
  },
  peasant_m: {
    label: "Крестьянин",
    sprite: "peasant_m",
    speed: 0.55,
    lines: [
      "«Караванщики платят за постой, а мнут траву. Ничего, переживём.»",
      "«Стража ходит по площади, а толку? Воруют всё равно.»",
      "«Раньше на дороге было спокойно. Теперь — как повезёт.»",
      "«Не стой у меня на пути, мил человек, у меня скотина не кормлена.»",
    ],
  },
  greengrocer: {
    label: "Торговка зеленью",
    sprite: "greengrocer",
    speed: 0,
    trader: true,
    lines: [
      "«Свежее всё, с грядки. Не то что у Мардо — тот торгует чем попало.»",
      "«Дёшево отдаю. Дорога нынче неспокойная, лучше продать, чем потерять.»",
      "«Купи репу. Мясо у вас, героев, всё равно не каждый день.»",
    ],
  },
  drunk: {
    label: "Пьяница",
    sprite: "drunk",
    speed: 0.35,
    rumormonger: true,
    lines: [
      "«Дай монету, и я расскажу то, что стража за деньги не скажет.»",
      "«Я тут тридцать лет пью. Знаю, кто из вас кого доил.»",
      "«Все бегут за золотом. А золото лежит и смеётся.»",
    ],
  },
  beggar: {
    label: "Нищий",
    sprite: "beggar",
    speed: 0,
    alms: true,
    lines: [
      "«Милостыню подашь? За это тебе зачтётся, где надо.»",
      "«Я не всегда тут стоял. Бывало, и с мечом стоял.»",
      "«Не подашь — ничего. Но и мне тебе помочь будет нечем.»",
    ],
  },
  traveler: {
    label: "Путник",
    sprite: "traveler",
    speed: 0.9,
    walker: true,
    lines: [
      "«Иду с востока. На север лучше не соваться — там караван стоит.»",
      "«Дорога длинная, а людей по ней всё меньше. Странно, да?»",
      "«Ты не первый, кто спрашивает про стойбище. Наверное, не последний.»",
    ],
  },
};

export const CIVILIAN_ORDER = [
  "peasant_w",
  "peasant_m",
  "greengrocer",
  "drunk",
  "beggar",
  "traveler",
];

// Точки расстановки: вне маршрута к Мардо, чтобы не запирать проход.
export const CIVILIAN_SPOTS = [
  { kind: "peasant_w", x: 16.5, y: 89.5, path: [[16.5, 89.5], [20.5, 89.5]] },
  { kind: "peasant_m", x: 31.5, y: 91.5, path: [[31.5, 91.5], [31.5, 96.5]] },
  { kind: "greengrocer", x: 14.2, y: 97.6, path: null },
  { kind: "drunk", x: 57.4, y: 79.6, path: null },
  { kind: "beggar", x: 9.6, y: 95.4, path: null },
  { kind: "traveler", x: 48.5, y: 86.9, path: [[48.5, 86.9], [72.5, 86.9]] },
];

export function createCivilian(kind, x, y, path = null, seed = 0) {
  const def = CIVILIAN_DEFS[kind];
  if (!def) return null;

  const id = hashSeed(`${kind}:${x}:${y}:${seed}`);

  return {
    id,
    kind,
    spriteKey: def.sprite,
    label: def.label,
    x,
    y,
    homeX: x,
    homeY: y,
    r: 0.3,
    speed: def.speed,
    angle: 0,
    path: path || null,
    pathIndex: 0,
    state: "idle",
    idleTimer: 0,
    visits: 0,
    seed: id,
    alive: true,
  };
}

export function createCivilians(seed = 0) {
  const list = [];
  for (let i = 0; i < CIVILIAN_SPOTS.length; i++) {
    const spot = CIVILIAN_SPOTS[i];
    const c = createCivilian(spot.kind, spot.x, spot.y, spot.path, seed + i);
    if (c) list.push(c);
  }
  return list;
}

// Лёгкое блуждание: туда-обратно по маршруту, с паузами.
// Никакой агрессии, никакого восприятия игрока.
export function stepCivilian(civilian, dt) {
  if (!civilian || !civilian.alive) return civilian;

  if (civilian.state === "pause") {
    civilian.idleTimer -= dt;
    if (civilian.idleTimer <= 0) civilian.state = "walk";
    return civilian;
  }

  if (!civilian.path || civilian.path.length < 2 || civilian.speed <= 0) {
    civilian.state = "idle";
    return civilian;
  }

  const target = civilian.path[civilian.pathIndex % civilian.path.length];
  const dx = target[0] - civilian.x;
  const dy = target[1] - civilian.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 0.15) {
    civilian.pathIndex = (civilian.pathIndex + 1) % civilian.path.length;
    civilian.state = "pause";
    civilian.idleTimer = 1.2;
    return civilian;
  }

  civilian.state = "walk";
  civilian.angle = Math.atan2(dy, dx);
  civilian.x += (dx / dist) * civilian.speed * dt;
  civilian.y += (dy / dist) * civilian.speed * dt;
  return civilian;
}

// Фраза гражданского: детерминирована, но не повторяется подряд.
export function civilianLine(civilian, seed = 0) {
  if (!civilian) return "";
  const def = CIVILIAN_DEFS[civilian.kind];
  if (!def) return "";
  const rng = createRng(hashSeed(`${civilian.id}:${seed}:${civilian.visits}`));
  return def.lines[Math.floor(rng() * def.lines.length) % def.lines.length];
}

export function bumpVisits(civilian) {
  if (civilian) civilian.visits = (civilian.visits || 0) + 1;
  return civilian;
}

export function isTrader(civilian) {
  return Boolean(civilian && CIVILIAN_DEFS[civilian.kind]?.trader);
}

export function isBeggar(civilian) {
  return Boolean(civilian && CIVILIAN_DEFS[civilian.kind]?.alms);
}

export function isRumormonger(civilian) {
  return Boolean(civilian && CIVILIAN_DEFS[civilian.kind]?.rumormonger);
}
