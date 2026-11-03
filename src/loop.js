// Цикл кадров, который не умирает от одного исключения. Чистый модуль.
//
// История: `requestAnimationFrame(frame)` стоял последней строкой frame().
// Любое исключение внутри кадра выбрасывало управление до планирования
// следующего — и цикл прекращался навсегда. Картинка и звук застывали,
// помогала только перезагрузка. Именно так игра умерла на опечатке в
// импорте (`trackAlpha is not defined`).
//
// Здесь планирование следующего кадра живёт в finally: один битый кадр
// остаётся одним битым кадром, а не концом игры.

// Ошибки не повторяются в консоли: без этого упавший кадр печатает
// 60 одинаковых сообщений в секунду и прячет причину.
export function createErrorReporter(onError) {
  const seen = new Set();
  return function report(error) {
    const text = String((error && error.message) || error);
    if (seen.has(text)) return false;
    seen.add(text);
    if (onError) onError(error, text);
    return true;
  };
}

// Собирает кадровую функцию из шага и планировщика.
//   step(now)    — тело кадра; может бросить
//   scheduler(fn) — обычно requestAnimationFrame
//   report(err)  — куда сообщать об ошибке
// Возвращает функцию, которую можно передать в scheduler без обёрток.
export function createFrameLoop(step, scheduler, report = () => {}) {
  let running = true;
  let frames = 0;
  let failures = 0;

  function frame(now) {
    if (!running) return;
    frames += 1;
    try {
      step(now);
    } catch (error) {
      failures += 1;
      report(error);
    } finally {
      // Планируем следующий кадр ВСЕГДА, в том числе после исключения.
      if (running) scheduler(frame);
    }
  }

  frame.stop = () => {
    running = false;
  };
  frame.stats = () => ({ frames, failures });

  return frame;
}
