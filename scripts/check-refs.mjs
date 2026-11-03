// Статическая проверка: ищет идентификаторы, которые вызываются,
// но нигде не объявлены и не импортированы в файле.
//
// Именно такой баг убил игру: raycaster.js звал trackAlpha(), не импортировав её.
// node --check такое не ловит (это не синтаксис), а тесты не покрывают
// рендеринг, потому что он требует canvas. Отсюда отдельный проход.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = process.argv[2] || "src";
const files = readdirSync(SRC).filter((f) => f.endsWith(".js"));

// Глобальные имена, которые существуют без объявления.
const GLOBALS = new Set([
  "Math", "Number", "String", "Boolean", "Array", "Object", "JSON", "Date",
  "Map", "Set", "WeakMap", "WeakSet", "Promise", "Error", "TypeError",
  "RangeError", "Symbol", "Proxy", "Reflect", "RegExp", "BigInt", "Intl",
  "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURIComponent",
  "decodeURIComponent", "setTimeout", "clearTimeout", "setInterval",
  "clearInterval", "requestAnimationFrame", "cancelAnimationFrame",
  "console", "document", "window", "globalThis", "performance", "fetch",
  "Uint8Array", "Uint16Array", "Uint32Array", "Int8Array", "Int16Array",
  "Int32Array", "Float32Array", "Float64Array", "ArrayBuffer", "DataView",
  "AudioContext", "webkitAudioContext", "OffscreenCanvas", "Image",
  "WebSocket", "URLSearchParams", "localStorage", "structuredClone",
  "undefined", "NaN", "Infinity", "arguments", "process", "require",
  "module", "exports", "__dirname", "Buffer", "TextEncoder", "TextDecoder",
  "crypto", "navigator", "screen", "location", "history", "alert",
  "KeyboardEvent", "MouseEvent", "CustomEvent", "Event", "HTMLElement",
  "Node", "Element", "DOMParser", "Blob", "FileReader", "Worker",
]);

// Ключевые слова, которые тоже ловятся как «вызов» в шаблонной строке.
const KEYWORDS = new Set([
  "if", "for", "while", "switch", "catch", "return", "typeof", "function",
  "new", "do", "else", "case", "throw", "delete", "void", "in", "of",
  "instanceof", "await", "yield", "super", "this", "class", "extends",
]);

let problems = 0;

for (const file of files) {
  const path = join(SRC, file);
  const raw = readFileSync(path, "utf8");

  // Убираем комментарии и строки, чтобы не ловить текст внутри них.
  const code = raw
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""');

  // Все объявленные имена в файле.
  const declared = new Set();

  // import { a, b as c } from "..."
  for (const m of code.matchAll(/import\s+(?:\{([^}]*)\}|(\w+))(?:\s*,\s*\{([^}]*)\})?\s*from/g)) {
    for (const group of [m[1], m[2], m[3]]) {
      if (!group) continue;
      for (const part of group.split(",")) {
        const name = part.trim().split(/\s+as\s+/).pop().trim();
        if (name) declared.add(name);
      }
    }
  }
  // const/let/var
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  // Множественное объявление: const a = 1, b = 2
  for (const m of code.matchAll(/\b(?:const|let|var)\s+[^;=]*=\s*[^;]+/g)) {
    for (const n of m[0].matchAll(/,\s*([A-Za-z_$][\w$]*)\s*=/g)) declared.add(n[1]);
  }
  // function foo(...)
  for (const m of code.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  // class Foo
  for (const m of code.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  // Параметры функций и стрелочных. Регулярка с [^()]* не видит
  // вложенные скобки в значениях по умолчанию
  // (например `report = () => {}`), поэтому разбираем настоящим
  // обходом по скобкам.
  function collectParams(openIndex) {
    let depth = 0;
    let end = -1;
    for (let i = openIndex; i < code.length; i++) {
      const ch = code[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end < 0) return;
    const inner = code.slice(openIndex + 1, end);
    // Режем по запятым верхнего уровня: значения по умолчанию тоже
    // могут содержать запятые и скобки.
    let level = 0;
    let start = 0;
    const parts = [];
    for (let i = 0; i <= inner.length; i++) {
      const ch = inner[i];
      if (ch === "(" || ch === "{" || ch === "[") level++;
      else if (ch === ")" || ch === "}" || ch === "]") level--;
      if ((ch === "," && level === 0) || i === inner.length) {
        parts.push(inner.slice(start, i));
        start = i + 1;
      }
    }
    for (const part of parts) {
      const name = part.trim().split(/[=:]/)[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
    }
  }

  // function foo(...) / function(...)
  for (const m of code.matchAll(/\bfunction\s*[\w$]*\s*\(/g)) {
    collectParams(m.index + m[0].length - 1);
  }
  // Стрелочные: (...) => — открывающая скобка перед «)=>»
  for (const m of code.matchAll(/\)\s*=>/g)) {
    // Находим парную открывающую скобку слева.
    let depth = 0;
    for (let i = m.index; i >= 0; i--) {
      if (code[i] === ")") depth++;
      else if (code[i] === "(") {
        depth--;
        if (depth === 0) { collectParams(i); break; }
      }
    }
  }
  // Стрелочные с одним параметром без скобок: x => ...
  for (const m of code.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*=>/g)) {
    declared.add(m[2]);
  }
  // Деструктуризация: const { a, b } = ...
  for (const m of code.matchAll(/\{([^{}]*)\}\s*=/g)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/[:=]/).pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) declared.add(name);
    }
  }
  // Методы класса: `  foo(...) {` в начале строки, а также геттеры.
  for (const m of code.matchAll(/^\s{2,}(?:get\s+|set\s+|static\s+|async\s+)?([A-Za-z_$][\w$]*)\s*\(/gm)) {
    declared.add(m[1]);
  }
  // Свойства объекта-обработчика: `foo: bar,` — значение может быть
  // ссылкой на объявленную функцию, но имени `foo` тут не объявляется.
  // Такие имена попадают в «вызовы» только если за ними стоит «(»,
  // поэтому дополнительно снимаем ключи объектов.
  for (const m of code.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(?:function|\()/g)) {
    declared.add(m[1]);
  }
  // Метки объектов и ключи: foo: bar — не объявления, но и не вызовы.
  // Классовые поля и методы this.foo — пропускаем (они через this).

  // Ищем вызовы name( и проверяем, объявлено ли имя.
  const calls = new Set();
  for (const m of code.matchAll(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[2];
    if (KEYWORDS.has(name)) continue;
    if (GLOBALS.has(name)) continue;
    calls.add(name);
  }

  const missing = [...calls].filter((n) => !declared.has(n));
  if (missing.length) {
    problems++;
    console.log(`${file}: не объявлено — ${missing.join(", ")}`);
  }
}

if (problems === 0) console.log("чисто: все вызываемые имена объявлены");
else process.exitCode = 1;
