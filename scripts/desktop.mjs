// Запуск десктопной версии без Electron.
//
// Что делает:
//   1. Проверяет, что окружение готово (.venv с pywebview).
//   2. Запускает desktop/main.py через pythonw, без окна консоли.
//
// Почему только запуск, а не сборка exe: сборка — это Nuitka и
// несколько минут, её незачем делать при каждом старте. Для неё есть
// npm run desktop:build.
//
// Почему pythonw, а не python: python.exe держит чёрное окно консоли
// поверх игры всё время работы. pythonw его не открывает.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const VENV_PY = ".venv\\Scripts\\python.exe";
const VENV_PYW = ".venv\\Scripts\\pythonw.exe";
const MAIN = "desktop\\main.py";

function fail(message) {
  console.error(`corovans: ${message}`);
  process.exit(1);
}

if (!existsSync(MAIN)) fail(`не найден ${MAIN}`);

// Окружение есть? Если нет — подсказываем одну команду, а не полотенце.
if (!existsSync(VENV_PYW)) {
  fail(
    "нет .venv с pywebview. Выполните один раз:\n" +
      "  npm run desktop:setup\n" +
      "или просто запустите Корованы.cmd — он всё сделает сам."
  );
}

// pywebview реально установлен? venv может существовать, но быть пустым
// после неудачного pip install — это частая ловушка.
const probe = spawnSync(VENV_PY, ["-c", "import webview"], { encoding: "utf8" });
if (probe.status !== 0) {
  fail("в .venv нет pywebview. Выполните:\n  npm run desktop:setup");
}

// pythonw запускается ОТВЯЗАННЫМ: node не должен ждать закрытия окна
// игры. Со связанным дочерним процессом `npm run desktop` висел, пока
// не закроешь игру, — а это выглядит как «команда не отработала».
const child = spawn(VENV_PYW, [MAIN], {
  stdio: "ignore",
  detached: true,
  windowsHide: true,
});

child.on("error", (error) => fail(`не удалось запустить: ${error.message}`));
child.unref();

console.log("corovans: окно игры запущено (WebView2, без Electron)");
process.exit(0);
