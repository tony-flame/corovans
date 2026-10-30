// Живность: коровы, козы, лисы. Чистый модуль — без DOM.
// Поведение детерминировано: блуждание считается от сида животного,
// иначе восстановление сейва поедет.

import { createRng, hashSeed } from "./rng.js";

export const SPECIES = {
  COW: "cow",
  GOAT: "goat",
  FOX: "fox",
};

// Радиусы и скорости подобраны так, чтобы корова не запирала дорогу,
// а лиса успевала догнать игрока, но не бесконечно.
export const SPECIES_DEFS = {
  cow: {
    label: "Корова",
    sprite: "cow",
    radius: 0.35,
    scale: 1.05,
    speed: 0.55,
    fleeSpeed: 1.5,
    wanderRadius: 4.5,
    hp: 30,
    hostile: false,
    fearRadius: 3.2,
    drops: [{ id: "beef", name: "Говядина", value: 28, weight: 2.5, kind: "food", heal: 30 }],
    sound: "moo",
  },
  goat: {
    label: "Коза",
    sprite: "goat",
    radius: 0.28,
    scale: 0.82,
    speed: 0.75,
    fleeSpeed: 1.9,
    wanderRadius: 3.8,
    hp: 18,
    hostile: false,
    fearRadius: 2.6,
    drops: [{ id: "chevon", name: "Козлятина", value: 20, weight: 1.5, kind: "food", heal: 20 }],
    sound: "bleat",
  },
  fox: {
    label: "Лиса",
    sprite: "fox",
    radius: 0.24,
    scale: 0.6,
    speed: 1.1,
    fleeSpeed: 2.2,
    wanderRadius: 3,
    hp: 14,
    hostile: true,
    fearRadius: 0,
    aggressionRange: 5,
    biteDamage: 6,
    biteCooldown: 1.4,
    bleed: { duration: 12, dps: 1.5 },
    drops: [{ id: "foxfur", name: "Лисий мех", value: 34, weight: 1, kind: "goods" }],
    sound: "yip",
  },
};

export function isHostile(species) {
  const def = SPECIES_DEFS[species];
  return Boolean(def && def.hostile);
}

export function isAnimal(kind) {
  return Boolean(SPECIES_DEFS[kind]);
}

export function createAnimal(kind, x, y, tier = 1, salt = 0) {
  const def = SPECIES_DEFS[kind];
  if (!def) return null;

  const seed = hashSeed(`${kind}:${x}:${y}:${tier}:${salt}`);
  const rng = createRng(seed);
  const hpScale = 1 + (tier - 1) * 0.15;

  return {
    id: seed,
    kind,
    species: kind,
    spriteKey: def.sprite,
    x,
    y,
    homeX: x,
    homeY: y,
    r: def.radius,
    scale: def.scale,
    hp: Math.round(def.hp * hpScale),
    maxHp: Math.round(def.hp * hpScale),
    alive: true,
    state: "idle",
    angle: rng() * Math.PI * 2,
    speed: def.speed,
    fleeSpeed: def.fleeSpeed,
    wanderRadius: def.wanderRadius,
    targetX: x,
    targetY: y,
    repathTimer: 0,
    steps: 0,
    attackCd: 0,
    seed,
    tier,
  };
}

// Один шаг поведения. Возвращает { animal, bite } — bite !== null,
// если животное укусило игрока в этом кадре.
// Детерминизм: решение о новой цели берётся от seed + счётчик шагов,
// без часов, иначе восстановление сейва даст другое поведение.
export function stepAnimal(animal, player, dt) {
  const def = SPECIES_DEFS[animal.kind];
  if (!def || !animal.alive) return { animal, bite: null };

  const dx = player.x - animal.x;
  const dy = player.y - animal.y;
  const dist = Math.hypot(dx, dy);

  animal.attackCd = Math.max(0, animal.attackCd - dt);
  animal.repathTimer = Math.max(0, animal.repathTimer - dt);
  animal.steps = (animal.steps || 0) + 1;

  // Хищник: преследует в радиусе агрессии и кусает в упор.
  if (def.hostile) {
    if (dist < def.aggressionRange) {
      animal.state = "chase";
      animal.angle = Math.atan2(dy, dx);
      if (dist > 0.9) {
        animal.x += (dx / dist) * animal.fleeSpeed * dt;
        animal.y += (dy / dist) * animal.fleeSpeed * dt;
      } else if (animal.attackCd <= 0) {
        animal.attackCd = def.biteCooldown;
        return {
          animal,
          bite: { damage: def.biteDamage, bleed: def.bleed, source: animal },
        };
      }
      return { animal, bite: null };
    }
    animal.state = "idle";
  } else if (dist < def.fearRadius) {
    // Травоядные: убегают от игрока, но не бесконечно.
    animal.state = "flee";
    animal.angle = Math.atan2(-dy, -dx);
    animal.x -= (dx / Math.max(0.001, dist)) * animal.fleeSpeed * dt;
    animal.y -= (dy / Math.max(0.001, dist)) * animal.fleeSpeed * dt;
    if (Math.hypot(animal.x - animal.homeX, animal.y - animal.homeY) > animal.wanderRadius * 2.2) {
      animal.x = animal.homeX;
      animal.y = animal.homeY;
    }
    return { animal, bite: null };
  }

  // Мирное блуждание вокруг дома.
  if (animal.repathTimer <= 0) {
    const rng = createRng(hashSeed(`${animal.seed}:${animal.steps}`));
    animal.repathTimer = 3 + rng() * 4;
    const angle = rng() * Math.PI * 2;
    const radius = rng() * animal.wanderRadius;
    animal.targetX = animal.homeX + Math.cos(angle) * radius;
    animal.targetY = animal.homeY + Math.sin(angle) * radius;
    animal.state = "wander";
  }

  const tx = animal.targetX - animal.x;
  const ty = animal.targetY - animal.y;
  const tdist = Math.hypot(tx, ty);
  if (tdist > 0.2) {
    animal.angle = Math.atan2(ty, tx);
    animal.x += (tx / tdist) * animal.speed * dt;
    animal.y += (ty / tdist) * animal.speed * dt;
  } else {
    animal.state = "idle";
  }

  return { animal, bite: null };
}

// Урон животному. Возвращает { animal, drops, killed }.
export function animalOnHit(animal, damage) {
  if (!animal || !animal.alive) return { animal, drops: [], killed: false };

  animal.hp -= damage;
  if (animal.hp > 0) {
    animal.state = "flee";
    return { animal, drops: [], killed: false };
  }

  animal.hp = 0;
  animal.alive = false;

  const def = SPECIES_DEFS[animal.kind];
  const drops = (def.drops || []).map((drop, index) => ({
    ...drop,
    id: `${drop.id}-${animal.tier || 1}-${animal.seed}-${index}`,
  }));

  return { animal, drops, killed: true };
}

// Кровотечение: тик по времени. Возвращает { bleed, damage }.
export function bleedTick(bleed, dt) {
  if (!bleed || bleed.remaining <= 0) {
    return { bleed: { remaining: 0, dps: 0 }, damage: 0 };
  }

  const remaining = Math.max(0, bleed.remaining - dt);
  const applied = Math.min(dt, bleed.remaining);
  const damage = applied * bleed.dps;

  return {
    bleed: { remaining, dps: bleed.dps },
    damage,
  };
}

export function applyBleed(bleed, spec) {
  if (!spec) return bleed || { remaining: 0, dps: 0 };
  const current = bleed || { remaining: 0, dps: 0 };
  return {
    remaining: Math.max(current.remaining || 0, spec.duration),
    dps: Math.max(current.dps || 0, spec.dps),
  };
}

export function createBleed() {
  return { remaining: 0, dps: 0 };
}

// Лучшая еда в инвентаре: самая сытная, при равенстве — самая дорогая.
export function bestFood(items) {
  let best = null;
  for (const item of items || []) {
    if (item.kind !== "food" || !item.heal) continue;
    if (!best || item.heal > best.heal || (item.heal === best.heal && item.value > best.value)) {
      best = item;
    }
  }
  return best;
}

// Спавн-точки живности по архетипу лагеря и тиру.
export function animalSpawnPlan(tier, archetype) {
  const plan = [
    { kind: SPECIES.COW, count: 2 },
    { kind: SPECIES.GOAT, count: 2 },
    { kind: SPECIES.FOX, count: Math.min(3, 1 + Math.floor(tier / 2)) },
  ];
  // У ночёвки больше хищников, у двойного фургона — больше скота.
  if (archetype === "night_camp") plan[2].count += 1;
  if (archetype === "double_wagon") plan[0].count += 1;
  return plan;
}
