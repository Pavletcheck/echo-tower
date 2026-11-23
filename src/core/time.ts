/** Единственная точка получения времени: позже сюда добавится серверная поправка. */
export function now(): number {
  return Date.now();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** «1 ч 20 мин», «45 с» — для таймеров и оффлайн-дохода. */
export function formatDuration(ms: number, locale: 'ru' | 'en' = 'ru'): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (locale === 'en') {
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  if (hours > 0) return `${hours} ч ${minutes} мин`;
  if (minutes > 0) return `${minutes} мин ${seconds} с`;
  return `${seconds} с`;
}

export function formatNumber(value: number, locale: 'ru' | 'en' = 'ru'): string {
  return Math.round(value).toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU');
}
