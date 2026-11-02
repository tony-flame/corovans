// Синтаксическая проверка всех JS-модулей без запуска браузера.
// Каталог electron добавлен отдельно: main там .cjs, а фильтр ниже
// принимает только .js/.mjs.
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dirs = ["src", "tests", "scripts", "electron"];
const files = dirs
  .filter((dir) => existsSync(dir))
  .flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith(".js") || name.endsWith(".mjs") || name.endsWith(".cjs"))
      .map((name) => join(dir, name))
  );

let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) {
    failed = true;
    console.error(`syntax error: ${file}`);
  }
}
process.exit(failed ? 1 : 0);
