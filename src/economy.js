// Экономика: цены, покупки, штраф. Чистые функции, без DOM.
export const UPGRADES = {
  sword: {
    name: "Меч",
    description: "Урон в ближнем бою +5 за уровень",
    prices: [80, 170, 280],
  },
  armor: {
    name: "Броня",
    description: "Получаемый урон −2 за уровень",
    prices: [70, 150, 240],
  },
  lockpick: {
    name: "Отмычки",
    description: "Обыск фургона быстрее на 0.5 с",
    prices: [60, 140],
  },
  boots: {
    name: "Сапоги",
    description: "Скорость +8% за уровень",
    prices: [60, 120],
  },
};

export function createUpgrades() {
  return { sword: 0, armor: 0, lockpick: 0, boots: 0 };
}

export function priceOf(id, level) {
  const upgrade = UPGRADES[id];
  if (!upgrade) return null;
  if (level >= upgrade.prices.length) return null;
  return upgrade.prices[level];
}

export function canBuy(gold, upgrades, id) {
  const level = upgrades[id];
  const price = priceOf(id, level);
  return price !== null && gold >= price;
}

export function purchase(gold, upgrades, id) {
  if (!canBuy(gold, upgrades, id)) return null;
  const price = priceOf(id, upgrades[id]);
  return {
    gold: gold - price,
    upgrades: { ...upgrades, [id]: upgrades[id] + 1 },
    spent: price,
  };
}

export function fineFor(wanted) {
  return wanted > 0 ? 40 + wanted * 60 : 0;
}

export function sellMultiplier(upgrades) {
  return 1 + (upgrades.lockpick || 0) * 0.05;
}
