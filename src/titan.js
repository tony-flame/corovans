// Титан: один на карту, медленный, неотступный, неубиваемый.
// Чистый модуль — без DOM. Вопросы и поедание проверяются тестами.
//
// Правило мира: он ест всех, кроме Мардо и куртизанок.
// Иначе съест скупщика и забег станет непроходимым.

import { createRng, hashSeed } from "./rng.js";

export const TITAN_SPEED = 0.9;
export const TITAN_EAT_RANGE = 1.2;
export const TITAN_EAT_TIME = 1.6;
export const TITAN_SCALE = 2.4;
// Радиус, в котором титан вообще замечает добычу. Без него он шёл
// к ближайшей жертве через всю карту и вычищал население подчистую.
export const TITAN_AGGRO_RANGE = 16;
// Сколько он стоит, обнюхивая пустое место, прежде чем пойти дальше.
export const TITAN_ROAM_TIME = 2.4;

// Кого он НЕ трогает. Роли, без которых игра не работает.
const IMMUNE_KINDS = new Set(["merchant", "courtesan", "titan"]);

export const TITAN_QUESTIONS = [
  {
    id: "road",
    text: "Ты идёшь по дороге и несёшь чужое. Зачем?",
    answers: [
      { text: "Чтобы стать богатым.", correct: false },
      { text: "Потому что могу.", correct: false },
      { text: "Потому что боюсь остаться ни с чем.", correct: true },
    ],
    hint: "Он ждёт не оправдания, а признания.",
  },
  {
    id: "killed",
    text: "Ты убивал. Что ты почувствовал потом?",
    answers: [
      { text: "Ничего. Они были не важны.", correct: false },
      { text: "Облегчение, что выжил я.", correct: true },
      { text: "Гордость. Я стал сильнее.", correct: false },
    ],
    hint: "Он знает разницу между честностью и бравадой.",
  },
  {
    id: "end",
    text: "Когда всё кончится, что останется от тебя?",
    answers: [
      { text: "Моё имя.", correct: false },
      { text: "Моё золото.", correct: false },
      { text: "Ничего. И это честно.", correct: true },
    ],
    hint: "Он прожил слишком долго, чтобы верить в имена.",
  },
];

export function titanSeed(runSeed) {
  return hashSeed(`${runSeed}:titan`);
}

export function createTitan(runSeed, x, y) {
  const seed = titanSeed(runSeed);
  const rng = createRng(seed);

  return {
    id: seed,
    kind: "titan",
    x,
    y,
    homeX: x,
    homeY: y,
    r: 0.9,
    speed: TITAN_SPEED,
    state: "roam", // roam | hunt | eat | pacified
    target: null,
    eatTimer: 0,
    roamTimer: 0,
    angle: rng() * Math.PI * 2,
    // Спрайт переключается по состоянию, а не пересобирается в кадре.
    spriteKey: "titan_calm",
    alive: true,
    // Неубиваемость: hp есть только чтобы тесты могли проверить,
    // что урон по нему не действует.
    hp: Infinity,
    maxHp: Infinity,
    steps: 0,
    seed,
  };
}

// Цель: ближайший, кого можно съесть. Мардо и куртизанки неприкосновенны.
// maxRange ограничивает интерес: за его пределами титан бродит, а не
// мчится через полкарты к одинокому крестьянину.
export function pickTarget(titan, candidates, maxRange = TITAN_AGGRO_RANGE) {
  let best = null;
  let bestDist = Infinity;

  for (const c of candidates || []) {
    if (!c || !c.alive) continue;
    if (IMMUNE_KINDS.has(c.kind)) continue;

    const d = Math.hypot(c.x - titan.x, c.y - titan.y);
    if (d > maxRange) continue;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }

  return best ? { target: best, dist: bestDist } : { target: null, dist: Infinity };
}

// Один шаг. Возвращает { titan, ate, victim } — ate=true, если кого-то съел.
// moveActor — из world.js: без него титан шёл к цели по прямой сквозь стены.
export function stepTitan(titan, candidates, dt, moveActor = null, world = null) {
  if (!titan || !titan.alive) return { titan, ate: false, victim: null };

  // Договор: он больше не охотится.
  if (titan.state === "pacified") {
    titan.target = null;
    titan.spriteKey = "titan_calm";
    return { titan, ate: false, victim: null };
  }

  titan.steps += 1;

  // Если цель мертва, исчезла или ушла за радиус интереса — ищем новую.
  if (titan.target && titan.target.alive) {
    const td = Math.hypot(titan.target.x - titan.x, titan.target.y - titan.y);
    if (td > TITAN_AGGRO_RANGE * 1.4) titan.target = null;
  } else {
    titan.target = null;
  }

  if (!titan.target) {
    // Пауза перед новым поиском: он не должен перескакивать с жертвы
    // на жертву в том же кадре. Но первую цель берём сразу — иначе
    // титан простоит первые секунды, уставившись в пустоту.
    titan.roamTimer = (titan.roamTimer || 0) + dt;
    if (titan.roamTimer >= TITAN_ROAM_TIME || titan.steps <= 1) {
      titan.roamTimer = 0;
      const picked = pickTarget(titan, candidates);
      titan.target = picked.target;
    }
  }

  if (!titan.target) {
    titan.state = "roam";
    titan.spriteKey = "titan_calm";
    return { titan, ate: false, victim: null };
  }

  const dx = titan.target.x - titan.x;
  const dy = titan.target.y - titan.y;
  const dist = Math.hypot(dx, dy);

  if (dist > TITAN_EAT_RANGE) {
    titan.state = "hunt";
    titan.spriteKey = "titan_hunt";
    titan.angle = Math.atan2(dy, dx);
    // Он не быстрый, но идёт всегда: убежать можно, скрыться нельзя.
    // Стены его останавливают — иначе углы ничего не значили.
    const stepX = (dx / dist) * titan.speed * dt;
    const stepY = (dy / dist) * titan.speed * dt;
    if (moveActor && world) {
      moveActor(world, titan, stepX, stepY);
    } else {
      titan.x += stepX;
      titan.y += stepY;
    }
    titan.eatTimer = 0;
    return { titan, ate: false, victim: null };
  }

  // В упор: жуёт.
  titan.state = "eat";
  titan.spriteKey = "titan_hunt";
  titan.eatTimer += dt;

  if (titan.eatTimer >= TITAN_EAT_TIME) {
    const victim = titan.target;
    titan.eatTimer = 0;
    titan.target = null;
    titan.state = "roam";
    titan.spriteKey = "titan_calm";
    return { titan, ate: true, victim };
  }

  return { titan, ate: false, victim: null };
}

// Все кандидаты на съедение: актёры, животные, игрок.
export function gatherPrey(world, player) {
  const list = [];

  for (const actor of world.actors || []) {
    if (!actor.alive) continue;
    if (IMMUNE_KINDS.has(actor.kind)) continue;
    list.push(actor);
  }

  for (const animal of world.animals || []) {
    if (!animal.alive) continue;
    list.push(animal);
  }

  for (const person of world.civilians || []) {
    if (!person.alive) continue;
    list.push(person);
  }

  if (player && !player.dead) {
    list.push({ kind: "player", x: player.x, y: player.y, alive: true, isPlayer: true });
  }

  return list;
}

// ── Диалог ──────────────────────────────────────────────────────────

// Вопросы в детерминированном порядке от сида.
export function titanQuestions(runSeed) {
  const rng = createRng(hashSeed(`${runSeed}:titan:questions`));
  const pool = [...TITAN_QUESTIONS];
  // Перемешивание без Math.random, чтобы порядок был стабилен.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export function checkAnswer(question, index) {
  if (!question || !Array.isArray(question.answers)) return false;
  const answer = question.answers[index];
  return Boolean(answer && answer.correct);
}

// Реакция на ответ: титан комментирует, но не подсказывает.
export function titanReaction(question, correct) {
  if (correct) return "Он медленно кивает.";
  return "Он перестаёт жевать и смотрит прямо на тебя.";
}

export const TITAN_FAIL_LINE =
  "Он открывает рот шире, чем должно быть возможно. Ты не успеваешь даже закричать.";
export const TITAN_PASS_LINE =
  "Он смотрит на тебя долго, потом отворачивается. Ты прошёл. Он больше не тронет тебя.";
