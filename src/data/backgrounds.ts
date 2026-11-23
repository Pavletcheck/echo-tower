/**
 * Боевые фоны глав по манифесту BG-01…BG-10.
 * Имена и порядок фиксированы: менять пути нельзя, только класть новые файлы.
 */
export const BATTLE_BACKGROUND_COUNT = 10;

export function battleBackground(chapter: number): string {
  const index = Math.min(BATTLE_BACKGROUND_COUNT, Math.max(1, Math.round(chapter)));
  return `assets/bg/battle/ch${String(index).padStart(2, '0')}.webp`;
}
