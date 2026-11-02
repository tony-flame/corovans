// Контракты Мардо. Чистый модуль: генерация по сиду, проверка по снапшоту рана.
//
// Снапшот (передаётся из main.js):
//   {
//     kills,          // убийств всего за ран
//     killsSinceAccept,
//     lootsSinceAccept,
//     chaseSinceAccept, // игрока замечали после взятия контракта
//     items,          // [{ id, name, value, weight }]
//     dayTime,        // игровое время в секундах
//     acceptedAt,     // игровое время взятия
//     lootedTiers,    // уровни обобранных караванов
//   }

import { createRng, hashSeed, pick } from "./rng.js";
import { CYCLE_LENGTH } from "./daynight.js";

// Длина суток в секундах. Нужна, чтобы посчитать прошедшее время через
// переход суток, когда монотонного счётчика в снапшоте нет.
const CYCLE_SECONDS = CYCLE_LENGTH;

export const CONTRACT_TYPES = {
  CLEAN: "clean",
  BEFORE_DAWN: "before_dawn",
  UNSEEN: "unseen",
  SPECIFIC_ITEM: "specific_item",
  DRIVER: "driver",
};

export const CONTRACT_DEFS = {
  clean: {
    name: "Без крови",
    describe: () => "Обчистить фургон, никого не убив",
    reward: { gold: 90, rep: 2 },
  },
  before_dawn: {
    name: "До рассвета",
    describe: (seconds) => `Обчистить фургон за ${Math.round(seconds)} с игрового времени`,
    reward: { gold: 120, rep: 3 },
  },
  unseen: {
    name: "Не на глаза",
    describe: () => "Обчистить фургон так, чтобы никто не поднял тревогу",
    reward: { gold: 140, rep: 4 },
  },
  specific_item: {
    name: "Особый тюк",
    describe: (itemName) => `Добыть и принести «${itemName}»`,
    reward: { gold: 110, rep: 3 },
  },
  driver: {
    name: "Убрать возницу",
    describe: () => "Убить возницу каравана (розыск гарантирован)",
    reward: { gold: 160, rep: 1 },
  },
};

const ITEM_CATALOG = [
  { id: "silk", name: "Тюк шёлка" },
  { id: "wine", name: "Бочонок вина" },
  { id: "spice", name: "Ящик специй" },
  { id: "furs", name: "Связка мехов" },
  { id: "silver", name: "Столовое серебро" },
  { id: "tools", name: "Ящик инструментов" },
];

const OFFER_COUNT = 3;
const DEADLINE_SECONDS = 90;

export function contractSeed(runSeed, actIndex, offerIndex) {
  return hashSeed(`${runSeed}:${actIndex}:${offerIndex}`);
}

export function offerKey(runSeed, actIndex, offerIndex) {
  return `${runSeed}-${actIndex}-${offerIndex}`;
}

// Три предложения на доску. Стиль игрока фильтрует пул.
export function generateContracts(runSeed, actIndex, offerIndex, tier, style = "neutral") {
  const seed = contractSeed(runSeed, actIndex, offerIndex);
  const rng = createRng(seed);

  const pool = [CONTRACT_TYPES.CLEAN, CONTRACT_TYPES.BEFORE_DAWN, CONTRACT_TYPES.UNSEEN];
  if (style === "ghost") {
    pool.push(CONTRACT_TYPES.UNSEEN, CONTRACT_TYPES.SPECIFIC_ITEM);
  } else if (style === "butcher") {
    pool.push(CONTRACT_TYPES.DRIVER, CONTRACT_TYPES.DRIVER);
  } else if (style === "dealer") {
    pool.push(CONTRACT_TYPES.SPECIFIC_ITEM, CONTRACT_TYPES.SPECIFIC_ITEM);
  } else {
    pool.push(CONTRACT_TYPES.SPECIFIC_ITEM, CONTRACT_TYPES.DRIVER);
  }

  const chosen = [];
  const used = new Set();
  let guard = 0;
  while (chosen.length < OFFER_COUNT && guard < 60) {
    guard++;
    const type = pick(pool, rng);
    if (used.has(type) && guard < 40) continue;
    used.add(type);
    chosen.push(makeContract(type, tier, rng, `${seed}-${chosen.length}`));
  }
  while (chosen.length < OFFER_COUNT) {
    chosen.push(makeContract(CONTRACT_TYPES.CLEAN, tier, rng, `${seed}-${chosen.length}`));
  }
  return chosen;
}

function makeContract(type, tier, rng, id) {
  const def = CONTRACT_DEFS[type];
  const scale = 1 + (tier - 1) * 0.18;
  const contract = {
    id,
    type,
    tier,
    state: "offered",
    reward: {
      gold: Math.round(def.reward.gold * scale),
      rep: def.reward.rep,
    },
    deadline: type === CONTRACT_TYPES.BEFORE_DAWN ? DEADLINE_SECONDS : null,
    requiredItemId: null,
    requiredItemName: null,
    description: "",
  };

  if (type === CONTRACT_TYPES.SPECIFIC_ITEM) {
    const item = pick(ITEM_CATALOG, rng);
    contract.requiredItemId = item.id;
    contract.requiredItemName = item.name;
  }

  contract.description =
    type === CONTRACT_TYPES.SPECIFIC_ITEM
      ? def.describe(contract.requiredItemName)
      : type === CONTRACT_TYPES.BEFORE_DAWN
        ? def.describe(contract.deadline)
        : def.describe();

  return contract;
}

export function contractName(type) {
  return (CONTRACT_DEFS[type] && CONTRACT_DEFS[type].name) || type;
}

export function contractIdOf(contract) {
  return contract ? contract.id : null;
}

// Проверка. Возвращает { status, reason }, где status:
// "active" | "complete" | "failed".
export function checkContract(contract, snapshot) {
  if (!contract || contract.state === "failed" || contract.state === "complete") {
    return { status: contract ? contract.state : "active", reason: "" };
  }

  const snap = snapshot || {};
  const kills = snap.killsSinceAccept || 0;
  const loots = snap.lootsSinceAccept || 0;
  const chased = Boolean(snap.chaseSinceAccept);
  const items = snap.items || [];

  if (contract.type === CONTRACT_TYPES.BEFORE_DAWN) {
    // Прошедшее время по монотонному счётчику. Раньше было
    // `dayTime - acceptedAt`, а dayTime замыкается через 240 с: контракт
    // с дедлайном 90 с можно было просрочить на 300 с и он оставался жив.
    let elapsed;
    if (Number.isFinite(snap.clockTotal)) {
      elapsed = Math.max(0, snap.clockTotal - (snap.acceptedClock ?? 0));
    } else {
      // Запасной путь без монотонного счётчика: разница по dayTime,
      // но с учётом перехода через полный круг суток.
      const raw = (snap.dayTime || 0) - (snap.acceptedAt || 0);
      elapsed = raw >= 0 ? raw : raw + CYCLE_SECONDS;
    }
    if (loots > 0) return { status: "complete", reason: "" };
    if (elapsed > contract.deadline) {
      return { status: "failed", reason: "Время вышло" };
    }
    return { status: "active", reason: "" };
  }

  if (contract.type === CONTRACT_TYPES.DRIVER) {
    if (snap.driverKilledSinceAccept) return { status: "complete", reason: "" };
    return { status: "active", reason: "" };
  }

  // Остальные завершаются в момент обыска фургона.
  if (loots <= 0) {
    return { status: "active", reason: "" };
  }

  if (contract.type === CONTRACT_TYPES.CLEAN) {
    if (kills > 0) return { status: "failed", reason: "Пролилась кровь" };
    return { status: "complete", reason: "" };
  }

  if (contract.type === CONTRACT_TYPES.UNSEEN) {
    if (chased) return { status: "failed", reason: "Вас заметили" };
    return { status: "complete", reason: "" };
  }

  if (contract.type === CONTRACT_TYPES.SPECIFIC_ITEM) {
    const has = items.some((item) => item && item.id && item.id.startsWith(contract.requiredItemId));
    if (!has) {
      return { status: "failed", reason: `Нужен предмет: ${contract.requiredItemName}` };
    }
    return { status: "complete", reason: "" };
  }

  return { status: "active", reason: "" };
}

// Одна неудачная проверка не отменяет контракт: поражение фиксируется,
// только когда провал необратим (кровь пролита, тревога поднята).
export function failureIsFinal(contract, snapshot) {
  const result = checkContract(contract, snapshot);
  if (result.status !== "failed") return false;
  if (contract.type === CONTRACT_TYPES.SPECIFIC_ITEM) return !hasLooted(snapshot);
  return true;
}

function hasLooted(snapshot) {
  return (snapshot && snapshot.lootsSinceAccept) > 0;
}

export function rewardOf(contract, streak = 0) {
  const base = contract.reward;
  const mult = 1 + 0.15 * Math.max(0, streak);
  return {
    gold: Math.round(base.gold * mult),
    rep: Math.max(1, Math.round(base.rep * (1 + 0.1 * Math.max(0, streak)))),
  };
}
