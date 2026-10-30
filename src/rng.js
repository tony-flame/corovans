// Детерминированный ГПСЧ. Весь рандом в игре идёт через него, иначе
// сохранение нельзя восстановить достоверно.

export function hashSeed(str) {
  const text = String(str);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Счётчик вызовов позволяет сохранить состояние прямо в сейв.
export function createRng(seed) {
  let state = (seed >>> 0) || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.fork = (salt) => createRng(hashSeed(`${state}:${salt}`));
  next.state = () => state;
  next.restore = (value) => {
    state = (value >>> 0) || 1;
  };
  return next;
}

export function pick(list, rng = Math.random) {
  if (!list || list.length === 0) return null;
  return list[Math.floor(rng() * list.length) % list.length];
}

export function weightedPick(entries, rng = Math.random) {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return entries[0] ? entries[0].value : null;
  let roll = rng() * total;
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll <= 0) return entry.value;
  }
  return entries[entries.length - 1].value;
}

export function chance(probability, rng = Math.random) {
  return rng() < probability;
}

export function randomInt(min, max, rng = Math.random) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function makeRunSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
