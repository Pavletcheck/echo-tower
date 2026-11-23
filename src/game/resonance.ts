import { levelCap, RESONANCE_SLOTS } from './config';
import type { SaveV1 } from './save';

export { RESONANCE_SLOTS };

/** Пять слотов резонанса без пустых значений и дублей. */
export function resonanceSlots(save: SaveV1): string[] {
  const raw = Array.isArray(save.resonance) ? save.resonance : [];
  return [...new Set(raw.filter((id) => typeof id === 'string' && id.length > 0 && Boolean(save.heroes[id])))].slice(
    0,
    RESONANCE_SLOTS,
  );
}

/** Уровень резонанса = уровень пятого по силе героя коллекции. */
export function resonanceLevel(save: SaveV1): number {
  const levels = Object.values(save.heroes)
    .map((hero) => Math.max(1, Math.floor(hero.level)))
    .sort((a, b) => b - a);
  if (levels.length === 0) return 1;
  return Math.max(1, levels[Math.min(RESONANCE_SLOTS - 1, levels.length - 1)] ?? 1);
}

export function isResonating(save: SaveV1, heroId: string): boolean {
  return resonanceSlots(save).includes(heroId);
}

/**
 * Эффективный уровень: герой в слоте резонанса подтягивается к топ-5,
 * но не выше капа своей звезды. Сохранённый уровень не мутируется.
 */
export function effectiveLevel(save: SaveV1, heroId: string): number {
  const hero = save.heroes[heroId];
  if (!hero) return 1;
  const stored = Math.max(1, Math.floor(hero.level));
  if (!isResonating(save, heroId)) return stored;
  return Math.min(levelCap(hero.star), Math.max(stored, resonanceLevel(save)));
}

export function setResonanceSlot(save: SaveV1, slot: number, heroId: string): boolean {
  if (!Number.isInteger(slot) || slot < 0 || slot >= RESONANCE_SLOTS) return false;
  if (!save.heroes[heroId]) return false;

  const slots = Array.from({ length: RESONANCE_SLOTS }, (_, index) => save.resonance?.[index] ?? '');
  const existing = slots.indexOf(heroId);
  if (existing >= 0 && existing !== slot) slots[existing] = '';
  slots[slot] = heroId;
  save.resonance = slots.filter(Boolean);
  return true;
}

export function clearResonanceSlot(save: SaveV1, slot: number): boolean {
  if (!Number.isInteger(slot) || slot < 0 || slot >= RESONANCE_SLOTS) return false;
  const slots = Array.from({ length: RESONANCE_SLOTS }, (_, index) => save.resonance?.[index] ?? '');
  if (!slots[slot]) return false;
  slots[slot] = '';
  save.resonance = slots.filter(Boolean);
  return true;
}
