import test from "node:test";
import assert from "node:assert/strict";

import { createWorld, hasPath, SPAWN, ZONES, isSolid, tileAt, TILE } from "../src/world.js";

const keyOf = (p) => `${p.sprite}:${p.x.toFixed(1)}:${p.y.toFixed(1)}`;

function scatterOf(world) {
  return world.props.filter((p) => p.scatter);
}

test("россыпь: появляется и по сиду различается", () => {
  const a = createWorld();
  a.scatterVillage(1);
  const b = createWorld();
  b.scatterVillage(2);

  const sa = scatterOf(a);
  const sb = scatterOf(b);
  assert.ok(sa.length > 0, "россыпь пуста — сид ни на что не влияет");
  assert.ok(sb.length > 0);

  const setA = new Set(sa.map(keyOf));
  const setB = new Set(sb.map(keyOf));
  const onlyA = [...setA].filter((k) => !setB.has(k));
  assert.ok(onlyA.length > 0, "два разных сида дают одинаковую россыпь");
});

test("россыпь: один сид — одна расстановка", () => {
  const a = createWorld();
  a.scatterVillage(777);
  const b = createWorld();
  b.scatterVillage(777);

  assert.deepEqual(scatterOf(a).map(keyOf), scatterOf(b).map(keyOf));
});

test("россыпь: повторный вызов не задваивает пропсы", () => {
  const world = createWorld();
  world.scatterVillage(5);
  const first = scatterOf(world).length;
  world.scatterVillage(5);
  const second = scatterOf(world).length;
  assert.equal(first, second, `после повтора ${second} вместо ${first}`);

  // И перестановка на другой сид тоже не копит.
  world.scatterVillage(6);
  assert.equal(scatterOf(world).length, first);
});

test("россыпь: ничего не попадает на дорогу", () => {
  for (const seed of [0, 1, 42, 99, 12345]) {
    const world = createWorld();
    world.scatterVillage(seed);
    for (const prop of scatterOf(world)) {
      const tile = tileAt(world, prop.x, prop.y);
      assert.notEqual(tile, TILE.ROAD, `seed ${seed}: ${prop.sprite} на дороге (${prop.x},${prop.y})`);
    }
  }
});

test("россыпь: ничего не врастает в стену", () => {
  for (const seed of [0, 7, 31, 555]) {
    const world = createWorld();
    world.scatterVillage(seed);
    for (const prop of scatterOf(world)) {
      assert.equal(isSolid(world, prop.x, prop.y), false,
        `seed ${seed}: ${prop.sprite} в стене (${prop.x},${prop.y})`);
    }
  }
});

test("россыпь: мелочь не перекрывает путь от спавна к ключевым точкам", () => {
  for (const seed of [0, 3, 8, 21, 64]) {
    const world = createWorld();
    world.scatterVillage(seed);
    world.tier = 1;

    assert.equal(hasPath(world, SPAWN, world.merchant), true, `seed ${seed}: нет пути к Мардо`);
    assert.equal(hasPath(world, SPAWN, world.wagon), true, `seed ${seed}: нет пути к фургону`);
  }
});

test("россыпь: пропсы остаются внутри своих зон", () => {
  const world = createWorld();
  world.scatterVillage(9);

  // Площадь и рынок: мелочь не должна улететь в лес.
  const villageBounds = { x0: 44, y0: 100, x1: 130, y1: 150 };
  const eastBounds = { x0: 140, y0: 48, x1: 190, y1: 146 };

  for (const prop of scatterOf(world)) {
    const inVillage =
      prop.x >= villageBounds.x0 && prop.x <= villageBounds.x1 &&
      prop.y >= villageBounds.y0 && prop.y <= villageBounds.y1;
    const inEast =
      prop.x >= eastBounds.x0 && prop.x <= eastBounds.x1 &&
      prop.y >= eastBounds.y0 && prop.y <= eastBounds.y1;
    assert.ok(inVillage || inEast, `пропс ${prop.sprite} улетел далеко: ${prop.x},${prop.y}`);
  }
});

test("россыпь: пропсы не стоят друг на друге", () => {
  const world = createWorld();
  world.scatterVillage(13);
  const list = scatterOf(world);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const d = Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y);
      assert.ok(d > 0.5, `${list[i].sprite} и ${list[j].sprite} слиплись: ${d.toFixed(2)}`);
    }
  }
});

test("россыпь: мелочь не закрывает обзор", () => {
  const world = createWorld();
  world.scatterVillage(17);
  for (const prop of scatterOf(world)) {
    assert.equal(prop.blocksSight, false, `${prop.sprite} перекрывает обзор`);
  }
});

test("россыпь: фургон на месте после перестановки мелочи", () => {
  const world = createWorld();
  world.scatterVillage(23);
  const wagons = world.props.filter((p) => p.sprite === "wagon");
  assert.equal(wagons.length, 1, `фургонов ${wagons.length}`);
  // Мелочь не должна стоять там же, где фургон.
  const wagon = wagons[0];
  for (const prop of scatterOf(world)) {
    const d = Math.hypot(prop.x - wagon.x, prop.y - wagon.y);
    assert.ok(d > 1.0, `${prop.sprite} стоит в фургоне (${d.toFixed(2)})`);
  }
});
