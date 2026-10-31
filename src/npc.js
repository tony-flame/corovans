// Куртизанка: платная услуга «отдохнуть и восстановиться» в духе Daggerfall.
// Внешность, характер и цена детерминированы от (runSeed, tier, act) — не хранятся в сейве.
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

// Максимальный запас бодрости сверх обычного здоровья.
export const OVERHEAL_CAP = 25;
// Сколько запаса тает в секунду на ходу.
export const OVERHEAL_DECAY = 1;

// Характеры: определяют тон реплик, цену и манеру.
export const TEMPERS = {
  mocking: { id: "mocking", label: "Насмешница", priceScale: 0.85 },
  matron: { id: "matron", label: "Матрона", priceScale: 1.2 },
  dreamer: { id: "dreamer", label: "Мечтательница", priceScale: 1.0 },
  business: { id: "business", label: "Деловая", priceScale: 1.15 },
  cryptic: { id: "cryptic", label: "Загадочная", priceScale: 1.05 },
};

export const TEMPER_ORDER = ["mocking", "matron", "dreamer", "business", "cryptic"];

// Приветствия: зависят от характера. {name} подставляется.
const GREETINGS = {
  mocking: [
    "{name} оглядывает тебя с ног до головы: «Живой. Уже достижение для этой дороги.»",
    "{name} фыркает: «Ты выглядишь как человек, который спорил с дверью. И проиграл.»",
    "{name} поднимает бровь: «О, снова герой. У меня как раз день терпения.»",
  ],
  matron: [
    "{name} кивает на скамью: «Сядь. Не спорь. Я видела мужчин и похуже.»",
    "{name} складывает руки: «Раны, грязь и гордость. Всё поправимо, кроме третьего.»",
    "{name} вздыхает: «Ну что опять. Показывай, где болит.»",
  ],
  dreamer: [
    "{name} смотрит не на тебя, а мимо: «Дорога у тебя в глазах. И пыль в волосах.»",
    "{name} улыбается тихо: «Я ждала кого-нибудь. Не обязательно тебя, но ты подошёл.»",
    "{name} касается твоего рукава: «Ты пахнешь дымом и чужим золотом.»",
  ],
  business: [
    "{name} не отрывается от счётов: «Двадцать золотых. Раны залечу, сказки не рассказываю.»",
    "{name} коротко кивает: «Живой, платёжеспособный. Проходи.»",
    "{name} откладывает перо: «Время — деньги. Твоё здоровье — мои деньги.»",
  ],
  cryptic: [
    "{name} улыбается одним углом рта: «Ты пришёл не за лечением. Но начнём с него.»",
    "{name} смотрит сквозь тебя: «У всех на этой дороге что-то болит. У тебя — предсказуемо.»",
    "{name} перебирает веер: «Судьба у тебя интересная. А вот состояние — нет.»",
  ],
};

// Реакция на оплату.
const AFTER_LINES = {
  mocking: [
    "{name} усмехается: «Не благодари. Благодарность — не монета.»",
    "{name} щёлкает веером: «За такие деньги я могла бы и не стараться. Но я стараюсь.»",
  ],
  matron: [
    "{name} кивает: «Иди. И не возвращайся слишком скоро — это выглядит жалко.»",
    "{name} поправляет тебе воротник: «Хоть кто-то из вас уходит целым.»",
  ],
  dreamer: [
    "{name} шепчет: «Возвращайся. Дорога длинная, а я никуда не денусь.»",
    "{name} задерживает руку на мгновение дольше нужного: «Тепло тебе идёт.»",
  ],
  business: [
    "{name} делает отметку в книге: «Следующий.»",
    "{name} отсчитывает сдачу: «Всё по счёту. Приятно иметь дело.»",
  ],
  cryptic: [
    "{name} говорит в спину: «В следующий раз ты придёшь не за этим.»",
    "{name} качает головой: «Заплатил — и уже уходишь. Как все.»",
  ],
};

// Отказы.
const REFUSALS = {
  full_health: [
    "{name} отмахивается: «Тебе и так неплохо, милый.»",
    "{name} оглядывает тебя: «Целёхонек. Иди работай.»",
  ],
  no_gold: [
    "{name} поджимает губы: «Мило, но задаром я не работаю.»",
    "{name} кивает на кошель: «Сначала монета, потом нежность.»",
  ],
};

// Слухи: бесплатны, но полезны. Не просто украшение.
const RUMORS = [
  "Северный тракт перекрыли — стража там теперь чаще.",
  "Мардо платит больше после заката. Не знаю почему. Знаю, что правда.",
  "В лесу кто-то живёт. И это не дровосеки.",
  "Караванщики стали нанимать больше охраны. Боятся.",
  "У руин ночью видели свет. Днём там пусто.",
  "Говорят, лисий мех теперь дороже человеческого. Времена.",
  "В деревне не хватает рук: молодые ушли на тракт, не все вернулись.",
  "Скупщик не любит, когда торгуются. Терпит, но запоминает.",
];

// Места, где стоят куртизанки. Ключ привязанности — МЕСТО, а не вариант:
// внешность меняется с караваном, а дружба должна оставаться с игроком.
export const COURTESAN_SPOTS = ["square", "inn", "forest", "camp"];

export const SPOT_LABELS = {
  square: "Площадь",
  inn: "Корчма",
  forest: "Лесная сторожка",
  camp: "Стоянка каравана",
};

// Сколько платных визитов нужно, чтобы она начала принимать бесплатно.
export const AFFINITY_FREE = 2;

export function courtesanSeed(runSeed, tier, act, spot = "square") {
  return hashSeed(`${runSeed}:${tier}:${act}:courtesan:${spot}`);
}

function pickFrom(list, rng) {
  return list[Math.floor(rng() * list.length) % list.length];
}

// Вариант внешности и характера. Меняется при смене каравана и акта,
// но остаётся в пределах своего места.
export function createCourtesan(runSeed, tier = 1, act = 0, spot = "square") {
  const seed = courtesanSeed(runSeed, tier, act, spot);
  const rng = createRng(seed);

  const name = pickFrom(NAMES, rng);
  const epithet = pickFrom(EPITHETS, rng);
  const hair = pickFrom(HAIR_COLORS, rng);
  const dress = pickFrom(DRESS_COLORS, rng);
  const accessory = pickFrom(ACCESSORIES, rng);
  const temperId = pickFrom(TEMPER_ORDER, rng);
  const temper = TEMPERS[temperId];

  const basePrice = PRICE_MIN + Math.floor(rng() * (PRICE_MAX - PRICE_MIN + 1));
  const price = Math.max(PRICE_MIN, Math.min(PRICE_MAX, Math.round(basePrice * temper.priceScale)));

  const display = epithet ? `${epithet} ${name}` : name;

  return {
    id: seed,
    spot,
    spotLabel: SPOT_LABELS[spot] || spot,
    name,
    epithet,
    displayName: display,
    hair,
    dress,
    accessory,
    temper: temperId,
    temperLabel: temper.label,
    price,
    tier,
    act,
    spriteKey: `courtesan_${seed}`,
    lineSeed: seed,
  };
}

// ── Привязанность ───────────────────────────────────────────────────
// Хранится в ране по ключу места. Платные визиты её повышают,
// бесплатные — нет, иначе первый же бесплатный визит сделал бы её вечной.

export function createAffinity() {
  const map = {};
  for (const spot of COURTESAN_SPOTS) map[spot] = 0;
  return map;
}

export function affinityOf(affinity, spot) {
  if (!affinity || !spot) return 0;
  return Math.max(0, affinity[spot] || 0);
}

// Она уже принимает бесплатно?
export function isFreeVisit(affinity, spot) {
  return affinityOf(affinity, spot) >= AFFINITY_FREE;
}

export function bumpAffinity(affinity, spot) {
  const next = { ...(affinity || createAffinity()) };
  next[spot] = Math.min(AFFINITY_FREE + 1, affinityOf(next, spot) + 1);
  return next;
}

function fill(line, courtesan) {
  return String(line).replace("{name}", courtesan.name);
}

export function greetCourtesan(courtesan, rng = Math.random, state = {}) {
  if (!courtesan) return "";
  const pool = GREETINGS[courtesan.temper] || GREETINGS.mock;
  let line = fill(pickFrom(pool, rng), courtesan);

  // Контекст важнее характера: за игроком охотятся — она это заметит.
  if (state.free) {
    line = `${courtesan.name} отмахивается от монеты: «Убери. С тебя я больше не беру.»`;
  } else if (state.wanted > 0) {
    line = `${courtesan.name} понижает голос: «За тобой идут. Ладно, заходи быстрее.»`;
  } else if (state.bled && state.bled > 0) {
    line = `${courtesan.name} хмурится: «Ты кровью капаешь на мой пол. Заходи.»`;
  }
  return line;
}

export function afterCourtesanLine(courtesan, rng = Math.random) {
  if (!courtesan) return "";
  const pool = AFTER_LINES[courtesan.temper] || AFTER_LINES.mock;
  return fill(pickFrom(pool, rng), courtesan);
}

export function refusalLine(courtesan, reason, rng = Math.random) {
  if (!courtesan) return "";
  const pool = REFUSALS[reason] || REFUSALS.full_health;
  return fill(pickFrom(pool, rng), courtesan);
}

// Слух: одна строка, детерминированная от сида визита.
export function courtesanRumor(runSeed, visitIndex = 0) {
  const rng = createRng(hashSeed(`${runSeed}:rumor:${visitIndex}`));
  return pickFrom(RUMORS, rng);
}

export function rumorCount() {
  return RUMORS.length;
}

// Услуга доступна, пока есть куда лечиться или добирать бодрость.
// free=true — она уже принимает бесплатно: платить не нужно, но и запаса не даёт.
export function courtesanCanServe(courtesan, gold, health, maxHealth, overheal = 0, free = false) {
  if (!courtesan) return { ok: false, reason: "no_courtesan" };
  const total = health + Math.max(0, overheal);
  const ceiling = maxHealth + OVERHEAL_CAP;
  if (total >= ceiling) return { ok: false, reason: "full_health" };
  if (!free && gold < courtesan.price) return { ok: false, reason: "no_gold" };
  return { ok: true, reason: "", free: Boolean(free) };
}

// Лечение: сначала здоровье до максимума, остаток — в запас бодрости.
// Бесплатный визит запас НЕ даёт: иначе привязанность отменяет экономику.
// Возвращает { health, overheal, gold, healed, topped }.
export function applyHeal(courtesan, gold, health, maxHealth, overheal = 0, free = false) {
  const safeHealth = Math.max(0, Math.min(maxHealth, health));
  const safeOver = Math.max(0, Math.min(OVERHEAL_CAP, overheal));
  let room = maxHealth + OVERHEAL_CAP - (safeHealth + safeOver);

  const healToMax = Math.min(room, maxHealth - safeHealth);
  const newHealth = safeHealth + Math.max(0, healToMax);
  room -= Math.max(0, healToMax);

  // Бесплатно — только здоровье, без запаса.
  const overGain = free ? 0 : Math.min(room, OVERHEAL_CAP - safeOver);
  const newOver = safeOver + Math.max(0, overGain);

  return {
    health: newHealth,
    overheal: newOver,
    gold: free ? gold : Math.max(0, gold - (courtesan ? courtesan.price : 0)),
    healed: newHealth - safeHealth,
    topped: newOver - safeOver,
    free: Boolean(free),
  };
}

// Расход запаса на ходу. Возвращает остаток.
export function decayOverheal(overheal, dt, moving) {
  if (!moving || !Number.isFinite(overheal) || overheal <= 0) return Math.max(0, overheal || 0);
  return Math.max(0, overheal - OVERHEAL_DECAY * dt);
}

// Урон: сначала съедает запас бодрости, потом здоровье.
export function absorbWithOverheal(damage, health, overheal) {
  const dmg = Math.max(0, damage);
  const over = Math.max(0, overheal || 0);
  const hp = Math.max(0, health);

  const fromOver = Math.min(over, dmg);
  const rest = dmg - fromOver;

  return {
    health: Math.max(0, hp - rest),
    overheal: Math.max(0, over - fromOver),
    absorbed: fromOver,
    toHealth: rest,
  };
}

export function pickCourtesanLine(courtesan, rng = Math.random) {
  return greetCourtesan(courtesan, rng);
}

export function describeCourtesan(courtesan) {
  if (!courtesan) return "";
  return `${courtesan.displayName} (${courtesan.temperLabel}): ${courtesan.hair.label} волосы, ${courtesan.dress.label} платье, ${courtesan.accessory}.`;
}
