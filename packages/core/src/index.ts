/**
 * @kit/core — ultra-light UI kit core.
 *
 * Importing this module:
 *   1. injects the kit CSS once (<style id="kit-styles">)
 *   2. applies the persisted theme
 *   3. wires dialog delegation + tabs
 *
 * The CSS itself is pure (no JS needed to style) — JS only adds behavior,
 * so `<link>`-only users can load dist/kit.min.css and skip the script.
 */
import tokensCss from './styles/tokens.css';
import resetCss from './styles/base/reset.css';
import utilitiesCss from './styles/base/utilities.css';
import avatarCss from './styles/components/avatar.css';
import badgeCss from './styles/components/badge.css';
import buttonCss from './styles/components/button.css';
import cardCss from './styles/components/card.css';
import choiceCss from './styles/components/choice.css';
import dialogCss from './styles/components/dialog.css';
import fieldCss from './styles/components/field.css';
import inputCss from './styles/components/input.css';
import skeletonCss from './styles/components/skeleton.css';
import spinnerCss from './styles/components/spinner.css';
import tabsCss from './styles/components/tabs.css';
import toastCss from './styles/components/toast.css';

import { i18n, type Messages, type TVariables } from './i18n/index';
import { initDialogs } from './components/dialog';
import { initTabs } from './components/tabs';
import { toast, type ToastOptions } from './components/toast';
import { getTheme, initTheme, setTheme, type ThemePreference } from './theme';

/** Full kit CSS (tokens + base + components), as one string. */
export const css = [
  tokensCss,
  resetCss,
  utilitiesCss,
  avatarCss,
  badgeCss,
  buttonCss,
  cardCss,
  choiceCss,
  dialogCss,
  fieldCss,
  inputCss,
  skeletonCss,
  spinnerCss,
  tabsCss,
  toastCss,
].join('\n');

export const STYLE_ID = 'kit-styles';

/** Inject the kit CSS once. Idempotent. */
export function injectStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  doc.head.appendChild(style);
}

/* i18n helpers bound to the default instance (en + vi built in). */
export function t(key: string, variables?: TVariables): string {
  return i18n.t(key, variables);
}
export function setLocale(locale: string): void {
  i18n.setLocale(locale);
}
export function getLocale(): string {
  return i18n.getLocale();
}
export function registerMessages(locale: string, messages: Messages): void {
  i18n.registerMessages(locale, messages);
}

let booted = false;

function boot(): void {
  if (booted || typeof document === 'undefined') return;
  booted = true;
  injectStyles();
  initTheme();
  initDialogs();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initTabs(), { once: true });
  } else {
    initTabs();
  }
}

boot();

export { getTheme, initTheme, setTheme, toast, initDialogs, initTabs, i18n };
export type { Messages, TVariables, ThemePreference, ToastOptions };

const kit = {
  css,
  injectStyles,
  t,
  setLocale,
  getLocale,
  registerMessages,
  setTheme,
  getTheme,
  toast,
  initTabs,
  i18n,
};

export default kit;
