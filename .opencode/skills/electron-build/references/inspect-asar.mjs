// Печатает содержимое app.asar без распаковки.
// Запуск: node .opencode/skills/electron-build/references/inspect-asar.mjs
import { readFileSync } from "node:fs";

const ASAR = "dist/Corovans-win32-x64/resources/app.asar";

let buf;
try {
  buf = readFileSync(ASAR);
} catch {
  console.error(`нет ${ASAR} — сначала npm run dist`);
  process.exit(1);
}

// Заголовок asar: 4 байта размера pickle, 4 байта размера заголовка,
// 4 байта размера pickle, 4 байта размера строки JSON.
const headerSize = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(16, 16 + headerSize).toString("utf8"));

const files = [];
const walk = (node, prefix) => {
  for (const [name, child] of Object.entries(node.files || {})) {
    const p = `${prefix}/${name}`;
    if (child.files) walk(child, p);
    else files.push(p);
  }
};
walk(json, "");

const logs = files.filter((p) => p.endsWith(".log"));
const docs = files.filter((p) => p.endsWith(".md"));
const electronDeps = files.filter((p) => p.includes("node_modules/electron"));
const hasGame = files.includes("/src/main.js") && files.includes("/index.html");

console.log(`files: ${files.length}`);
console.log(`logs: ${logs.length}${logs.length ? " -> " + logs.join(", ") : ""}`);
console.log(`markdown: ${docs.length}${docs.length ? " -> " + docs.join(", ") : ""}`);
console.log(`electron dev deps packed: ${electronDeps.length}`);
console.log(`game present: ${hasGame}`);

const problems = [];
if (logs.length) problems.push("log files packed");
if (docs.length) problems.push("markdown docs packed");
if (electronDeps.length) problems.push("electron dev deps packed");
if (!hasGame) problems.push("game files missing");

if (problems.length) {
  console.log("\nFAIL: " + problems.join("; "));
  console.log("Fix the --ignore flags in package.json \"dist\" script.");
  process.exit(1);
}
console.log("\nOK");
