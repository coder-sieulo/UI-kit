/**
 * Tiny i18n (~1KB) — dot-path lookup, fallback locale, {interpolation},
 * plural via Intl.PluralRules (platform built-in, no bundled tables),
 * optional <html lang>/<html dir> sync.
 */
import en from './locales/en.json';
import vi from './locales/vi.json';

export type MessageNode = string | MessageTree;

export interface MessageTree {
  [key: string]: MessageNode;
}

export type Messages = MessageTree;
export type MessageBundles = Record<string, Messages>;
export type TVariables = Record<string, string | number>;

export interface I18nOptions {
  locale?: string;
  fallbackLocale?: string;
  messages?: MessageBundles;
  /** Keep <html lang> and <html dir> in sync (browser only). Default: true. */
  syncDocument?: boolean;
}

export interface I18n {
  t(key: string, variables?: TVariables): string;
  setLocale(locale: string): void;
  getLocale(): string;
  registerMessages(locale: string, messages: Messages): void;
  /** Subscribe to locale changes; returns an unsubscribe function. */
  subscribe(listener: (locale: string) => void): () => void;
}

const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi', 'ckb']);
const pluralRules = new Map<string, Intl.PluralRules>();

function pluralCategory(locale: string, count: number): string {
  let rules = pluralRules.get(locale);
  if (!rules) {
    try {
      rules = new Intl.PluralRules(locale);
    } catch {
      rules = new Intl.PluralRules('en');
    }
    pluralRules.set(locale, rules);
  }
  return rules.select(count);
}

function lookup(messages: Messages | undefined, key: string): MessageNode | undefined {
  if (!messages) return undefined;
  let node: MessageNode | undefined = messages;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = node[part];
  }
  return node;
}

function deepMerge(base: Messages, extra: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const prev = out[key];
    if (typeof value === 'object' && typeof prev === 'object' && prev !== null) {
      out[key] = deepMerge(prev, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function interpolate(template: string, variables?: TVariables): string {
  if (!variables) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in variables ? String(variables[name]) : match,
  );
}

export function createI18n(options: I18nOptions = {}): I18n {
  const bundles: MessageBundles = { ...(options.messages ?? {}) };
  const fallbackLocale = options.fallbackLocale ?? 'en';
  const syncDocument = options.syncDocument ?? true;
  const listeners = new Set<(locale: string) => void>();
  let locale = options.locale ?? 'en';

  function pick(localeCode: string, key: string, variables?: TVariables): string | undefined {
    let value = lookup(bundles[localeCode], key);
    if (value === undefined && localeCode !== fallbackLocale) {
      value = lookup(bundles[fallbackLocale], key);
    }
    if (value === undefined) return undefined;
    if (typeof value === 'object') {
      const count = typeof variables?.count === 'number' ? variables.count : 0;
      const category = pluralCategory(locale, count);
      const candidates = [value[category], value.other];
      const picked = candidates.find((c) => typeof c === 'string');
      if (picked === undefined || typeof picked !== 'string') return undefined;
      value = picked;
    }
    return interpolate(value, variables);
  }

  return {
    t(key, variables) {
      return pick(locale, key, variables) ?? key;
    },
    setLocale(next) {
      if (next === locale) return;
      locale = next;
      if (syncDocument && typeof document !== 'undefined') {
        const root = document.documentElement;
        root.lang = next;
        const base = next.split('-')[0] ?? next;
        root.dir = RTL_LANGUAGES.has(base) ? 'rtl' : 'ltr';
      }
      for (const listener of listeners) listener(locale);
    },
    getLocale() {
      return locale;
    },
    registerMessages(localeCode, messages) {
      bundles[localeCode] = deepMerge(bundles[localeCode] ?? {}, messages);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Default instance shipped with the kit (en + vi included). */
export const i18n = createI18n({ messages: { en, vi } });
