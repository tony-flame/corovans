// Куртизанка: платная услуга «отдохнуть и восстановиться» в духе Daggerfall.
// Внешность и цена детерминированы от (runSeed, tier, act) — не хранятся в сейве.
// Чистый модуль.

import { createRng, hashSeed } from "./rng.js";

export const NAMES = [
  "Люсель",
  "Миранда",
  "Одетта",
  "Флёр",
  "Камелия",
  "Жизель",
  "Розалинда",
  "Виолетта",
  "Аврора",
  "Колетт",
];

export const EPITHETS = ["Мадам", "Госпожа", "Прекрасная", ""];

// Кураторские палитры: случайный RGB дал бы кислотную кашу.
export const HAIR_COLORS = [
  { id: "platinum", label: "платиновые", css: "#e8e2c8" },
  { id: "chestnut", label: "каштановые", css: "#7a4a2a" },
  { id: "copper", label: "медные", css: "#b5571f" },
  { id: "raven", label: "вороновы", css: "#221a16" },
  { id: "wine", label: "винные", css: "#6a2030" },
  { id: "ash", label: "пепельные", css: "#9a9188" },
];

export const DRESS_COLORS = [
  { id: "emerald", label: "изумрудное", css: "#1f6b46" },
  { id: "burgundy", label: "бургундское", css: "#6d1f2e" },
  { id: "violet", label: "фиолетовое", css: "#4a2a6b" },
  { id: "teal", label: "бирюзовое", css: "#1f5f6b" },
  { id: "gold", label: "золотое", css: "#8a6a1f" },
  { id: "crimson", label: "багровое", css: "#8a1f2a" },
];

export const ACCESSORIES = ["веер", "вуаль", "перья", "брошь", "муфта"];

export const PRICE_MIN = 20;
export const PRICE_MAX = 35;

// Реплики. Имя подставляется, чтобы вариант ощущался живым.
export const LINES = [
  "{name} обмахивается веером: «Милый, ты выглядишь так, будто тебя били. Я это исправлю.»",
  "{name} прищуривается: «Все бегут за золотом, а ты — ко мне. Приятно, когда ценят.»",
  "{name} поправляет платье: «Дорога — грязное дело. Ты бы хоть пыль с сапог стряхнул.»",
  "{name} вздыхает: «Очередной герой. Ладно, у меня сегодня хорошее настроение.»",
  "{name} улыбается краешком губ: «Не благодари. Благодарность — не монета.»",
  "{name} щёлкает веером: «Три акта, три каравана, а всё туда же. Мужчины не меняются.»",
  "{name} оглядывает тебя с ног до головы: «Живой. Уже неплохо для этой дороги.»",
  "{name} шепчет: «Только не говори Мардо. Он и так считает, что весь блеск в его сундуке.»",
  "{name} усмехается: «За такие деньги я могла бы и не стараться. Но я стараюсь.»",
  "{name} качает головой: «Раны затянутся, а вот манеры — вряд ли.»",
];

export function courtesanSeed(runSeed, tier, act) {
  return hashSeed(`${runSeed}:${tier}:${act}:courtesan`);
}

// Вариант внешности. Меняется при смене каравана и при смене акта.
export function createCourtesan(runSeed, tier = 1, act = 0) {
  const seed = courtesanSeed(runSeed, tier, act);
  const rng = createRng(seed);

  const name = NAMES[Math.floor(rng() * NAMES.length) % NAMES.length];
  const epithet = EPITHETS[Math.floor(rng() * EPITHETS.length) % EPITHETS.length];
  const hair = HAIR_COLORS[Math.floor(rng() * HAIR_COLORS.length) % HAIR_COLORS.length];
  const dress = DRESS_COLORS[Math.floor(rng() * DRESS_COLORS.length) % DRESS_COLORS.length];
  const accessory = ACCESSORIES[Math.floor(rng() * ACCESSORIES.length) % ACCESSORIES.length];

  const price = PRICE_MIN + Math.floor(rng() * (PRICE_MAX - PRICE_MIN + 1));

  const display = epithet ? `${epithet} ${name}` : name;

  return {
    id: seed,
    name,
    epithet,
    displayName: display,
    hair,
    dress,
    accessory,
    price,
    tier,
    act,
    spriteKey: `courtesan_${seed}`,
    lineSeed: seed,
  };
}

export function courtesanCanServe(courtesan, gold, health, maxHealth) {
  if (!courtesan) return { ok: false, reason: "no_courtesan" };
  if (health >= maxHealth) return { ok: false, reason: "full_health" };
  if (gold < courtesan.price) return { ok: false, reason: "no_gold" };
  return { ok: true, reason: "" };
}

// Лечение с клампом по максимуму. Возвращает { health, gold, healed }.
export function applyHeal(courtesan, gold, health, maxHealth) {
  const healed = Math.min(maxHealth - health, maxHealth);
  return {
    health: Math.max(0, Math.min(maxHealth, health + healed)),
    gold: Math.max(0, gold - courtesan.price),
    healed,
  };
}

export function pickCourtesanLine(courtesan, rng = Math.random) {
  if (!courtesan) return "";
  const line = LINES[Math.floor(rng() * LINES.length) % LINES.length];
  return line.replace("{name}", courtesan.name);
}

// Описание внешности — для подсказки и сообщений.
export function describeCourtesan(courtesan) {
  if (!courtesan) return "";
  return `${courtesan.displayName}: ${courtesan.hair.label} волосы, ${courtesan.dress.label} платье, ${courtesan.accessory}.`;
}
