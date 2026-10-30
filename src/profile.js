// Мета-прогресс: репутация, постоянные разблокировки, статистика.
// Чистый модуль — не трогает DOM и localStorage.

export const SAVE_VERSION = 2;

export const UNLOCKS = {
  lockpick: {
    name: "Свои отмычки",
    description: "Старт с отмычками 1-го уровня",
    cost: 6,
  },
  stash: {
    name: "Тайник",
    description: "Лимит веса +4",
    cost: 8,
  },
  fence: {
    name: "Свой скупщик",
    description: "Цена продажи +10%",
    cost: 10,
  },
  horse: {
    name: "Лошадь",
    description: "Быстрое перемещение по дороге",
    cost: 12,
  },
  scout: {
    name: "Знание карты",
    description: "Стоянка каравана видна на HUD",
    cost: 6,
  },
};

export const UNLOCK_ORDER = ["lockpick", "stash", "fence", "horse", "scout"];

export function createProfile() {
  return {
    version: SAVE_VERSION,
    reputation: 0,
    unlocks: { lockpick: 0, stash: 0, fence: 0, horse: 0, scout: 0 },
    completedContracts: [],
    bestRun: { gold: 0, totalSold: 0, contracts: 0 },
    stats: { runs: 0, deaths: 0, kills: 0, silentLoots: 0, contractsDone: 0, contractsFailed: 0 },
    styleDefaults: { ghost: 0, butcher: 0, dealer: 0, events: 0 },
    lastArchetype: "neutral",
  };
}

export function hasUnlock(profile, id) {
  return Boolean(profile && profile.unlocks && profile.unlocks[id] > 0);
}

export function unlockCost(id) {
  return UNLOCKS[id] ? UNLOCKS[id].cost : null;
}

export function canUnlock(profile, id) {
  const cost = unlockCost(id);
  if (cost === null) return false;
  if (hasUnlock(profile, id)) return false;
  return (profile.reputation || 0) >= cost;
}

export function unlock(profile, id) {
  if (!canUnlock(profile, id)) return null;
  const cost = unlockCost(id);
  return {
    ...profile,
    reputation: profile.reputation - cost,
    unlocks: { ...profile.unlocks, [id]: 1 },
  };
}

// Стартовые бонусы рана от разблокировок.
export function startingBonuses(profile) {
  return {
    lockpick: hasUnlock(profile, "lockpick") ? 1 : 0,
    capacity: 24 + (hasUnlock(profile, "stash") ? 4 : 0),
    priceBonus: hasUnlock(profile, "fence") ? 0.1 : 0,
    fastTravel: hasUnlock(profile, "horse"),
    showCamp: hasUnlock(profile, "scout"),
  };
}

// Итог рана добавляется к профилю. Идемпотентность по runId обеспечивает
// вызывающий: профиль не знает про сейв.
export function applyRun(profile, summary) {
  const next = {
    ...profile,
    stats: { ...profile.stats },
    bestRun: { ...profile.bestRun },
    completedContracts: [...(profile.completedContracts || [])],
  };

  next.reputation = (profile.reputation || 0) + Math.max(0, summary.reputation || 0);
  next.stats.runs = (profile.stats.runs || 0) + 1;
  next.stats.deaths = (profile.stats.deaths || 0) + (summary.died ? 1 : 0);
  next.stats.kills = (profile.stats.kills || 0) + Math.max(0, summary.kills || 0);
  next.stats.silentLoots = (profile.stats.silentLoots || 0) + Math.max(0, summary.silentLoots || 0);
  next.stats.contractsDone = (profile.stats.contractsDone || 0) + Math.max(0, summary.contracts || 0);
  next.stats.contractsFailed = (profile.stats.contractsFailed || 0) + Math.max(0, summary.contractsFailed || 0);

  for (const id of summary.completedContractIds || []) {
    if (!next.completedContracts.includes(id)) next.completedContracts.push(id);
  }

  next.bestRun = {
    gold: Math.max(next.bestRun.gold || 0, summary.gold || 0),
    totalSold: Math.max(next.bestRun.totalSold || 0, summary.totalSold || 0),
    contracts: Math.max(next.bestRun.contracts || 0, summary.contracts || 0),
  };

  if (summary.style) next.lastArchetype = summary.style;
  return next;
}

// Миграция старых/частичных сейвов. Возвращает валидный профиль всегда.
export function migrateProfile(raw) {
  const base = createProfile();
  if (!raw || typeof raw !== "object") return base;

  const profile = {
    ...base,
    reputation: Number.isFinite(raw.reputation) ? Math.max(0, raw.reputation) : 0,
    unlocks: { ...base.unlocks },
    completedContracts: Array.isArray(raw.completedContracts) ? raw.completedContracts.filter((id) => typeof id === "string") : [],
    stats: { ...base.stats },
    bestRun: { ...base.bestRun },
    styleDefaults: { ...base.styleDefaults },
    lastArchetype: typeof raw.lastArchetype === "string" ? raw.lastArchetype : "neutral",
    version: SAVE_VERSION,
  };

  if (raw.unlocks && typeof raw.unlocks === "object") {
    for (const id of UNLOCK_ORDER) {
      profile.unlocks[id] = raw.unlocks[id] ? 1 : 0;
    }
  }

  if (raw.stats && typeof raw.stats === "object") {
    for (const key of Object.keys(base.stats)) {
      if (Number.isFinite(raw.stats[key])) profile.stats[key] = raw.stats[key];
    }
  }

  if (raw.bestRun && typeof raw.bestRun === "object") {
    for (const key of Object.keys(base.bestRun)) {
      if (Number.isFinite(raw.bestRun[key])) profile.bestRun[key] = raw.bestRun[key];
    }
  }

  if (raw.styleDefaults && typeof raw.styleDefaults === "object") {
    for (const key of ["ghost", "butcher", "dealer", "events"]) {
      if (Number.isFinite(raw.styleDefaults[key])) profile.styleDefaults[key] = raw.styleDefaults[key];
    }
  }

  return profile;
}

export function totalReputationSpent(profile) {
  return (profile.completedContracts || []).length;
}
