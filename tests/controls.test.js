import test from "node:test";
import assert from "node:assert/strict";

import {
  createJumpState,
  startJump,
  stepJump,
  canJump,
  clampPitch,
  addPitch,
  viewOffset,
  GRAVITY,
  JUMP_VELOCITY,
  PITCH_LIMIT,
  JUMP_STAMINA,
} from "../src/motion.js";
import {
  blockAbsorb,
  blockFacingDot,
  BLOCK_ABSORB,
  BLOCK_BROKEN_ABSORB,
  BLOCK_STAMINA_PER_DAMAGE,
  BLOCK_FRONT_DOT,
} from "../src/combat.js";

test("motion: прыжок поднимает и возвращает на землю", () => {
  let state = startJump(createJumpState());
  assert.equal(state.grounded, false);
  assert.ok(state.vz > 0);

  let peak = 0;
  let landed = false;
  for (let i = 0; i < 200 && !landed; i++) {
    const step = stepJump(state, 1 / 60);
    state = step.state;
    peak = Math.max(peak, state.z);
    landed = step.landed;
  }

  assert.ok(landed, "прыжок обязан приземлиться");
  assert.equal(state.z, 0);
  assert.equal(state.grounded, true);
  assert.ok(peak > 30 && peak < 80, `пик ${peak.toFixed(1)} px вне ожидаемого диапазона`);
});

test("motion: второй прыжок в воздухе невозможен", () => {
  const state = startJump(createJumpState());
  const again = startJump(state);
  assert.equal(again.vz, state.vz, "повторный startJump не меняет скорость");
  assert.equal(state.grounded, false);
});

test("motion: прыжок запрещён в приседании, без стамины и мёртвому", () => {
  const grounded = createJumpState();
  assert.equal(canJump(grounded, { crouching: false, stamina: 100, dead: false }), true);
  assert.equal(canJump(grounded, { crouching: true, stamina: 100, dead: false }), false);
  assert.equal(canJump(grounded, { crouching: false, stamina: 0, dead: false }), false);
  assert.equal(canJump(grounded, { crouching: false, stamina: 100, dead: true }), false);
  assert.equal(canJump(startJump(grounded), { crouching: false, stamina: 100, dead: false }), false);
  assert.equal(JUMP_STAMINA, 8);
});

test("motion: физика симметрична и не уходит в бесконечность", () => {
  let state = startJump(createJumpState());
  const dt = 1 / 120;
  for (let i = 0; i < 1000; i++) {
    state = stepJump(state, dt).state;
  }
  assert.equal(state.z, 0, "на земле высота не накапливается");
  assert.equal(state.grounded, true);
  assert.ok(GRAVITY > 0 && JUMP_VELOCITY > 0);
});

test("motion: pitch клампится по обе стороны", () => {
  assert.equal(clampPitch(0), 0);
  assert.equal(clampPitch(999), PITCH_LIMIT);
  assert.equal(clampPitch(-999), -PITCH_LIMIT);
  assert.equal(clampPitch(NaN), 0);

  let pitch = 0;
  for (let i = 0; i < 500; i++) pitch = addPitch(pitch, 10);
  assert.equal(pitch, PITCH_LIMIT);
  for (let i = 0; i < 1000; i++) pitch = addPitch(pitch, -10);
  assert.equal(pitch, -PITCH_LIMIT);
});

test("motion: смещение камеры учитывает прыжок и приседание", () => {
  assert.equal(viewOffset(createJumpState(), false), 0);
  assert.equal(viewOffset(createJumpState(), true), -8);
  assert.equal(viewOffset({ z: 40, vz: 0, grounded: false }, false), 40);
});

test("combat: блок спереди гасит 75% и тратит стамину", () => {
  const result = blockAbsorb(20, 100, 1);
  assert.equal(result.blocked, true);
  assert.equal(result.broke, false);
  assert.equal(result.damage, Math.round(20 * (1 - BLOCK_ABSORB)));
  assert.equal(result.stamina, 100 - 20 * BLOCK_STAMINA_PER_DAMAGE);
});

test("combat: пробитый блок пропускает больше урона и обнуляет стамину", () => {
  const result = blockAbsorb(50, 10, 1);
  assert.equal(result.blocked, true);
  assert.equal(result.broke, true);
  assert.equal(result.stamina, 0);
  assert.equal(result.damage, Math.round(50 * (1 - BLOCK_BROKEN_ABSORB)));
  assert.ok(result.damage > Math.round(50 * (1 - BLOCK_ABSORB)));
});

test("combat: удар в спину блок не ловит", () => {
  const behind = blockAbsorb(30, 100, -1);
  assert.equal(behind.blocked, false);
  assert.equal(behind.damage, 30);
  assert.equal(behind.stamina, 100);

  assert.equal(blockFacingDot(0, 0, 1, 0, 5, 0), 1);
  assert.equal(blockFacingDot(0, 0, 1, 0, -5, 0), -1);
  assert.ok(blockFacingDot(0, 0, 1, 0, 0, 5) < BLOCK_FRONT_DOT);
});

test("combat: блок никогда не даёт нулевой урон", () => {
  const result = blockAbsorb(1, 100, 1);
  assert.ok(result.damage >= 1);
  assert.ok(blockAbsorb(0, 100, 1).damage >= 1);
});
