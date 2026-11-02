// Electron main-процесс для «Корованов».
//
// Почему не просто win.loadFile("index.html"): Chromium блокирует
// ES-модули на file:// по CORS, а вся игра — это модули. Наивная загрузка
// даёт чёрное окно и ошибку в консоли. Поэтому игра отдаётся через
// собственный протокол app:// — у него настоящий origin, работает и
// module, и localStorage в save.js.
//
// CommonJS (.cjs), потому что package.json объявлен как "type": "module".

const { app, BrowserWindow, Menu, protocol, net, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");

// Корень игры. В собранном приложении это asar-архив, снаружи — папка.
const ROOT = path.join(__dirname, "..");

// Схема должна быть зарегистрирована ДО app.whenReady, иначе модулям
// не выдадут нужные права и они не загрузятся.
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

// Путь из URL → путь на диске. Возвращает null, если запрос пытается
// выйти за пределы папки игры (app://game/../../Windows/System32).
function resolvePath(urlString) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(urlString).pathname);
  } catch {
    return null;
  }

  const relative = pathname === "/" || pathname === "" ? "/index.html" : pathname;
  const target = path.normalize(path.join(ROOT, relative));

  // Должно остаться внутри ROOT. Сравниваем с разделителем, иначе
  // "E:/Corovans-evil" пройдёт проверку префикса.
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return null;
  return target;
}

async function handleAppRequest(request) {
  const target = resolvePath(request.url);
  if (!target) return new Response("forbidden", { status: 403 });

  try {
    let file = target;
    const info = await fs.stat(target);
    if (info.isDirectory()) file = path.join(target, "index.html");

    const body = await fs.readFile(file);
    const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";

    const headers = {
      "Content-Type": type,
      // Кеш выключен намеренно: иначе после правки модуля играет старая копия.
      "Cache-Control": "no-store, must-revalidate",
    };

    // CSP только для HTML: модули и стили свои, внешних источников нет.
    // Без этого заголовка Electron ругается в консоли на каждом старте.
    if (type.startsWith("text/html")) {
      headers["Content-Security-Policy"] =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; media-src 'self' blob:; " +
        "connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'";
    }

    return new Response(body, { status: 200, headers });
  } catch {
    return new Response("404", { status: 404 });
  }
}

function createWindow() {
  const win = new BrowserWindow({
    // Точный размер буфера игры: при useContentSize рамка окна не отнимает
    // пиксели, и applyCanvasScale считает множитель от 1280×720.
    width: 1280,
    height: 720,
    useContentSize: true,
    backgroundColor: "#000000", // без него на старте белая вспышка
    title: "Корованы: Тёмная дорога",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox: true здесь НЕЛЬЗЯ: на этой машине рендерер падает с
      // "Renderer process launch-failed", окно не появляется вообще.
      // Изоляция контекста и выключенный Node закрывают ту же дыру.
      sandbox: false,
    },
  });

  // Показываем только когда картинка готова: иначе виден чёрный прямоугольник
  // с рамкой и моргание при загрузке.
  win.once("ready-to-show", () => win.show());

  win.loadURL("app://game/index.html");

  // F11 — полный экран, F12 — devtools. Без второго отлаживать нечем.
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.key === "F12") {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Внешние ссылки — в системный браузер, а не в окно игры.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });

  return win;
}

function buildMenu() {
  const template = [
    {
      label: "Игра",
      submenu: [
        { label: "Полный экран", accelerator: "F11", click: (_i, win) => win && win.setFullScreen(!win.isFullScreen()) },
        { label: "Инструменты разработчика", accelerator: "F12", click: (_i, win) => win && win.webContents.toggleDevTools() },
        { type: "separator" },
        { role: "reload", label: "Перезагрузить" },
        { type: "separator" },
        { role: "quit", label: "Выход" },
      ],
    },
    {
      label: "Вид",
      submenu: [{ role: "resetZoom", label: "Обычный масштаб" }, { role: "togglefullscreen", label: "Полный экран" }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Второй экземпляр не нужен: он поднимет второе окно с той же игрой.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    protocol.handle("app", handleAppRequest);
    buildMenu();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
