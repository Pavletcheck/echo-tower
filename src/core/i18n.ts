import { signal } from '@preact/signals';
import en from '../data/i18n/en.json';
import ru from '../data/i18n/ru.json';
import type { Locale } from '../game/save';

type Dict = Record<string, string>;

const DICTS: Record<Locale, Dict> = { ru, en };

export const locale$ = signal<Locale>('ru');

export function setLocale(locale: Locale): void {
  locale$.value = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const dict = DICTS[locale$.value];
  let value = dict[key] ?? DICTS.ru[key] ?? key;

  if (params) {
    for (const [name, raw] of Object.entries(params)) {
      value = value.replaceAll(`{${name}}`, String(raw));
    }
  }

  return value;
}
