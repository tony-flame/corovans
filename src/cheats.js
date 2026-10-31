// Чит-консоль в духе Скайрима: парсинг команд и их исполнение.
// Чистый модуль: принимает контекст игры, не трогает DOM.
//
// Модуль намеренно НЕ прячет читы за флагом debug: прототип, отлаживать нужно.
// Но в README и в самом оверлее написано, что это режим разработчика.

export const CHEAT_HELP = [
  ["tgm", "бессмертие (вкл/выкл)"],
  ["god on|off", "бессмертие явно"],
  ["gold N", "установить золото"],
  ["hp N", "установить здоровье"],
  ["heal", "полностью вылечить"],
  ["tp X Y", "телепорт по координатам"],
  ["tier N", "уровень каравана"],
  ["act N", "акт (0..2)"],
  ["wanted N", "уровень розыска"],
  ["weather KIND", "ясно | моросит | дождь | гроза | снег"],
  ["speed N", "множитель скорости (1 = обычная)"],
  ["noclip", "проход сквозь стены (вкл/выкл)"],
  ["kit", "выдать снаряжение и золото"],
  ["help", "этот список"],
];

// Разбор строки в { name, args }.
export function parseCommand(input) {
  const text = String(input || "").trim();
  if (!text) return null;

  const parts = text.split(/\s+/);
  const name = parts[0].toLowerCase();
  const args = parts.slice(1);

  return { name, args, raw: text };
}

function num(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Исполнение команды. ctx — объект с ссылками на игру.
// Возвращает { ok, message } — консоль печатает message.
export function runCommand(input, ctx) {
  const parsed = parseCommand(input);
  if (!parsed) return { ok: false, message: "" };

  const { name, args } = parsed;

  switch (name) {
    case "help":
      return { ok: true, message: CHEAT_HELP.map(([c, d]) => `${c} — ${d}`).join("\n") };

    case "tgm":
      return toggleGod(ctx);

    case "god": {
      const mode = (args[0] || "").toLowerCase();
      if (mode === "on" || mode === "1") {
        ctx.game.godMode = true;
        return { ok: true, message: "Бессмертие включено." };
      }
      if (mode === "off" || mode === "0") {
        ctx.game.godMode = false;
        return { ok: true, message: "Бессмертие выключено." };
      }
      return toggleGod(ctx);
    }

    case "gold": {
      const value = num(args[0]);
      if (value === null) return { ok: false, message: "gold N — нужно число." };
      ctx.run.gold = Math.max(0, Math.floor(value));
      return { ok: true, message: `Золото: ${ctx.run.gold}.` };
    }

    case "hp": {
      const value = num(args[0]);
      if (value === null) return { ok: false, message: "hp N — нужно число." };
      ctx.player.health = Math.max(0, Math.min(ctx.player.maxHealth, value));
      return { ok: true, message: `Здоровье: ${ctx.player.health}.` };
    }

    case "heal": {
      ctx.player.health = ctx.player.maxHealth;
      ctx.player.overheal = 0;
      if (ctx.run.bleed) ctx.run.bleed = { remaining: 0, dps: 0 };
      return { ok: true, message: "Полностью вылечен." };
    }

    case "tp": {
      const x = num(args[0]);
      const y = num(args[1]);
      if (x === null || y === null) return { ok: false, message: "tp X Y — нужны две координаты." };
      ctx.player.x = x;
      ctx.player.y = y;
      return { ok: true, message: `Телепорт в (${x}, ${y}).` };
    }

    case "tier": {
      const value = num(args[0]);
      if (value === null) return { ok: false, message: "tier N — нужно число." };
      ctx.setTier(Math.max(1, Math.floor(value)));
      return { ok: true, message: `Уровень каравана: ${ctx.run.tier}.` };
    }

    case "act": {
      const value = num(args[0]);
      if (value === null) return { ok: false, message: "act N — нужно число." };
      ctx.setAct(Math.max(0, Math.min(2, Math.floor(value))));
      return { ok: true, message: `Акт: ${ctx.run.act + 1}.` };
    }

    case "wanted": {
      const value = num(args[0]);
      if (value === null) return { ok: false, message: "wanted N — нужно число." };
      ctx.run.wanted = Math.max(0, Math.min(5, Math.floor(value)));
      return { ok: true, message: `Розыск: ${ctx.run.wanted}.` };
    }

    case "weather": {
      const kind = (args[0] || "").toLowerCase();
      const map = {
        clear: "clear",
        ясно: "clear",
        drizzle: "drizzle",
        моросит: "drizzle",
        rain: "rain",
        дождь: "rain",
        storm: "storm",
        гроза: "storm",
        snow: "snow",
        снег: "snow",
      };
      const target = map[kind];
      if (!target) {
        return { ok: false, message: "weather clear|drizzle|rain|storm|snow" };
      }
      ctx.setWeather(target);
      return { ok: true, message: `Погода: ${target}.` };
    }

    case "speed": {
      const value = num(args[0]);
      if (value === null) return { ok: false, message: "speed N — нужно число." };
      ctx.game.speedMultiplier = Math.max(0.1, Math.min(10, value));
      return { ok: true, message: `Скорость: ×${ctx.game.speedMultiplier}.` };
    }

    case "noclip": {
      ctx.game.noclip = !ctx.game.noclip;
      return { ok: true, message: `Noclip: ${ctx.game.noclip ? "вкл" : "выкл"}.` };
    }

    case "kit": {
      ctx.run.gold = Math.max(ctx.run.gold, 1000);
      ctx.player.health = ctx.player.maxHealth;
      return { ok: true, message: "Выдано: 1000 золота, полное здоровье." };
    }

    default:
      return { ok: false, message: `Неизвестная команда: ${name}. Введите help.` };
  }
}

function toggleGod(ctx) {
  ctx.game.godMode = !ctx.game.godMode;
  return {
    ok: true,
    message: ctx.game.godMode ? "Бессмертие включено." : "Бессмертие выключено.",
  };
}

export function commandNames() {
  return CHEAT_HELP.map(([name]) => name);
}
