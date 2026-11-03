// Торг у Мардо: кубик против кубика. Чистый модуль.
//
// Смысл: продажа всей добычи разом убивает разговор о цене. Игрок
// приходит, жмёт «продать» и получает столько, сколько решил код.
// Здесь появляется выбор — рискнуть на больший куш или забрать
// сколько дают.
//
// Правила простые и намеренно нечестные в пользу Мардо:
//   • бросаем d6 против d6, при равенстве побеждает Мардо;
//   • выигрыш — +20% к цене, проигрыш — −15%;
//   • после третьего броска за визит он больше не играет.
//
// Мардо — скупщик, а не казино: ему не должно быть выгодно торговаться
// до бесконечности. Три попытки и стоп.
//
// Числа подобраны так, чтобы матожидание было чуть НИЖЕ единицы:
// 15 из 36 бросков — победа, 21 — поражение или ничья, значит
// 0.417·1.20 + 0.583·0.85 ≈ 0.996. Торг — риск, а не бесплатные деньги.

import { createRng, hashSeed } from "./rng.js";

export const WIN_BONUS = 0.2;
export const LOSS_PENALTY = 0.15;
export const MAX_ROLLS = 3;

// Сколько раз ещё можно бросить. Счётчик живёт в game, не в ране:
// перезагрузка не должна сбрасывать «он устал торговаться».
export function rollsLeft(rolled = 0) {
  return Math.max(0, MAX_ROLLS - rolled);
}

// Один бросок. rng — из createRng, чтобы результат был воспроизводим
// при отладке; в игре передаётся игровой rng.
export function rollHaggle(rng) {
  const player = 1 + Math.floor(rng() * 6);
  const merchant = 1 + Math.floor(rng() * 6);
  // Равенство — в пользу Мардо. Он торгуется дольше и наглее.
  const won = player > merchant;

  return {
    player,
    merchant,
    won,
    multiplier: won ? 1 + WIN_BONUS : 1 - LOSS_PENALTY,
  };
}

// Итоговая цена после броска. Округление вниз: игрок не должен
// получать лишнюю монету из-за плавающей точки.
export function haggledPrice(baseValue, result) {
  if (!result) return Math.round(baseValue);
  return Math.max(0, Math.floor(baseValue * result.multiplier));
}

// Подпись для кнопки и журнала.
export function rollText(result) {
  if (!result) return "";
  const dice = `Вы ${result.player} — Мардо ${result.merchant}`;
  if (result.won) return `${dice}. Он морщится: «Ладно. Но это в последний раз.»`;
  return `${dice}. Он усмехается: «Не твой день.»`;
}

// Можно ли вообще торговаться: нужна добыча и остаток попыток.
export function canHaggle(value, rolled) {
  return value > 0 && rollsLeft(rolled) > 0;
}

// Сид броска: привязан к рану и номеру попытки, чтобы в отладке
// повторный запуск давал тот же результат.
export function haggleSeed(runSeed, rolled, visitIndex = 0) {
  return hashSeed(`haggle:${runSeed}:${rolled}:${visitIndex}`);
}

export function makeHaggleRng(runSeed, rolled, visitIndex = 0) {
  return createRng(haggleSeed(runSeed, rolled, visitIndex));
}
