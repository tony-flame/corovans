import test from "node:test";
import assert from "node:assert/strict";

import {
  createInventory,
  addItem,
  removeItem,
  totalWeight,
  totalValue,
  sellAll,
  rollLoot,
} from "../src/inventory.js";
import {
  createUpgrades,
  priceOf,
  canBuy,
  purchase,
  fineFor,
  sellMultiplier,
} from "../src/economy.js";
import { damageRoll, applyArmor, inMeleeCone, attackCooldown, stealTime } from "../src/combat.js";
import { createWorld, canStand, isSolid, tileAt, TILE, spawnCamp, lineOfSight } from "../src/world.js";

test("inventory: вместимость, вес и продажа", () => {
  const inv = createInventory(5);
  assert.equal(addItem(inv, { id: "a", name: "A", value: 10, weight: 3 }), true);
  assert.equal(addItem(inv, { id: "b", name: "B", value: 20, weight: 3 }), false);
  assert.equal(totalWeight(inv), 3);
  assert.equal(totalValue(inv), 10);
  assert.equal(addItem(inv, { id: "c", name: "C", value: 5, weight: 2 }), true);
  assert.equal(totalWeight(inv), 5);
  assert.equal(sellAll(inv), 15);
  assert.equal(inv.items.length, 0);
});

test("inventory: удаление предмета", () => {
  const inv = createInventory();
  addItem(inv, { id: "x", name: "X", value: 1, weight: 1 });
  assert.equal(removeItem(inv, "x").id, "x");
  assert.equal(removeItem(inv, "x"), null);
});

test("inventory: детерминированный лут растёт с уровнем", () => {
  const low = rollLoot(1, () => 0.1, 2);
  const high = rollLoot(3, () => 0.1, 2);
  assert.equal(low.length, 2);
  assert.equal(low[0].id === low[1].id, false);
  assert.ok(high[0].value > low[0].value);
});

test("economy: цены, покупка и максимум уровней", () => {
  const upgrades = createUpgrades();
  assert.equal(priceOf("sword", 0), 80);
  assert.equal(canBuy(79, upgrades, "sword"), false);
  const result = purchase(100, upgrades, "sword");
  assert.equal(result.gold, 20);
  assert.equal(result.upgrades.sword, 1);
  assert.equal(upgrades.sword, 0, "исходный объект не мутируется");

  const maxed = { ...upgrades, sword: 3 };
  assert.equal(priceOf("sword", 3), null);
  assert.equal(canBuy(9999, maxed, "sword"), false);
  assert.equal(purchase(9999, maxed, "sword"), null);
});

test("economy: штраф и множитель продажи", () => {
  assert.equal(fineFor(0), 0);
  assert.equal(fineFor(1), 100);
  assert.equal(sellMultiplier(createUpgrades()), 1);
  assert.ok(sellMultiplier({ ...createUpgrades(), lockpick: 2 }) > 1);
});

test("combat: урон, броня и конус удара", () => {
  assert.equal(damageRoll(10, () => 0.5), 10);
  assert.equal(damageRoll(1, () => 0), 1);
  assert.equal(applyArmor(10, 0), 10);
  assert.equal(applyArmor(10, 2), 6);
  assert.equal(applyArmor(2, 3), 1, "минимум 1 урон");

  assert.equal(inMeleeCone(0, 0, 1, 0, 1.5, 0, 2), true);
  assert.equal(inMeleeCone(0, 0, 1, 0, -1.5, 0, 2), false);
  assert.equal(inMeleeCone(0, 0, 1, 0, 3, 0, 2), false);

  assert.ok(attackCooldown(3) < attackCooldown(0));
  assert.ok(stealTime(2) < stealTime(0));
});

test("world: спавн, стены и дорога", () => {
  const world = createWorld();
  assert.equal(isSolid(world, world.spawn.x, world.spawn.y), false);
  assert.equal(canStand(world, world.spawn.x, world.spawn.y, 0.26), true);

  // Тракт идёт по y=86..87 через всю карту.
  assert.equal(tileAt(world, 60.5, 86.5), TILE.ROAD);
  assert.equal(tileAt(world, 98.5, 60.5), TILE.ROAD, "поворот на север — дорога");

  // Дом в деревне непроходим.
  assert.equal(canStand(world, 11, 72, 0.26), false, "внутри дома стоять нельзя");

  // Обзор вдоль улицы свободен, сквозь дом — нет.
  assert.equal(lineOfSight(world, 12.5, 92.5, 30.5, 92.5), true, "площадь просматривается");
  assert.equal(lineOfSight(world, 11, 72, 11, 78), false, "дом перекрывает обзор");
});

test("world: уровни каравана и сброс фургона", () => {
  const world = createWorld();
  assert.equal(world.campGuards.filter((a) => a.kind === "guard").length, 2);
  world.wagonLooted = true;
  spawnCamp(world, 3);
  assert.equal(world.wagonLooted, false);
  assert.equal(world.campGuards.filter((a) => a.kind === "guard").length, 4);
  assert.ok(world.campGuards[0].hp > 38 + 14, "охрана третьего уровня крепче");
});
