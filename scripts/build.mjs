#!/usr/bin/env node
/**
 * Full build for @kit/core:
 *   1. tokens        -> tokens.css / tokens.ts / tokens.g.dart
 *   2. CSS           -> dist/kit.min.css, dist/kit.base.css (minified)
 *   3. JS            -> dist/kit.min.js (ESM), dist/kit.iife.min.js (IIFE global `kit`)
 *   4. types         -> dist/*.d.ts via tsc (declaration only)
 */
import { build as esbuild, transform } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { writeTokens } from './build-tokens.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = join(ROOT, 'packages', 'core');
const SRC = join(PKG, 'src');
const OUT = join(PKG, 'dist');

const started = Date.now();
mkdirSync(OUT, { recursive: true });

// 1. tokens --------------------------------------------------------------
writeTokens();

// 2. CSS -----------------------------------------------------------------
const read = (rel) => readFileSync(join(SRC, rel), 'utf8');
const componentCss = readdirSync(join(SRC, 'styles', 'components'))
  .filter((f) => f.endsWith('.css'))
  .sort()
  .map((f) => `styles/components/${f}`);

const baseParts = ['styles/tokens.css', 'styles/base/reset.css', 'styles/base/utilities.css'];
const fullParts = [...baseParts, ...componentCss];

const minifyCss = async (parts) => {
  const raw = parts.map(read).join('\n');
  const { code } = await transform(raw, { loader: 'css', minify: true });
  return code;
};

writeFileSync(join(OUT, 'kit.min.css'), await minifyCss(fullParts));
writeFileSync(join(OUT, 'kit.base.css'), await minifyCss(baseParts));
console.log(`css: kit.min.css, kit.base.css`);

// 3. JS ------------------------------------------------------------------
/** Minify CSS before it becomes a JS string (loader 'text' would skip minify). */
const cssTextMinify = {
  name: 'css-text-minify',
  setup(pluginBuild) {
    pluginBuild.onLoad({ filter: /\.css$/ }, async (args) => {
      const source = readFileSync(args.path, 'utf8');
      const { code } = await transform(source, { loader: 'css', minify: true });
      return { contents: code, loader: 'text' };
    });
  },
};

const shared = {
  bundle: true,
  minify: true,
  target: ['es2020'],
  legalComments: 'none',
  logLevel: 'warning',
  plugins: [cssTextMinify],
};

await esbuild({
  ...shared,
  entryPoints: [join(SRC, 'index.ts')],
  format: 'esm',
  outfile: join(OUT, 'kit.min.js'),
});

await esbuild({
  ...shared,
  entryPoints: [join(SRC, 'index.ts')],
  format: 'iife',
  globalName: 'kit',
  outfile: join(OUT, 'kit.iife.min.js'),
});
console.log('js: kit.min.js (ESM), kit.iife.min.js (IIFE)');

// 4. .d.ts ---------------------------------------------------------------
const tsc = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const result = spawnSync(process.execPath, [tsc, '-p', join(PKG, 'tsconfig.build.json')], {
  stdio: 'inherit',
});
if (result.status !== 0) {
  console.error('tsc declaration emit failed');
  process.exit(result.status ?? 1);
}
console.log('types: dist/*.d.ts');

console.log(`build ok in ${Date.now() - started}ms`);
