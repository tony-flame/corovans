import test from "node:test";
import assert from "node:assert/strict";

import {
  createHorse,
  createHorseList,
  horseSpeed,
  canMount,
  mountReasonText,
  allowsAtMount,
  mountedDamage,
  horseSpawns,
  HORSE_SPEED_ROAD,
  HORSE_SPEED_OFFROAD,
  HORSE_MOUNT_RANGE,
  MOUNTED_DAMAGE_MULT,
} from "../src/horse.js";
import { TILE } from "../src/world.js";

test("лошадь: создаётся с осёдланным спрайтом", () => {
  const h = createHorse("stable", 10, 20);
  assert.equal(h.kind, "horse");
  assert.equal(h.alive, true);
  assert.equal(h.spriteKey, "horseSaddled");
  assert.equal(h.x, 10);
});

test("лошадь: по дороге быстрее, чем по бездорожью", () => {
  const road = horseSpeed(TILE.ROAD);
  const grass = horseSpeed(TILE.GRASS);
  assert.ok(road > grass, `${road} vs ${grass}`);
  assert.equal(road, HORSE_SPEED_ROAD);
  assert.equal(grass, HORSE_SPEED_OFFROAD);
});

test("лошадь: по воде не едет", () => {
  assert.equal(horseSpeed(TILE.WATER), 0);
});

test("лошадь: сесть можно рядом и на твёрдой земле", () => {
  const horse = createHorse("stable", 10, 20);
  const r = canMount({ mounted: false, blocking: false }, horse, TILE.GRASS, 1.0);
  assert.equal(r.ok, true);
});

test("лошадь: нельзя сесть слишком далеко", () => {
  const horse = createHorse("stable", 10, 20);
  const r = canMount({ mounted: false, blocking: false }, horse, TILE.GRASS, HORSE_MOUNT_RANGE + 1);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "too_far");
});

test("лошадь: нельзя сесть со щитом и уже верхом", () => {
  const horse = createHorse("stable", 10, 20);
  assert.equal(canMount({ mounted: false, blocking: true }, horse, TILE.GRASS, 1).reason, "blocking");
  assert.equal(canMount({ mounted: true, blocking: false }, horse, TILE.GRASS, 1).reason, "already_mounted");
});

test("лошадь: нельзя сесть на воду и на мёртвую лошадь", () => {
  const horse = createHorse("stable", 10, 20);
  assert.equal(canMount({ mounted: false }, horse, TILE.WATER, 1).reason, "blocked_terrain");

  const dead = createHorse("dead", 10, 20);
  dead.alive = false;
  assert.equal(canMount({ mounted: false }, dead, TILE.GRASS, 1).reason, "no_horse");
});

test("лошадь: причины отказа объяснимы человеку", () => {
  for (const reason of ["no_horse", "already_mounted", "blocking", "too_far", "blocked_terrain"]) {
    const text = mountReasonText(reason);
    assert.ok(text.length > 5, reason);
    assert.notEqual(text, "Не получилось сесть.", reason);
  }
});

test("лошадь: верхом запрещены кража, блок и присед", () => {
  assert.equal(allowsAtMount("steal"), false);
  assert.equal(allowsAtMount("block"), false);
  assert.equal(allowsAtMount("crouch"), false);

  assert.equal(allowsAtMount("attack"), true);
  assert.equal(allowsAtMount("move"), true);
  assert.equal(allowsAtMount("eat"), true);
});

test("лошадь: удар с седла слабее", () => {
  assert.equal(mountedDamage(10), Math.round(10 * MOUNTED_DAMAGE_MULT));
  assert.ok(mountedDamage(10) < 10);
  assert.ok(mountedDamage(1) >= 1, "не ноль");
});

test("лошадь: без разблокировки только конюшенная", () => {
  const none = horseSpawns({});
  assert.equal(none.length, 1);
  assert.equal(none[0].id, "stable");
});

test("лошадь: с разблокировкой появляется личная", () => {
  const withBonus = horseSpawns({ fastTravel: true });
  assert.equal(withBonus.length, 2);
  assert.ok(withBonus.some((h) => h.personal));
});

test("лошадь: список создаётся из спавнов", () => {
  const list = createHorseList({ fastTravel: true });
  assert.equal(list.length, 2);
  for (const h of list) {
    assert.equal(h.alive, true);
    assert.equal(h.kind, "horse");
  }
});
