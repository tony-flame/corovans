// Стиль игры: телеметрия поступков игрока и адаптация мира под неё.
// Чистый модуль. Балансится содержание, а не сила врага: множители
// зажаты в узких пределах, иначе игра наказывает за мастерство.

export const STYLE = {
  GHOST: "ghost",
  BUTCHER: "butcher",
  DEALER: "dealer",
  NEUTRAL: "neutral",
};

export const STYLE_LABELS = {
  ghost: "Призрак",
  butcher: "Мясник",
  dealer: "Делец",
  neutral: "Безымянный",
};

// Что игрок видит в панели «Слава».
export const STYLE_HINTS = {
  ghost: "Тебя знают как Призрака: стража чутче, но тихая кража платит больше.",
  butcher: "Тебя знают как Мясника: лагеря укрепляются, а с трупов много не взять.",
  dealer: "Тебя знают как Дельца: караваны богаче, а Мардо щедрее.",
  neutral: "Тебя ещё не знают. Поступки определят, каким тебя запомнят.",
};

// Потолки множителей. Никакая телеметрия не выводит за них.
export const TUNING_CAPS = {
  guardCountDelta: 1,
  hp: [0.85, 1.2],
  damage: [0.85, 1.2],
  viewRange: [0.9, 1.15],
  killDrop: [0.5, 1],
  silentBonus: [1, 1.5],
  lootCount: [0, 2],
};

const EVENT_WEIGHTS = {
  silent_loot: { ghost: 3 },
  loud_loot: { butcher: 2 },
  kill: { butcher: 3 },
  witnessed: { butcher: 1 },
  chase_escaped: { ghost: 2 },
  clean_contract: { dealer: 2, ghost: 1 },
  sell_high: { dealer: 2 },
  contract_done: { dealer: 2 },
  contract_failed: { dealer: -1 },
  damage_taken: { butcher: 0.5 },
};

// Итог, ниже которого стиль не считается выраженным.
const NEUTRAL_THRESHOLD = 4;
const DECAY = 0.97;

export function createStyle() {
  return { ghost: 0, butcher: 0, dealer: 0, events: 0 };
}

export function recordEvent(style, eventName) {
  const weights = EVENT_WEIGHTS[eventName];
  if (!weights) return style;

  for (const key of Object.keys(STYLE_LABELS)) {
    if (key === STYLE.NEUTRAL) continue;
    style[key] = Math.max(0, style[key] * DECAY);
  }
  for (const [key, delta] of Object.entries(weights)) {
    style[key] = Math.max(0, (style[key] || 0) + delta);
  }
  style.events = (style.events || 0) + 1;
  return style;
}

export function totalStyle(style) {
  return (style.ghost || 0) + (style.butcher || 0) + (style.dealer || 0);
}

export function styleShares(style) {
  const total = totalStyle(style);
  if (total <= 0) return { ghost: 0, butcher: 0, dealer: 0 };
  return {
    ghost: (style.ghost || 0) / total,
    butcher: (style.butcher || 0) / total,
    dealer: (style.dealer || 0) / total,
  };
}

export function dominantArchetype(style) {
  if (!style || totalStyle(style) < NEUTRAL_THRESHOLD) return STYLE.NEUTRAL;
  const shares = styleShares(style);
  let best = STYLE.NEUTRAL;
  let bestValue = 0;
  for (const [key, value] of Object.entries(shares)) {
    if (value > bestValue) {
      bestValue = value;
      best = key;
    }
  }
  return best;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// 70% архетип / 30% база — чтобы мир оставался узнаваемым.
export const ARCHETYPE_BLEND = 0.7;

const BASE_TUNING = {
  archetype: "road_camp",
  guardCountDelta: 0,
  hp: 1,
  damage: 1,
  viewRange: 1,
  killDrop: 1,
  // Тихая кража должна быть выгоднее громкой ВСЕГДА, иначе единственный
  // повод красться — избежать розыска, а советы обещают ещё и бонус.
  // Было 1: на старте round(coin * (1-1)) = 0, то есть обещание врало.
  silentBonus: 1.15,
  lootCount: 0,
  priceBonus: 1,
};

const ARCHETYPE_TUNING = {
  ghost: {
    archetype: "night_camp",
    guardCountDelta: -1,
    hp: 0.9,
    damage: 0.9,
    viewRange: 1.15,
    killDrop: 0.6,
    silentBonus: 1.5,
    lootCount: 0,
    priceBonus: 1.05,
  },
  butcher: {
    archetype: "fortified_post",
    guardCountDelta: 1,
    hp: 1.15,
    damage: 1.2,
    viewRange: 0.95,
    killDrop: 0.55,
    silentBonus: 1,
    lootCount: 1,
    priceBonus: 1,
  },
  dealer: {
    archetype: "double_wagon",
    guardCountDelta: 0,
    hp: 1,
    damage: 0.95,
    viewRange: 1,
    killDrop: 0.8,
    silentBonus: 1.2,
    lootCount: 1,
    priceBonus: 1.12,
  },
  neutral: {
    archetype: "road_camp",
    guardCountDelta: 0,
    hp: 1,
    damage: 1,
    viewRange: 1,
    killDrop: 1,
    silentBonus: 1,
    lootCount: 0,
    priceBonus: 1,
  },
};

function blend(base, target, t) {
  return base + (target - base) * t;
}

export function tuningFor(style) {
  const archetype = dominantArchetype(style);
  const target = ARCHETYPE_TUNING[archetype] || ARCHETYPE_TUNING.neutral;
  const t = archetype === STYLE.NEUTRAL ? 0 : ARCHETYPE_BLEND;

  const tuning = {
    archetype: archetype === STYLE.NEUTRAL ? BASE_TUNING.archetype : target.archetype,
    guardCountDelta: 0,
    hp: blend(BASE_TUNING.hp, target.hp, t),
    damage: blend(BASE_TUNING.damage, target.damage, t),
    viewRange: blend(BASE_TUNING.viewRange, target.viewRange, t),
    killDrop: blend(BASE_TUNING.killDrop, target.killDrop, t),
    silentBonus: blend(BASE_TUNING.silentBonus, target.silentBonus, t),
    lootCount: 0,
    priceBonus: blend(BASE_TUNING.priceBonus, target.priceBonus, t),
  };

  // Дельту количества считаем по модулю: 3 стража × 70% ≈ +1.
  const rawDelta = (target.guardCountDelta || 0) * (t || 1);
  tuning.guardCountDelta = clamp(Math.round(rawDelta), -TUNING_CAPS.guardCountDelta, TUNING_CAPS.guardCountDelta);
  tuning.lootCount = clamp(Math.round((target.lootCount || 0) * (t || 1)), 0, TUNING_CAPS.lootCount[1]);

  tuning.hp = clamp(tuning.hp, TUNING_CAPS.hp[0], TUNING_CAPS.hp[1]);
  tuning.damage = clamp(tuning.damage, TUNING_CAPS.damage[0], TUNING_CAPS.damage[1]);
  tuning.viewRange = clamp(tuning.viewRange, TUNING_CAPS.viewRange[0], TUNING_CAPS.viewRange[1]);
  tuning.killDrop = clamp(tuning.killDrop, TUNING_CAPS.killDrop[0], TUNING_CAPS.killDrop[1]);
  tuning.silentBonus = clamp(tuning.silentBonus, TUNING_CAPS.silentBonus[0], TUNING_CAPS.silentBonus[1]);
  tuning.style = archetype;
  tuning.label = STYLE_LABELS[archetype];
  tuning.hint = STYLE_HINTS[archetype];
  return tuning;
}

export function archetypeLabel(id) {
  const labels = {
    road_camp: "Дорожный лагерь",
    night_camp: "Ночёвка",
    fortified_post: "Укреплённый пост",
    double_wagon: "Двойной фургон",
  };
  return labels[id] || labels.road_camp;
}
