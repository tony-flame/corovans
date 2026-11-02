// Инвентарь и добыча. Модуль чистый — используется и в браузере, и в node:test.
// Вместимость была 24 при добыче на 9.5 кг даже на tier 5 — влезало всё,
// и выбора «что взять» не возникало ни разу. 14 заставляет выбирать
// с первого каравана, но не превращает обыск в издевательство.
export const DEFAULT_CAPACITY = 14;

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

// Вес тюков поднят примерно вдвое против прежнего. При вместимости 24
// и добыче на 9.5 кг выбора не было вообще — теперь обыск заставляет
// решать, что унести, а что оставить.
export const LOOT_TABLE = [
  { id: "silk", name: "Тюк шёлка", value: 34, weight: 2.7, kind: "goods" },
  { id: "wine", name: "Бочонок вина", value: 26, weight: 5.4, kind: "goods" },
  { id: "spice", name: "Ящик специй", value: 44, weight: 3.6, kind: "goods" },
  { id: "furs", name: "Связка мехов", value: 30, weight: 4.5, kind: "goods" },
  { id: "silver", name: "Столовое серебро", value: 52, weight: 1.8, kind: "goods" },
  { id: "tools", name: "Ящик инструментов", value: 22, weight: 7.2, kind: "goods" },
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
