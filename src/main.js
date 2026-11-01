import { Renderer } from "./raycaster.js";
import { Input } from "./input.js";
import { Player } from "./player.js";
import { createWorld, nearestInteraction, spawnCamp } from "./world.js";
import { updateActors, maxSuspicion } from "./enemies.js";import { UI } from "./ui.js";
import { AudioSys } from "./audio.js";
import { addItem, totalValue, rollLoot } from "./inventory.js";
import { purchase, fineFor, sellMultiplier } from "./economy.js";
import { damageRoll, inMeleeCone, attackCooldown, stealTime, applyArmor, blockAbsorb, blockFacingDot } from "./combat.js";
import { createRng, makeRunSeed } from "./rng.js";
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
import { generateContracts, checkContract, rewardOf, contractName } from "./contracts.js";
import { phaseOf, pricesAt } from "./daynight.js";
import { buildLightmap, AMBIENT } from "./lighting.js";
import { createWeather, stepWeather, weatherLabel, isWet, setWeather } from "./weather.js";
import { runCommand, CHEAT_HELP } from "./cheats.js";
import { buildAdvicePanel } from "./advice.js";
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
import { buildCourtesan } from "./sprites.js";
import {
  SPECIES_DEFS,
  createAnimal,
  stepAnimal,
  animalOnHit,
  bleedTick,
  applyBleed,
  bestFood,
  animalSpawnPlan,
  isAnimal,
} from "./wildlife.js";
import {
  createCourtesan,
  courtesanCanServe,
  applyHeal,
  pickCourtesanLine,
  describeCourtesan,
  greetCourtesan,
  afterCourtesanLine,
  refusalLine,
  courtesanRumor,
  absorbWithOverheal,
  OVERHEAL_CAP,
  affinityOf,
  isFreeVisit,
  bumpAffinity,
} from "./npc.js";
import {
  createCivilians,
  stepCivilian,
  civilianLine,
  bumpVisits,
  isTrader,
  isBeggar,
  isRumormonger,
} from "./civilian.js";

// Метка сборки: видна в консоли и в window.__corovans.build.
// Не совпала с ожидаемой — браузер играет закешированные модули.
const BUILD = "2026-11-02-world-1";

const canvas = document.getElementById("game");const world = createWorld();
const player = new Player(world.spawn);
const renderer = new Renderer(canvas);
const audio = new AudioSys();

let saved = readSave();
let profile = saved.profile;
let run = null;
let rng = createRng(1);

// Рантайм-состояние, которое не сохраняется.
const game = {
  started: false,
  paused: false,
  gameOver: false,
  victoryShown: false,
  uiOpen: false,
  stealing: false,
  stealProgress: 0,
  noiseTimer: 0,
  noiseLevel: 0,
  weather: null,
  godMode: false,
  noclip: false,
  speedMultiplier: 1,
  consoleHistory: [],
  consoleHistoryIndex: -1,
  time: 0,
  lastAlertMsg: -99,
  contractTimeLeft: null,
  lootBuffer: null,
  lootSecondWagon: false,
  suspicion: 0,
  chasing: false,
};

let ui;

const bonuses = () => startingBonuses(profile);

function canControl() {
  return (
    game.started &&
    !game.paused &&
    !game.gameOver &&
    !game.victoryShown &&
    !ui.tradeOpen &&
    !ui.helpOpen &&
    !ui.lootOpen &&
    !ui.courtesanOpen &&
    !ui.adviceOpen &&
    !ui.titanOpen &&
    !ui.consoleOpen
  );
}

// ── Жизненный цикл рана ─────────────────────────────────────────────

function newRun() {
  const seed = makeRunSeed();
  run = createRun(seed, profile, { bonuses: bonuses() });
  rng = createRng(run.seed);
  rng.restore(run.rngState);

  player.reset(world.spawn);
  world.tier = 1;
  run.archetype = "road_camp";
  spawnCamp(world, 1, tuningFor(run.style, 2));
  respawnWildlifeAndCourtesan();
  game.weather = createWeather(run.seed);

  run.offerIndex = 0;
  run.offerAct = 0;
  refreshContracts();
  syncRunToWorld();
  saveCheckpoint(CHECKPOINT_REASONS.START);
  ui.message("Мардо: «Караван стоит на северной стоянке. Иди на восток по дороге, потом на север.»");
}

function continueRun() {
  const loaded = restoreRun(saved.run, profile, bonuses());
  if (!loaded) {
    newRun();
    return false;
  }
  run = loaded.run;
  rng = createRng(run.seed);
  rng.restore(run.rngState);

  spawnCamp(world, run.tier, tuningFor(run.style, run.tier + 1));
  respawnWildlifeAndCourtesan();
  // Погода выводится из сида рана: F5 с чекпоинта даёт тот же дождь,
  // иначе перезагрузка стала бы кнопкой «сделать сухо».
  game.weather = createWeather(run.seed);
  if (run.wagonLooted) world.wagonLooted = true;
  if (run.secondWagonLooted) world.secondWagon.looted = true;

  if (playerPositionValid(world, run.player)) {
    player.x = run.player.x;
    player.y = run.player.y;
    player.setAngle(run.player.angle || 0);
    // Запас бодрости восстанавливаем из сейва: иначе F5 его сбрасывает.
    player.overheal = Math.max(0, Math.min(OVERHEAL_CAP, run.player.overheal || 0));
  } else {
    player.reset(world.spawn);
  }

  syncRunToWorld();
  ui.message("Вы продолжаете с последнего чекпоинта.");
  return true;
}

function syncRunToWorld() {
  world.tier = run.tier;
  world.wagonLooted = run.wagonLooted;
  if (world.secondWagon) world.secondWagon.looted = Boolean(run.secondWagonLooted);
}

// Живность и куртизанка пересоздаются вместе с караваном:
// новый тир и акт дают новую внешность и новые тушки.
function respawnWildlifeAndCourtesan() {
  world.animals = spawnAnimals(run.tier, world.archetype);
  // Гражданские не пересоздаются с караваном: они часть мира, не лагеря.
  if (!world.civilians || world.civilians.length === 0) {
    world.civilians = createCivilians(run.seed);
  }
  updateCourtesanVariant();
  spawnTitan();
}

// Титан один на карту. Появляется у леса — далеко от деревни,
// чтобы первые минуты забега не были смертельными.
function spawnTitan() {
  if (!run) return;
  if (run.titanPacified) {
    world.titan = null;
    return;
  }

  if (!world.titan) {
    world.titan = createTitan(run.seed, 40.5, 34.5);
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
  { x: 56, y: 78 }, { x: 64, y: 84 }, { x: 72, y: 76 }, { x: 82, y: 88 },
  { x: 60, y: 94 }, { x: 76, y: 96 }, { x: 86, y: 80 },
  { x: 62, y: 44 }, { x: 68, y: 47 }, { x: 74, y: 46 },
  { x: 88, y: 62 }, { x: 94, y: 70 },
];

// Каждая куртизанка получает свой вариант: сид включает ключ места.
// Спрайтов два на стиль: чистый и в крови. Переключаем ключ, а не пересобираем в кадре.
function updateCourtesanVariant() {
  const bloodied = (run.counters.kills > 0 && run.wanted > 0) || run.wanted >= 2;

  for (const courtesan of world.courtesans || []) {
    const spot = courtesan.spot || "square";
    const variant = createCourtesan(run.seed, run.tier, run.act, spot);
    courtesan.displayName = variant.displayName;
    courtesan.variant = variant;

    const cleanKey = `${variant.spriteKey}_clean`;
    const bloodKey = `${variant.spriteKey}_blood`;
    courtesan.spriteKey = bloodied ? bloodKey : cleanKey;

    // Старые ключи этого места удаляем, иначе копится мусор при каждом караване.
    for (const key of Object.keys(renderer.sprites)) {
      if (key.startsWith(`courtesan_`) && !key.endsWith("_clean") && !key.endsWith("_blood")) {
        delete renderer.sprites[key];
      }
    }

    renderer.sprites[cleanKey] = buildCourtesan(variant, { bloodied: false });
    renderer.sprites[bloodKey] = buildCourtesan(variant, { bloodied: true });
  }
}

function saveCheckpoint(reason) {
  if (!run) return false;
  if (!canCheckpoint(run, { stealing: game.stealing })) return false;

  run.rngState = rng.state();
  run.player = { x: player.x, y: player.y, angle: player.angle, overheal: player.overheal || 0 };
  return writeSave(profile, snapshotRun(run, player));
}

// ── Стиль и телекоординация ─────────────────────────────────────────

function noteStyle(event) {
  recordEvent(run.style, event);
}

function styleKey() {
  return dominantArchetype(run.style);
}

// ── Контракты ───────────────────────────────────────────────────────

function refreshContracts() {
  if (!run) return;
  if (run.activeContract) return;
  run.contractOffer = generateContracts(run.seed, run.act, run.offerIndex, run.tier, styleKey());
  run.offerSeed = run.contractOffer.length ? run.contractOffer[0].id : 0;
  run.offerAct = run.act;
}

function acceptContract(index) {
  if (!ui.tradeOpen || !run) return;
  const offer = run.contractOffer[index];
  if (!offer || run.activeContract) return;

  run.activeContract = { ...offer, state: "active", acceptedAt: run.dayTime };
  run.contractOffer = [];
  run.counters.killsSinceAccept = 0;
  run.counters.lootsSinceAccept = 0;
  run.counters.chaseSinceAccept = false;
  run.counters.driverKilledSinceAccept = false;
  run.counters.acceptedAt = run.dayTime;

  audio.ui();
  ui.message(`Взят заказ: ${contractName(offer.type)}. ${offer.description}`);
  ui.renderTrade(tradeState());
  saveCheckpoint(CHECKPOINT_REASONS.CONTRACT_ACCEPTED);
}

function contractSnapshot() {
  return {
    kills: run.counters.kills,
    killsSinceAccept: run.counters.killsSinceAccept,
    lootsSinceAccept: run.counters.lootsSinceAccept,
    chaseSinceAccept: run.counters.chaseSinceAccept,
    driverKilledSinceAccept: run.counters.driverKilledSinceAccept,
    items: run.inventory.items,
    dayTime: run.dayTime,
    acceptedAt: run.counters.acceptedAt,
  };
}

function evaluateContract() {
  if (!run || !run.activeContract) return;
  const contract = run.activeContract;
  const snap = contractSnapshot();
  const result = checkContract(contract, snap);

  if (contract.deadline && result.status === "active") {
    game.contractTimeLeft = Math.max(0, contract.deadline - (run.dayTime - contract.acceptedAt));
  } else {
    game.contractTimeLeft = null;
  }

  if (result.status === "complete") {
    finishContract(true);
  } else if (result.status === "failed") {
    finishContract(false, result.reason);
  }
}

function finishContract(success, reason = "") {
  const contract = run.activeContract;
  if (!contract) return;

  if (success) {
    const reward = rewardOf(contract, run.contractStreak);
    run.gold += reward.gold;
    run.contractStreak += 1;
    run.counters.contractsDone += 1;
    profile = {
      ...profile,
      reputation: (profile.reputation || 0) + reward.rep,
      completedContracts: profile.completedContracts.includes(contract.id)
        ? profile.completedContracts
        : [...profile.completedContracts, contract.id],
      stats: { ...profile.stats, contractsDone: (profile.stats.contractsDone || 0) + 1 },
    };
    noteStyle("contract_done");
    if (contract.type === "clean" || contract.type === "unseen") noteStyle("clean_contract");
    ui.message(`Заказ выполнен: +${reward.gold} зм., +${reward.rep} репутации.`);
    audio.coin();
  } else {
    run.contractStreak = 0;
    run.counters.contractsFailed += 1;
    profile = {
      ...profile,
      stats: { ...profile.stats, contractsFailed: (profile.stats.contractsFailed || 0) + 1 },
    };
    noteStyle("contract_failed");
    ui.message(`Заказ провален${reason ? `: ${reason}` : ""}.`);
  }

  run.activeContract = null;
  game.contractTimeLeft = null;
  run.offerIndex += 1;
  refreshContracts();
  checkActProgress();
  saveCheckpoint(success ? CHECKPOINT_REASONS.CONTRACT_DONE : CHECKPOINT_REASONS.SOLD);
  if (ui.tradeOpen) ui.renderTrade(tradeState());
}

// ── Акты ────────────────────────────────────────────────────────────

function checkActProgress() {
  if (!run || game.victoryShown) return;
  const goal = goalOf(run);
  if (run.gold < goal || run.totalSold <= 0) return;

  if (run.act < ACTS.length - 1) {
    run.act += 1;
    run.offerIndex += 1;
    refreshContracts();
    const act = actOf(run);
    ui.message(`${act.label}: «${act.title}». Новая цель — ${act.goal} зм.`);
    audio.victory();
    saveCheckpoint(CHECKPOINT_REASONS.ACT_UP);
    return;
  }

  game.victoryShown = true;
  game.paused = true;
  input.exitLock();
  ui.closeTrade();
  ui.closeLoot();
  ui.hideHelp();
  game.uiOpen = false;
  ui.setPrompt(null);
  ui.setProgress(null);
  audio.victory();
  profile = applyRun(profile, runSummary(run, { style: styleKey() }));
  writeSave(profile, null);
  ui.showEnd(
    "Демо пройдено",
    `Вы собрали ${run.gold} золотых на чужих караванах. Репутация: ${profile.reputation}. Дорога запомнила вас — ${STYLE_LABELS[styleKey()]}.`,
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

ui = new UI({
  start: startGame,
  load: loadGame,
  resume: resumeGame,
  restart: restartRun,
  continueGame: continueAfterVictory,
  sell: sellLoot,
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
  courtesanLeave: leaveCourtesan,
  closeAdvice: closeAdvicePanel,
  consoleCommand: runConsoleCommand,
  titanAnswer: answerTitan,
});

canvas.addEventListener("click", () => {
  if (canControl() && !input.locked) input.requestLock();
});

function startGame() {
  audio.init();
  audio.ui();
  game.started = true;
  game.paused = false;
  document.body.classList.add("playing");
  ui.hideStart();
  newRun();
  input.requestLock();
}

function loadGame() {
  audio.init();
  audio.ui();
  saved = readSave();
  profile = saved.profile;
  game.started = true;
  game.paused = false;
  game.gameOver = false;
  game.victoryShown = false;
  document.body.classList.add("playing");
  ui.hideStart();
  ui.hideEnd();
  if (!continueRun()) {
    ui.message("Сохранение не читается — начат новый забег.");
  }
  input.requestLock();
}

function restartRun() {
  if (run) {
    profile = applyRun(profile, runSummary(run, { style: styleKey() }));
    writeSave(profile, null);
  }
  saved = { profile, run: null };
  run = null;
  game.gameOver = false;
  game.victoryShown = false;
  game.paused = false;
  ui.hideEnd();
  newRun();
  input.requestLock();
}

function continueAfterVictory() {
  ui.hideEnd();
  game.victoryShown = false;
  game.paused = false;
  input.requestLock();
}

function pauseGame() {
  game.paused = true;
  input.clear();
  ui.setPrompt(null);
  ui.setProgress(null);
  ui.showPause();
}

function resumeGame() {
  if (game.gameOver) return;
  game.paused = false;
  ui.hidePause();
  input.requestLock();
}

function handleKeyDown(code) {
  // Консоль перехватывает всё, пока открыта.
  if (code === "Backquote") {
    if (ui.consoleOpen) closeConsole();
    else openConsole();
    return;
  }
  if (code === "ArrowUp" && ui.consoleOpen) {
    consoleHistory(-1);
    return;
  }
  if (code === "ArrowDown" && ui.consoleOpen) {
    consoleHistory(1);
    return;
  }
  if (ui.consoleOpen) return;

  if (code === "KeyI" && game.started && !game.gameOver && !ui.tradeOpen) {
    if (ui.helpOpen) closeHelp();
    else openHelp();
    return;
  }
  if (code === "Tab") {
    if (ui.adviceOpen) closeAdvicePanel();
    else openAdvicePanel();
    return;
  }
  if (code === "Escape") {
    if (ui.adviceOpen) closeAdvicePanel();
    else if (ui.courtesanOpen) leaveCourtesan();
    else if (ui.tradeOpen) closeTrade();
    else if (ui.helpOpen) closeHelp();
    else if (ui.lootOpen) finishLoot();
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
    const near = nearestInteraction(world, player);
    if (near && near.type === "merchant") openTrade();
    else if (near && near.type === "courtesan") visitCourtesan(near.spot);
    else if (near && near.type === "civilian") talkToCivilian(near.civilianId);
    else if (near && near.type === "titan") startTitanDialogue();
    return;
  }
  if (code === "KeyF" && canControl()) {
    eatBestFood();
    return;
  }
}

// Съесть самый сытный предмет. Мгновенно, без панелей.
function eatBestFood() {
  const food = bestFood(run.inventory.items);
  if (!food) {
    ui.message("Съестного нет.");
    return;
  }
  if (player.health >= player.maxHealth) {
    ui.message("Вы и так сыты.");
    return;
  }

  const index = run.inventory.items.findIndex((item) => item.id === food.id);
  if (index === -1) return;
  run.inventory.items.splice(index, 1);

  const heal = Math.min(food.heal || 0, player.maxHealth - player.health);
  player.health = Math.min(player.maxHealth, player.health + heal);
  audio.eat?.();
  ui.message(`Вы съели ${food.name.toLowerCase()} (+${heal} здоровья).`);
}

// Куртизанка: открываем панель диалога, а не списываем деньги молча.
// game.activeCourtesan помнит, к кому именно подошли: куртизанок теперь четыре.
function visitCourtesan(spot) {
  const courtesan = findCourtesan(spot);
  if (!courtesan || !courtesan.variant) return;

  const key = courtesan.spot || "square";
  const variant = courtesan.variant;
  const free = isFreeVisit(run.courtesanAffinity, key);
  const can = courtesanCanServe(variant, run.gold, player.health, player.maxHealth, player.overheal, free);

  game.activeCourtesan = key;
  // При отказе всё равно показываем панель: так игрок видит, почему нельзя.
  game.courtesanRumorUsed = false;

  game.uiOpen = true;
  input.clear();
  input.exitLock();
  ui.setPrompt(null);
  ui.setProgress(null);
  ui.openCourtesan({
    displayName: variant.displayName,
    temperLabel: variant.temperLabel,
    description: describeCourtesan(variant).replace(`${variant.displayName} (${variant.temperLabel}): `, ""),
    line: can.ok
      ? greetCourtesan(variant, rng, {
          wanted: run.wanted,
          bled: run.bleed?.remaining || 0,
          free,
        })
      : refusalLine(variant, can.reason, rng),
    info: can.ok ? courtesanInfo(variant, key, free) : courtesanRefusalInfo(variant, can.reason),
    price: variant.price,
    canPay: can.ok,
    free,
    affinity: affinityOf(run.courtesanAffinity, key),
    rumorUsed: false,
  });
  audio.ui();
}

function courtesanInfo(variant, spot, free) {
  const health = `Здоровье ${Math.ceil(player.health)}/${player.maxHealth}` +
    (player.overheal > 0.05 ? ` · запас +${Math.ceil(player.overheal)}` : "");
  if (free) return `Бесплатно: она вас помнит. ${health}`;
  const visits = affinityOf(run.courtesanAffinity, spot);
  const left = Math.max(0, 2 - visits);
  return `Цена: ${variant.price} зм. ${health}` +
    (left > 0 && left < 2 ? ` · ещё ${left} платных визит(а) до «с тебя не беру»` : "");
}

function courtesanRefusalInfo(variant, reason) {
  if (reason === "full_health") return "Она смотрит с сомнением: лечить нечего.";
  return `Не хватает ${Math.max(0, variant.price - run.gold)} зм.`;
}

function findCourtesan(spot) {
  if (spot) {
    const found = (world.courtesans || []).find((c) => (c.spot || "square") === spot);
    if (found) return found;
  }
  return world.courtesan;
}

function payCourtesan() {
  const key = game.activeCourtesan || "square";
  const courtesan = findCourtesan(key);
  if (!courtesan || !courtesan.variant) return;

  const variant = courtesan.variant;
  const free = isFreeVisit(run.courtesanAffinity, key);
  const can = courtesanCanServe(variant, run.gold, player.health, player.maxHealth, player.overheal, free);
  if (!can.ok) {
    ui.setCourtesanLine(refusalLine(variant, can.reason, rng));
    return;
  }

  const result = applyHeal(variant, run.gold, player.health, player.maxHealth, player.overheal, free);
  run.gold = result.gold;
  player.health = result.health;
  player.overheal = result.overheal;

  // Платный визит повышает привязанность. Бесплатный — нет,
  // иначе первый же бесплатный визит сделал бы её вечной.
  if (!free) {
    run.courtesanAffinity = bumpAffinity(run.courtesanAffinity, key);
  }

  audio.coin();
  ui.setCourtesanLine(afterCourtesanLine(variant, rng));

  const parts = [];
  if (result.healed > 0) parts.push(`+${result.healed} здоровья`);
  if (result.topped > 0) parts.push(`+${Math.round(result.topped)} запаса`);
  const priceText = free ? "бесплатно" : `−${variant.price} зм.`;
  if (parts.length) ui.message(`Отдых: ${parts.join(", ")} (${priceText}).`);

  // Обновляем доступность: повторный визит может быть уже не нужен.
  const freeNow = isFreeVisit(run.courtesanAffinity, key);
  const again = courtesanCanServe(variant, run.gold, player.health, player.maxHealth, player.overheal, freeNow);
  ui.openCourtesan({
    displayName: variant.displayName,
    temperLabel: variant.temperLabel,
    description: describeCourtesan(variant).replace(`${variant.displayName} (${variant.temperLabel}): `, ""),
    line: ui.$("courtesan-line").textContent,
    info: again.ok ? courtesanInfo(variant, key, freeNow) : "Больше она вам сегодня не поможет.",
    price: variant.price,
    canPay: again.ok,
    free: freeNow,
    affinity: affinityOf(run.courtesanAffinity, key),
    rumorUsed: game.courtesanRumorUsed,
  });

  saveCheckpoint(CHECKPOINT_REASONS.SOLD);
}

function askCourtesan() {
  const courtesan = findCourtesan(game.activeCourtesan);
  if (!courtesan || !courtesan.variant) return;
  if (game.courtesanRumorUsed) return;

  game.courtesanRumorUsed = true;
  const rumor = courtesanRumor(run.seed, run.visitIndex);
  run.visitIndex = (run.visitIndex || 0) + 1;

  ui.showCourtesanRumor(`«${rumor}»`);
  audio.ui();
  saveCheckpoint(CHECKPOINT_REASONS.SOLD);
}

function leaveCourtesan() {
  ui.closeCourtesan();
  game.uiOpen = false;
  game.courtesanRumorUsed = false;
  game.activeCourtesan = null;
  input.requestLock();
}

// ── Гражданские ──────────────────────────────────────────────────────

function talkToCivilian(civilianId) {
  const person = (world.civilians || []).find((c) => c.id === civilianId);
  if (!person) return;

  bumpVisits(person);
  const line = civilianLine(person, run.seed);

  // Нищему можно подать: монета за репутацию.
  if (isBeggar(person)) {
    if (run.gold >= 1) {
      run.gold -= 1;
      profile = {
        ...profile,
        reputation: (profile.reputation || 0) + 1,
        stats: { ...profile.stats },
      };
      ui.message(`${person.label}: ${line}`);
      ui.message("Вы подали монету. +1 репутации.");
      audio.coin();
      saveCheckpoint(CHECKPOINT_REASONS.SOLD);
      return;
    }
    ui.message(`${person.label}: ${line}`);
    ui.message("У вас нет даже монеты.");
    return;
  }

  ui.message(`${person.label}: ${line}`);

  if (isTrader(person)) {
    ui.message("Она торгует едой. Спросите у Мардо — но у неё дешевле.");
  } else if (isRumormonger(person)) {
    ui.message("Он готов рассказать больше — за монету.");
  }

  audio.ui();
}

// ── Консоль разработчика ─────────────────────────────────────────────

function openConsole() {
  game.uiOpen = true;
  input.clear();
  input.exitLock();
  ui.openConsole();
  ui.consoleClear();
  ui.consolePrint("Консоль разработчика. help — список команд.", "cmd");
}

function closeConsole() {
  ui.closeConsole();
  game.uiOpen = false;
  input.requestLock();
}

function consoleHistory(direction) {
  const history = game.consoleHistory;
  if (!history.length) return;
  const inputEl = ui.consoleInput();
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
  ui.consolePrint(`> ${text}`, "cmd");

  const result = runCommand(text, cheatContext());
  if (result.message) ui.consolePrint(result.message, result.ok ? "ok" : "err");
  if (!result.ok && result.message === "") ui.consolePrint("Пустая команда.", "err");
}

function cheatContext() {
  return {
    game,
    run,
    player,
    world,
    profile,
    setTier(value) {
      run.tier = value;
      spawnCamp(world, run.tier, tuningFor(run.style, run.tier + 1));
      run.archetype = world.archetype;
      respawnWildlifeAndCourtesan();
    },
    setAct(value) {
      run.act = value;
      refreshContracts();
    },
    setWeather(kind) {
      if (!game.weather) game.weather = createWeather(run.seed);
      setWeather(game.weather, kind);
    },
  };
}

// ── Панель целей и советов ───────────────────────────────────────────

function openAdvicePanel() {
  game.uiOpen = true;
  input.clear();
  input.exitLock();
  ui.openAdvice(
    buildAdvicePanel({
      run,
      world,
      player,
      game,
      profile,
    })
  );
  audio.ui();
}

function closeAdvicePanel() {
  ui.closeAdvice();
  game.uiOpen = false;
  input.requestLock();
}

// Смерть от титана: полный рестарт забега. Репутация и разблокировки целы.
function titanDeath() {
  if (game.gameOver) return;

  player.dead = true;
  game.gameOver = true;
  input.exitLock();
  ui.closeTrade();
  ui.closeLoot();
  ui.closeCourtesan();
  ui.closeTitan();
  ui.hideHelp();
  game.uiOpen = false;
  game.stealing = false;
  game.stealProgress = 0;
  ui.setPrompt(null);
  ui.setProgress(null);
  audio.death();

  profile = { ...profile, stats: { ...profile.stats, deaths: (profile.stats.deaths || 0) + 1 } };
  writeSave(profile, null);

  ui.showEnd(
    "Титан не оставил ничего",
    "Ни имени, ни вещей, ни следа. Дорога начинается заново — но то, что ты знал, осталось с тобой. Репутация и разблокировки целы.",
    false
  );
}

// ── Диалог с титаном ─────────────────────────────────────────────────

function startTitanDialogue() {
  if (!world.titan || run.titanPacified) return;

  game.titanDialogue = {
    questions: titanQuestions(run.seed),
    index: 0,
    correct: 0,
  };

  game.uiOpen = true;
  input.clear();
  input.exitLock();
  ui.setPrompt(null);
  ui.setProgress(null);
  showTitanQuestion();
}

function showTitanQuestion() {
  const d = game.titanDialogue;
  if (!d) return;

  const q = d.questions[d.index];
  if (!q) return;

  ui.openTitan({
    question: q.text,
    answers: q.answers,
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
    ui.closeTitan();
    game.titanDialogue = null;
    game.uiOpen = false;
    ui.message(TITAN_FAIL_LINE);
    titanDeath();
    return;
  }

  d.correct += 1;
  d.index += 1;

  if (d.index >= d.questions.length) {
    // Прошёл все три.
    run.titanPacified = true;
    world.titan = null;
    game.titanDialogue = null;
    game.uiOpen = false;
    ui.closeTitan();
    ui.message(TITAN_PASS_LINE);
    audio.victory();
    saveCheckpoint(CHECKPOINT_REASONS.SOLD);
    input.requestLock();
    return;
  }

  audio.ui();
  showTitanQuestion();
}

function handleKeyUp(code) {  if (code === "KeyE") {
    game.stealing = false;
    game.stealProgress = 0;
  }
}

function openHelp() {
  game.uiOpen = true;
  input.clear();
  input.exitLock();
  ui.showHelp();
  ui.setPrompt(null);
  ui.setProgress(null);
}

function closeHelp() {
  ui.hideHelp();
  game.uiOpen = false;
  input.requestLock();
}

function openTrade() {
  game.uiOpen = true;
  input.clear();
  input.exitLock();
  ui.setPrompt(null);
  ui.setProgress(null);
  ui.openTrade(tradeState());
  audio.ui();
}

function closeTrade() {
  ui.closeTrade();
  game.uiOpen = false;
  input.requestLock();
}

function tradeState() {
  return {
    gold: run.gold,
    upgrades: run.upgrades,
    inventory: run.inventory,
    wanted: run.wanted,
    profile,
    contractOffer: run.contractOffer,
    activeContract: run.activeContract,
    priceModifier: priceModifier(),
  };
}

function priceModifier() {
  return (1 + bonuses().priceBonus) * pricesAt(run.dayTime) * tuningFor(run.style, run.tier + 1).priceBonus;
}

// ── Экономика ───────────────────────────────────────────────────────

function sellLoot() {
  if (!ui.tradeOpen || !run) return;
  const value = totalValue(run.inventory);
  if (value <= 0) return;

  const earned = Math.round(value * sellMultiplier(run.upgrades, priceModifier()));
  run.gold += earned;
  run.totalSold += earned;
  run.counters.totalGoldEarned += earned;
  run.inventory.items = [];
  audio.coin();
  ui.message(`Мардо отсчитал ${earned} зм.`);
  if (earned >= 120) noteStyle("sell_high");

  if (world.wagonLooted && !run.lootSoldForTier) {
    run.lootSoldForTier = true;
    run.pendingCaravan = true;
    run.caravanTimer = 12;
    ui.message("Слух: на северной дороге скоро появится новый караван.");
  }

  ui.renderTrade(tradeState());
  checkActProgress();
  saveCheckpoint(CHECKPOINT_REASONS.SOLD);
}

function buyUpgrade(id) {
  if (!ui.tradeOpen || !run) return;
  if (!(id in run.upgrades)) return;
  const result = purchase(run.gold, run.upgrades, id);
  if (!result) return;
  run.gold = result.gold;
  run.upgrades = result.upgrades;
  audio.coin();
  ui.message(`Куплено улучшение.`);
  ui.renderTrade(tradeState());
}

function buyUnlock(id) {
  if (!ui.tradeOpen) return;
  const next = unlock(profile, id);
  if (!next) return;
  profile = next;
  audio.coin();
  ui.message(`Открыто навсегда: ${id}.`);
  ui.renderTrade(tradeState());
  writeSave(profile, run ? snapshotRun(run, player) : null);
}

function payFine() {
  if (!ui.tradeOpen || !run) return;
  const cost = fineFor(run.wanted);
  if (cost <= 0) return;
  if (run.gold < cost) {
    ui.message("Не хватает золота на штраф.");
    return;
  }
  run.gold -= cost;
  run.wanted = 0;
  const guard = world.villageGuard;
  guard.state = "idle";
  guard.suspicion = 0;
  guard.alerted = false;
  audio.coin();
  ui.message("Штраф уплачен. Стража больше не ищет вас.");
  ui.renderTrade(tradeState());
  saveCheckpoint(CHECKPOINT_REASONS.SOLD);
}

// ── Обыск фургона ───────────────────────────────────────────────────

function startLoot(second = false) {
  const tier = run.tier;
  const count = 2 + tier + tuningFor(run.style, tier + 1).lootCount;
  game.lootBuffer = rollLoot(tier, rng, count);
  game.lootSecondWagon = second;

  const witnessed = world.campGuards.some(
    (a) => a.alive && (a.state === "chase" || a.suspicion > 0.4)
  );
  game.lootWitnessed = witnessed;
  game.stealing = false;
  game.stealProgress = 0;

  game.uiOpen = true;
  input.clear();
  input.exitLock();
  ui.openLoot(game.lootBuffer);
  ui.setPrompt(null);
  ui.setProgress(null);
}

function takeLoot(index) {
  if (!ui.lootOpen || !game.lootBuffer) return;
  const item = game.lootBuffer[index];
  if (!item) return;

  if (!addItem(run.inventory, item)) {
    ui.message("Не помещается — несите, что есть.");
    return;
  }
  game.lootBuffer.splice(index, 1);
  ui.renderLoot(game.lootBuffer);
  if (game.lootBuffer.length === 0) finishLoot();
}

function finishLoot() {
  if (!run) return;
  const taken = run.inventory.items.length;
  const wasSecond = game.lootSecondWagon;

  if (wasSecond) {
    if (world.secondWagon) world.secondWagon.looted = true;
    run.secondWagonLooted = true;
  } else {
    world.wagonLooted = true;
    run.wagonLooted = true;
  }

  const coin = 18 + run.tier * 8;
  run.gold += coin;

  if (game.lootWitnessed) {
    run.wanted = Math.min(5, Math.max(run.wanted, 1));
    noteStyle("witnessed");
    ui.message("Стража видела ограбление! Розыск +1.");
  } else {
    noteStyle("silent_loot");
    run.counters.silentLoots += 1;
    const bonus = Math.round(coin * (tuningFor(run.style, run.tier + 1).silentBonus - 1));
    if (bonus > 0) {
      run.gold += bonus;
      ui.message(`Тихо и чисто: +${bonus} зм. за бесшумность.`);
    }
  }

  run.counters.lootsSinceAccept += 1;
  game.lootBuffer = null;
  game.lootSecondWagon = false;
  game.lootWitnessed = false;
  game.uiOpen = false;
  ui.closeLoot();
  audio.coin();
  ui.message(`Из фургона вынесено ${taken} тюков и ${coin} зм.`);

  evaluateContract();
  checkActProgress();
  saveCheckpoint(CHECKPOINT_REASONS.SOLD);
  input.requestLock();
}

// ── Бой ─────────────────────────────────────────────────────────────

function performAttack() {
  if (player.attackCd > 0 || player.dead || player.blocking) return;

  // Титан неуязвим: удар просто отскакивает, но кулдаун тратится.
  const titan = world.titan;
  if (
    titan &&
    titan.alive &&
    Math.hypot(titan.x - player.x, titan.y - player.y) < 2.6
  ) {
    player.attackCd = attackCooldown(run.upgrades.sword);
    player.swingT = 0.34;
    audio.swing();
    audio.hit();
    ui.message("Клинок отскакивает, будто от скалы. Его нельзя убить.");
    return;
  }

  player.attackCd = attackCooldown(run.upgrades.sword);
  player.swingT = 0.34;
  audio.swing();
  game.noiseTimer = 0.5;

  let target = null;
  let bestDist = Infinity;
  let targetIsAnimal = false;

  for (const actor of world.actors) {
    if (!actor.alive || actor.kind === "merchant" || actor.kind === "courtesan") continue;
    if (
      inMeleeCone(
        player.x,
        player.y,
        player.dirX,
        player.dirY,
        actor.x,
        actor.y,
        1.95,
        0.4
      )
    ) {
      const dist = Math.hypot(actor.x - player.x, actor.y - player.y);
      if (dist < bestDist) {
        bestDist = dist;
        target = actor;
        targetIsAnimal = false;
      }
    }
  }

  // Живность — тоже цель, но отдельным проходом: у неё свой код урона.
  for (const animal of world.animals || []) {
    if (!animal.alive) continue;
    if (
      inMeleeCone(
        player.x,
        player.y,
        player.dirX,
        player.dirY,
        animal.x,
        animal.y,
        1.95,
        0.4
      )
    ) {
      const dist = Math.hypot(animal.x - player.x, animal.y - player.y);
      if (dist < bestDist) {
        bestDist = dist;
        target = animal;
        targetIsAnimal = true;
      }
    }
  }

  if (!target) {
    alertNoise(player.x, player.y, 7);
    return;
  }

  const dmg = damageRoll(12 + run.upgrades.sword * 5, rng);

  if (targetIsAnimal) {
    ui.flashHit();
    audio.hit();
    const result = animalOnHit(target, dmg);
    if (result.killed) {
      killAnimal(result.animal, result.drops);
    } else {
      ui.message(`Вы ранили ${SPECIES_DEFS[target.kind].label.toLowerCase()} (-${dmg}).`);
      audio.beast?.(target.kind);
    }
    return;
  }

  target.hp -= dmg;
  if (target.asleep) target.asleep = false;
  ui.flashHit();
  // Стражник хрипит от попадания, обычные цели — просто удар.
  if (target.kind === "guard" || target.kind === "village_guard" || target.kind === "driver") {
    audio.guardHit();
  } else {
    audio.hit();
  }
  alertNoise(player.x, player.y, 9);

  if (target.hp <= 0) {
    killActor(target);
    return;
  }

  if (target.kind === "guard") {
    target.state = "chase";
    target.suspicion = 1.2;
    target.alerted = true;
    target.lostTimer = 0;
    game.onGuardAlert?.(target);
  } else if (target.kind === "driver") {
    target.state = "flee";
    target.suspicion = 1;
  } else if (target.kind === "village_guard") {
    target.state = "chase";
    target.suspicion = 1.2;
    target.lostTimer = 0;
    run.wanted = Math.min(5, run.wanted + 1);
  }

  const label = target.kind === "driver" ? "возницу" : "стражника";
  ui.message(`Вы ранили ${label} (-${dmg}).`);
}

// Убийство животного: добыча в инвентарь, розыск НЕ начисляется.
function killAnimal(animal, drops) {
  const def = SPECIES_DEFS[animal.kind];
  let taken = 0;

  for (const drop of drops) {
    if (addItem(run.inventory, drop)) taken++;
  }

  const value = drops.reduce((sum, d) => sum + d.value, 0);
  ui.message(
    taken > 0
      ? `Вы убили ${def.label.toLowerCase()}. Добыча: ${drops.map((d) => d.name).join(", ")} (${value} зм.).`
      : `Вы убили ${def.label.toLowerCase()}, но добыча не поместилась.`
  );
  audio.coin();
}

function alertNoise(x, y, radius) {
  for (const actor of world.actors) {
    if (!actor.alive) continue;
    if (actor.kind !== "guard" && actor.kind !== "driver") continue;
    const dist = Math.hypot(actor.x - x, actor.y - y);
    if (dist <= radius) {
      if (actor.kind === "driver") {
        actor.state = "flee";
        actor.suspicion = 1;
      } else if (actor.state !== "chase") {
        actor.state = "chase";
        actor.suspicion = 1.2;
        actor.alerted = true;
        actor.lostTimer = 0;
        actor.asleep = false;
      }
    }
  }
}

function killActor(actor) {
  actor.alive = false;
  actor.hp = 0;
  actor.state = "dead";

  const tuning = tuningFor(run.style, run.tier + 1);
  const drop = Math.round((6 + run.tier * 3 + Math.floor(rng() * 6)) * tuning.killDrop);
  run.gold += drop;
  run.wanted = Math.min(5, run.wanted + 1);
  run.counters.kills += 1;
  run.counters.killsSinceAccept += 1;
  if (actor.kind === "driver") run.counters.driverKilledSinceAccept = true;
  noteStyle("kill");
  audio.guardDeath();
  audio.coin();

  const label =
    actor.kind === "driver"
      ? "возницу"
      : actor.kind === "village_guard"
        ? "городского стражника"
        : "стражника";
  ui.message(`Вы убили ${label}. Добыча: ${drop} зм. Розыск +1.`);
  evaluateContract();
  checkActProgress();
}

function damagePlayer(amount, source) {
  if (player.dead || game.gameOver) return;
  // Режим разработчика: урон не проходит.
  if (game.godMode) return;

  let raw = damageRoll(amount, rng);

  // Блок гасит урон только спереди и тратит выносливость.
  if (player.blocking && source && Number.isFinite(source.x)) {
    const dot = blockFacingDot(player.x, player.y, player.dirX, player.dirY, source.x, source.y);
    const result = blockAbsorb(raw, player.stamina, dot);
    if (result.blocked) {
      player.stamina = result.stamina;
      raw = result.damage;
      if (result.broke) {
        player.blockBroke = 0.5;
        ui.message("Блок пробит — выносливость на нуле!");
        audio.hit();
      } else {
        audio.block();
      }
    }
  }

  const dmg = applyArmor(raw, run.upgrades.armor);
  // Запас бодрости принимает удар первым, здоровье — остатком.
  const absorbed = absorbWithOverheal(dmg, player.health, player.overheal);
  player.health = absorbed.health;
  player.overheal = absorbed.overheal;
  player.hurtFlash = 1;
  if (!player.blocking) audio.hurt();
  noteStyle("damage_taken");

  const label =
    source?.kind === "village_guard"
      ? "Городской стражник"
      : source?.kind === "driver"
        ? "Возница"
        : "Стражник";
  ui.message(`${label} ранил вас (-${dmg}).`);

  if (player.health <= 0) die();
}

// Мягкая смерть: откат на чекпоинт, минус 20% золота и вся переносимая добыча.
// Репутация, разблокировки и статистика не страдают.
function die() {
  player.dead = true;
  input.exitLock();
  ui.closeTrade();
  ui.closeLoot();
  ui.hideHelp();
  game.uiOpen = false;
  game.stealing = false;
  game.stealProgress = 0;
  ui.setPrompt(null);
  ui.setProgress(null);
  audio.death();

  profile = { ...profile, stats: { ...profile.stats, deaths: (profile.stats.deaths || 0) + 1 } };

  // Берём последний чекпоинт и применяем штраф уже к нему,
  // иначе перезагрузка вернула бы потерянное золото.
  const checkpoint = readSave();
  const loaded = restoreRun(checkpoint.run, profile, bonuses());

  if (!loaded) {
    newRun();
    player.dead = false;
    player.health = player.maxHealth;
    game.paused = true;
    ui.showEnd("Вы очнулись у Мардо", "Забег был слишком коротким — начинаем заново. Репутация цела.", true);
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
  run = penalty.run;
  refreshContracts();

  rng = createRng(run.seed);
  rng.restore(run.rngState);
  spawnCamp(world, run.tier, tuningFor(run.style, run.tier + 1));
  syncRunToWorld();

  if (playerPositionValid(world, run.player)) {
    player.x = run.player.x;
    player.y = run.player.y;
    player.setAngle(run.player.angle || 0);
    player.overheal = Math.max(0, Math.min(OVERHEAL_CAP, run.player.overheal || 0));
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
  run.wanted = 0;
  saveCheckpoint(CHECKPOINT_REASONS.DEATH);

  const contractNote = failedContract ? ` Заказ «${contractName(failedContract.type)}» провален.` : "";
  ui.showEnd(
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
  run.bleed = applyBleed(run.bleed, bite.bleed);
  audio.hurt();
  ui.message(`Лиса укусила вас (-${dmg}). Рана кровоточит.`);

  if (player.health <= 0) die();
}

// Кровотечение тикает независимо от боя.
function tickBleed(dt) {
  if (!run.bleed || run.bleed.remaining <= 0) return;
  if (game.godMode) {
    run.bleed = { remaining: 0, dps: 0 };
    return;
  }

  const result = bleedTick(run.bleed, dt);
  run.bleed = result.bleed;
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
    ui.message("Вас заметили!");
    audio.alert();
  }
  if (run && run.activeContract && !run.counters.chaseSinceAccept) {
    run.counters.chaseSinceAccept = true;
    evaluateContract();
  }
};

function objectiveText() {
  if (!run) return "";
  const act = actOf(run);
  let line;
  if (run.activeContract) {
    line = `Заказ: ${contractName(run.activeContract.type)}`;
  } else if (!run.wagonLooted) {
    line = "Ограбьте караван на северной стоянке";
  } else if (run.inventory.items.length > 0) {
    line = "Продайте добычу Мардо в деревне";
  } else if (run.pendingCaravan) {
    line = `Новый караван через ${Math.max(1, Math.ceil(run.caravanTimer))} с`;
  } else {
    line = "Возвращайтесь к Мардо за новым заказом";
  }
  return `${act.label} · ${line}\nЦель: ${act.goal} зм. · продано на ${run.totalSold} зм.`;
}

// Живность: блуждание, побег, укусы. Животные не сохраняются — пересоздаются с караваном.
function updateWildlife(dt) {
  for (const animal of world.animals || []) {
    if (!animal.alive) continue;
    const result = stepAnimal(animal, player, dt);
    if (result.bite) applyBite(result.bite);
  }
}

// Гражданские: лёгкое блуждание по маршруту. Никакой агрессии.
function updateCivilians(dt) {
  for (const person of world.civilians || []) {
    stepCivilian(person, dt);
  }
}

// Титан: медленный, но неотступный. Ест всех, кроме Мардо и куртизанок.
function updateTitan(dt) {
  const titan = world.titan;
  if (!titan) return;

  const prey = gatherPrey(world, player);
  const result = stepTitan(titan, prey, dt);
  world.titan = result.titan;

  if (result.ate && result.victim) {
    if (result.victim.isPlayer) {
      titanDeath();
      return;
    }
    // NPC просто исчезает: он его съел.
    result.victim.alive = false;
    if (result.victim.kind) {
      ui.message(`Титан съел ${result.victim.label || result.victim.kind}.`);
    }
  }
}

function updateGame(dt) {
  game.time += dt;
  run.dayTime = (run.dayTime + dt) % 240;

  // Лайтмап пересобирается по фазе суток: ночью остаются только огни.
  const phase = phaseOf(run.dayTime);
  game.lightmap = buildLightmap(world, AMBIENT[phase] ?? 1, game.time);
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

  let near = nearestInteraction(world, player);
  const wagonNear = near && near.type === "wagon";

  if (wagonNear && input.isDown("KeyE") && !game.stealing) {
    game.stealing = true;
    game.stealProgress = 0;
    audio.steal();
  }

  if (game.stealing) {
    if (!input.isDown("KeyE") || !wagonNear) {
      game.stealing = false;
      game.stealProgress = 0;
    } else {
      game.stealProgress += dt / stealTime(run.upgrades.lockpick);
      if (game.stealProgress >= 1) startLoot(Boolean(near.second));
    }
  }

  if (!game.stealing) {
    // Множитель скорости и noclip — только для режима разработчика.
    run.speedMultiplier = game.speedMultiplier;
    player.noclip = game.noclip;
    player.update(world, input, dt, run, audio);
  }

  // Приземление после прыжка слышно: стража просыпается от топота.
  if (player.landedThisFrame) {
    player.landedThisFrame = false;
    game.noiseTimer = Math.max(game.noiseTimer, 0.35);
  }

  const aiContext = {
    world,
    player,
    wanted: run.wanted,
    noiseLevel: game.noiseLevel,
    dayTime: run.dayTime,
    damagePlayer,
    onGuardAlert: game.onGuardAlert,
  };
  updateActors(aiContext, dt);

  const susp = maxSuspicion(world);
  game.suspicion = susp.value;
  game.chasing = susp.chasing;

  near = nearestInteraction(world, player);
  if (game.stealing) {
    ui.setPrompt("Обыскиваете фургон… не дайте страже заметить вас");
    ui.setProgress(game.stealProgress);
  } else if (near && near.type === "wagon") {
    ui.setPrompt(near.label);
    ui.setProgress(null);
  } else if (near && near.type === "merchant") {
    ui.setPrompt(near.label);
    ui.setProgress(null);
  } else {
    ui.setPrompt(null);
    ui.setProgress(null);
  }

  if (run.pendingCaravan) {
    run.caravanTimer -= dt;
    if (run.caravanTimer <= 0) {
      const distToWagon = Math.hypot(player.x - world.wagon.x, player.y - world.wagon.y);
      if (distToWagon < 13) {
        run.caravanTimer = 3;
      } else {
        run.tier += 1;
        spawnCamp(world, run.tier, tuningFor(run.style, run.tier + 1));
        run.archetype = world.archetype;
        respawnWildlifeAndCourtesan();
        run.wagonLooted = false;
        run.secondWagonLooted = false;
        run.pendingCaravan = false;
        run.lootSoldForTier = false;
        ui.message(`На северной дороге замечен новый караван — ${world.layout.label.toLowerCase()}.`);
        saveCheckpoint(CHECKPOINT_REASONS.NEW_CARAVAN);
      }
    }
  }

  evaluateContract();
}

function uiState() {
  const phase = phaseOf(run ? run.dayTime : 0);
  return {
    player,
    gold: run ? run.gold : 0,
    reputation: profile.reputation || 0,
    wanted: run ? run.wanted : 0,
    bleed: run ? run.bleed : { remaining: 0, dps: 0 },
    weatherLabel: isWet(game.weather) ? weatherLabel(game.weather) : "",
    wet: isWet(game.weather),
    inventory: run ? run.inventory : { capacity: 0, items: [] },
    upgrades: run ? run.upgrades : {},
    profile,
    activeContract: run ? run.activeContract : null,
    contractOffer: run ? run.contractOffer : [],
    contractTimeLeft: game.contractTimeLeft,
    noiseLevel: game.noiseLevel,
    phase,
    styleKey: run ? styleKey() : "neutral",
    archetype: run ? run.archetype : "road_camp",
    suppressFame: false,
  };
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  if (run && canControl()) {
    updateGame(dt);
  } else if (run) {
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
    light: run ? phaseOf(run.dayTime) : "day",
    lightmap: game.lightmap,
    weather: game.weather,
    suspicionSource: (actor) => (actor.asleep ? 0 : actor.suspicion),
    showSuspicion: game.started && !game.gameOver,
  });

  if (run) {
    ui.update(uiState());
    ui.setObjective(objectiveText());
    // Дождь звучит только когда он есть и игра не на паузе.
    audio.rain(Boolean(game.weather && game.weather.raining) && game.started && !game.paused, game.weather ? game.weather.intensity : 0);
  }
  requestAnimationFrame(frame);
}

// ── Запуск ──────────────────────────────────────────────────────────

// Целочисленный масштаб: при нецелом множителе pixelated-канвас «мылит».
// Внутри остаётся 640×360, на экране — кратное увеличение, поля по краям.
function applyCanvasScale() {
  const scale = Math.max(
    1,
    Math.floor(Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height))
  );
  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;
}

applyCanvasScale();
window.addEventListener("resize", applyCanvasScale);

const debugEnabled = new URLSearchParams(window.location.search).has("debug");
const startHasSave = hasSave();
ui.showStart(startHasSave);

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
      return run;
    },
    get profile() {
      return profile;
    },
    ui,
    input,
    player,
    world,
    renderer,
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
