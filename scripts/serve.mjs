// Статический сервер для разработки.
// Отличается от `python -m http.server` тем, что шлёт Cache-Control: no-store.
// Без этого Chrome кеширует ES-модули по эвристике Last-Modified, и правки
// в src/*.js не доезжают до игрока: HTML обновляется, а логика остаётся старой.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PORT = Number(process.env.PORT) || 8000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function resolvePath(urlPath) {
  const clean = decodeURIComponent((urlPath || "/").split("?")[0].split("#")[0]);
  const target = normalize(join(ROOT, clean === "/" ? "/index.html" : clean));
  // Защита от выхода за пределы каталога проекта.
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null;
  return target;
}

const server = createServer(async (req, res) => {
  const target = resolvePath(req.url);

  if (!target) {
    res.writeHead(403, { "Cache-Control": "no-store" });
    res.end("forbidden");
    return;
  }

  try {
    const info = await stat(target);
    const file = info.isDirectory() ? join(target, "index.html") : target;
    const body = await readFile(file);
    const type = MIME[extname(file).toLowerCase()] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": body.length,
      "Cache-Control": "no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end("404: " + (req.url || "/"));
  }
});

server.listen(PORT, () => {
  console.log(`corovans: http://localhost:${PORT}  (no-store, правки видны без hard reload)`);
});
