import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCivilianDialogue,
  buildCourtesanDialogue,
  dialogueView,
  chooseOption,
  currentNode,
  optionAvailable,
  COURTESAN_FACT_ORDER,
  factCount,
  factPrice,
} from "../src/dialog.js";
import { CIVILIAN_ORDER } from "../src/civilian.js";
import { createCourtesan, AFFINITY_FREE } from "../src/npc.js";

function ctx(extra = {}) {
  return { seed: 1234, visits: 0, gold: 50, wanted: 0, knownIntel: {}, reputation: 0, ...extra };
}

// Каждое дерево обязано быть связным: иначе игрок нажмёт кнопку
// и получит пустую панель вместо ответа.
function assertTreeIntact(state, label) {
  const { tree } = state;
  assert.ok(tree.root, `${label}: нет корневого узла`);

  for (const [id, node] of Object.entries(tree)) {
    assert.ok(typeof node.text === "string" && node.text.length > 0, `${label}.${id}: пустой текст`);
    assert.ok(Array.isArray(node.options) && node.options.length > 0, `${label}.${id}: нет вариантов`);
    for (const option of node.options) {
      assert.ok(option.id, `${label}.${id}: вариант без id`);
      assert.ok(option.label, `${label}.${id}.${option.id}: вариант без подписи`);
      if (option.end) continue;
      assert.ok(option.next, `${label}.${id}.${option.id}: переход без цели`);
      assert.ok(tree[option.next], `${label}.${id}.${option.id}: нет узла «${option.next}»`);
    }
  }
}

test("диалоги: у каждого гражданского дерево связно", () => {
  for (const kind of CIVILIAN_ORDER) {
    const state = buildCivilianDialogue(kind, ctx());
    assertTreeIntact(state, kind);
  }
});

test("диалоги: неизвестный вид не даёт пустую панель", () => {
  const state = buildCivilianDialogue("no_such_kind", ctx());
  assertTreeIntact(state, "fallback");
  assert.ok(currentNode(state));
});

test("диалоги: детерминизм в пределах одного визита", () => {
  const a = buildCivilianDialogue("traveler", ctx());
  const b = buildCivilianDialogue("traveler", ctx());
  assert.equal(JSON.stringify(a.tree), JSON.stringify(b.tree));

  const c = buildCivilianDialogue("traveler", ctx({ visits: 7 }));
  assert.ok(currentNode(c), "другой визит тоже должен давать дерево");
});

test("диалоги: все варианты проходимы по ссылкам", () => {
  for (const kind of CIVILIAN_ORDER) {
    const state = buildCivilianDialogue(kind, ctx());
    for (const node of Object.values(state.tree)) {
      for (const option of node.options) {
        if (option.end || !option.next) continue;
        // Симулируем выбор из каждого узла, куда можно попасть.
        const probe = { ...state, nodeId: Object.keys(state.tree).find((k) => state.tree[k] === node) };
        const result = chooseOption(probe, option.id, 999);
        assert.equal(result.error, undefined, `${kind}: переход ${option.id} сломан`);
        assert.ok(currentNode(result.state), `${kind}: после ${option.id} нет узла`);
      }
    }
  }
});

test("диалоги: вариант с ценой недоступен без денег", () => {
  const state = buildCivilianDialogue("drunk", ctx({ gold: 0 }));
  const view = dialogueView(state, 0);
  const pay = view.options.find((o) => o.id === "pay");
  assert.ok(pay, "у пьяницы должен быть платный вопрос");
  assert.equal(pay.available, false);
  assert.match(pay.reason, /1 зм/);

  const rich = dialogueView(buildCivilianDialogue("drunk", ctx({ gold: 10 })), 10);
  assert.equal(rich.options.find((o) => o.id === "pay").available, true);
});

test("диалоги: платный вариант нельзя купить дважды", () => {
  let state = buildCivilianDialogue("drunk", ctx({ gold: 10 }));
  const first = chooseOption(state, "pay", 10);
  assert.equal(first.error, undefined);
  assert.equal(first.cost, 1);
  state = first.state;

  // Возврат в корень и повторный выбор — вариант уже потрачен.
  const back = chooseOption(state, "back", 9);
  state = back.state;
  assert.equal(state.nodeId, "root");

  const view = dialogueView(state, 9);
  const pay = view.options.find((o) => o.id === "pay");
  assert.equal(pay.available, false);
  assert.match(pay.reason, /уже/);

  const again = chooseOption(state, "pay", 9);
  assert.equal(again.error, "blocked");
});

test("диалоги: уход закрывает разговор и не тратит золото", () => {
  const state = buildCivilianDialogue("peasant_m", ctx());
  const result = chooseOption(state, "bye", 50);
  assert.equal(result.done, true);
  assert.equal(result.cost || 0, 0);
});

test("диалоги: нищий даёт репутацию только за монету", () => {
  const state = buildCivilianDialogue("beggar", ctx({ gold: 5 }));
  const give = chooseOption(state, "give", 5);
  assert.equal(give.cost, 1);
  assert.deepEqual(give.effect, { rep: 1 });

  const poor = buildCivilianDialogue("beggar", ctx({ gold: 0 }));
  assert.equal(dialogueView(poor, 0).options.find((o) => o.id === "give").available, false);
});

test("диалоги: благословение священника платное", () => {
  const state = buildCivilianDialogue("priest", ctx({ gold: 20 }));
  const bless = chooseOption(state, "bless", 20);
  assert.equal(bless.cost, 5);
  assert.deepEqual(bless.effect, { bless: true });
});

test("куртизанка: дерево связно и факты стоят денег", () => {
  const variant = createCourtesan(42, 1, 0, "square");
  const state = buildCourtesanDialogue(variant, ctx());
  assertTreeIntact(state, "courtesan");

  assert.equal(factCount(), COURTESAN_FACT_ORDER.length);
  for (const id of COURTESAN_FACT_ORDER) {
    assert.ok(factPrice(id) > 0, `${id}: факт должен стоить денег`);
    assert.ok(state.tree[`fact_${id}`], `${id}: нет узла факта`);
  }
});

test("куртизанка: бесплатная болтовня не трогает кошель", () => {
  const variant = createCourtesan(42, 1, 0, "inn");
  const state = buildCourtesanDialogue(variant, ctx({ gold: 0 }));
  const chat = chooseOption(state, "chat", 0);
  assert.equal(chat.error, undefined);
  assert.equal(chat.cost || 0, 0);
});

test("куртизанка: известный факт не продаётся повторно", () => {
  const variant = createCourtesan(42, 1, 0, "forest");
  const state = buildCourtesanDialogue(variant, ctx({ knownIntel: { guards: true } }));
  assert.equal(state.tree.fact_guards, undefined, "купленный факт не должен висеть в дереве");
  assert.ok(state.tree.fact_sleep);

  const view = dialogueView({ ...state, nodeId: "facts" }, 100);
  assert.equal(view.options.some((o) => o.id === "fact_guards"), false);
});

test("куртизанка: все факты уже куплены — честный отказ", () => {
  const variant = createCourtesan(42, 1, 0, "camp");
  const known = {};
  for (const id of COURTESAN_FACT_ORDER) known[id] = true;

  const state = buildCourtesanDialogue(variant, ctx({ knownIntel: known }));
  const view = dialogueView({ ...state, nodeId: "facts" }, 100);
  assert.match(view.text, /уже рассказала/);
  // Остались только «назад» и «уйти».
  assert.equal(view.options.length, 2);
});

test("куртизанка: без денег факт не выбрать, но виден", () => {
  const variant = createCourtesan(7, 2, 1, "square");
  const state = buildCourtesanDialogue(variant, ctx({ gold: 0 }));
  const view = dialogueView({ ...state, nodeId: "facts" }, 0);
  const fact = view.options.find((o) => o.id === "fact_guards");
  assert.ok(fact);
  assert.equal(fact.available, false);

  const result = chooseOption({ ...state, nodeId: "facts" }, "fact_guards", 0);
  assert.equal(result.error, "blocked");
});

test("куртизанка: покупка факта списывает ровно цену", () => {
  const variant = createCourtesan(9, 1, 0, "square");
  const state = { ...buildCourtesanDialogue(variant, ctx()), nodeId: "facts" };
  const id = COURTESAN_FACT_ORDER[0];
  const result = chooseOption(state, `fact_${id}`, 100);
  assert.equal(result.cost, factPrice(id));
  assert.deepEqual(result.effect, { intel: id });
});
