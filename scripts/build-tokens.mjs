#!/usr/bin/env node
/**
 * Build design tokens from tokens/*.json (DTCG-ish) into:
 *   - packages/core/src/styles/tokens.css  (:root + [data-theme=dark] + system media query)
 *   - packages/core/src/tokens.ts          (typed object for runtime)
 *   - flutter/lib/src/tokens.g.dart        (ThemeExtension<KitTokens> with light/dark)
 *
 * Pure Node, zero dependencies. Reference syntax: {path.to.token}
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS_DIR = join(ROOT, 'tokens');

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Invalid JSON in ${file}: ${err.message}`);
  }
}

/** A file with a root-level $type applies it to all its top-level entries. */
function normalizeFile(data) {
  const rootType = data.$type;
  if (!rootType) return data;
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === '$type') continue;
    if (key.startsWith('$')) {
      out[key] = value;
    } else if (isPlain(value)) {
      out[key] = { $type: rootType, ...value };
    } else {
      out[key] = { $type: rootType, $value: value };
    }
  }
  return out;
}

function deepMerge(a, b, src = '?') {
  if (!isPlain(a) || !isPlain(b)) return b;
  const out = { ...a };
  for (const [key, value] of Object.entries(b)) {
    const prev = out[key];
    if (key in out && isPlain(prev) && isPlain(value)) {
      const bothLeaves = '$value' in prev && '$value' in value;
      if (bothLeaves) throw new Error(`Token conflict at "${key}" (from ${src})`);
      out[key] = deepMerge(prev, value, src);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function readJsonDir(dir) {
  let out = {};
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  for (const file of files) {
    out = deepMerge(out, normalizeFile(readJson(join(dir, file))), `${dir}/${file}`);
  }
  return out;
}

/** Flatten a token tree into { "a.b.c": { $value, $type } } with inherited $type. */
function flatten(tree, prefix = '', inheritedType, out = {}) {
  if (!isPlain(tree)) return out;
  if ('$value' in tree) {
    out[prefix] = { $value: tree.$value, $type: tree.$type ?? inheritedType };
    return out;
  }
  const type = tree.$type ?? inheritedType;
  for (const [key, value] of Object.entries(tree)) {
    if (key.startsWith('$')) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlain(value)) {
      flatten(value, path, type, out);
    } else {
      out[path] = { $value: value, $type: type };
    }
  }
  return out;
}

/** Resolve all {ref} references. Throws on missing refs or cycles. */
function resolveAll(flat) {
  const cache = new Map();
  const resolving = new Set();

  function resolveValue(path) {
    if (cache.has(path)) return cache.get(path);
    const leaf = flat[path];
    if (!leaf) throw new Error(`Unknown token reference: {${path}}`);
    if (resolving.has(path)) throw new Error(`Circular token reference at {${path}}`);
    resolving.add(path);
    const raw = leaf.$value;
    let value = raw;
    if (typeof raw === 'string' && raw.includes('{')) {
      const single = /^\{([^{}]+)\}$/.exec(raw.trim());
      if (single) {
        // Whole value is one reference — keep the referenced type (string, number...).
        value = resolveValue(single[1].trim());
      } else {
        value = raw.replace(/\{([^{}]+)\}/g, (_match, ref) => {
          const resolved = resolveValue(ref.trim());
          if (resolved === null || typeof resolved === 'object') {
            throw new Error(`Cannot inline non-scalar token {${ref}} into "${raw}"`);
          }
          return String(resolved);
        });
      }
    }
    resolving.delete(path);
    cache.set(path, value);
    return value;
  }

  const out = {};
  for (const path of Object.keys(flat).sort()) out[path] = resolveValue(path);
  return out;
}

function setPath(obj, path, value) {
  const parts = path.split('.');
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!isPlain(node[key])) node[key] = {};
    node = node[key];
  }
  node[parts[parts.length - 1]] = value;
}

/** font.lineHeight -> font-line-height */
function toKebab(segment) {
  return segment.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function cssVarName(path) {
  return `--kit-${path.split('.').map(toKebab).join('-')}`;
}

function blockCss(flat, paths) {
  const lines = paths
    .filter((p) => p in flat)
    .sort()
    .map((p) => `  ${cssVarName(p)}: ${flat[p]};`);
  return lines.join('\n');
}

function buildCss(lightFlat, darkFlat, baseFlat, themePaths) {
  const lightLines = [
    ...Object.keys(baseFlat).sort().map((p) => `  ${cssVarName(p)}: ${baseFlat[p]};`),
    ...themePaths.filter((p) => p in lightFlat).sort().map((p) => `  ${cssVarName(p)}: ${lightFlat[p]};`),
  ];
  const darkBlock = blockCss(darkFlat, themePaths);
  return `/* GENERATED from tokens/ — do not edit. Run \`npm run build:tokens\`. */
:root {
${lightLines.join('\n')}
}

[data-theme="dark"] {
${darkBlock}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${darkBlock}
  }
}
`;
}

function buildTs(lightFlat, darkFlat) {
  const light = {};
  const dark = {};
  for (const [path, value] of Object.entries(lightFlat)) setPath(light, path, value);
  for (const [path, value] of Object.entries(darkFlat)) setPath(dark, path, value);
  return `/* GENERATED from tokens/ — do not edit. Run \`npm run build:tokens\`. */
export const tokens = ${JSON.stringify(light, null, 2)} as const;

/** Theme-dependent values only (semantic + component tokens, dark values). */
export const tokensDark = ${JSON.stringify(dark, null, 2)} as const;

export type Tokens = typeof tokens;
`;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const RGBA_RE = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/;

function dartColor(value) {
  if (typeof value !== 'string') return null;
  const hex = HEX_RE.exec(value);
  if (hex) return `Color(0xFF${value.slice(1).toUpperCase()})`;
  const rgba = RGBA_RE.exec(value);
  if (rgba) {
    const [, r, g, b, a] = rgba;
    return `Color.fromRGBO(${r}, ${g}, ${b}, ${a === '1' ? '1.0' : a})`;
  }
  return null;
}

function dartFieldName(path) {
  const parts = path.replace(/^color\./, '').split('.');
  return parts
    .map((seg, i) => {
      const clean = seg.replace(/-([a-z0-9])/g, (_m, c) => c.toUpperCase());
      return i === 0 ? clean : clean.charAt(0).toUpperCase() + clean.slice(1);
    })
    .join('');
}

function buildDart(lightFlat, darkFlat, semanticPaths) {
  const fields = [];
  for (const path of semanticPaths.sort()) {
    if (!path.startsWith('color.')) continue;
    const lightColor = dartColor(lightFlat[path]);
    const darkValue = darkFlat[path];
    if (!lightColor || !(path in darkFlat)) continue;
    const darkColor = dartColor(darkValue);
    if (!darkColor) continue;
    fields.push({ name: dartFieldName(path), light: lightColor, dark: darkColor, path });
  }
  if (fields.length === 0) throw new Error('Dart build produced no color fields');

  const paramList = fields.map((f) => `    required this.${f.name},`).join('\n');
  const fieldList = fields.map((f) => `  final Color ${f.name};`).join('\n');
  const lightArgs = fields.map((f) => `      ${f.name}: ${f.light},`).join('\n');
  const darkArgs = fields.map((f) => `      ${f.name}: ${f.dark},`).join('\n');
  const copyParams = fields.map((f) => `    Color? ${f.name},`).join('\n');
  const copyBody = fields.map((f) => `      ${f.name}: ${f.name} ?? this.${f.name},`).join('\n');
  const lerpBody = fields
    .map((f) => `      ${f.name}: Color.lerp(${f.name}, other.${f.name}, t)!,`)
    .join('\n');

  return `// GENERATED from tokens/ — do not edit. Run \`npm run build:tokens\`.
// ignore_for_file: lines_longer_than_80_chars

import 'package:flutter/material.dart';

/// Semantic color tokens, generated from tokens/semantic/*.json.
/// Override in a Theme with \`Theme.of(context).extension<KitTokens>()\`.
@immutable
class KitTokens extends ThemeExtension<KitTokens> {
  const KitTokens({
${paramList}
  });

${fieldList}

  /// Light theme values (tokens/semantic/light.json).
  static const KitTokens light = KitTokens(
${lightArgs}
  );

  /// Dark theme values (tokens/semantic/dark.json).
  static const KitTokens dark = KitTokens(
${darkArgs}
  );

  @override
  KitTokens copyWith({
${copyParams}
  }) {
    return KitTokens(
${copyBody}
    );
  }

  @override
  KitTokens lerp(covariant ThemeExtension<KitTokens>? other, double t) {
    if (other is! KitTokens) return this;
    return KitTokens(
${lerpBody}
    );
  }
}
`;
}

export function build() {
  const base = readJsonDir(join(TOKENS_DIR, 'base'));
  const component = readJsonDir(join(TOKENS_DIR, 'component'));
  const lightSem = normalizeFile(readJson(join(TOKENS_DIR, 'semantic', 'light.json')));
  const darkSem = normalizeFile(readJson(join(TOKENS_DIR, 'semantic', 'dark.json')));

  const baseFlat = resolveAll(flatten(base));
  const lightTree = deepMerge(deepMerge(base, lightSem, 'light'), component, 'component');
  const darkTree = deepMerge(deepMerge(base, darkSem, 'dark'), component, 'component');
  const lightFlat = resolveAll(flatten(lightTree));
  const darkFlat = resolveAll(flatten(darkTree));

  const lightSemPaths = Object.keys(flatten(lightSem));
  const compPaths = Object.keys(flatten(component));
  const themePaths = [...new Set([...lightSemPaths, ...compPaths])];

  const css = buildCss(lightFlat, darkFlat, baseFlat, themePaths);
  const ts = buildTs(lightFlat, darkFlat);
  const dart = buildDart(lightFlat, darkFlat, lightSemPaths);

  return { css, ts, dart, baseFlat, lightFlat, darkFlat, themePaths, lightSemPaths };
}

export function writeTokens() {
  const result = build();
  const outputs = [
    [join(ROOT, 'packages', 'core', 'src', 'styles', 'tokens.css'), result.css],
    [join(ROOT, 'packages', 'core', 'src', 'tokens.ts'), result.ts],
    [join(ROOT, 'flutter', 'lib', 'src', 'tokens.g.dart'), result.dart],
  ];
  for (const [file, content] of outputs) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    console.log(`wrote ${file.replace(`${ROOT}/`, '')} (${content.length} bytes)`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  writeTokens();
}
