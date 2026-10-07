#!/usr/bin/env node
/**
 * Size budget gate — "cực nhẹ" must be measured, not felt.
 * Prints raw + gzip sizes and exits 1 when a budget is exceeded.
 */
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = join(ROOT, 'packages', 'core');
const KB = 1024;

const checks = [
  ['dist/kit.base.css', 6 * KB],
  ['dist/kit.min.css', 20 * KB],
  ['dist/kit.min.js', 8 * KB],
  ['dist/kit.iife.min.js', 8 * KB],
];

async function i18nBundleSize() {
  const result = await build({
    entryPoints: [join(PKG, 'src', 'i18n', 'index.ts')],
    bundle: true,
    minify: true,
    write: false,
    format: 'esm',
    target: ['es2020'],
    logLevel: 'silent',
  });
  return result.outputFiles[0].contents;
}

const rows = [];
let failed = false;

for (const [file, budget] of checks) {
  const buf = readFileSync(join(PKG, file));
  const gz = gzipSync(buf, { level: 9 }).length;
  rows.push([file, buf.length, gz, budget, gz <= budget]);
  if (gz > budget) failed = true;
}

const i18nBuf = await i18nBundleSize();
const i18nBudget = 1.5 * KB;
const i18nGz = gzipSync(Buffer.from(i18nBuf), { level: 9 }).length;
rows.push(['i18n module (esm)', i18nBuf.length, i18nGz, i18nBudget, i18nGz <= i18nBudget]);
if (i18nGz > i18nBudget) failed = true;

const fmt = (n) => `${(n / KB).toFixed(2)} KB`;
console.log('artifact'.padEnd(34), 'raw'.padStart(9), 'gzip'.padStart(9), 'budget'.padStart(9), '  status');
for (const [name, raw, gz, budget, ok] of rows) {
  console.log(name.padEnd(34), fmt(raw).padStart(9), fmt(gz).padStart(9), fmt(budget).padStart(9), ok ? '  ok' : '  OVER');
}

if (failed) {
  console.error('\nSize budget exceeded.');
  process.exit(1);
}
console.log('\nAll size budgets ok.');
