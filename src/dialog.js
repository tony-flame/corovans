// Диалоги: деревья реплик для гражданских и куртизанок. Чистый модуль.
//
// Почему отдельный файл, а не строки в civilian.js: дерево — это данные,
// а не код. Узел знает только свои реплики и переходы, а золото, репутацию
// и подсказки применяет вызывающий код. Так диалоги тестируются в Node
// без DOM, и любая ветка проверяется отдельно.
//
// Формат узла:
//   {
//     text: "что говорит NPC",
//     options: [
//       { id, label, next, cost?, once?, end?, effect? }
//     ]
//   }
//
// cost — сколько золота стоит выбор. Если не хватает, вариант показывается
// серым и не нажимается: игрок должен видеть цену, а не гадать.
// effect — что случится при выборе: применяет main.js, модуль только сообщает.

import { createRng, hashSeed } from "./rng.js";
import {
  makeQuest,
  canTakeQuest,
  questProgressText,
  QUEST_GIVERS,
} from "./quests.js";

// ── Задания в диалоге ───────────────────────────────────────────────
// Из ветки «А что я могу сделать?» житель выдаёт задание, если у него
// есть, и игрок ещё не занят. Отдельная тема, а не автовыдача при
// входе: иначе разговор превращается в раздачу заданий без выбора.

const QUEST_OFFER_LABEL = "А что я могу сделать?";
const QUEST_DONE_LABEL = "Я всё сделал.";

function questBranch(ctx, rng) {
  const quest = ctx.quest && ctx.quest.active;
  if (quest && quest.giverId === ctx.npcId) {
    const done = quest.state === "complete";
    return {
      text: done
        ? "«Сделал?.. Надо же. Не каждый день дожидаюсь.»"
        : `«Ты ещё не закончил. ${questProgressText(quest, questSnapshotOf(ctx))}.»`,
      options: done
        ? [
            { id: "claim", label: QUEST_DONE_LABEL, next: "claimed", effect: { claimQuest: true } },
            { id: "back", label: "Сначала поговорим.", next: "root" },
            { id: "bye", label: "Уйти", end: true },
          ]
        : [
            { id: "back", label: "Я помню.", next: "root" },
            { id: "bye", label: "Уйти", end: true },
          ],
    };
  }

  if (!canTakeQuest(quest)) {
    return {
      text: "«Ты уже в чём-то занят. Сначала разберись с тем, а потом приходи.»",
      options: [
        { id: "back", label: "Ладно.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    };
  }

  const offered = makeQuest(
    ctx.runSeed ?? ctx.seed,
    { id: ctx.npcId, kind: ctx.npcKind, label: ctx.npcLabel },
    0
  );
  if (!offered) {
    return {
      text: "«Мне-то? Ничего. Справляюсь сам. Ты иди, у тебя дорога.»",
      options: [
        { id: "back", label: "Как скажешь.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    };
  }

  return {
    text: `«${offered.description}.»\n\nЗа это просят немного, но и людей здесь мало.`,
    options: [
      { id: "accept", label: "Согласен.", next: "accepted", effect: { takeQuest: true } },
      { id: "back", label: "Не сейчас.", next: "root" },
      { id: "bye", label: "Уйти", end: true },
    ],
  };
}

function questSnapshotOf(ctx) {
  return {
    beastsSince: (ctx.quest && ctx.quest.beasts) || {},
    items: [],
    visited: (ctx.quest && ctx.quest.visited) || {},
    askedPeople: (ctx.quest && ctx.quest.askedPeople) || [],
  };
}

const ROAD_TALK = [
  "«Тракт на восток. Днём ещё терпимо, к ночи лучше не выходить.»",
  "«Дорога одна, а людей на ней всё меньше. Считай сам.»",
  "«Караванщики ездят по ней и не здороваются. Мы для них — пейзаж.»",
];

const CARAVAN_TALK = [
  "«Стоят на северной стоянке. Фургон, кони, охрана. Всё как всегда.»",
  "«Караван пришёл ночью. Утром уже стоял, будто вырос из земли.»",
  "«Охраны у них больше, чем товара. Это о чём-то говорит.»",
];

const TITAN_TALK = [
  "«Оно ходит по дороге и спрашивает. Не отвечай невпопад.»",
  "«Я видел его раз. Больше не хочу. Оно не спешит — и это хуже всего.»",
  "«Говорят, оно уходит, если ответить правильно. Говорят.»",
];

const VILLAGE_TALK = [
  "«Деревня держится на колодце и на упрямстве. Колодец чинили.»",
  "«Раньше тут была ярмарка. Теперь — рынок и три торговца.»",
  "«Молодые ушли на тракт. Вернулись не все, а кто вернулся — молчит.»",
];

function pick(list, rng) {
  return list[Math.floor(rng() * list.length) % list.length];
}

// ── Общие ветки ─────────────────────────────────────────────────────
// Одни и те же темы встречаются у половины деревни, поэтому тексты
// вынесены сюда: дублировать по девять раз — гарантированно разъехаться.

// ── Гражданские ─────────────────────────────────────────────────────
// У каждого свой корень и свои темы. Общие темы подмешиваются,
// но не заменяют характер: пьяница и священник не говорят одинаково.

const CIVILIAN_TREES = {
  peasant_w: (ctx, rng) => ({
    root: {
      text:
        "Она вытирает руки о передник и смотрит на вас без всякого интереса.",
      options: [
        { id: "road", label: "Что на дороге?", next: "road" },
        { id: "village", label: "Как живётся в деревне?", next: "village" },
        { id: "titan", label: "Про титана слышали?", next: "titan" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    road: {
      text: pick(ROAD_TALK, rng),
      options: [
        { id: "caravan", label: "А караван?", next: "caravan" },
        { id: "back", label: "Спасибо.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    caravan: {
      text:
        pick(CARAVAN_TALK, rng) +
        "\n\n«Мой муж туда не ходит. И тебе не советую — но ты не послушаешь.»",
      options: [
        { id: "back", label: "Ясно.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    village: {
      text: pick(VILLAGE_TALK, rng),
      options: [
        { id: "road", label: "А дорога?", next: "road" },
        { id: "back", label: "Понятно.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    titan: {
      text: pick(TITAN_TALK, rng),
      options: [
        { id: "back", label: "Не буду больше спрашивать.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
  }),

  peasant_m: (ctx, rng) => ({
    root: {
      text: "Он не откладывает вилы — просто ждёт, когда вы уйдёте.",
      options: [
        { id: "work", label: "Что за работа?", next: "work" },
        { id: "road", label: "Что на тракте?", next: "road" },
        { id: "bye", label: "Не буду мешать.", end: true },
      ],
    },
    work: {
      text:
        "«Поле. Каждый год одно и то же поле. Кто-то должен, пока другие " +
        "ходят с мечом и рассказывают, какие они страшные.»",
      options: [
        { id: "caravan", label: "Караван видел?", next: "caravan" },
        { id: "back", label: "Тогда не мешаю.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    road: {
      text: pick(ROAD_TALK, rng) + "\n\n«Стража на тракте злая. Не дай им повода.»",
      options: [
        { id: "caravan", label: "А караван?", next: "caravan" },
        { id: "back", label: "Учту.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    caravan: {
      text: pick(CARAVAN_TALK, rng),
      options: [
        { id: "back", label: "Ясно.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
  }),

  greengrocer: (ctx) => ({
    root: {
      text:
        `Она оглядывает ваш кошель: ${ctx.gold} золотых. Видела и меньше.`,
      options: [
        { id: "buy", label: "Купить хлеба (3 зм.)", next: "bought", cost: 3, once: true, effect: { food: true } },
        { id: "prices", label: "Почему так дорого?", next: "prices" },
        { id: "mardo", label: "А Мардо?", next: "mardo" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    bought: {
      text:
        "«Держи. Не размокнет, если не будешь носить под дождём.»\n\n" +
        "Она заворачивает хлеб в тряпицу и уже смотрит на следующего.",
      options: [
        { id: "back", label: "Спасибо.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    prices: {
      text:
        "«Дорого? Дорого — это когда везут через лес и половину не довозят. " +
        "Вот это дорого. А моё — дёшево, потому что я тут стою и никуда не еду.»",
      options: [
        { id: "buy", label: "Хлеба (3 зм.)", next: "bought", cost: 3, once: true, effect: { food: true } },
        { id: "back", label: "Логично.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    mardo: {
      text:
        "«Мардо торгует тем, что принесли. Я — тем, что вырастила. " +
        "Разница в том, что за моё он бы взял вдвое.»",
      options: [
        { id: "back", label: "Понял.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
  }),

  drunk: (ctx, rng) => ({
    root: {
      text: "Он покачивается, но взгляд у него трезвее, чем хотелось бы.",
      options: [
        { id: "pay", label: "Держи монету (1 зм.)", next: "rumor", cost: 1, once: true },
        { id: "who", label: "Ты кто вообще?", next: "who" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    rumor: {
      text:
        pick(
          [
            "«Охрана в караване спит по очереди. Плохо спит, но спит. " +
              "Один вообще храпит так, что за три дома слышно.»",
            "«Титан обходит стоянку стороной. Почему-то. Может, фургон ему " +
              "не по вкусу, может — они договорились. Я бы не удивился.»",
            "«Мардо платит больше за то, что взято без крови. Не из доброты. " +
              "Из расчёта: мёртвые не жалуются, но и не возвращаются.»",
          ],
          rng
        ),
      options: [
        { id: "back", label: "Полезно.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    who: {
      text:
        "«Тридцать лет назад я был кем-то. Теперь я тот, кому подают. " +
        "Разница — в трёх монетах и одном удачном году.»",
      options: [
        { id: "pay", label: "Держи монету (1 зм.)", next: "rumor", cost: 1, once: true },
        { id: "back", label: "Бывает.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
  }),

  beggar: (ctx) => ({
    root: {
      text: "Он не тянет руку — просто стоит и ждёт. Это хуже.",
      options: [
        { id: "give", label: "Подать монету (1 зм.)", next: "given", cost: 1, once: true, effect: { rep: 1 } },
        { id: "know", label: "Что знаешь за так?", next: "know" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    given: {
      text:
        "«Вот. Уже лучше, чем вчера.»\n\n" +
        "Он прячет монету так быстро, будто её у него уже отнимали.",
      options: [
        { id: "know", label: "А теперь что знаешь?", next: "know" },
        { id: "back", label: "Не за что.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    know: {
      text:
        "«Нищий видит всё, потому что на него не смотрят. У каравана " +
        "сменяются часовые каждые пару минут — и один всегда зевает.»",
      options: [
        { id: "back", label: "Запомню.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
  }),

  traveler: (ctx, rng) => ({
    root: {
      text: "Он ставит сумку на землю — значит, готов говорить.",
      options: [
        { id: "east", label: "Откуда идёшь?", next: "east" },
        { id: "titan", label: "Титана встречал?", next: "titan" },
        { id: "north", label: "Куда лучше не соваться?", next: "north" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    east: {
      text:
        pick(
          [
            "«С востока. Там города побольше и врут поизящнее. Здесь хотя бы честно бьют.»",
            "«С востока, и не спрашивай, что там. Не поверишь, а если поверишь — " +
              "не заснёшь.»",
          ],
          rng
        ),
      options: [
        { id: "north", label: "А на север?", next: "north" },
        { id: "back", label: "Понятно.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    titan: {
      text: pick(TITAN_TALK, rng) + "\n\n«Оно спрашивает. Отвечай коротко и не спорь.»",
      options: [
        { id: "back", label: "Запомню.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    north: {
      text:
        "«На север — караван. Не ходи туда без причины и уж точно не " +
        "в одиночку ночью. Хотя ты, судя по лицу, всё равно пойдёшь.»",
      options: [
        { id: "east", label: "А ты сам туда ходил?", next: "east" },
        { id: "back", label: "Спасибо.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
  }),

  priest: (ctx) => ({
    root: {
      text: "Он не поднимает головы от книги.",
      options: [
        { id: "bless", label: "Благослови меня (5 зм.)", next: "blessed", cost: 5, once: true, effect: { bless: true } },
        { id: "titan", label: "Что это за титан?", next: "titan" },
        { id: "absolve", label: "Отпущение грехов есть?", next: "absolve" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    blessed: {
      text:
        "«Иди. И постарайся, чтобы меч тебе не понадобился в этот же день.»\n\n" +
        "Он касается вашего плеча сухими пальцами. Стало легче — или показалось.",
      options: [
        { id: "titan", label: "А титан — он тоже творение?", next: "titan" },
        { id: "back", label: "Спасибо, отче.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    titan: {
      text:
        "«Собор стоит дольше, чем вся эта деревня, и в хрониках он появляется " +
        "раньше, чем деревня. Там о нём три строки. В них сказано: " +
        "«не убивается». Не «трудно убить». Не убивается.»",
      options: [
        { id: "absolve", label: "И что делать?", next: "absolve" },
        { id: "back", label: "Мрачно.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    absolve: {
      text:
        "«Отпущение стоит дешевле, чем ты думаешь. Но и оно не бесплатно. " +
        "И оно не отменяет стражу — это уже к ним.»",
      options: [
        { id: "bless", label: "Тогда благослови (5 зм.)", next: "blessed", cost: 5, once: true, effect: { bless: true } },
        { id: "back", label: "Ясно.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
  }),

  market_trader: (ctx) => ({
    root: {
      text: "Он перекладывает какие-то тряпки туда-обратно. Просто чтобы руки были заняты.",
      options: [
        { id: "trade", label: "Что продаёшь?", next: "trade" },
        { id: "mardo", label: "С Мардо воюешь?", next: "mardo" },
        { id: "haggle", label: "А сторговаться?", next: "haggle" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    trade: {
      text:
        "«Всё, что не прибито. И кое-что прибитое — оторву за отдельную плату.»\n\n" +
        "«Нормально торгую только с теми, кто не тычет мечом в прилавок.»",
      options: [
        { id: "mardo", label: "А Мардо?", next: "mardo" },
        { id: "back", label: "Понял.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    mardo: {
      text:
        "«Мы не воюем. Мы просто не мешаем друг другу. Он берёт краденое, " +
        "я — всё остальное. Рынок держится на том, что все врут одинаково.»",
      options: [
        { id: "haggle", label: "А со мной сторгуешься?", next: "haggle" },
        { id: "back", label: "Честно.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    haggle: {
      text:
        "«Со мной? Всегда. Но не сегодня — сегодня я добрый, а добрым " +
        "торговать невыгодно.»\n\n" +
        "Он подмигивает. Кажется, он просто издевается.",
      options: [
        { id: "back", label: "Как скажешь.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
  }),

  throne_guard: (ctx) => ({
    root: {
      text: ctx.wanted > 0
        ? "«Тебя ищут. Я обязан тебя задержать, но мне лень. " +
          "Считай это моей добротой и уходи, пока я не передумал.»"
        : "Он не двигается, но вы точно знаете, что он может.",
      options: ctx.wanted > 0
        ? [
            { id: "leave", label: "Ухожу.", end: true },
            { id: "why", label: "За что меня ищут?", next: "why" },
          ]
        : [
            { id: "who", label: "Кто в ратуше?", next: "who" },
            { id: "titan", label: "Титан — ваша забота?", next: "titan" },
            { id: "bye", label: "Уйти", end: true },
          ],
    },
    why: {
      text:
        "«Не притворяйся. В деревне все всё видят, а стража делает вид, что " +
        "не видит. Пока им не заплатят за то, чтобы увидели.»",
      options: [{ id: "leave", label: "Понял.", end: true }],
    },
    who: {
      text:
        "«Совет. Трое, которых никто не выбирал, и один, который думает, " +
        "что он герцог. Дальше сам догадайся, почему здесь такая тишина.»",
      options: [
        { id: "titan", label: "А титан?", next: "titan" },
        { id: "back", label: "Ясно.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    titan: {
      text:
        "«Зубцы на башне — не для красоты. Но титана они не остановят, " +
        "и все это знают. Поэтому мы стоим здесь, а не там.»",
      options: [
        { id: "back", label: "Логично.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
  }),
};

// Падение на крестьянку: неизвестный вид всё равно должен говорить,
// а не открывать пустую панель.
const FALLBACK_TREE = CIVILIAN_TREES.peasant_w;

export function buildCivilianDialogue(kind, ctx) {
  const builder = CIVILIAN_TREES[kind] || FALLBACK_TREE;
  // Реплики зависят от визита: одно и то же дерево не должно
  // выдавать одну и ту же фразу каждый раз.
  const rng = createRng(hashSeed(`dialog:${kind}:${ctx.seed || 0}:${ctx.visits || 0}`));
  const tree = builder(ctx, rng);

  // Ветка задания добавляется в корень, а не заменяет его:
  // разговор о дороге никуда не девается, когда есть работа.
  const branch = questBranch({ ...ctx, npcKind: kind }, rng);
  tree.quest = branch;
  tree.accepted = {
    text: "«Вот и славно. Я знал, что ты согласишься — по лицу видно, что деваться некуда.»",
    options: [
      { id: "back", label: "К делу.", next: "root" },
      { id: "bye", label: "Уйти", end: true },
    ],
  };
  tree.claimed = {
    text: "«Держи. Не говорю, что много, но больше, чем у меня было.»",
    effect: { claimQuest: true },
    options: [
      { id: "back", label: "Спасибо.", next: "root" },
      { id: "bye", label: "Уйти", end: true },
    ],
  };

  const root = tree.root;
  if (root && Array.isArray(root.options)) {
    // Ставим предложение перед «уйти», чтобы «уйти» оставалось последним.
    const exitIndex = root.options.findIndex((o) => o.end);
    const option = { id: "quest", label: QUEST_OFFER_LABEL, next: "quest" };
    if (exitIndex === -1) root.options.push(option);
    else root.options.splice(exitIndex, 0, option);
  }

  return {
    kind,
    tree,
    nodeId: "root",
    spent: 0,
    used: {},       // одноразовые варианты: id → true
    history: [],
  };
}

// ── Куртизанка ──────────────────────────────────────────────────────
// Бесплатно — только болтовня. Факты о мире стоят денег: иначе
// «поговорить с ней» стало бы бесплатной разведкой и убило смысл
// платить за визит.
//
// Цены на факты низкие (4–6 зм.), но их несколько, и за один визит
// можно купить любой — выбор игрока, а не обязательный сбор.

const FACT_LABELS = {
  guards: "Сколько охраны у фургона?",
  sleep: "Кто-нибудь из них спит?",
  titan: "Почему титан не трогает караван?",
  mardo: "Как торговаться с Мардо?",
};

const COURTESAN_FACTS = {
  guards: {
    price: 5,
    text:
      "«Сколько их — не считала. Но считала, сколько раз за ночь меняется " +
      "часовой у фургона. Смена короткая, значит их много.»",
    effect: { intel: "guards" },
  },
  sleep: {
    price: 4,
    text:
      "«Один из них спит. Не просто дремлет — спит. Я слышала его из " +
      "сторожки. Если подойти тихо, он не проснётся.»",
    effect: { intel: "sleeper" },
  },
  titan: {
    price: 6,
    text:
      "«Титан не подходит к фургону. Никогда. Я думала — боится железа. " +
      "Потом поняла: ему не нужно. Он ждёт, когда вы сами придёте.»",
    effect: { intel: "titan" },
  },
  mardo: {
    price: 5,
    text:
      "«Мардо не взвешивает товар. Он смотрит на тебя и решает, сколько " +
      "ты готов отдать. Поэтому с ним не торгуются — с ним договариваются.»",
    effect: { intel: "mardo" },
  },
};

export const COURTESAN_FACT_ORDER = ["guards", "sleep", "titan", "mardo"];

// Реплики «просто поболтать»: бесплатные, но не пустые.
const CHATTER = {
  mocking: [
    "«Ты всё ещё здесь. Я начинаю думать, что тебе больше некуда идти.»",
    "«Дорога тебя не любит. Это видно по лицу.»",
  ],
  matron: [
    "«Сядь уже. Стоишь, как будто ждёшь, что я тебя прогоню.»",
    "«Все вы приходите за одним, а потом долго рассказываете про честь.»",
  ],
  dreamer: [
    "«Я иногда думаю: а если бы дорога кончилась? Что бы ты делал?»",
    "«У тебя пыль в волосах. Это не упрёк. Это просто правда.»",
  ],
  business: [
    "«Разговор — бесплатно. Всё остальное — по счёту.»",
    "«Время идёт. Твоё и моё. Оба стоят денег.»",
  ],
  cryptic: [
    "«Ты пришёл не за лечением. Но начнём с него, если хочешь.»",
    "«У всех на этой дороге что-то болит. У тебя — предсказуемо.»",
  ],
};

export function buildCourtesanDialogue(variant, ctx) {
  const rng = createRng(hashSeed(`courtesan-dialog:${variant.id}:${ctx.seed || 0}:${ctx.visits || 0}`));
  const temper = variant.temper || "mocking";
  const chatter = CHATTER[temper] || CHATTER.mocking;

  const factOptions = COURTESAN_FACT_ORDER.filter((id) => !(ctx.knownIntel || {})[id]).map((id) => {
    const fact = COURTESAN_FACTS[id];
    const label = FACT_LABELS[id];
    return {
      id: `fact_${id}`,
      label: `${label} (${fact.price} зм.)`,
      next: `fact_${id}`,
      cost: fact.price,
      once: true,
    };
  });

  const tree = {
    root: {
      text:
        `«Говорить будем или мимо шёл?» — она смотрит внимательно, ` +
        `будто прикидывает цену прежде чем цену назвать.`,
      options: [
        { id: "chat", label: "Просто поговорить", next: "chat" },
        { id: "facts", label: "Что знаешь о дороге?", next: "facts" },
        { id: "price", label: "Сколько стоит остаться?", next: "price" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    chat: {
      text: pick(chatter, rng),
      options: [
        { id: "chat2", label: "И что, всегда так?", next: "chat2", once: true },
        { id: "facts", label: "А про дорогу?", next: "facts" },
        { id: "back", label: "Ладно.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    chat2: {
      text:
        pick(
          [
            "«Всегда. Разница только в том, кто платит и кто потом вспоминает.»",
            "«Не всегда. Но сегодня — да. Не порти мне вечер.»",
            "«Спроси что-нибудь другое. Это я слышала от каждого второго.»",
          ],
          rng
        ),
      options: [
        { id: "facts", label: "Тогда про дорогу.", next: "facts" },
        { id: "back", label: "Понял.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    facts: {
      text:
        factOptions.length
          ? "«Слухи у меня не бесплатные. Но я не беру за то, чего не знаю.»"
          : "«Я уже рассказала всё, что знаю. Второй раз не продам — совесть.»",
      options: [
        ...factOptions,
        { id: "back", label: "Ладно, дорого.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
    price: {
      text:
        ctx.free
          ? `«С тебя — ничего. Я тебя помню, и это дороже монеты.»`
          : `«${variant.price} золотых. Раны залечу, сказки не рассказываю» — ` +
            `она говорит это без нажима, как называют погоду.`,
      options: [
        { id: "back", label: "Понял.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    },
  };

  // Узлы фактов создаются только для доступных: недоступный факт
  // не должен висеть в дереве, на него нельзя перейти.
  for (const id of COURTESAN_FACT_ORDER) {
    if ((ctx.knownIntel || {})[id]) continue;
    const fact = COURTESAN_FACTS[id];
    tree[`fact_${id}`] = {
      text: fact.text,
      effect: fact.effect,
      options: [
        { id: "more", label: "Ещё что-нибудь?", next: "facts" },
        { id: "back", label: "Достаточно.", next: "root" },
        { id: "bye", label: "Уйти", end: true },
      ],
    };
  }

  return { kind: "courtesan", tree, nodeId: "root", spent: 0, used: {}, history: [] };
}

// ── Машина состояний ────────────────────────────────────────────────

export function currentNode(state) {
  return state ? state.tree[state.nodeId] || null : null;
}

// Можно ли выбрать вариант: хватает золота и он ещё не потрачен.
export function optionAvailable(option, state, gold) {
  if (!option) return false;
  if (option.once && state.used[option.id]) return false;
  if (option.cost && gold < option.cost) return false;
  return true;
}

// Причина недоступности — для подписи «не хватает N зм.».
export function optionBlockReason(option, state, gold) {
  if (!option) return "";
  if (option.once && state.used[option.id]) return "уже спрашивали";
  if (option.cost && gold < option.cost) return `нужно ${option.cost} зм.`;
  return "";
}

// Выбор варианта. Возвращает новое состояние и эффекты — чисто,
// без побочных действий: золото списывает вызывающий код.
export function chooseOption(state, optionId, gold) {
  const node = currentNode(state);
  if (!node) return { state, effect: null, done: true, error: "no_node" };

  const option = (node.options || []).find((o) => o.id === optionId);
  if (!option) return { state, effect: null, done: false, error: "no_option" };
  if (!optionAvailable(option, state, gold)) {
    return { state, effect: null, done: false, error: "blocked" };
  }

  const next = {
    ...state,
    tree: state.tree,
    used: { ...state.used },
    history: [...state.history, option.id],
    spent: state.spent + (option.cost || 0),
  };
  if (option.once) next.used[option.id] = true;

  if (option.end) {
    return { state: next, effect: option.effect || null, done: true, option };
  }

  const target = state.tree[option.next];
  if (!target) return { state: next, effect: option.effect || null, done: true, option };

  next.nodeId = option.next;
  // Эффект узла срабатывает при входе в него, а не при выборе перехода.
  return {
    state: next,
    effect: target.effect || option.effect || null,
    done: false,
    option,
    cost: option.cost || 0,
  };
}

// Что показать в панели: текущий узел плюс состояние каждого варианта.
export function dialogueView(state, gold) {
  const node = currentNode(state);
  if (!node) return { text: "", options: [] };
  return {
    text: node.text,
    options: (node.options || []).map((o) => ({
      id: o.id,
      label: o.label,
      available: optionAvailable(o, state, gold),
      reason: optionBlockReason(o, state, gold),
      cost: o.cost || 0,
    })),
  };
}

export function factCount() {
  return COURTESAN_FACT_ORDER.length;
}

export function factPrice(id) {
  return COURTESAN_FACTS[id] ? COURTESAN_FACTS[id].price : 0;
}
