#!/usr/bin/env node
// Imports daily tasks from a CSV file into the content files of one city:
//
//   src/content/<city>/daily.json          { "tasks": [{ "id", "tier" }] }
//   src/content/<city>/<lang>/daily.json   { "<id>": { "label", "hint" } }
//
// Usage:
//   node scripts/import-daily.mjs <file.csv> [--city lahti] [--replace]
//
// CSV: first row is the header. Columns `id`, `tier` (easy | medium | hard), then
// `<lang>_label` and `<lang>_hint` for every language in the city's city.json
// (for Lahti: en_label, en_hint, fi_label, fi_hint). Comma or semicolon separated
// (Excel in a Finnish locale saves semicolons), UTF-8, quotes around a field that
// contains the separator. Hints may be empty; everything else is required.
//
// Without --replace the rows are merged into the existing pool: a row whose id already
// exists updates that task, new ids are added at the end. With --replace the pool becomes
// exactly the CSV (use this to drop the placeholder tasks).
//
// Nothing is written if any row is invalid. Run `npm run build` afterwards: it checks
// that every task has text in every language.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TIERS = ['easy', 'medium', 'hard'];
const ID = /^[a-z0-9-]+$/;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(`import-daily: ${message}`);
  process.exit(1);
}

// ---------- arguments ----------
const args = process.argv.slice(2);
let csvPath;
let cityId = 'lahti';
let replace = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--replace') replace = true;
  else if (args[i] === '--city') cityId = args[++i];
  else if (args[i].startsWith('--')) fail(`unknown option ${args[i]}`);
  else if (!csvPath) csvPath = args[i];
  else fail('give one CSV file');
}
if (!csvPath || !cityId)
  fail('usage: node scripts/import-daily.mjs <file.csv> [--city lahti] [--replace]');

const cityDir = join(root, 'src', 'content', cityId);
const cityFile = join(cityDir, 'city.json');
if (!existsSync(cityFile)) fail(`no such city: ${cityFile} not found`);
if (!existsSync(csvPath)) fail(`file not found: ${csvPath}`);
const city = JSON.parse(readFileSync(cityFile, 'utf8'));
const languages = city.languages;

// ---------- CSV ----------
/** RFC 4180-style parser: quoted fields, "" for a quote, line breaks inside quotes. */
function parseCsv(text, separator) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === separator) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (quoted) fail('the CSV ends inside a quoted field');
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Drop empty lines.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

const text = readFileSync(csvPath, 'utf8').replace(/^﻿/, '');
const firstLine = text.split(/\r?\n/, 1)[0];
const separator = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
const [header, ...rows] = parseCsv(text, separator);
if (!header) fail('the CSV is empty');

const columns = header.map((name) => name.trim().toLowerCase());
const needed = ['id', 'tier', ...languages.flatMap((l) => [`${l}_label`, `${l}_hint`])];
const missing = needed.filter((name) => !columns.includes(name));
if (missing.length) fail(`missing column(s): ${missing.join(', ')}. Found: ${columns.join(', ')}`);
const cell = (row, name) => (row[columns.indexOf(name)] ?? '').trim();

// ---------- validate ----------
const errors = [];
const seen = new Set();
const imported = rows.map((row, index) => {
  const line = `row ${index + 2}`;
  const id = cell(row, 'id');
  const tier = cell(row, 'tier').toLowerCase();
  // Usually a text with a comma in it that is missing its quotes.
  if (row.length !== header.length)
    errors.push(`${line} (${id}): ${row.length} fields, but the header has ${header.length}`);
  if (!ID.test(id)) errors.push(`${line}: id "${id}" must be lowercase letters, digits and dashes`);
  if (seen.has(id)) errors.push(`${line}: id "${id}" appears twice`);
  seen.add(id);
  if (!TIERS.includes(tier)) errors.push(`${line} (${id}): tier "${tier}" must be ${TIERS.join(', ')}`);
  const copy = {};
  for (const lang of languages) {
    const label = cell(row, `${lang}_label`);
    if (!label) errors.push(`${line} (${id}): ${lang}_label is empty`);
    copy[lang] = { label, hint: cell(row, `${lang}_hint`) };
  }
  return { id, tier, copy };
});
if (errors.length) fail(`nothing was written.\n  ${errors.join('\n  ')}`);
if (!imported.length) fail('the CSV has a header but no tasks');

// ---------- merge and write ----------
const readJson = (file, fallback) =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback;
const writeJson = (file, data) => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);

const poolFile = join(cityDir, 'daily.json');
const before = replace ? [] : readJson(poolFile, { tasks: [] }).tasks;
const tierOf = new Map(before.map((task) => [task.id, task.tier]));
const known = new Set(tierOf.keys());
for (const task of imported) tierOf.set(task.id, task.tier);
const tasks = [...tierOf].map(([id, tier]) => ({ id, tier }));
writeJson(poolFile, { tasks });

for (const lang of languages) {
  const file = join(cityDir, lang, 'daily.json');
  const old = replace ? {} : readJson(file, {});
  const copy = {};
  // Same order as the pool, and no text for tasks that are not in it.
  for (const { id } of tasks) {
    const row = imported.find((task) => task.id === id);
    copy[id] = row ? row.copy[lang] : old[id];
  }
  writeJson(file, copy);
}

const added = imported.filter((task) => !known.has(task.id)).length;
console.log(
  `${cityId}: ${imported.length} task(s) imported (${added} new, ${imported.length - added} updated)` +
    `${replace ? ', pool replaced' : ''}. Pool is now ${tasks.length}:`
);
for (const tier of TIERS) {
  const count = tasks.filter((task) => task.tier === tier).length;
  const perDay = city.daily?.perDay?.[tier] ?? 0;
  const short = count < perDay ? `  <-- fewer than the ${perDay} offered per day` : '';
  console.log(`  ${tier.padEnd(6)} ${String(count).padStart(4)}  (${city.daily?.xp?.[tier] ?? '?'} XP each)${short}`);
}
const placeholders = tasks.filter((task) => task.id.startsWith('placeholder-')).length;
if (placeholders) console.log(`  ${placeholders} placeholder task(s) are still in the pool (use --replace to drop them).`);
console.log('Now run: npm run build');
