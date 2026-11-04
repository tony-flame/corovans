import { Renderer } from "./raycaster.js";
import { Input } from "./input.js";
import { Player } from "./player.js";
import { createWorld, nearestInteraction, spawnCamp, tileAt, canStand, moveActor, TILE } from "./world.js";
import { updateActors, maxSuspicion } from "./enemies.js";
import { UI } from "./ui.js";
import { AudioSys } from "./audio.js";
import { stealTime } from "./combat.js";
import { createRng, makeRunSeed, hashSeed } from "./rng.js";
import { recordEvent, tuningFor, dominantArchetype, STYLE_LABELS } from "./style.js";
import { applyRun, unlock, startingBonuses } from "./profile.js";
import { readSave, writeSave, hasSave } from "./save.js";
import {
  createRun,
  snapshotRun,
  restoreRun,
  canCheckpoint,
  playerPositionValid,
  softDeathPenalty,
  runSummary,
  goalOf,
  actOf,
  ACTS,
  CHECKPOINT_REASONS,
} from "./run.js";
import { contractName } from "./contracts.js";
import { phaseOf, pricesAt } from "./daynight.js";
import { buildLightmap, AMBIENT } from "./lighting.js";
import { createWeather, stepWeather, weatherLabel, isWet, setWeather } from "./weather.js";
import { runCommand, CHEAT_HELP } from "./cheats.js";
import { buildAdvicePanel } from "./advice.js";
import { createErrorReporter, createFrameLoop } from "./loop.js";
import {
  createTitan,
  stepTitan,
  gatherPrey,
  titanQuestions,
  checkAnswer,
  TITAN_FAIL_LINE,
  TITAN_PASS_LINE,
  TITAN_SCALE,
} from "./titan.js";
import { buildTitan } from "./titan-sprite.js";
import {
  createHorseList,
  canMount,
  mountReasonText,
  horseSpeed,
  allowsAtMount,
  HORSE_CAMERA_LIFT,
} from "./horse.js";
import { buildCourtesan } from "./sprites.js";
import {
  SPECIES_DEFS,
  createAnimal,
  stepAnimal,
  bleedTick,
  applyBleed,
  bestFood,
  animalSpawnPlan,
} from "./wildlife.js";
import {
  createCourtesan,
  absorbWithOverheal,
  OVERHEAL_CAP,
} from "./npc.js";
import {
  createCivilians,
  stepCivilian,
  civilianLine,
  bumpVisits,
} from "./civilian.js";
import {
  buildCivilianDialogue,
  buildCourtesanDialogue,
} from "./dialog.js";
import {
  stepTracks,
  shouldDropTrack,
  trackAlpha,
  TRACK_LIMIT,
} from "./ambience.js";
import { rollsLeft } from "./haggle.js";
import { questProgressText, QUEST_TYPES } from "./quests.js";
import { createState } from "./core/state.js";
import * as trade from "./systems/trade.js";
import * as combat from "./systems/combat.js";
import * as dialogue from "./systems/dialogue.js";
import * as progress from "./systems/progress.js";
import * as courtesan from "./systems/courtesan.js";

// Метка сборки: видна в консоли и в window.__corovans.build.
// Не совпала с ожидаемой — браузер играет закешированные модули.
const BUILD = "2026-11-04-refactor-2";

// Единое изменяемое состояние игры. Модули читают его через геттеры,
// поэтому вынос логики из main.js не ломает ссылки на run/profile/rng.
const state = createState();

const canvas = document.getElementById("game");
const world = createWorld();
const player = new Player(world.spawn);
const renderer = new Renderer(canvas);
const audio = new AudioSys();

state.rng = createRng(1);
const game = state.game;

const bonuses = () => startingBonuses(state.profile);

function canControl() {
  return (
    game.started &&
    !game.paused &&
    !game.gameOver &&
    !game.victoryShown &&
    !state.ui.tradeOpen &&
    !state.ui.helpOpen &&
    !state.ui.lootOpen &&
    !state.ui.courtesanOpen &&
    !state.ui.dialogOpen &&
    !state.ui.adviceOpen &&
    !state.ui.titanOpen &&
    !state.ui.consoleOpen
  );
}

// ── Жизненный цикл рана ─────────────────────────────────────────────

function newRun() {
  const seed = makeRunSeed();
  state.run = createRun(seed, state.profile, { bonuses: bonuses() });
  state.rng = createRng(state.run.seed);
  state.rng.restore(state.run.rngState);

  player.reset(world.spawn);
  world.tier = 1;
  // Новый забег — новый разговор о цене.
  game.haggleRolled = 0;
  // Сид забега нужен миру: от него зависит, где встанет стоянка.
  world.seed = state.run.seed;
  // И где ляжет мелочь по площади: дома стоят, скарб вокруг них — нет.
  world.scatterVillage(state.run.seed);
  state.run.archetype = "road_camp";
  spawnCamp(world, 1, tuningFor(state.run.style));
  respawnWildlifeAndCourtesan();
  game.weather = createWeather(state.run.seed);

  state.run.offerIndex = 0;
  state.run.offerAct = 0;
  refreshContracts();
  syncRunToWorld();
  saveCheckpoint(CHECKPOINT_REASONS.START);
  state.ui.message("Мардо: «Караван стоит на северной стоянке. Иди на восток по дороге, потом на север.»");
}

function continueRun() {
  const loaded = restoreRun(state.saved.run, state.profile, bonuses());
  if (!loaded) {
    newRun();
    return false;
  }
  state.run = loaded.run;
  state.rng = createRng(state.run.seed);
  state.rng.restore(state.run.rngState);

  // Тот же сид — та же площадка: перезагрузка не должна переставлять лагерь.
  world.seed = state.run.seed;
  // И та же россыпь: иначе F5 двигал бы бочки по площади.
  world.scatterVillage(state.run.seed);
  spawnCamp(world, state.run.tier, tuningFor(state.run.style));
  respawnWildlifeAndCourtesan();
  // Погода выводится из сида рана: F5 с чекпоинта даёт тот же дождь,
  // иначе перезагрузка стала бы кнопкой «сделать сухо».
  game.weather = createWeather(state.run.seed);
  if (state.run.wagonLooted) world.wagonLooted = true;
  if (state.run.secondWagonLooted) world.secondWagon.looted = true;

  if (playerPositionValid(world, state.run.player)) {
    player.x = state.run.player.x;
    player.y = state.run.player.y;
    player.setAngle(state.run.player.angle || 0);
    // Запас бодрости восстанавливаем из сейва: иначе F5 его сбрасывает.
    player.overheal = Math.max(0, Math.min(OVERHEAL_CAP, state.run.player.overheal || 0));
  } else {
    player.reset(world.spawn);
  }

  syncRunToWorld();
  state.ui.message("Вы продолжаете с последнего чекпоинта.");
  return true;
}

function syncRunToWorld() {
  world.tier = state.run.tier;
  world.wagonLooted = state.run.wagonLooted;
  if (world.secondWagon) world.secondWagon.looted = Boolean(state.run.secondWagonLooted);
}

// Живность и куртизанка пересоздаются вместе с караваном:
// новый тир и акт дают новую внешность и новые тушки.
function respawnWildlifeAndCourtesan() {
  world.animals = spawnAnimals(state.run.tier, world.archetype);
  // Гражданские не пересоздаются с караваном: они часть мира, не лагеря.
  if (!world.civilians || world.civilians.length === 0) {
    world.civilians = createCivilians(state.run.seed);
  }
  // Лошади создаются один раз: конюшенная всегда, личная по разблокировке.
  if (!world.horses || world.horses.length === 0) {
    world.horses = createHorseList(bonuses());
  }
  updateCourtesanVariant();
  spawnTitan();
}

// Титан один на карту. Появляется у леса — далеко от деревни,
// чтобы первые минуты забега не были смертельными.
function spawnTitan() {
  if (!state.run) return;
  if (state.run.titanPacified) {
    world.titan = null;
    return;
  }

  if (!world.titan) {
    world.titan = createTitan(state.run.seed, 80.5, 74.5);
  }

  // Спрайты собираются при загрузке, не в кадре.
  renderer.sprites.titan_calm = buildTitan({ hunting: false });
  renderer.sprites.titan_hunt = buildTitan({ hunting: true });
  world.titan.spriteKey = world.titan.state === "hunt" || world.titan.state === "eat"
    ? "titan_hunt"
    : "titan_calm";
}

function spawnAnimals(tier, archetype) {
  const plan = animalSpawnPlan(tier, archetype);
  const animals = [];
  const spots = ANIMAL_SPOTS;
  let salt = 0;

  for (const group of plan) {
    for (let i = 0; i < group.count; i++) {
      const spot = spots[(salt + i) % spots.length];
      const animal = createAnimal(group.kind, spot.x, spot.y, tier, salt);
      if (animal) animals.push(animal);
      salt++;
    }
  }
  return animals;
}

// Точки в полях, у руин и на дороге. Намеренно далеко от маршрута к фургону.
const ANIMAL_SPOTS = [
  { x: 96, y: 118 }, { x: 104, y: 124 }, { x: 112, y: 116 }, { x: 122, y: 128 },
  { x: 100, y: 134 }, { x: 116, y: 136 }, { x: 126, y: 120 },
  { x: 102, y: 84 }, { x: 108, y: 87 }, { x: 114, y: 86 },
  { x: 128, y: 102 }, { x: 134, y: 110 },
];

// Каждая куртизанка получает свой вариант: сид включает ключ места.
// Спрайтов два на стиль: чистый и в крови. Переключаем ключ, а не пересобираем в кадре.
function updateCourtesanVariant() {
  const bloodied = (state.run.counters.kills > 0 && state.run.wanted > 0) || state.run.wanted >= 2;

  for (const courtesan of world.courtesans || []) {
    const spot = courtesan.spot || "square";
    const variant = createCourtesan(state.run.seed, state.run.tier, state.run.act, spot);
    courtesan.displayName = variant.displayName;
    courtesan.variant = variant;

    const cleanKey = `${variant.spriteKey}_clean`;
    const bloodKey = `${variant.spriteKey}_blood`;
    courtesan.spriteKey = bloodied ? bloodKey : cleanKey;

    // Удаляем РОВНО свои прошлые ключи. Прежнее условие никогда не
    // выполнялось: всё, что пишется в renderer.sprites, оканчивается на
    // _clean или _blood, поэтому под фильтр ничего не попадало. За шесть
    // караванов набиралось 48 canvas вместо 8.
    if (courtesan.spriteKeys) {
      for (const key of courtesan.spriteKeys) delete renderer.sprites[key];
    }

    renderer.sprites[cleanKey] = buildCourtesan(variant, { bloodied: false });
    renderer.sprites[bloodKey] = buildCourtesan(variant, { bloodied: true });
    courtesan.spriteKeys = [cleanKey, bloodKey];
  }
}

function saveCheckpoint(reason) {
  if (!state.run) return false;
  if (!canCheckpoint(state.run, { stealing: game.stealing })) return false;

  state.run.rngState = state.rng.state();
  state.run.player = { x: player.x, y: player.y, angle: player.angle, overheal: player.overheal || 0 };
  return writeSave(state.profile, snapshotRun(state.run, player));
}

// ── Стиль и телекоординация ─────────────────────────────────────────

function noteStyle(event) {
  recordEvent(state.run.style, event);
}

function styleKey() {
  return dominantArchetype(state.run.style);
}

// ── Контракты ───────────────────────────────────────────────────────

function refreshContracts() {
  progress.refreshContracts(progressCtx());
}

function acceptContract(index) {
  progress.acceptContract(progressCtx(), index);
}

function evaluateContract() {
  progress.evaluateContract(progressCtx());
}

// ── Акты ────────────────────────────────────────────────────────────

function checkActProgress() {
  if (!state.run || game.victoryShown) return;
  const goal = goalOf(state.run);
  if (state.run.gold < goal || state.run.totalSold <= 0) return;

  if (state.run.act < ACTS.length - 1) {
    state.run.act += 1;
    state.run.offerIndex += 1;
    refreshContracts();
    const act = actOf(state.run);
    state.ui.message(`${act.label}: «${act.title}». Новая цель — ${act.goal} зм.`);
    audio.victory();
    saveCheckpoint(CHECKPOINT_REASONS.ACT_UP);
    return;
  }

  game.victoryShown = true;
  game.paused = true;
  input.exitLock();
  state.ui.closeTrade();
  state.ui.closeLoot();
  state.ui.hideHelp();
  game.uiOpen = false;
  state.ui.setPrompt(null);
  state.ui.setProgress(null);
  audio.victory();
  state.profile = applyRun(state.profile, runSummary(state.run, { style: styleKey() }));
  writeSave(state.profile, null);
  state.ui.showEnd(
    "Демо пройдено",
    `Вы собрали ${state.run.gold} золотых на чужих караванах. Репутация: ${state.profile.reputation}. Дорога запомнила вас — ${STYLE_LABELS[styleKey()]}.`,
    true
  );
}

// ── Ввод ────────────────────────────────────────────────────────────

const input = new Input(canvas, {
  attack: () => {
    if (canControl()) performAttack();
  },
  keyDown: handleKeyDown,
  keyUp: handleKeyUp,
  lockChange: (locked) => {
    if (
      !locked &&
      game.started &&
      !game.gameOver &&
      !game.victoryShown &&
      !game.paused &&
      !game.uiOpen
    ) {
      pauseGame();
    }
  },
});

state.ui = new UI({
  start: startGame,
  load: loadGame,
  resume: resumeGame,
  restart: restartRun,
  continueGame: continueAfterVictory,
  sell: sellLoot,
  haggle: haggleSell,
  fine: payFine,
  buy: buyUpgrade,
  closeTrade,
  closeHelp,
  acceptContract,
  unlock: buyUnlock,
  takeLoot,
  finishLoot,
  courtesanPay: payCourtesan,
  courtesanAsk: askCourtesan,
  courtesanTalk: talkToCourtesan,
  courtesanLeave: leaveCourtesan,
  dialogOption: chooseDialogOption,
  closeAdvice: closeAdvicePanel,
  consoleCommand: runConsoleCommand,
  titanAnswer: answerTitan,
});
state.ui = state.ui;

canvas.addEventListener("click", () => {
  if (canControl() && !input.locked) input.requestLock();
});

function startGame() {
  audio.init();
  audio.ui();
  game.started = true;
  game.paused = false;
  document.body.classList.add("playing");
  state.ui.hideStart();
  newRun();
  input.requestLock();
}

function loadGame() {
  audio.init();
  audio.ui();
  state.saved = readSave();
  state.profile = state.saved.profile;
  game.started = true;
  game.paused = false;
  game.gameOver = false;
  game.victoryShown = false;
  document.body.classList.add("playing");
  state.ui.hideStart();
  state.ui.hideEnd();
  if (!continueRun()) {
    state.ui.message("Сохранение не читается — начат новый забег.");
  }
  input.requestLock();
}

function restartRun() {
  if (state.run) {
    state.profile = applyRun(state.profile, runSummary(state.run, { style: styleKey() }));
    writeSave(state.profile, null);
  }
  state.saved = { profile: state.profile, run: null };
  state.run = null;
  game.gameOver = false;
  game.victoryShown = false;
  game.paused = false;
  state.ui.hideEnd();
  newRun();
  input.requestLock();
}

function continueAfterVictory() {
  state.ui.hideEnd();
  game.victoryShown = false;
  game.paused = false;
  input.requestLock();
}

function pauseGame() {
  game.paused = true;
  input.clear();
  state.ui.setPrompt(null);
  state.ui.setProgress(null);
  state.ui.showPause();
}

function resumeGame() {
  if (game.gameOver) return;
  game.paused = false;
  state.ui.hidePause();
  input.requestLock();
}

function handleKeyDown(code) {
  // Консоль перехватывает всё, пока открыта.
  if (code === "Backquote") {
    if (state.ui.consoleOpen) closeConsole();
    else openConsole();
    return;
  }
  if (code === "ArrowUp" && state.ui.consoleOpen) {
    consoleHistory(-1);
    return;
  }
  if (code === "ArrowDown" && state.ui.consoleOpen) {
    consoleHistory(1);
    return;
  }
  if (state.ui.consoleOpen) return;

  if (code === "KeyI" && game.started && !game.gameOver && !state.ui.tradeOpen) {
    if (state.ui.helpOpen) closeHelp();
    else openHelp();
    return;
  }
  if (code === "Tab") {
    if (state.ui.adviceOpen) closeAdvicePanel();
    else openAdvicePanel();
    return;
  }
  if (code === "Escape") {
    if (state.ui.adviceOpen) closeAdvicePanel();
    else if (state.ui.dialogOpen) closeDialogPanel();
    else if (state.ui.titanOpen) leaveTitan();
    else if (state.ui.courtesanOpen) leaveCourtesan();
    else if (state.ui.tradeOpen) closeTrade();
    else if (state.ui.helpOpen) closeHelp();
    else if (state.ui.lootOpen) finishLoot();
    return;
  }
  if (code === "KeyR" && game.gameOver) {
    restartRun();
    return;
  }
  if (code === "Space" && canControl()) {
    // Space — прыжок. Удар остался на ЛКМ.
    if (player.requestJump()) {
      audio.step(false);
      game.noiseTimer = Math.max(game.noiseTimer, 0.25);
    }
    return;
  }
  if (code === "KeyE" && canControl()) {
    // Верхом E спешивает, а не взаимодействует.
    if (game.mounted) {
      dismountHorse();
      return;
    }
    const near = nearestInteraction(world, player);
    if (near && near.type === "merchant") openTrade();
    else if (near && near.type === "courtesan") visitCourtesan(near.spot);
    else if (near && near.type === "civilian") talkToCivilian(near.civilianId);
    else if (near && near.type === "titan") startTitanDialogue();
    else if (near && near.type === "horse") tryMountHorse(near.horseId);
    return;
  }
  if (code === "KeyH" && canControl()) {
    if (game.mounted) dismountHorse();
    return;
  }
  if (code === "KeyF" && canControl()) {
    eatBestFood();
    return;
  }
}

// Съесть самый сытный предмет. Мгновенно, без панелей.
function eatBestFood() {
  const food = bestFood(state.run.inventory.items);
  if (!food) {
    state.ui.message("Съестного нет.");
    return;
  }
  if (player.health >= player.maxHealth) {
    state.ui.message("Вы и так сыты.");
    return;
  }

  const index = state.run.inventory.items.findIndex((item) => item.id === food.id);
  if (index === -1) return;
  state.run.inventory.items.splice(index, 1);

  const heal = Math.min(food.heal || 0, player.maxHealth - player.health);
  player.health = Math.min(player.maxHealth, player.health + heal);
  audio.eat?.();
  state.ui.message(`Вы съели ${food.name.toLowerCase()} (+${heal} здоровья).`);
}

// Куртизанка: открываем панель диалога, а не списываем деньги молча.
// game.activeCourtesan помнит, к кому именно подошли: куртизанок теперь четыре.
function visitCourtesan(spot) {
  courtesan.visitCourtesan(courtesanCtx(), spot);
}

function payCourtesan() {
  courtesan.payCourtesan(courtesanCtx());
}

function askCourtesan() {
  courtesan.askCourtesan(courtesanCtx());
}

function leaveCourtesan() {
  courtesan.leaveCourtesan(courtesanCtx());
}

// Большой диалог куртизанки: болтовня бесплатна, факты — за деньги.
// Отдельная панель, потому что в панели визита кнопок уже четыре.
function talkToCourtesan() {
  courtesan.talkToCourtesan(courtesanCtx());
}

// ── Гражданские ──────────────────────────────────────────────────────

function talkToCivilian(civilianId) {
  const person = (world.civilians || []).find((c) => c.id === civilianId);
  if (!person) return;

  bumpVisits(person);
  const line = civilianLine(person, state.run.seed);

  // Задание на расспросы: считаем РАЗНЫХ жителей, а не визиты.
  if (state.run.quest && state.run.quest.active && state.run.quest.active.type === QUEST_TYPES.LISTEN) {
    if (!state.run.quest.askedPeople.includes(person.id)) {
      state.run.quest.askedPeople.push(person.id);
      refreshQuestState();
    }
  }

  // Нищий: монету теперь предлагает само дерево, но сама реплика
  // приветствия остаётся — она задаёт тон разговору.
  openCivilianDialog(person, line);
}

// ── Дерево диалога ───────────────────────────────────────────────────

function dialogContext() {
  return {
    seed: state.run.seed,
    // Отдельно от seed: seed у каждого NPC свой (для реплик),
    // а задание строится от сида забега — иначе обещание в диалоге
    // и выданное задание разъедутся.
    runSeed: state.run.seed,
    visits: state.run.visitIndex || 0,
    gold: state.run.gold,
    wanted: state.run.wanted || 0,
    knownIntel: state.run.intel || {},
    reputation: state.profile.reputation || 0,
    // Сторонний квест: что уже сделано по нему.
    quest: state.run.quest || null,
  };
}

function openCivilianDialog(person, greetLine) {
  // Имя НЕ `state`: см. комментарий в talkToCourtesan.
  const tree = buildCivilianDialogue(person.kind, {
    ...dialogContext(),
    // Визиты считаются по NPC, а не по общему счётчику куртизанки:
    // иначе деревня хором меняла бы реплики после каждого визита к ней.
    visits: person.visits || 0,
    // И свой сид на каждого: двое крестьян одного вида не должны
    // говорить одну и ту же фразу.
    seed: hashSeed(`${state.run.seed}:${person.id}`),
    npcId: person.id,
    npcKind: person.kind,
    npcLabel: person.label,
  });
  game.dialog = {
    kind: "civilian",
    personId: person.id,
    label: person.label,
    // Житель нужен эффекту задания: по нему строится квест.
    giver: { id: person.id, kind: person.kind, label: person.label },
    greetLine,
    state: tree,
  };
  game.uiOpen = true;
  input.clear();
  input.exitLock();
  state.ui.setPrompt(null);
  state.ui.setProgress(null);
  showDialog();
  audio.ui();
}

function showDialog() {
  dialogue.showDialog(dialogCtx());
}

function chooseDialogOption(optionId) {
  dialogue.chooseDialogOption(dialogCtx(), optionId);
}

function closeDialogPanel() {
  dialogue.closeDialogPanel(dialogCtx());
}

// ── Консоль разработчика ─────────────────────────────────────────────

function openConsole() {
  game.uiOpen = true;
  input.clear();
  input.exitLock();
  state.ui.openConsole();
  state.ui.consoleClear();
  state.ui.consolePrint("Консоль разработчика. help — список команд.", "cmd");
}

function closeConsole() {
  state.ui.closeConsole();
  game.uiOpen = false;
  input.requestLock();
}

function consoleHistory(direction) {
  const history = game.consoleHistory;
  if (!history.length) return;
  const inputEl = state.ui.consoleInput();
  let index = game.consoleHistoryIndex;
  index += direction;
  if (index < 0) index = 0;
  if (index >= history.length) {
    index = history.length - 1;
    game.consoleHistoryIndex = index;
    inputEl.value = "";
    return;
  }
  game.consoleHistoryIndex = index;
  inputEl.value = history[index];
}

function runConsoleCommand(raw) {
  const text = String(raw || "").trim();
  if (!text) return;

  game.consoleHistory.push(text);
  game.consoleHistoryIndex = game.consoleHistory.length;
  state.ui.consolePrint(`> ${text}`, "cmd");

  const result = runCommand(text, cheatContext());
  if (result.message) state.ui.consolePrint(result.message, result.ok ? "ok" : "err");
  if (!result.ok && result.message === "") state.ui.consolePrint("Пустая команда.", "err");
}

function cheatContext() {
  return {
    game,
    run: state.run,
    player,
    world,
    profile: state.profile,
    setTier(value) {
      state.run.tier = value;
      spawnCamp(world, state.run.tier, tuningFor(state.run.style));
      state.run.archetype = world.archetype;
      respawnWildlifeAndCourtesan();
    },
    setAct(value) {
      state.run.act = value;
      refreshContracts();
    },
    setWeather(kind) {
      if (!game.weather) game.weather = createWeather(state.run.seed);
      setWeather(game.weather, kind);
    },
  };
}

// ── Панель целей и советов ───────────────────────────────────────────

function openAdvicePanel() {
  game.uiOpen = true;
  input.clear();
  input.exitLock();
  state.ui.openAdvice(
    buildAdvicePanel({
      run: state.run,
      world,
      player,
      game,
      profile: state.profile,
    })
  );
  audio.ui();
}

function closeAdvicePanel() {
  state.ui.closeAdvice();
  game.uiOpen = false;
  input.requestLock();
}

// Смерть от титана: полный рестарт забега. Репутация и разблокировки целы.
function titanDeath() {
  if (game.gameOver) return;

  player.dead = true;
  game.gameOver = true;
  input.exitLock();
  state.ui.closeTrade();
  state.ui.closeLoot();
  state.ui.closeCourtesan();
  state.ui.closeTitan();
  state.ui.hideHelp();
  game.uiOpen = false;
  game.stealing = false;
  game.stealProgress = 0;
  state.ui.setPrompt(null);
  state.ui.setProgress(null);
  audio.death();

  state.profile = {
    ...state.profile,
    stats: { ...state.profile.stats, deaths: (state.profile.stats.deaths || 0) + 1 },
  };
  writeSave(state.profile, null);

  state.ui.showEnd(
    "Титан не оставил ничего",
    "Ни имени, ни вещей, ни следа. Дорога начинается заново — но то, что ты знал, осталось с тобой. Репутация и разблокировки целы.",
    false
  );
}

// ── Диалог с титаном ─────────────────────────────────────────────────

function startTitanDialogue() {
  if (!world.titan || state.run.titanPacified) return;

  // Титан замирает на время разговора. Раньше он продолжал жевать:
  // таймер поедания шёл независимо от того, открыта ли панель,
  // и игрока съедали между нажатием E и первым вопросом.
  world.titan.state = "talk";
  world.titan.target = null;
  world.titan.eatTimer = 0;
  world.titan.spriteKey = "titan_calm";

  game.titanDialogue = {
    questions: titanQuestions(state.run.seed),
    index: 0,
    correct: 0,
  };

  game.uiOpen = true;
  input.clear();
  input.exitLock();
  state.ui.setPrompt(null);
  state.ui.setProgress(null);
  showTitanQuestion();
}

// Вернуть титана к обычной жизни после разговора.
function releaseTitan() {
  const titan = world.titan;
  if (!titan) return;
  titan.state = "roam";
  titan.target = null;
  titan.eatTimer = 0;
  titan.roamTimer = 0;
  titan.spriteKey = "titan_calm";
}

// Уйти из разговора, ничего не ответив. Раньше панель титана вообще
// нельзя было закрыть: Escape её не знал, а canControl() блокировал игру.
// Игрок либо отвечал, либо висел в панели навсегда.
function leaveTitan() {
  if (!game.titanDialogue) return;
  game.titanDialogue = null;
  game.uiOpen = false;
  state.ui.closeTitan();
  releaseTitan();
  state.ui.message("Титан провожает тебя взглядом, но не двигается.");
  input.requestLock();
}

function showTitanQuestion() {
  const d = game.titanDialogue;
  if (!d) return;

  const q = d.questions[d.index];
  if (!q) return;

  state.ui.openTitan({
    question: q.text,
    answers: q.answers,
    hint: q.hint,
    progress: `Вопрос ${d.index + 1} из ${d.questions.length}`,
  });
}

function answerTitan(index) {
  const d = game.titanDialogue;
  if (!d) return;

  const q = d.questions[d.index];
  const correct = checkAnswer(q, index);

  if (!correct) {
    // Ошибся — он ест. Без вариантов.
    state.ui.closeTitan();
    game.titanDialogue = null;
    game.uiOpen = false;
    state.ui.message(TITAN_FAIL_LINE);
    titanDeath();
    return;
  }

  d.correct += 1;
  d.index += 1;

  if (d.index >= d.questions.length) {
    // Прошёл все три.
    state.run.titanPacified = true;
    world.titan = null;
    game.titanDialogue = null;
    game.uiOpen = false;
    state.ui.closeTitan();
    state.ui.message(TITAN_PASS_LINE);
    audio.victory();
    saveCheckpoint(CHECKPOINT_REASONS.SOLD);
    input.requestLock();
    return;
  }

  // Ещё не всё спросил: он по-прежнему в разговоре, а не в охоте.
  if (world.titan) world.titan.state = "talk";
  audio.ui();
  showTitanQuestion();
}

// ── Лошадь ───────────────────────────────────────────────────────────

function tryMountHorse(horseId) {
  const horse = (world.horses || []).find((h) => h.id === horseId);
  if (!horse) return;

  const dist = Math.hypot(horse.x - player.x, horse.y - player.y);
  const tile = tileAt(world, player.x, player.y);
  const check = canMount({ mounted: game.mounted, blocking: player.blocking }, horse, tile, dist);

  if (!check.ok) {
    state.ui.message(mountReasonText(check.reason));
    return;
  }

  game.mounted = horse.id;
  game.horseRef = horse;
  player.crouching = false;
  player.blocking = false;
  audio.ui();
  state.ui.message(`${horse.label}: вы в седле. H — спешиться.`);
  saveCheckpoint(CHECKPOINT_REASONS.SOLD);
}

function dismountHorse() {
  if (!game.mounted) return;
  const horse = game.horseRef;

  if (horse) {
    // Лошадь остаётся рядом, но не внутри игрока.
    const angle = player.angle + Math.PI / 2;
    const nx = player.x + Math.cos(angle) * 1.2;
    const ny = player.y + Math.sin(angle) * 1.2;
    if (canStand(world, nx, ny, 0.55)) {
      horse.x = nx;
      horse.y = ny;
    }
  }

  game.mounted = null;
  game.horseRef = null;
  audio.ui();
  state.ui.message("Вы спешились.");
  saveCheckpoint(CHECKPOINT_REASONS.SOLD);
}

function handleKeyUp(code) {
  if (code === "KeyE") {
    game.stealing = false;
    game.stealProgress = 0;
  }
}

function openHelp() {
  game.uiOpen = true;
  input.clear();
  input.exitLock();
  state.ui.showHelp();
  state.ui.setPrompt(null);
  state.ui.setProgress(null);
}

function closeHelp() {
  state.ui.hideHelp();
  game.uiOpen = false;
  input.requestLock();
}

function openTrade() {
  game.uiOpen = true;
  input.clear();
  input.exitLock();
  state.ui.setPrompt(null);
  state.ui.setProgress(null);
  state.ui.openTrade(tradeState());
  audio.ui();
}

function closeTrade() {
  state.ui.closeTrade();
  game.uiOpen = false;
  input.requestLock();
}

function tradeState() {
  return {
    gold: state.run.gold,
    upgrades: state.run.upgrades,
    inventory: state.run.inventory,
    wanted: state.run.wanted,
    profile: state.profile,
    contractOffer: state.run.contractOffer,
    activeContract: state.run.activeContract,
    priceModifier: priceModifier(),
    haggleLeft: rollsLeft(game.haggleRolled || 0),
  };
}

function priceModifier() {
  return (1 + bonuses().priceBonus) * pricesAt(state.run.dayTime) * tuningFor(state.run.style).priceBonus;
}

// Контекст для systems/courtesan.js.
function courtesanCtx() {
  return {
    state,
    game,
    world,
    player,
    input,
    audio,
    dialogContext,
    showDialog,
    buildCourtesanTree: buildCourtesanDialogue,
    saveCheckpoint,
  };
}

// Контекст для systems/progress.js.
function progressCtx() {
  return {
    state,
    game,
    player,
    audio,
    styleKey,
    checkActProgress,
    noteStyle,
    saveCheckpoint,
    tradeState,
  };
}

// Контекст для systems/dialogue.js.
function dialogCtx() {
  return {
    state,
    game,
    player,
    input,
    audio,
    saveCheckpoint,
  };
}

// Контекст для systems/combat.js.
function combatCtx() {
  return {
    state,
    game,
    world,
    player,
    audio,
    noteStyle,
    evaluateContract,
    checkActProgress,
    die,
    refreshQuestState,
  };
}

// Контекст для systems/trade.js: модуль не знает про main.js и не держит
// состояния, всё необходимое приходит сюда.
function tradeCtx() {
  return {
    state,
    game,
    world,
    player,
    input,
    audio,
    tradeState,
    priceModifier,
    noteStyle,
    saveCheckpoint,
    checkActProgress,
    evaluateContract,
    writeSave,
  };
}

// Проверяет активное задание и, если оно выполнилось, помечает.
// Награду не выдаёт: за ней надо вернуться к жителю, иначе задание
// закрывалось бы само где-нибудь в лесу без всякого разговора.
function refreshQuestState() {
  progress.refreshQuestState(progressCtx());
}

// Какие места считаются «посещёнными» для задания. Зоны берём из мира:
// дублировать координаты — значит разъехаться при следующей перестройке.
const VISIT_PLACES = {
  cathedral: "CATHEDRAL",
  rathouse: "RATHOUSE",
  market: "MARKET",
};

function noteVisitedPlaces() {
  progress.noteVisitedPlaces(progressCtx());
}

function trackFootsteps(dt) {
  // Следы живут в game, а не в мире и не в ране: это украшение кадра,
  // и оно не должно переживать перезагрузку.
  game.tracks = stepTracks(game.tracks || [], dt);
  game.trackTimer = (game.trackTimer || 0) - dt;

  if (game.trackTimer > 0) return;
  game.trackTimer = 0.12;

  const moving = input.isDown("KeyW") || input.isDown("KeyS") ||
    input.isDown("KeyA") || input.isDown("KeyD");
  if (!moving) return;

  // Только на мягкой земле: на камне и в воде следов не остаётся.
  const tile = tileAt(world, player.x, player.y);
  if (tile !== TILE.DIRT && tile !== TILE.ROAD) return;
  if (!shouldDropTrack(game.lastTrackX, game.lastTrackY, player.x, player.y, 0.7)) return;

  game.lastTrackX = player.x;
  game.lastTrackY = player.y;
  game.tracks.push({ x: player.x, y: player.y, age: 0 });
  if (game.tracks.length > TRACK_LIMIT) game.tracks.shift();
}

// ── Экономика ───────────────────────────────────────────────────────

function sellLoot() {
  trade.sellLoot(tradeCtx());
}

// Торг: бросок кубика против Мардо. Выиграл — наценка, проиграл —
// скидка. Продажа совершается сразу: иначе игрок мог бы бросить,
// увидеть проигрыш и закрыть панель без последствий.
function haggleSell() {
  trade.haggleSell(tradeCtx());
}

function buyUpgrade(id) {
  trade.buyUpgrade(tradeCtx(), id);
}

function buyUnlock(id) {
  trade.buyUnlock(tradeCtx(), id);
}

function payFine() {
  trade.payFine(tradeCtx());
}

// ── Обыск фургона ───────────────────────────────────────────────────

function startLoot(second = false) {
  trade.startLoot(tradeCtx(), second);
}

function takeLoot(index) {
  trade.takeLoot(tradeCtx(), index);
}

function finishLoot() {
  trade.finishLoot(tradeCtx());
}

// ── Бой ─────────────────────────────────────────────────────────────

function performAttack() {
  combat.performAttack(combatCtx());
}

// Убийство животного: добыча в инвентарь, розыск НЕ начисляется.

function damagePlayer(amount, source) {
  combat.damagePlayer(combatCtx(), amount, source);
}

// Мягкая смерть: откат на чекпоинт, минус 20% золота и вся переносимая добыча.
// Репутация, разблокировки и статистика не страдают.
function die() {
  player.dead = true;
  input.exitLock();
  state.ui.closeTrade();
  state.ui.closeLoot();
  state.ui.hideHelp();
  game.uiOpen = false;
  game.stealing = false;
  game.stealProgress = 0;
  state.ui.setPrompt(null);
  state.ui.setProgress(null);
  audio.death();

  state.profile = {
    ...state.profile,
    stats: { ...state.profile.stats, deaths: (state.profile.stats.deaths || 0) + 1 },
  };

  // Берём последний чекпоинт и применяем штраф уже к нему,
  // иначе перезагрузка вернула бы потерянное золото.
  const checkpoint = readSave();
  const loaded = restoreRun(checkpoint.run, state.profile, bonuses());

  if (!loaded) {
    newRun();
    player.dead = false;
    player.health = player.maxHealth;
    game.paused = true;
    state.ui.showEnd("Вы очнулись у Мардо", "Забег был слишком коротким — начинаем заново. Репутация цела.", true);
    return;
  }

  const base = loaded.run;
  const failedContract = base.activeContract;
  if (failedContract) {
    base.activeContract = null;
    base.counters.contractsFailed += 1;
    base.contractStreak = 0;
  }
  base.offerIndex += 1;

  const penalty = softDeathPenalty(base);
  state.run = penalty.run;
  refreshContracts();

  state.rng = createRng(state.run.seed);
  state.rng.restore(state.run.rngState);
  spawnCamp(world, state.run.tier, tuningFor(state.run.style));
  syncRunToWorld();

  if (playerPositionValid(world, state.run.player)) {
    player.x = state.run.player.x;
    player.y = state.run.player.y;
    player.setAngle(state.run.player.angle || 0);
    player.overheal = Math.max(0, Math.min(OVERHEAL_CAP, state.run.player.overheal || 0));
  } else {
    player.reset(world.spawn);
  }

  player.dead = false;
  player.health = player.maxHealth;
  player.stamina = player.maxStamina;
  game.gameOver = false;
  game.victoryShown = false;
  game.paused = true;

  // Чекпоинт уже со штрафом — сейв-скам не вернёт золото.
  state.run.wanted = 0;
  saveCheckpoint(CHECKPOINT_REASONS.DEATH);

  const contractNote = failedContract ? ` Заказ «${contractName(failedContract.type)}» провален.` : "";
  state.ui.showEnd(
    "Вы очнулись у Мардо",
    `Вас вытащили из канавы. Потеряно ${penalty.lostGold} зм. и ${penalty.lostItems} тюков (${penalty.lostValue} зм. стоимости).${contractNote} Репутация и разблокировки целы.`,
    true
  );
}

// ── Цикл ────────────────────────────────────────────────────────────

game.damagePlayer = damagePlayer;

// Укус лисы: урон + кровотечение, которое тикает само.
function applyBite(bite) {
  if (!bite || player.dead) return;
  if (game.godMode) return;

  const dmg = Math.max(1, Math.round(bite.damage));
  const absorbed = absorbWithOverheal(dmg, player.health, player.overheal);
  player.health = absorbed.health;
  player.overheal = absorbed.overheal;
  player.hurtFlash = 1;
  state.run.bleed = applyBleed(state.run.bleed, bite.bleed);
  audio.hurt();
  state.ui.message(`Лиса укусила вас (-${dmg}). Рана кровоточит.`);

  if (player.health <= 0) die();
}

// Кровотечение тикает независимо от боя.
function tickBleed(dt) {
  if (!state.run.bleed || state.run.bleed.remaining <= 0) return;
  if (game.godMode) {
    state.run.bleed = { remaining: 0, dps: 0 };
    return;
  }

  const result = bleedTick(state.run.bleed, dt);
  state.run.bleed = result.bleed;
  if (result.damage <= 0) return;

  player.health = Math.max(0, player.health - result.damage);
  if (player.health <= 0) die();
}

game.onGuardAlert = (actor) => {
  // Рычание — всегда, даже если сообщение подавлено кулдауном.
  if (actor && (actor.kind === "guard" || actor.kind === "village_guard")) {
    audio.guardGrowl();
  }
  if (game.time - game.lastAlertMsg > 3) {
    game.lastAlertMsg = game.time;
    state.ui.message("Вас заметили!");
    audio.alert();
  }
  if (state.run && state.run.activeContract && !state.run.counters.chaseSinceAccept) {
    state.run.counters.chaseSinceAccept = true;
    evaluateContract();
  }
};

function objectiveText() {
  if (!state.run) return "";
  const act = actOf(state.run);
  let line;
  if (state.run.activeContract) {
    line = `Заказ: ${contractName(state.run.activeContract.type)}`;
  } else if (!state.run.wagonLooted) {
    line = "Ограбьте караван на северной стоянке";
  } else if (state.run.inventory.items.length > 0) {
    line = "Продайте добычу Мардо в деревне";
  } else if (state.run.pendingCaravan) {
    line = `Новый караван через ${Math.max(1, Math.ceil(state.run.caravanTimer))} с`;
  } else {
    line = "Возвращайтесь к Мардо за новым заказом";
  }

  // Стороннее задание показываем отдельной строкой: иначе о нём
  // напоминает только лента сообщений, которая давно прокрутилась.
  const quest = state.run.quest && state.run.quest.active;
  let questLine = "";
  if (quest) {
    const progress = questProgressText(quest, {
      beastsSince: (state.run.quest.beasts || {}),
      items: state.run.inventory.items,
      visited: (state.run.quest.visited || {}),
      askedPeople: (state.run.quest.askedPeople || []),
    });
    questLine = `\nПоручение: ${quest.description}${
      quest.state === "complete" ? " — можно сдать" : ` (${progress})`
    }`;
  }

  return `${act.label} · ${line}${questLine}\nЦель: ${act.goal} зм. · продано на ${state.run.totalSold} зм.`;
}

// Живность: блуждание, побег, укусы. Животные не сохраняются — пересоздаются с караваном.
function updateWildlife(dt) {
  for (const animal of world.animals || []) {
    if (!animal.alive) continue;
    // moveActor и world передаются: без них животные ходят сквозь стены.
    const result = stepAnimal(animal, player, dt, moveActor, world);
    if (result.bite) applyBite(result.bite);
  }
}

// Гражданские: лёгкое блуждание по маршруту. Никакой агрессии.
// Титан передаётся как угроза: без этого они стояли и ждали, пока их съедят.
function updateCivilians(dt) {
  const threat = world.titan && world.titan.alive && world.titan.state !== "pacified"
    ? world.titan
    : null;
  for (const person of world.civilians || []) {
    stepCivilian(person, dt, threat, moveActor, world);
  }
}

// Титан: медленный, но неотступный. Ест всех, кроме Мардо и куртизанок.
function updateTitan(dt) {
  const titan = world.titan;
  if (!titan) return;

  // Во время разговора он заморожен: никакого поедания, пока открыта панель.
  if (game.titanDialogue) {
    titan.state = "talk";
    titan.eatTimer = 0;
    return;
  }

  const prey = gatherPrey(world, player);
  // moveActor и world передаются в шаг: иначе титан ходит сквозь стены.
  const result = stepTitan(titan, prey, dt, moveActor, world);
  world.titan = result.titan;

  if (result.ate && result.victim) {
    if (result.victim.isPlayer) {
      titanDeath();
      return;
    }
    // NPC просто исчезает: он его съел.
    result.victim.alive = false;
    if (result.victim.kind) {
      state.ui.message(`Титан съел ${result.victim.label || result.victim.kind}.`);
    }
  }
}

function updateGame(dt) {
  game.time += dt;
  // Монотонное время игры: не замыкается, в отличие от dayTime.
  // Нужно для дедлайнов контрактов — иначе смена суток их обнуляет.
  game.clockTotal = (game.clockTotal || 0) + dt;
  state.run.dayTime = (state.run.dayTime + dt) % 240;

  // Лайтмап пересобирается НЕ каждый кадр: заливка 40 000 тайлов плюс
  // радиусы всех огней стоит дороже, чем весь рейкастинг. Мерцание
  // всё равно медленное — 10 раз в секунду достаточно.
  const phase = phaseOf(state.run.dayTime);
  game.lightTimer = (game.lightTimer || 0) - dt;
  if (game.lightTimer <= 0 || game.lightPhase !== phase) {
    game.lightTimer = 0.1;
    game.lightPhase = phase;
    game.lightmap = buildLightmap(world, AMBIENT[phase] ?? 1, game.time);
  }
  if (game.weather) stepWeather(game.weather, dt);

  // Живность и кровотечение тикают даже во время обыска.
  updateWildlife(dt);
  updateCivilians(dt);
  updateTitan(dt);
  tickBleed(dt);

  const mouse = input.consumeMouse();
  if (input.locked && mouse.dx !== 0) player.turn(mouse.dx * 0.0022);
  if (input.locked && mouse.dy !== 0) player.look(mouse.dy);
  const turnAxis = (input.isDown("ArrowRight") ? 1 : 0) - (input.isDown("ArrowLeft") ? 1 : 0);
  if (turnAxis !== 0) player.turn(turnAxis * 1.9 * dt);

  game.noiseTimer = Math.max(0, game.noiseTimer - dt);
  game.noiseLevel = Math.max(game.stealing ? 1 : 0, game.noiseTimer > 0 ? 0.9 : 0);

  // Следы на мягкой земле: не механика, а память о пути.
  trackFootsteps(dt);

  // Посещение мест для задания «дойти»: раз в секунду, а не каждый кадр.
  game.questTimer = (game.questTimer || 0) - dt;
  if (game.questTimer <= 0) {
    game.questTimer = 1;
    noteVisitedPlaces();
    refreshQuestState();
  }

  let near = nearestInteraction(world, player);
  const wagonNear = near && near.type === "wagon";

  // Верхом обыскивать фургон нельзя — это был бы чит.
  if (wagonNear && input.isDown("KeyE") && !game.stealing && !game.mounted) {
    game.stealing = true;
    game.stealProgress = 0;
    audio.steal();
  }

  if (game.stealing) {
    if (!input.isDown("KeyE") || !wagonNear || game.mounted) {
      game.stealing = false;
      game.stealProgress = 0;
    } else {
      game.stealProgress += dt / stealTime(state.run.upgrades.lockpick);
      if (game.stealProgress >= 1) startLoot(Boolean(near.second));
    }
  }

  if (!game.stealing) {
    // Множитель скорости и noclip — только для режима разработчика.
    state.run.speedMultiplier = game.speedMultiplier;
    // Лошадь даёт свой множитель по типу поверхности.
    state.run.horseMultiplier = game.mounted
      ? horseSpeed(tileAt(world, player.x, player.y))
      : 1;
    state.run.mounted = Boolean(game.mounted);
    player.noclip = game.noclip;
    player.update(world, input, dt, state.run, audio);
  }

  // Приземление после прыжка слышно: стража просыпается от топота.
  if (player.landedThisFrame) {
    player.landedThisFrame = false;
    game.noiseTimer = Math.max(game.noiseTimer, 0.35);
  }

  // Шаги стражей слышны только вблизи и только когда рядом нет тишины.
  // Без отсечки по дистанции топот шёл бы со всей карты.
  for (const actor of world.actors) {
    if (actor.kind !== "guard" && actor.kind !== "village_guard") {
      actor.onStep = null;
      continue;
    }
    actor.onStep = () => {
      if (game.paused || !game.started) return;
      const d = Math.hypot(actor.x - player.x, actor.y - player.y);
      if (d > 12) return;
      // Тихо подкрадывающемуся игроку шаги стражи не мешают спать.
      audio.guardStep(d);
    };
  }

  const aiContext = {
    world,
    player,
    wanted: state.run.wanted,
    noiseLevel: game.noiseLevel,
    dayTime: state.run.dayTime,
    damagePlayer,
    onGuardAlert: game.onGuardAlert,
  };
  updateActors(aiContext, dt);

  const susp = maxSuspicion(world);
  game.suspicion = susp.value;
  game.chasing = susp.chasing;

  near = nearestInteraction(world, player);
  if (game.stealing) {
    state.ui.setPrompt("Обыскиваете фургон… не дайте страже заметить вас");
    state.ui.setProgress(game.stealProgress);
  } else if (near && near.type === "wagon") {
    state.ui.setPrompt(near.label);
    state.ui.setProgress(null);
  } else if (near && near.type === "merchant") {
    state.ui.setPrompt(near.label);
    state.ui.setProgress(null);
  } else {
    state.ui.setPrompt(null);
    state.ui.setProgress(null);
  }

  if (state.run.pendingCaravan) {
    state.run.caravanTimer -= dt;
    if (state.run.caravanTimer <= 0) {
      const distToWagon = Math.hypot(player.x - world.wagon.x, player.y - world.wagon.y);
      if (distToWagon < 13) {
        state.run.caravanTimer = 3;
      } else {
        state.run.tier += 1;
        spawnCamp(world, state.run.tier, tuningFor(state.run.style));
        state.run.archetype = world.archetype;
        respawnWildlifeAndCourtesan();
        state.run.wagonLooted = false;
        state.run.secondWagonLooted = false;
        state.run.pendingCaravan = false;
        state.run.lootSoldForTier = false;
        // Новый караван — новый разговор о цене: Мардо снова готов торговаться.
        game.haggleRolled = 0;
        state.ui.message(`На северной дороге замечен новый караван — ${world.layout.label.toLowerCase()}.`);
        saveCheckpoint(CHECKPOINT_REASONS.NEW_CARAVAN);
      }
    }
  }

  evaluateContract();
}

function uiState() {
  const phase = phaseOf(state.run ? state.run.dayTime : 0);
  return {
    player,
    gold: state.run ? state.run.gold : 0,
    reputation: state.profile.reputation || 0,
    wanted: state.run ? state.run.wanted : 0,
    bleed: state.run ? state.run.bleed : { remaining: 0, dps: 0 },
    weatherLabel: isWet(game.weather) ? weatherLabel(game.weather) : "",
    wet: isWet(game.weather),
    inventory: state.run ? state.run.inventory : { capacity: 0, items: [] },
    upgrades: state.run ? state.run.upgrades : {},
    profile: state.profile,
    activeContract: state.run ? state.run.activeContract : null,
    contractOffer: state.run ? state.run.contractOffer : [],
    contractTimeLeft: game.contractTimeLeft,
    noiseLevel: game.noiseLevel,
    phase,
    styleKey: state.run ? styleKey() : "neutral",
    archetype: state.run ? state.run.archetype : "road_camp",
    suppressFame: false,
  };
}

let last = performance.now();
// В деревне музыка спокойнее, на тракте — темнее. Граница совпадает
// с зоной деревни из world.js, но чуть шире: площадь и рынок тоже «свои».
function isInTown(x, y) {
  return x >= 44 && x <= 90 && y >= 104 && y <= 146;
}

// Исключение внутри кадра раньше убивало игру насмерть: requestAnimationFrame
// стоял ПОСЛЕДНЕЙ строкой, и до него управление не доходило. Картинка и звук
// замирали, помогала только перезагрузка. Именно так и случилось с
// `trackAlpha is not defined`: одна опечатка в импорте — и стоп-кадр.
//
// Логика цикла вынесена в src/loop.js: планирование следующего кадра живёт
// в finally, поэтому один битый кадр остаётся одним битым кадром. Ошибки
// копятся в window.__frameErrors (видно в ?debug=1) и печатаются один раз
// на уникальный текст, иначе консоль заливает 60 сообщениями в секунду.
const reportFrameError = createErrorReporter((error) => {
  if (typeof window !== "undefined") {
    window.__frameErrors = window.__frameErrors || [];
    const text = String((error && error.message) || error);
    if (!window.__frameErrors.includes(text)) window.__frameErrors.push(text);
  }
  console.error("[corovans] кадр упал:", error);
});

function stepFrame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  if (state.run && canControl()) {
    updateGame(dt);
  } else if (state.run) {
    input.consumeMouse();
    game.noiseLevel = 0;
    game.suspicion = Math.max(0, game.suspicion - dt);
  }

  renderer.render({
    world,
    player,
    time: game.time,
    hurtFlash: player.hurtFlash,
    started: game.started,
    light: state.run ? phaseOf(state.run.dayTime) : "day",
    lightmap: game.lightmap,
    weather: game.weather,
    mounted: Boolean(game.mounted),
    // Сид нужен небу: звёзды и луна фиксированы на забег, иначе они мерцают.
    seed: state.run ? state.run.seed : 0,
    tracks: game.tracks || [],
    suspicionSource: (actor) => (actor.asleep ? 0 : actor.suspicion),
    showSuspicion: game.started && !game.gameOver,
  });

  if (state.run) {
    state.ui.update(uiState());
    state.ui.setObjective(objectiveText());
    // Дождь звучит только когда он есть и игра не на паузе.
    audio.rain(Boolean(game.weather && game.weather.raining) && game.started && !game.paused, game.weather ? game.weather.intensity : 0);

    // Фон: смена настроения по фазе и месту. music() сам решает, пора ли
    // что-то менять, поэтому вызывать каждый кадр безопасно.
    if (game.started && !game.paused && !game.gameOver) {
      const inTown = isInTown(player.x, player.y);
      audio.stepMusic(state.run ? phaseOf(state.run.dayTime) : "day", inTown);
    } else {
      audio.musicStop(1.5);
    }
  }
}

// ── Запуск ──────────────────────────────────────────────────────────

// Кадр собирается здесь, а не выше: createFrameLoop нужен готовый stepFrame.
const frame = createFrameLoop(
  stepFrame,
  (fn) => requestAnimationFrame(fn),
  reportFrameError
);

// Целочисленный масштаб: при нецелом множителе pixelated-канвас «мылит».
// Внутри буфера 1280×720, на экране — кратное увеличение, поля по краям.
function applyCanvasScale() {
  const scale = Math.max(
    1,
    Math.floor(Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height))
  );
  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;
  // CSS-размер может оказаться меньше буфера на маленьком экране:
  // считаем фактический множитель, чтобы прицел не «уезжал».
  document.documentElement.style.setProperty("--pixel", String(scale));
}

applyCanvasScale();
window.addEventListener("resize", applyCanvasScale);

const debugEnabled = new URLSearchParams(window.location.search).has("debug");
const startHasSave = hasSave();
state.ui.showStart(startHasSave);

// Загрузка сейва профиля. Делается здесь, а не при объявлении переменных:
// UI уже создан, контейнер готов, и профиль можно сразу положить в него.
state.saved = readSave();
state.profile = state.saved.profile;

// Метка всегда в консоли: при кеше видно, что играешь не ту сборку.
console.info(
  `[corovans] build ${BUILD} · crouch=C jump=Space block=RMB pitch=Y · ?debug=1 для отладки`
);

if (debugEnabled) {
  window.__corovans = {
    build: BUILD,
    get game() {
      return game;
    },
    get run() {
      return state.run;
    },
    get profile() {
      return state.profile;
    },
    ui: state.ui,
    input,
    player,
    world,
    renderer,
    audio,
    saveCheckpoint,
    newRun,
    attack: performAttack,
    eat: eatBestFood,
    api: { readSave, writeSave },
    debugStyle: {
      dominantArchetype,
      tuningFor,
      recordEvent,
    },
    debugNpc: {
      createCourtesan,
    },
    debugWildlife: {
      SPECIES_DEFS,
      createAnimal,
      bestFood,
    },
  };
}

requestAnimationFrame(frame);
