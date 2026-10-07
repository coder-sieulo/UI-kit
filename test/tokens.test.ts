import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
}

function leafPaths(tree: unknown, prefix = ''): string[] {
  if (tree !== null && typeof tree === 'object' && !('$value' in (tree as object))) {
    return Object.entries(tree as Record<string, unknown>)
      .filter(([key]) => !key.startsWith('$'))
      .flatMap(([key, value]) => leafPaths(value, prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}

let css = '';
let ts = '';
let dart = '';

beforeAll(() => {
  execFileSync(process.execPath, ['scripts/build-tokens.mjs'], { cwd: ROOT, stdio: 'pipe' });
  css = readFileSync(join(ROOT, 'packages/core/src/styles/tokens.css'), 'utf8');
  ts = readFileSync(join(ROOT, 'packages/core/src/tokens.ts'), 'utf8');
  dart = readFileSync(join(ROOT, 'flutter/lib/src/tokens.g.dart'), 'utf8');
});

describe('build:tokens', () => {
  it('emits light defaults on :root and dark overrides on [data-theme="dark"]', () => {
    expect(css).toContain(':root {');
    expect(css).toContain('[data-theme="dark"] {');
    // bg canvas defined for both themes
    expect(css.match(/--kit-color-bg-canvas:/g)?.length).toBe(3); // :root + dark + media query
  });

  it('auto-follows prefers-color-scheme unless light is forced', () => {
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain(':root:not([data-theme="light"])');
  });

  it('has no unresolved {references}', () => {
    const unresolved = css.match(/\{(color|space|radius|shadow|font|motion|z|button|input|field|overlay)\.[^}]+\}/g);
    expect(unresolved).toBeNull();
  });

  it('light and dark semantic token keys stay in parity', () => {
    const light = leafPaths(readJson('tokens/semantic/light.json'));
    const dark = leafPaths(readJson('tokens/semantic/dark.json'));
    expect([...light].sort()).toEqual([...dark].sort());
    expect(light.length).toBeGreaterThan(20);
  });

  it('every semantic token resolves to a value in both themes', () => {
    const light = leafPaths(readJson('tokens/semantic/light.json'));
    for (const path of light) {
      const name = `--kit-${path.replace(/\./g, '-')}:`;
      expect(css, `missing ${path}`).toContain(name);
    }
  });

  it('tokens.ts exposes resolved nested values', () => {
    expect(ts).toContain('export const tokens');
    expect(ts).toContain('export const tokensDark');
    expect(ts).toContain('"canvas": "#faf9f7"');
    expect(ts).toMatch(/"canvas": "#171612"/); // dark canvas differs
  });

  it('tokens.g.dart is a ThemeExtension with light/dark constants', () => {
    expect(dart).toContain('class KitTokens extends ThemeExtension<KitTokens>');
    expect(dart).toContain('static const KitTokens light');
    expect(dart).toContain('static const KitTokens dark');
    expect(dart).toContain('final Color bgCanvas;');
    expect(dart).toContain('Color(0xFFFAF9F7)'); // light canvas
    expect(dart).toContain('Color(0xFF171612)'); // dark canvas
    expect(dart).toContain('KitTokens lerp(');
    expect(dart).toContain('KitTokens copyWith(');
  });
});
