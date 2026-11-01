import test from "node:test";
import assert from "node:assert/strict";

import {
  SPECIES,
  SPECIES_DEFS,
  createAnimal,
  stepAnimal,
  animalOnHit,
  bleedTick,
  applyBleed,
  createBleed,
  bestFood,
  animalSpawnPlan,
  isAnimal,
  isHostile,
} from "../src/wildlife.js";
import {
  createCourtesan,
  courtesanSeed,
  courtesanCanServe,
  applyHeal,
  pickCourtesanLine,
  NAMES,
  HAIR_COLORS,
  DRESS_COLORS,
  ACCESSORIES,
  PRICE_MIN,
  PRICE_MAX,
} from "../src/npc.js";
import { createWorld, spawnCamp, hasPath, canStand, SPAWN, MERCHANT_POS, COURTESAN_POS, WAGON_BASE, MAP_W, MAP_H, isSolid, CAMP_LAYOUTS, nearestInteraction, ZONES } from "../src/world.js";
import { updateActors, maxSuspicion } from "../src/enemies.js";

test("wildlife: диспетчер не превращает животное в стражника", () => {
  const world = createWorld();
  const cow = createAnimal("cow", 60, 80, 1, 0);
  world.animals = [cow];

  const player = { x: 59, y: 80, crouching: false, sprinting: false, dead: false };
  const game = {
    world,
    player,
    wanted: 0,
    noiseLevel: 0,
    dayTime: 0,
    damagePlayer: () => {
      throw new Error("корова не должна бить игрока");
    },
    onGuardAlert: () => {},
  };

  for (let i = 0; i < 120; i++) updateActors(game, 0.016);

  // Животное не в world.actors, поэтому диспетчер его вообще не видит.
  // Это и есть защита: AI обновляет только людей.
  assert.equal(world.actors.some((a) => a.kind === "cow"), false);
  assert.equal(cow.hp, cow.maxHp);
});

test("wildlife: куртизанка не патрулирует и не даёт подозрения", () => {
  const world = createWorld();
  const courtesan = world.courtesan;
  assert.ok(courtesan);
  assert.equal(courtesan.kind, "courtesan");

  const game = {
    world,
    player: { x: courtesan.x + 0.5, y: courtesan.y, crouching: false, sprinting: false, dead: false },
    wanted: 0,
    noiseLevel: 1,
    dayTime: 0,
    damagePlayer: () => {
      throw new Error("куртизанка не должна бить");
    },
    onGuardAlert: () => {},
  };

  updateActors(game, 0.016);
  assert.equal(courtesan.state, "idle");
  assert.equal(courtesan.suspicion, 0);

  const susp = maxSuspicion(world);
  assert.equal(susp.value, 0, "подозрение считается только по людям");
  assert.equal(susp.chasing, false);
});

test("map: все ключевые точки на карте достижимы", () => {
  const world = createWorld();

  assert.equal(isSolid(world, SPAWN.x, SPAWN.y), false, "спавн в стене");
  assert.equal(isSolid(world, MERCHANT_POS.x, MERCHANT_POS.y), false, "Мардо в стене");
  assert.equal(isSolid(world, COURTESAN_POS.x, COURTESAN_POS.y), false, "куртизанка в стене");

  assert.equal(hasPath(world, SPAWN, MERCHANT_POS), true, "нет пути до Мардо");
  assert.equal(hasPath(world, SPAWN, COURTESAN_POS), true, "нет пути до куртизанки");
  assert.equal(hasPath(world, SPAWN, WAGON_BASE), true, "нет пути до фургона");
});

test("map: вокруг спавна и NPC есть место", () => {
  const world = createWorld();
  for (const [name, p] of Object.entries({ spawn: SPAWN, merchant: MERCHANT_POS, courtesan: COURTESAN_POS })) {
    let free = 0;
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      if (canStand(world, p.x + Math.cos(ang) * 1.5, p.y + Math.sin(ang) * 1.5, 0.26)) free++;
    }
    assert.ok(free >= 5, `${name}: слишком тесно вокруг (${free}/8)`);
  }
});

test("map: зоны внутри границ", () => {
  assert.equal(MAP_W, 200);
  assert.equal(MAP_H, 200);
  for (const [name, z] of Object.entries(ZONES)) {
    assert.ok(z.x0 >= 0 && z.y0 >= 0, name);
    assert.ok(z.x1 < MAP_W && z.y1 < MAP_H, name);
  }
});

test("map: архетипы лагерей не выходят за зону стойбища", () => {
  for (const [id, layout] of Object.entries(CAMP_LAYOUTS)) {
    for (const [ox, oy] of layout.guardSpots) {
      const x = WAGON_BASE.x + ox;
      const y = WAGON_BASE.y + oy;
      assert.ok(x > ZONES.CAMP.x0 && x < ZONES.CAMP.x1, `${id}: страж за зоной лагеря по x (${x})`);
      assert.ok(y > ZONES.CAMP.y0 && y < ZONES.CAMP.y1, `${id}: страж за зоной лагеря по y (${y})`);
    }
  }
});

test("map: взаимодействия не перекрываются по радиусу", () => {
  const world = createWorld();
  const player = { x: MERCHANT_POS.x, y: MERCHANT_POS.y };
  const near = nearestInteraction(world, player);
  assert.equal(near.type, "merchant");

  const nearCourtesan = nearestInteraction(world, { x: COURTESAN_POS.x, y: COURTESAN_POS.y });
  assert.equal(nearCourtesan.type, "courtesan");
  assert.ok(nearCourtesan.label.includes("E"));
});

test("map: у каждого актёра и животного есть спрайт", () => {
  const world = createWorld();
  const keys = new Set([
    "guard", "village_guard", "driver", "merchant", "courtesan",
    "cow", "goat", "fox", "corpse",
  ]);
  for (const actor of world.actors) {
    const key = actor.spriteKey || actor.kind;
    assert.ok(keys.has(key), `нет спрайта для ${actor.kind} (${key})`);
  }
});

test("wildlife: виды определены и различаются по враждебности", () => {
  assert.equal(isAnimal("cow"), true);
  assert.equal(isAnimal("cow"), true);
  assert.equal(isAnimal("guard"), false);

  assert.equal(isHostile(SPECIES.FOX), true);
  assert.equal(isHostile(SPECIES.COW), false);
  assert.equal(isHostile(SPECIES.GOAT), false);
});

test("wildlife: корова и коза дают еду, лиса — мех", () => {
  assert.equal(SPECIES_DEFS.cow.drops[0].kind, "food");
  assert.ok(SPECIES_DEFS.cow.drops[0].heal > 0);
  assert.equal(SPECIES_DEFS.goat.drops[0].kind, "food");
  assert.equal(SPECIES_DEFS.fox.drops[0].kind, "goods");
});

test("wildlife: создание животного детерминировано", () => {
  const a = createAnimal(SPECIES.COW, 10, 20, 2, 3);
  const b = createAnimal(SPECIES.COW, 10, 20, 2, 3);
  assert.equal(a.seed, b.seed);
  assert.equal(a.hp, b.hp);
  assert.equal(a.angle, b.angle);
  assert.equal(a.spriteKey, "cow");
});

test("wildlife: корова убегает, лиса преследует и кусает", () => {
  const cow = createAnimal(SPECIES.COW, 10, 10, 1, 0);
  const player = { x: 10.5, y: 10 };
  const cowStep = stepAnimal(cow, player, 0.1);
  assert.equal(cow.state, "flee");
  assert.equal(cowStep.bite, null);

  const fox = createAnimal(SPECIES.FOX, 10, 10, 1, 0);
  fox.x = 10;
  fox.y = 10;
  const near = { x: 10.5, y: 10 };
  const hit = stepAnimal(fox, near, 0.1);
  assert.equal(fox.state, "chase");
  assert.ok(hit.bite, "лиса в упор обязана укусить");
  assert.ok(hit.bite.damage > 0);
  assert.ok(hit.bite.bleed.duration > 0);
});

test("wildlife: укус лисы имеет перезарядку", () => {
  const fox = createAnimal(SPECIES.FOX, 10, 10, 1, 0);
  const player = { x: 10.4, y: 10 };
  const first = stepAnimal(fox, player, 0.05);
  assert.ok(first.bite);
  const second = stepAnimal(fox, player, 0.05);
  assert.equal(second.bite, null, "второй укус не должен проходить сразу");
});

test("wildlife: убийство животного даёт дропы, ранение — нет", () => {
  const cow = createAnimal(SPECIES.COW, 10, 10, 2, 0);
  const wounded = animalOnHit(cow, 1);
  assert.equal(wounded.killed, false);
  assert.equal(wounded.drops.length, 0);
  assert.equal(cow.state, "flee");

  const killed = animalOnHit(cow, 999);
  assert.equal(killed.killed, true);
  assert.equal(cow.alive, false);
  assert.equal(killed.drops.length, 1);
  assert.equal(killed.drops[0].kind, "food");
});

test("wildlife: дропы уникальны по id", () => {
  const a = animalOnHit(createAnimal(SPECIES.COW, 10, 10, 1, 0), 999);
  const b = animalOnHit(createAnimal(SPECIES.COW, 10, 10, 1, 1), 999);
  assert.notEqual(a.drops[0].id, b.drops[0].id);
});

test("wildlife: кровотечение тикает и заканчивается", () => {
  let bleed = applyBleed(createBleed(), { duration: 2, dps: 2 });
  assert.equal(bleed.remaining, 2);

  const step = bleedTick(bleed, 1);
  assert.equal(step.damage, 2);
  assert.equal(step.bleed.remaining, 1);

  const last = bleedTick(step.bleed, 1);
  assert.equal(last.damage, 2);
  assert.equal(last.bleed.remaining, 0);

  const after = bleedTick(last.bleed, 1);
  assert.equal(after.damage, 0);
});

test("wildlife: повторный укус не сокращает кровотечение", () => {
  const first = applyBleed(createBleed(), { duration: 12, dps: 1.5 });
  const weakened = bleedTick(first, 5).bleed;
  const again = applyBleed(weakened, { duration: 12, dps: 1.5 });
  assert.equal(again.remaining, 12, "новый укус продлевает, а не обнуляет");
});

test("wildlife: лучшая еда — самая сытная", () => {
  const items = [
    { id: "a", kind: "goods", value: 50, weight: 1 },
    { id: "b", kind: "food", heal: 20, value: 10, weight: 1 },
    { id: "c", kind: "food", heal: 30, value: 5, weight: 1 },
  ];
  assert.equal(bestFood(items).id, "c");
  assert.equal(bestFood([]), null);
  assert.equal(bestFood([{ id: "x", kind: "goods", value: 99, weight: 1 }]), null);
});

test("wildlife: план спавна зависит от тира и архетипа", () => {
  const plan = animalSpawnPlan(1, "road_camp");
  assert.ok(plan.find((p) => p.kind === "cow").count >= 1);
  assert.ok(plan.find((p) => p.kind === "goat").count >= 1);

  const night = animalSpawnPlan(1, "night_camp");
  const base = animalSpawnPlan(1, "road_camp");
  assert.ok(
    night.find((p) => p.kind === "fox").count > base.find((p) => p.kind === "fox").count,
    "у ночёвки больше лис"
  );

  const highTier = animalSpawnPlan(6, "road_camp");
  assert.ok(highTier.find((p) => p.kind === "fox").count > 1);
});

test("npc: вариант куртизанки детерминирован", () => {
  const a = createCourtesan(1234, 2, 1);
  const b = createCourtesan(1234, 2, 1);
  assert.equal(a.id, b.id);
  assert.equal(a.name, b.name);
  assert.equal(a.hair.id, b.hair.id);
  assert.equal(a.dress.id, b.dress.id);
  assert.equal(a.price, b.price);
  assert.equal(courtesanSeed(1234, 2, 1), courtesanSeed(1234, 2, 1));
});

test("npc: новый караван меняет внешность", () => {
  const tier1 = createCourtesan(777, 1, 0);
  const tier2 = createCourtesan(777, 2, 0);
  assert.notEqual(tier1.id, tier2.id);
  const different =
    tier1.name !== tier2.name ||
    tier1.hair.id !== tier2.hair.id ||
    tier1.dress.id !== tier2.dress.id;
  assert.ok(different, "при смене каравана что-то должно измениться");
});

test("npc: смена акта меняет внешность", () => {
  const act1 = createCourtesan(777, 3, 0);
  const act2 = createCourtesan(777, 3, 1);
  assert.notEqual(act1.id, act2.id);
});

test("npc: поля в кураторских палитрах, цена в диапазоне", () => {
  for (let seed = 1; seed < 60; seed++) {
    const c = createCourtesan(seed, 1, 0);
    assert.ok(NAMES.includes(c.name), c.name);
    assert.ok(HAIR_COLORS.some((h) => h.id === c.hair.id));
    assert.ok(DRESS_COLORS.some((d) => d.id === c.dress.id));
    assert.ok(ACCESSORIES.includes(c.accessory));
    assert.ok(c.price >= PRICE_MIN && c.price <= PRICE_MAX, String(c.price));
    assert.ok(c.spriteKey.startsWith("courtesan_"));
  }
});

test("npc: услуга доступна при полном здоровье, пока есть место в запасе", () => {
  const c = createCourtesan(1, 1, 0);

  // Полное здоровье больше не отказ: куртизанка добирает запас бодрости.
  assert.equal(courtesanCanServe(c, 100, 100, 100).ok, true);
  assert.equal(courtesanCanServe(c, 100, 100, 100, 0).ok, true);

  // Отказ только когда здоровье И запас на максимуме.
  assert.equal(courtesanCanServe(c, 100, 100, 100, 25).reason, "full_health");
  assert.equal(courtesanCanServe(c, 100, 100, 100, 24.9).ok, true);

  // Без золота — отказ независимо от здоровья.
  assert.equal(courtesanCanServe(c, c.price - 1, 10, 100).reason, "no_gold");
  assert.equal(courtesanCanServe(c, c.price, 10, 100).ok, true);
  assert.equal(courtesanCanServe(null, 100, 10, 100).ok, false);
});

test("npc: лечение не превышает максимум и списывает ровно цену", () => {
  const c = createCourtesan(1, 1, 0);
  const result = applyHeal(c, c.price + 50, 10, 100);
  assert.equal(result.health, 100);
  assert.equal(result.gold, 50);
  assert.equal(result.healed, 90);
});

test("npc: реплика подставляет имя", () => {
  const c = createCourtesan(42, 1, 0);
  const line = pickCourtesanLine(c, () => 0.5);
  assert.ok(line.includes(c.name), line);
  assert.ok(!line.includes("{name}"));
});

test("npc: имя может быть с эпитетом", () => {
  const c = createCourtesan(5, 1, 0);
  if (c.epithet) assert.equal(c.displayName, `${c.epithet} ${c.name}`);
  else assert.equal(c.displayName, c.name);
});
