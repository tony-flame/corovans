// Инвентарь и добыча. Модуль чистый — используется и в браузере, и в node:test.
export const DEFAULT_CAPACITY = 24;

export function createInventory(capacity = DEFAULT_CAPACITY) {
  return { capacity, items: [] };
}

export function totalWeight(inv) {
  return inv.items.reduce((sum, item) => sum + item.weight, 0);
}

export function totalValue(inv) {
  return inv.items.reduce((sum, item) => sum + item.value, 0);
}

export function addItem(inv, item) {
  const weight = totalWeight(inv);
  if (weight + item.weight > inv.capacity + 1e-9) return false;
  inv.items.push({ ...item });
  return true;
}

export function removeItem(inv, id) {
  const index = inv.items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  return inv.items.splice(index, 1)[0];
}

export function sellAll(inv, multiplier = 1) {
  const value = Math.round(totalValue(inv) * multiplier);
  inv.items = [];
  return value;
}

export function weightLeft(inv) {
  return Math.max(0, inv.capacity - totalWeight(inv));
}

export function canCarry(inv, item) {
  return Boolean(item) && totalWeight(inv) + item.weight <= inv.capacity + 1e-9;
}

export const LOOT_TABLE = [
  { id: "silk", name: "Тюк шёлка", value: 34, weight: 1.5, kind: "goods" },
  { id: "wine", name: "Бочонок вина", value: 26, weight: 3, kind: "goods" },
  { id: "spice", name: "Ящик специй", value: 44, weight: 2, kind: "goods" },
  { id: "furs", name: "Связка мехов", value: 30, weight: 2.5, kind: "goods" },
  { id: "silver", name: "Столовое серебро", value: 52, weight: 1, kind: "goods" },
  { id: "tools", name: "Ящик инструментов", value: 22, weight: 4, kind: "goods" },
];

// Детерминированный выбор добычи: rng обязан быть функцией, возвращающей [0,1).
export function rollLoot(tier, rng = Math.random, count = 2) {
  const picked = [];
  for (let i = 0; i < count; i++) {
    const base = LOOT_TABLE[Math.floor(rng() * LOOT_TABLE.length) % LOOT_TABLE.length];
    const scale = 1 + (tier - 1) * 0.25;
    picked.push({
      ...base,
      id: `${base.id}-${tier}-${i}`,
      value: Math.round(base.value * scale),
    });
  }
  return picked;
}
