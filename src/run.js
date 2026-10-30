// Состояние рана: создание, проверка пригодности для чекпоинта, сериализация.
// Чистый модуль — вся логика сохранения проверяется в node:test.

import { createRng, hashSeed, makeRunSeed } from "./rng.js";
import { createInventory } from "./inventory.js";
import { createUpgrades } from "./economy.js";
import { createStyle } from "./style.js";
import { canStand } from "./world.js";
import { SAVE_VERSION } from "./profile.js";
import { createBleed } from "./wildlife.js";

export const ACTS = [
  { index: 0, goal: 300, label: "Акт I", title: "Первая кровь или первая тень" },
  { index: 1, goal: 800, label: "Акт II", title: "Дорога запоминает" },
  { index: 2, goal: 1500, label: "Акт III", title: "Тёмная дорога" },
];

export const CHECKPOINT_REASONS = {
  START: "start",
  SOLD: "sold",
  NEW_CARAVAN: "new_caravan",
  CONTRACT_ACCEPTED: "contract_accepted",
  CONTRACT_DONE: "contract_done",
  DONE: "contract_done",
  ACT_UP: "act_up",
  DEATH: "death",
};

export function createRun(seed, profile, options = {}) {
  const runSeed = seed >>> 0 || makeRunSeed();
  const rng = createRng(runSeed);
  const bonuses = options.bonuses || { lockpick: 0, capacity: 24, priceBonus: 0 };

  const run = {
    version: SAVE_VERSION,
    runId: hashSeed(`${runSeed}:${Date.now()}`),
    seed: runSeed,
    rngState: rng.state(),
    act: 0,
    tier: 1,
    gold: options.gold !== undefined ? options.gold : 25,
    totalSold: 0,
    upgrades: { ...createUpgrades(), lockpick: bonuses.lockpick || 0 },
    inventory: createInventory(bonuses.capacity || 24),
    wanted: 0,
    style: createStyle(),
    dayTime: 0,
    bleed: createBleed(),
    wagonLooted: false,
    archetype: "road_camp",
    offerIndex: 0,
    offerAct: 0,
    offerSeed: 0,
    contractOffer: [],
    activeContract: null,
    contractStreak: 0,
    pendingCaravan: false,
    caravanTimer: 0,
    lootSoldForTier: false,
    secondWagonLooted: false,
    counters: {
      kills: 0,
      silentLoots: 0,
      contractsDone: 0,
      contractsFailed: 0,
      killsSinceAccept: 0,
      lootsSinceAccept: 0,
      chaseSinceAccept: false,
      driverKilledSinceAccept: false,
      acceptedAt: 0,
      totalGoldEarned: 0,
    },
    player: { x: 0, y: 0, angle: 0 },
  };

  return run;
}

// Чекпоинт пишется всегда, кроме момента незавершённого обыска.
// Блокировать по розыску или погоне нельзя: стража замечает игрока почти
// сразу после кражи, и ран перестал бы сохраняться вообще. Сейв-скам это
// не открывает — позиции актёров не сохраняются, а штраф смерти уже применён.
export function canCheckpoint(run, runtime = {}) {
  if (!run) return false;
  if (runtime.stealing) return false;
  return true;
}

// Снимок для записи в localStorage. Позиции актёров не пишем:
// лагерь пересоздаётся по сиду и архетипу.
export function snapshotRun(run, player) {
  return {
    version: SAVE_VERSION,
    runId: run.runId,
    seed: run.seed,
    rngState: run.rngState,
    act: run.act,
    tier: run.tier,
    gold: run.gold,
    totalSold: run.totalSold,
    upgrades: { ...run.upgrades },
    inventory: {
      capacity: run.inventory.capacity,
      items: run.inventory.items.map((item) => ({ ...item })),
    },
    wanted: run.wanted,
    style: { ...run.style },
    dayTime: run.dayTime,
    bleed: { ...run.bleed },
    wagonLooted: run.wagonLooted,
    secondWagonLooted: Boolean(run.secondWagonLooted),
    archetype: run.archetype,
    offerIndex: run.offerIndex,
    offerAct: run.offerAct,
    offerSeed: run.offerSeed,
    contractOffer: run.contractOffer.map((c) => ({ ...c })),
    activeContract: run.activeContract ? { ...run.activeContract } : null,
    contractStreak: run.contractStreak,
    pendingCaravan: run.pendingCaravan,
    caravanTimer: run.caravanTimer,
    lootSoldForTier: run.lootSoldForTier,
    counters: { ...run.counters },
    player: { x: player.x, y: player.y, angle: player.angle },
  };
}

function num(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

// Восстановление с проверкой. Возвращает { run, repaired } или null.
export function restoreRun(raw, profile, bonuses = null) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.version !== SAVE_VERSION) return null;
  if (!Number.isFinite(raw.seed)) return null;

  let repaired = false;
  const detected = bonuses || { lockpick: 0, capacity: 24 };

  const run = createRun(raw.seed, profile, {
    gold: num(raw.gold, 25),
    bonuses: detected,
  });

  run.runId = Number.isFinite(raw.runId) ? raw.runId : run.runId;
  run.rngState = Number.isFinite(raw.rngState) ? raw.rngState : run.rngState;
  run.act = Math.max(0, Math.min(ACTS.length - 1, Math.floor(num(raw.act, 0))));
  run.tier = Math.max(1, Math.floor(num(raw.tier, 1)));
  run.totalSold = Math.max(0, num(raw.totalSold, 0));
  run.wanted = Math.max(0, Math.min(5, Math.floor(num(raw.wanted, 0))));
  run.dayTime = Math.max(0, num(raw.dayTime, 0));
  run.wagonLooted = Boolean(raw.wagonLooted);
  run.secondWagonLooted = Boolean(raw.secondWagonLooted);
  run.archetype = typeof raw.archetype === "string" ? raw.archetype : "road_camp";
  run.offerIndex = Math.max(0, Math.floor(num(raw.offerIndex, 0)));
  run.offerAct = Math.max(0, Math.floor(num(raw.offerAct, 0)));
  run.offerSeed = num(raw.offerSeed, 0);
  run.contractStreak = Math.max(0, Math.floor(num(raw.contractStreak, 0)));
  run.pendingCaravan = Boolean(raw.pendingCaravan);
  run.caravanTimer = Math.max(0, num(raw.caravanTimer, 0));
  run.lootSoldForTier = Boolean(raw.lootSoldForTier);

  if (raw.upgrades && typeof raw.upgrades === "object") {
    for (const key of Object.keys(run.upgrades)) {
      if (Number.isFinite(raw.upgrades[key])) run.upgrades[key] = Math.max(0, raw.upgrades[key]);
    }
  }

  if (raw.inventory && Array.isArray(raw.inventory.items)) {
    run.inventory.capacity = Math.max(1, Math.floor(num(raw.inventory.capacity, 24)));
    run.inventory.items = raw.inventory.items
      .filter((item) => item && typeof item.id === "string" && Number.isFinite(item.value))
      .map((item) => ({
        ...item,
        weight: num(item.weight, 0),
        value: Math.max(0, num(item.value, 0)),
      }));
    if (run.inventory.capacity < 8) repaired = true;
  }

  if (raw.style && typeof raw.style === "object") {
    for (const key of ["ghost", "butcher", "dealer", "events"]) {
      if (Number.isFinite(raw.style[key])) run.style[key] = Math.max(0, raw.style[key]);
    }
  }

  if (raw.bleed && typeof raw.bleed === "object") {
    run.bleed = {
      remaining: Math.max(0, num(raw.bleed.remaining, 0)),
      dps: Math.max(0, num(raw.bleed.dps, 0)),
    };
  }

  if (raw.counters && typeof raw.counters === "object") {
    for (const key of Object.keys(run.counters)) {
      const value = raw.counters[key];
      if (typeof run.counters[key] === "boolean") {
        run.counters[key] = Boolean(value);
      } else if (Number.isFinite(value)) {
        run.counters[key] = Math.max(0, value);
      }
    }
  }

  if (Array.isArray(raw.contractOffer)) {
    run.contractOffer = raw.contractOffer.filter((c) => c && typeof c.type === "string");
    // Пустая доска — легальное состояние (заказ в работе или всё сгорело).
    if (run.contractOffer.length !== 0 && run.contractOffer.length !== 3) repaired = true;
  }

  if (raw.activeContract && typeof raw.activeContract.type === "string") {
    run.activeContract = { ...raw.activeContract };
  }

  if (raw.player && Number.isFinite(raw.player.x) && Number.isFinite(raw.player.y)) {
    run.player = {
      x: raw.player.x,
      y: raw.player.y,
      angle: num(raw.player.angle, 0),
    };
  } else {
    repaired = true;
  }

  return { run, repaired };
}

// Проверка, что точку восстановления можно поставить на карте.
export function playerPositionValid(world, position, radius = 0.26) {
  if (!position) return false;
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;
  return canStand(world, position.x, position.y, radius);
}

export function actOf(run) {
  return ACTS[Math.max(0, Math.min(ACTS.length - 1, run.act))];
}

export function goalOf(run) {
  return actOf(run).goal;
}

// Итог рана для мета-профиля.
export function runSummary(run, extra = {}) {
  return {
    gold: run.gold,
    totalSold: run.totalSold,
    contracts: run.counters.contractsDone,
    contractsFailed: run.counters.contractsFailed,
    kills: run.counters.kills,
    silentLoots: run.counters.silentLoots,
    reputation: Math.floor((run.counters.contractsDone * 2 + run.counters.silentLoots) / 2),
    died: Boolean(extra.died),
    style: extra.style || run.archetype,
  };
}

// Мягкая смерть: −20% золота и вся переносимая добыча.
// Потеря округляется вверх: обещать 20% и списывать 19.3% — нечестно.
export function softDeathPenalty(run) {
  const lostGold = Math.ceil(run.gold * 0.2);
  const lostItems = run.inventory.items.length;
  const lostValue = run.inventory.items.reduce((sum, item) => sum + (item.value || 0), 0);
  return {
    run: {
      ...run,
      gold: Math.max(0, run.gold - lostGold),
      inventory: { ...run.inventory, items: [] },
    },
    lostGold,
    lostItems,
    lostValue,
  };
}
