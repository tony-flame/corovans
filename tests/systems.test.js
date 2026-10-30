import test from "node:test";
import assert from "node:assert/strict";

import { hashSeed, mulberry32, createRng, pick, weightedPick, randomInt } from "../src/rng.js";
import {
  createStyle,
  recordEvent,
  dominantArchetype,
  tuningFor,
  styleShares,
  TUNING_CAPS,
  STYLE,
} from "../src/style.js";
import {
  generateContracts,
  checkContract,
  rewardOf,
  contractSeed,
  CONTRACT_TYPES,
} from "../src/contracts.js";
import {
  createProfile,
  applyRun,
  migrateProfile,
  startingBonuses,
  canUnlock,
  unlock,
  hasUnlock,
} from "../src/profile.js";
import {
  createRun,
  snapshotRun,
  restoreRun,
  canCheckpoint,
  softDeathPenalty,
  playerPositionValid,
  runSummary,
} from "../src/run.js";
import { createWorld, spawnCamp, CAMP_LAYOUTS } from "../src/world.js";
import { phaseOf, pricesAt, lightOf, secondsUntilPhase, advance, PHASE, CYCLE_LENGTH } from "../src/daynight.js";

test("rng: одинаковый сид даёт одинаковую последовательность", () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);

  const c = mulberry32(999);
  assert.notDeepEqual(seqA, [c(), c(), c()]);
});

test("rng: состояние можно сохранить и восстановить", () => {
  const rng = createRng(42);
  rng();
  rng();
  const state = rng.state();
  const expected = [rng(), rng()];
  rng.restore(state);
  assert.deepEqual([rng(), rng()], expected);
});

test("rng: pick и randomInt не выходят за границы", () => {
  const rng = createRng(7);
  const list = ["a", "b", "c"];
  for (let i = 0; i < 50; i++) {
    assert.ok(list.includes(pick(list, rng)));
    const n = randomInt(1, 3, rng);
    assert.ok(n >= 1 && n <= 3);
  }
  assert.equal(pick([], rng), null);
  assert.equal(weightedPick([{ value: "only", weight: 1 }], rng), "only");
  assert.notEqual(hashSeed("a"), hashSeed("b"));
});

test("style: события двигают шкалы, доминанта определяется", () => {
  const style = createStyle();
  assert.equal(dominantArchetype(style), STYLE.NEUTRAL);

  for (let i = 0; i < 5; i++) recordEvent(style, "kill");
  assert.equal(dominantArchetype(style), STYLE.BUTCHER);

  const ghost = createStyle();
  for (let i = 0; i < 4; i++) recordEvent(ghost, "silent_loot");
  assert.equal(dominantArchetype(ghost), STYLE.GHOST);

  const shares = styleShares(ghost);
  assert.ok(shares.ghost > shares.butcher);
});

test("style: тюнинг не выходит за кэпы", () => {
  const nasty = { ghost: 0, butcher: 999, dealer: 0, events: 40 };
  const tuning = tuningFor(nasty);
  assert.ok(tuning.hp <= TUNING_CAPS.hp[1]);
  assert.ok(tuning.damage <= TUNING_CAPS.damage[1]);
  assert.ok(tuning.killDrop >= TUNING_CAPS.killDrop[0]);
  assert.ok(tuning.silentBonus <= TUNING_CAPS.silentBonus[1]);
  assert.ok(Math.abs(tuning.guardCountDelta) <= TUNING_CAPS.guardCountDelta);
  assert.equal(tuning.archetype, "fortified_post");

  const sneaky = { ghost: 999, butcher: 0, dealer: 0, events: 40 };
  const ghostTuning = tuningFor(sneaky);
  assert.equal(ghostTuning.archetype, "night_camp");
  assert.ok(ghostTuning.viewRange >= 1, "призрак получает более чуткую стражу");
  assert.ok(ghostTuning.silentBonus >= 1);
  assert.ok(ghostTuning.guardCountDelta <= 0);
});

test("contracts: генерация стабильна по сиду", () => {
  const a = generateContracts(1000, 1, 0, 2, "neutral");
  const b = generateContracts(1000, 1, 0, 2, "neutral");
  assert.deepEqual(a.map((c) => c.type), b.map((c) => c.type));
  assert.equal(a.length, 3);
  assert.equal(contractSeed(1000, 1, 0), contractSeed(1000, 1, 0));

  const different = generateContracts(1000, 1, 1, 2, "neutral");
  assert.notDeepEqual(a.map((c) => c.id), different.map((c) => c.id));
});

test("contracts: 'без крови' проваливается от убийства", () => {
  const contract = { type: CONTRACT_TYPES.CLEAN, state: "active", deadline: null, reward: { gold: 90, rep: 2 }, id: "c1" };

  assert.equal(checkContract(contract, {}).status, "active");
  assert.equal(checkContract(contract, { lootsSinceAccept: 1, killsSinceAccept: 0 }).status, "complete");
  assert.equal(checkContract(contract, { lootsSinceAccept: 1, killsSinceAccept: 1 }).status, "failed");
});

test("contracts: 'не на глаза' ломается тревогой", () => {
  const contract = { type: CONTRACT_TYPES.UNSEEN, state: "active", deadline: null, reward: { gold: 140, rep: 4 }, id: "c2" };
  assert.equal(checkContract(contract, { lootsSinceAccept: 1, chaseSinceAccept: true }).status, "failed");
  assert.equal(checkContract(contract, { lootsSinceAccept: 1, chaseSinceAccept: false }).status, "complete");
});

test("contracts: 'до рассвета' истекает по времени", () => {
  const contract = { type: CONTRACT_TYPES.BEFORE_DAWN, state: "active", deadline: 90, reward: { gold: 120, rep: 3 }, id: "c3" };
  assert.equal(checkContract(contract, { dayTime: 50, acceptedAt: 10 }).status, "active");
  assert.equal(checkContract(contract, { dayTime: 200, acceptedAt: 10 }).status, "failed");
  assert.equal(checkContract(contract, { dayTime: 200, acceptedAt: 10, lootsSinceAccept: 1 }).status, "complete");
});

test("contracts: предметный заказ требует конкретный лут", () => {
  const contract = {
    type: CONTRACT_TYPES.SPECIFIC_ITEM,
    state: "active",
    deadline: null,
    requiredItemId: "silk",
    requiredItemName: "Тюк шёлка",
    reward: { gold: 110, rep: 3 },
    id: "c4",
  };
  assert.equal(
    checkContract(contract, { lootsSinceAccept: 1, items: [{ id: "silk-1-0" }] }).status,
    "complete"
  );
  assert.equal(
    checkContract(contract, { lootsSinceAccept: 1, items: [{ id: "wine-1-0" }] }).status,
    "failed"
  );
});

test("contracts: награда растёт со серией", () => {
  const contract = { reward: { gold: 100, rep: 2 } };
  assert.equal(rewardOf(contract, 0).gold, 100);
  assert.ok(rewardOf(contract, 3).gold > rewardOf(contract, 0).gold);
});

test("profile: миграция мусора даёт валидный профиль", () => {
  const base = migrateProfile(null);
  assert.equal(base.version, 2);
  assert.equal(base.reputation, 0);

  const repaired = migrateProfile({ reputation: 12, unlocks: { stash: 1, hacker: 9 }, stats: { kills: "много" } });
  assert.equal(repaired.unlocks.stash, 1);
  assert.equal(repaired.unlocks.hacker, undefined);
  assert.equal(repaired.stats.kills, 0);
});

test("profile: разблокировка списывает репутацию и не повторяется", () => {
  const profile = { ...createProfile(), reputation: 20 };
  assert.equal(canUnlock(profile, "stash"), true);

  const next = unlock(profile, "stash");
  assert.ok(next);
  assert.equal(hasUnlock(next, "stash"), true);
  assert.equal(next.reputation, 12);
  assert.equal(unlock(next, "stash"), null, "повторно не покупается");
  assert.equal(unlock({ ...profile, reputation: 0 }, "fence"), null);
});

test("profile: applyRun копит статистику и лучший забег", () => {
  const profile = createProfile();
  const next = applyRun(profile, {
    gold: 500,
    totalSold: 400,
    contracts: 2,
    contractsFailed: 1,
    kills: 3,
    silentLoots: 4,
    reputation: 5,
    died: false,
    completedContractIds: ["a"],
    style: "ghost",
  });
  assert.equal(next.reputation, 5);
  assert.equal(next.stats.runs, 1);
  assert.equal(next.bestRun.gold, 500);
  assert.deepEqual(next.completedContracts, ["a"]);
  assert.equal(next.lastArchetype, "ghost");
});

test("run: снапшот и восстановление сохраняют прогресс", () => {
  const profile = createProfile();
  const run = createRun(777, profile, { bonuses: { lockpick: 0, capacity: 24 } });
  run.gold = 240;
  run.totalSold = 190;
  run.tier = 3;
  run.upgrades.sword = 2;
  run.inventory.items.push({ id: "silk-2-0", name: "Тюк шёлка", value: 40, weight: 1.5 });

  const snapshot = snapshotRun(run, { x: 7.5, y: 24.5, angle: 1.2 });
  const restored = restoreRun(JSON.parse(JSON.stringify(snapshot)), profile, { lockpick: 0, capacity: 24 });

  assert.ok(restored);
  assert.equal(restored.repaired, false);
  assert.equal(restored.run.gold, 240);
  assert.equal(restored.run.tier, 3);
  assert.equal(restored.run.upgrades.sword, 2);
  assert.equal(restored.run.inventory.items.length, 1);
  assert.equal(restored.run.player.x, 7.5);
});

test("run: битый снапшот отвергается или чинится", () => {
  assert.equal(restoreRun(null, createProfile()), null);
  assert.equal(restoreRun({ version: 99, seed: 1 }, createProfile()), null);

  const profile = createProfile();
  const run = createRun(5, profile, {});
  const snapshot = snapshotRun(run, { x: 7.5, y: 24.5, angle: 0 });
  delete snapshot.player;

  const restored = restoreRun(snapshot, profile, { lockpick: 0, capacity: 24 });
  assert.ok(restored);
  assert.equal(restored.repaired, true);
});

test("run: чекпоинт блокируется только на время обыска", () => {
  const run = createRun(1, createProfile(), {});
  assert.equal(canCheckpoint(run, {}), true);
  assert.equal(canCheckpoint(run, { stealing: true }), false);

  // Розыск и погоня сохранение не блокируют: стража замечает игрока сразу
  // после кражи, иначе ран перестал бы сохраняться вообще.
  run.wanted = 2;
  assert.equal(canCheckpoint(run, {}), true);
  assert.equal(canCheckpoint(run, { chasing: true }), true);
});

test("run: мягкая смерть забирает 20% золота и всю добычу", () => {
  const run = createRun(1, createProfile(), {});
  run.gold = 100;
  run.inventory.items.push({ id: "a", name: "A", value: 30, weight: 1 });

  const penalty = softDeathPenalty(run);
  assert.equal(penalty.run.gold, 80);
  assert.equal(penalty.lostGold, 20);
  assert.equal(penalty.run.inventory.items.length, 0);
  assert.equal(penalty.lostItems, 1);
  assert.equal(penalty.lostValue, 30);
});

test("run: потеря при смерти округляется вверх, а не вниз", () => {
  const run = createRun(1, createProfile(), {});
  run.gold = 83;
  const penalty = softDeathPenalty(run);
  // ⌊83 * 0.2⌋ = 16 дало бы потерю 19.3% — обещание «20%» было бы ложью.
  assert.equal(penalty.lostGold, 17);
  assert.equal(penalty.run.gold, 66);
  assert.equal(penalty.run.gold, Math.floor(83 * 0.8));
});

test("run: позиция восстанавливается только на проходимой клетке", () => {
  const world = createWorld();
  const spawn = { x: 12.5, y: 92.5 };

  assert.equal(playerPositionValid(world, spawn), true, "спавн проходим");
  assert.equal(playerPositionValid(world, { x: 11, y: 72 }), false, "внутри дома стоять нельзя");
  assert.equal(playerPositionValid(world, { x: 0.5, y: 0.5 }), false, "за границей мира");
  assert.equal(playerPositionValid(world, null), false);
  assert.equal(playerPositionValid(world, { x: NaN, y: 5 }), false);
});

test("world: архетипы меняют раскладку лагеря", () => {
  const world = createWorld();
  spawnCamp(world, 2, tuningFor({ ghost: 0, butcher: 99, dealer: 0, events: 20 }));
  assert.equal(world.archetype, "fortified_post");
  assert.equal(world.layout.label, CAMP_LAYOUTS.fortified_post.label);

  spawnCamp(world, 2, tuningFor({ ghost: 99, butcher: 0, dealer: 0, events: 20 }));
  assert.equal(world.archetype, "night_camp");
  assert.ok(world.dormantGuards.length > 0, "в ночёвке есть спящий страж");

  spawnCamp(world, 2, tuningFor({ ghost: 0, butcher: 0, dealer: 99, events: 20 }));
  assert.ok(world.secondWagon, "у дельца второй фургон");
});

test("run: восстановление сохраняет стиль и предпочтения", () => {
  const profile = createProfile();
  const run = createRun(31, profile, {});
  run.style.ghost = 12;
  run.style.butcher = 1;
  run.style.events = 8;
  run.dayTime = 123.5;
  run.archetype = "night_camp";

  const snapshot = snapshotRun(run, { x: 7.5, y: 24.5, angle: 0 });
  const restored = restoreRun(JSON.parse(JSON.stringify(snapshot)), profile, {});

  assert.ok(restored);
  assert.equal(restored.run.style.ghost, 12);
  assert.equal(restored.run.dayTime, 123.5);
  assert.equal(restored.run.archetype, "night_camp");
});

test("run: seed не сбрасывается при восстановлении", () => {
  const profile = createProfile();
  const run = createRun(4242, profile, {});
  const snapshot = snapshotRun(run, { x: 7.5, y: 24.5, angle: 0 });
  const restored = restoreRun(snapshot, profile, {});
  assert.equal(restored.run.seed, 4242);
  assert.equal(restored.run.runId, run.runId);
});

test("daynight: фазы идут по кругу, ночь дешевле по свету и дороже по цене", () => {
  assert.equal(phaseOf(0), PHASE.DAWN);
  assert.equal(phaseOf(CYCLE_LENGTH * 0.3), PHASE.DAY);
  assert.equal(phaseOf(CYCLE_LENGTH * 0.6), PHASE.DUSK);
  assert.equal(phaseOf(CYCLE_LENGTH * 0.9), PHASE.NIGHT);

  assert.ok(lightOf(CYCLE_LENGTH * 0.9) < lightOf(CYCLE_LENGTH * 0.3));
  assert.ok(pricesAt(CYCLE_LENGTH * 0.9) > pricesAt(CYCLE_LENGTH * 0.3));
  assert.equal(advance(CYCLE_LENGTH - 1, 2), 1);

  const until = secondsUntilPhase(CYCLE_LENGTH * 0.9, PHASE.DAWN);
  assert.ok(until > 0 && until <= CYCLE_LENGTH);
});
