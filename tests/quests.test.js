import test from "node:test";
import assert from "node:assert/strict";

import {
  makeQuest,
  checkQuest,
  questProgressText,
  questReward,
  canTakeQuest,
  questsFor,
  QUEST_TYPES,
  QUEST_GIVERS,
} from "../src/quests.js";
import { CIVILIAN_ORDER } from "../src/civilian.js";
import { buildCivilianDialogue } from "../src/dialog.js";

function giver(kind, id = 1) {
  return { id, kind, label: kind };
}

test("задания: у каждого вида жителя только объявленные типы", () => {
  for (const [kind, types] of Object.entries(QUEST_GIVERS)) {
    assert.ok(CIVILIAN_ORDER.includes(kind), `${kind}: жителя с таким видом нет`);
    assert.ok(types.length > 0, `${kind}: пустой список заданий`);
    for (const type of types) {
      assert.ok(Object.values(QUEST_TYPES).includes(type), `${kind}: неизвестный тип ${type}`);
    }
  }
});

test("задания: детерминированы по сиду и жителю", () => {
  const a = makeQuest(777, giver("peasant_m", 5), 0);
  const b = makeQuest(777, giver("peasant_m", 5), 0);
  assert.deepEqual(a, b);

  const other = makeQuest(778, giver("peasant_m", 5), 0);
  assert.ok(other, "другой сид тоже должен давать задание");
});

test("задания: житель без пула не даёт ничего", () => {
  assert.equal(makeQuest(1, giver("no_such_kind"), 0), null);
  assert.deepEqual(questsFor(1, giver("no_such_kind")), []);
});

test("задания: каждое имеет описание и награду", () => {
  for (const kind of Object.keys(QUEST_GIVERS)) {
    for (let seed = 0; seed < 40; seed++) {
      const quest = makeQuest(seed, giver(kind, seed + 1), 0);
      assert.ok(quest, `${kind}/${seed}: задания нет`);
      assert.ok(quest.description.length > 0, `${kind}/${seed}: пустое описание`);
      assert.ok(quest.reward.gold > 0, `${kind}/${seed}: нулевая награда`);
      assert.ok(quest.reward.rep > 0, `${kind}/${seed}: нулевая репутация`);
    }
  }
});

test("задание на охоту: считается по своему виду, а не по всем зверям", () => {
  const quest = {
    type: QUEST_TYPES.HUNT,
    targetId: "fox",
    goal: 2,
    state: "active",
  };

  // Убили двух коров — это не лисы.
  let result = checkQuest(quest, { beastsSince: { cow: 2 } });
  assert.equal(result.status, "active");
  assert.equal(result.progress.done, 0);

  result = checkQuest(quest, { beastsSince: { fox: 1 } });
  assert.equal(result.status, "active");
  assert.equal(result.progress.done, 1);

  result = checkQuest(quest, { beastsSince: { fox: 2, cow: 5 } });
  assert.equal(result.status, "complete");
});

test("задание на охоту: счётчик не превышает цель", () => {
  const quest = { type: QUEST_TYPES.HUNT, targetId: "goat", goal: 2, state: "active" };
  const result = checkQuest(quest, { beastsSince: { goat: 9 } });
  assert.equal(result.progress.done, 2);
});

test("задание на доставку: предмет ищется по префиксу id", () => {
  const quest = { type: QUEST_TYPES.DELIVER, targetId: "meal", goal: 1, state: "active" };

  // Дропы получают суффикс: точное совпадение не сработало бы.
  const result = checkQuest(quest, { items: [{ id: "meal-3-1", name: "Мешок муки" }] });
  assert.equal(result.status, "complete");

  const empty = checkQuest(quest, { items: [{ id: "silk-1-0", name: "Тюк шёлка" }] });
  assert.equal(empty.status, "active");
  assert.match(empty.reason, /Нужно/);
});

test("задание на место: закрывается только посещением нужного", () => {
  const quest = { type: QUEST_TYPES.REACH, targetId: "cathedral", goal: 1, state: "active" };

  assert.equal(checkQuest(quest, { visited: { market: true } }).status, "active");
  assert.equal(checkQuest(quest, { visited: { cathedral: true } }).status, "complete");
});

test("задание на расспросы: разные люди, а не визиты", () => {
  const quest = { type: QUEST_TYPES.LISTEN, goal: 3, state: "active" };

  let result = checkQuest(quest, { askedPeople: [1, 2] });
  assert.equal(result.status, "active");
  assert.equal(result.progress.done, 2);

  // Тот же человек дважды — не продвигает.
  result = checkQuest(quest, { askedPeople: [1, 1, 1, 2] });
  assert.equal(result.progress.done, 2);

  result = checkQuest(quest, { askedPeople: [1, 2, 3] });
  assert.equal(result.status, "complete");
});

test("задание: завершённое не пересчитывается и не откатывается", () => {
  const quest = { type: QUEST_TYPES.HUNT, targetId: "fox", goal: 2, state: "complete" };
  const result = checkQuest(quest, { beastsSince: {} });
  assert.equal(result.status, "complete", "завершённое не должно снова стать активным");
});

test("задание: текст прогресса понятен", () => {
  const quest = { type: QUEST_TYPES.HUNT, targetId: "fox", goal: 3, state: "active" };
  assert.match(questProgressText(quest, { beastsSince: { fox: 1 } }), /1 \/ 3/);

  const reach = { type: QUEST_TYPES.REACH, targetId: "market", goal: 1, state: "active" };
  assert.match(questProgressText(reach, { visited: {} }), /Нужно дойти/);

  const done = { type: QUEST_TYPES.REACH, targetId: "market", goal: 1, state: "complete" };
  assert.match(questProgressText(done, {}), /Выполнено/);
});

test("задание: награда копируется, а не отдаётся по ссылке", () => {
  const quest = { reward: { gold: 50, rep: 2 } };
  const reward = questReward(quest);
  reward.gold = 0;
  assert.equal(quest.reward.gold, 50, "изменение копии не должно менять задание");
});

test("задание: новое не выдаётся поверх активного", () => {
  assert.equal(canTakeQuest(null), true);
  assert.equal(canTakeQuest({ state: "active" }), false);
  assert.equal(canTakeQuest({ state: "complete" }), true);
});

test("диалог: ветка задания есть в корне и ведёт в узел", () => {
  const state = buildCivilianDialogue("peasant_m", {
    seed: 42,
    visits: 0,
    gold: 0,
    wanted: 0,
    knownIntel: {},
    reputation: 0,
    quest: null,
    npcId: 5,
    npcKind: "peasant_m",
    npcLabel: "Крестьянин",
  });

  const option = state.tree.root.options.find((o) => o.id === "quest");
  assert.ok(option, "в корне нет предложения задания");
  assert.equal(option.next, "quest");
  assert.ok(state.tree.quest, "нет узла задания");
  assert.ok(state.tree.quest.text.length > 0);

  // «Уйти» остаётся последним: предложение вставляется перед ним.
  const last = state.tree.root.options[state.tree.root.options.length - 1];
  assert.equal(last.end, true);
});

test("диалог: обещанное задание совпадает с выданным", () => {
  // Раньше ветка строила задание от сида NPC, а выдача — от сида
  // забега. В диалоге висело «принести 3 лисиц», а выдавалось
  // «дойти до собора». Ловим это сравнением двух источников.
  const runSeed = 918273;
  const npcId = 5551;
  const ctx = {
    seed: 12345, // сид реплик — намеренно другой
    runSeed,
    visits: 0,
    gold: 0,
    wanted: 0,
    knownIntel: {},
    reputation: 0,
    quest: null,
    npcId,
    npcKind: "peasant_m",
    npcLabel: "Крестьянин",
  };

  const state = buildCivilianDialogue("peasant_m", ctx);
  const promised = state.tree.quest.text;

  const issued = makeQuest(runSeed, { id: npcId, kind: "peasant_m", label: "Крестьянин" }, 0);
  assert.ok(issued, "задание не выдалось");
  assert.ok(
    promised.includes(issued.description),
    `в диалоге «${promised}», а выдаётся «${issued.description}»`
  );
});
test("диалог: житель без заданий честно отказывает", () => {
  // Стражник ратуши умеет только «дойти», но проверим пустой пул
  // через неизвестный вид — ветка обязана быть, а не падать.
  const state = buildCivilianDialogue("no_such_kind", {
    seed: 1,
    visits: 0,
    gold: 0,
    wanted: 0,
    knownIntel: {},
    reputation: 0,
    quest: null,
    npcId: 1,
    npcKind: "no_such_kind",
    npcLabel: "Неизвестный",
  });
  assert.ok(state.tree.quest);
  assert.ok(state.tree.quest.text.length > 0);
  // Переход в «принято» не должен быть доступен, раз задания нет.
  assert.equal(state.tree.quest.options.some((o) => o.effect && o.effect.takeQuest), false);
});

test("диалог: активное задание этого жителя видно в ветке", () => {
  const quest = {
    id: "q-1",
    giverId: 9,
    type: QUEST_TYPES.HUNT,
    targetId: "fox",
    targetLabel: "лисиц",
    goal: 2,
    state: "active",
    description: "Принести 2 лисиц",
  };
  const state = buildCivilianDialogue("peasant_w", {
    seed: 3,
    visits: 0,
    gold: 0,
    wanted: 0,
    knownIntel: {},
    reputation: 0,
    quest: { active: quest, beasts: { fox: 1 }, visited: {}, askedPeople: [] },
    npcId: 9,
    npcKind: "peasant_w",
    npcLabel: "Крестьянка",
  });

  assert.match(state.tree.quest.text, /не закончил/i);
  assert.equal(state.tree.quest.options.some((o) => o.id === "claim"), false, "сдавать рано");
});

test("диалог: выполненное задание можно сдать", () => {
  const quest = {
    id: "q-2",
    giverId: 9,
    type: QUEST_TYPES.HUNT,
    targetId: "fox",
    goal: 2,
    state: "complete",
    description: "Принести 2 лисиц",
  };
  const state = buildCivilianDialogue("peasant_w", {
    seed: 3,
    visits: 0,
    gold: 0,
    wanted: 0,
    knownIntel: {},
    reputation: 0,
    quest: { active: quest, beasts: { fox: 2 }, visited: {}, askedPeople: [] },
    npcId: 9,
    npcKind: "peasant_w",
    npcLabel: "Крестьянка",
  });

  const claim = state.tree.quest.options.find((o) => o.id === "claim");
  assert.ok(claim, "нет кнопки сдачи");
  assert.deepEqual(claim.effect, { claimQuest: true });
});
