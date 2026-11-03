// Сторонние задания: не от Мардо, а от жителей. Чистый модуль.
//
// Зачем отдельно от contracts.js: у Мардо все задания об одном —
// обчистить фургон. Пять контрактов, но действие одно и то же.
// Здесь задания на другие действия: принеси шкуру, дойди до места,
// поговори с человеком. Это даёт причину ходить по карте, а не
// только к фургону и обратно.
//
// Модуль ничего не знает про мир и игрока: он получает снапшот
// и говорит «выполнено / нет». Награду выдаёт вызывающий код.

import { createRng, hashSeed, pick } from "./rng.js";

// Типы заданий. Каждый проверяется по своему полю снапшота.
export const QUEST_TYPES = {
  HUNT: "hunt",       // убить N зверей этого вида
  DELIVER: "deliver", // принести предмет с ярлыком
  REACH: "reach",     // дойти до места
  LISTEN: "listen",   // расспросить N разных жителей
};

export const QUEST_DEFS = {
  hunt: {
    name: "Шкура",
    // Виды, на которых имеет смысл охотиться. Лисы дают мех,
    // коровы и козы — мясо: и то и другое нужно деревне.
    targets: ["fox", "cow", "goat"],
  },
  deliver: { name: "Доставка" },
  reach: { name: "Дозор" },
  listen: { name: "Расспросы" },
};

// Кто из жителей что просит. Не все: торговка и стражник ратуши
// не будут просить охотиться, это выбивается из их роли.
export const QUEST_GIVERS = {
  peasant_w: ["hunt", "listen"],
  peasant_m: ["hunt", "reach"],
  traveler: ["reach", "deliver"],
  drunk: ["listen", "deliver"],
  beggar: ["listen"],
  priest: ["listen", "deliver"],
  greengrocer: ["hunt"],
  market_trader: ["deliver"],
  throne_guard: ["reach"],
};

const TARGET_LABELS = {
  fox: "лисиц",
  cow: "коров",
  goat: "коз",
};

const HUNT_COUNTS = [2, 3];
const DELIVER_ITEMS = [
  { id: "meal", name: "Мешок муки" },
  { id: "herbs", name: "Пучок трав" },
  { id: "letter", name: "Письмо" },
];
const REACH_PLACES = [
  { id: "cathedral", name: "собор" },
  { id: "rathouse", name: "ратушу" },
  { id: "market", name: "рынок" },
];

export function questSeed(runSeed, giverId, slot = 0) {
  return hashSeed(`quest:${runSeed}:${giverId}:${slot}`);
}

// Задание для конкретного жителя. null, если он ничего не просит.
// Детерминировано: один и тот же житель в одном забеге всегда просит
// одно и то же, иначе F5 перекатывал бы задание как рулетку.
export function makeQuest(runSeed, giver, slot = 0) {
  const pool = QUEST_GIVERS[giver.kind];
  if (!pool || pool.length === 0) return null;

  // Сид обязан совпадать с тем, что показали в диалоге. Отдельная
  // функция вместо «переиспользовать hashSeed» — чтобы обе стороны
  // считали одно и то же, а не два похожих выражения.
  const seed = questSeed(runSeed, giver.id, slot);
  const rng = createRng(seed);
  const type = pick(pool, rng);

  const quest = {
    id: `q-${seed}`,
    giverId: giver.id,
    giverKind: giver.kind,
    giverLabel: giver.label,
    type,
    state: "offered",
    goal: 1,
    targetId: null,
    targetLabel: "",
    description: "",
    reward: { gold: 0, rep: 1 },
    acceptedClock: null,
  };

  if (type === QUEST_TYPES.HUNT) {
    const target = pick(QUEST_DEFS.hunt.targets, rng);
    quest.goal = pick(HUNT_COUNTS, rng);
    quest.targetId = target;
    quest.targetLabel = TARGET_LABELS[target] || target;
    quest.description = `Принести ${quest.goal} ${quest.targetLabel} — деревне нужно мясо и мех`;
    quest.reward.gold = 35 + quest.goal * 15;
    quest.reward.rep = 2;
  } else if (type === QUEST_TYPES.DELIVER) {
    const item = pick(DELIVER_ITEMS, rng);
    quest.targetId = item.id;
    quest.targetLabel = item.name;
    quest.description = `Донести до Мардо: «${item.name}» от жителя`;
    quest.reward.gold = 45;
    quest.reward.rep = 2;
  } else if (type === QUEST_TYPES.REACH) {
    const place = pick(REACH_PLACES, rng);
    quest.targetId = place.id;
    quest.targetLabel = place.name;
    quest.description = `Дойти до места: ${place.name} — проверить, всё ли тихо`;
    quest.reward.gold = 40;
    quest.reward.rep = 1;
  } else if (type === QUEST_TYPES.LISTEN) {
    quest.goal = 3;
    quest.description = "Расспросить трёх разных жителей о дороге";
    quest.reward.gold = 50;
    quest.reward.rep = 3;
  }

  return quest;
}

// Все задания, которые этот житель может дать.
export function questsFor(runSeed, giver) {
  const pool = QUEST_GIVERS[giver.kind];
  if (!pool) return [];
  const list = [];
  for (let slot = 0; slot < pool.length; slot++) {
    const q = makeQuest(runSeed, giver, slot);
    if (q) list.push(q);
  }
  return list;
}

// Проверка. snapshot:
//   { beastsSince: {fox: n, ...}, items: [...], visited: {...}, askedPeople: [...] }
// Возвращает { status: "active"|"complete", progress: {done, goal}, reason }
export function checkQuest(quest, snapshot) {
  if (!quest) return { status: "active", progress: { done: 0, goal: 1 }, reason: "" };
  if (quest.state === "complete") {
    return { status: "complete", progress: { done: quest.goal, goal: quest.goal }, reason: "" };
  }

  const snap = snapshot || {};

  if (quest.type === QUEST_TYPES.HUNT) {
    const beasts = snap.beastsSince || {};
    const done = Math.max(0, Math.min(quest.goal, beasts[quest.targetId] || 0));
    return {
      status: done >= quest.goal ? "complete" : "active",
      progress: { done, goal: quest.goal },
      reason: "",
    };
  }

  if (quest.type === QUEST_TYPES.DELIVER) {
    // Предмет ищется по префиксу id: дропы получают суффикс уров­ня
    // и индекса, поэтому точное совпадение не сработало бы никогда.
    const has = (snap.items || []).some(
      (item) => item && item.id && String(item.id).startsWith(quest.targetId)
    );
    return {
      status: has ? "complete" : "active",
      progress: { done: has ? 1 : 0, goal: 1 },
      reason: has ? "" : `Нужно: ${quest.targetLabel}`,
    };
  }

  if (quest.type === QUEST_TYPES.REACH) {
    const visited = snap.visited || {};
    const done = visited[quest.targetId] ? 1 : 0;
    return {
      status: done >= 1 ? "complete" : "active",
      progress: { done, goal: 1 },
      reason: done ? "" : `Нужно дойти: ${quest.targetLabel}`,
    };
  }

  if (quest.type === QUEST_TYPES.LISTEN) {
    const asked = new Set(snap.askedPeople || []);
    const done = Math.min(quest.goal, asked.size);
    return {
      status: done >= quest.goal ? "complete" : "active",
      progress: { done, goal: quest.goal },
      reason: "",
    };
  }

  return { status: "active", progress: { done: 0, goal: 1 }, reason: "" };
}

export function questProgressText(quest, snapshot) {
  const result = checkQuest(quest, snapshot);
  if (result.status === "complete") return "Выполнено";
  if (result.progress.goal > 1) {
    return `${result.progress.done} / ${result.progress.goal}`;
  }
  return result.reason || "В процессе";
}

export function questReward(quest) {
  return quest ? { ...quest.reward } : { gold: 0, rep: 0 };
}

// Задание можно сдать, только если у жителя ещё нет другого.
// Иначе он выдаст новое поверх невыполненного, и счётчик потеряется.
export function canTakeQuest(activeQuest) {
  return !activeQuest || activeQuest.state === "complete";
}
