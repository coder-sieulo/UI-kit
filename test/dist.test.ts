import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const DIST = join(ROOT, 'packages/core/dist');

function readDist(file: string): string {
  const path = join(DIST, file);
  if (!existsSync(path)) {
    throw new Error(`Missing ${file} — run \`npm run build\` first (verify does this).`);
  }
  return readFileSync(path, 'utf8');
}

describe('built artifacts', () => {
  it('kit.min.css carries tokens + theme switch + components', () => {
    const css = readDist('kit.min.css');
    expect(css).toContain('--kit-color-bg-canvas');
    // minifier drops the quotes around the attribute value
    expect(css).toContain('[data-theme=dark]');
    expect(css).toContain('.kit-btn');
    expect(css).toContain('.kit-dialog');
    expect(css).toContain('.kit-toast');
  });

  it('kit.base.css stays tokens + reset + utilities only', () => {
    const css = readDist('kit.base.css');
    expect(css).toContain('--kit-color-bg-canvas');
    expect(css).toContain('.kit-sr-only');
    expect(css).not.toContain('.kit-btn--primary');
  });

  it('kit.min.js is an ESM bundle that injects styles once', () => {
    const js = readDist('kit.min.js');
    expect(js).toContain('kit-styles');
    expect(js).toMatch(/export\s*\{/); // real ESM
    expect(js).toContain('kit-dialog-in'); // CSS embedded as text
  });

  it('kit.iife.min.js exposes the global `kit` namespace', () => {
    const js = readDist('kit.iife.min.js');
    expect(js).toMatch(/var kit=/);
    expect(js).toContain('kit-styles');
  });

  it('declarations are emitted for consumers', () => {
    const dts = readDist('index.d.ts');
    expect(dts).toContain('setTheme');
    expect(dts).toContain('toast');
    expect(dts).toMatch(/export \{[^}]*setTheme[^}]*toast[^}]*\}/);
  });
});
