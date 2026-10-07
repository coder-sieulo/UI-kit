import { describe, expect, it } from 'vitest';
import { createI18n, i18n } from '../packages/core/src/i18n/index';

describe('i18n', () => {
  it('resolves dot-path keys from built-in bundles (en default)', () => {
    expect(i18n.getLocale()).toBe('en');
    expect(i18n.t('dialog.close')).toBe('Close');
  });

  it('translates Vietnamese after setLocale', () => {
    const i = createI18n({ messages: { en: { dialog: { close: 'Close' } }, vi: { dialog: { close: 'Đóng' } } } });
    i.setLocale('vi');
    expect(i.t('dialog.close')).toBe('Đóng');
  });

  it('falls back to the fallback locale for missing keys', () => {
    const i = createI18n({
      locale: 'vi',
      messages: { en: { onlyEnglish: 'English only' }, vi: {} },
    });
    expect(i.t('onlyEnglish')).toBe('English only');
  });

  it('interpolates {variables}', () => {
    const i = createI18n({ messages: { en: { greet: 'Hello {name}, you have {count} messages' } } });
    expect(i.t('greet', { name: 'An', count: 3 })).toBe('Hello An, you have 3 messages');
  });

  it('leaves unknown placeholders untouched', () => {
    const i = createI18n({ messages: { en: { greet: 'Hi {name}' } } });
    expect(i.t('greet')).toBe('Hi {name}');
  });

  it('selects English plural forms via Intl.PluralRules', () => {
    const i = createI18n({
      messages: { en: { items: { one: '{count} item', other: '{count} items' } } },
    });
    expect(i.t('items', { count: 1 })).toBe('1 item');
    expect(i.t('items', { count: 5 })).toBe('5 items');
  });

  it('uses the "other" form for Vietnamese (no plural distinction)', () => {
    const i = createI18n({
      locale: 'vi',
      messages: { en: { items: { one: '{count} item', other: '{count} items' } }, vi: { items: { other: '{count} mục' } } },
    });
    expect(i.t('items', { count: 1 })).toBe('1 mục');
    expect(i.t('items', { count: 5 })).toBe('5 mục');
  });

  it('returns the key itself when missing everywhere', () => {
    expect(i18n.t('nope.missing')).toBe('nope.missing');
  });

  it('notifies subscribers on setLocale and supports unsubscribe', () => {
    const i = createI18n({ messages: { en: {}, vi: {} } });
    const seen: string[] = [];
    const unsubscribe = i.subscribe((locale) => seen.push(locale));
    i.setLocale('vi');
    unsubscribe();
    i.setLocale('en');
    expect(seen).toEqual(['vi']);
  });

  it('deep-merges registerMessages over existing bundles', () => {
    const i = createI18n({ messages: { en: { a: { b: 'old', c: 'keep' } } } });
    i.registerMessages('en', { a: { b: 'new' } });
    expect(i.t('a.b')).toBe('new');
    expect(i.t('a.c')).toBe('keep');
  });
});
