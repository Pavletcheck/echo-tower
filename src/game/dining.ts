import { DINING_BY_ID, type DiningBuffDef, type DiningBuffId } from '../data/dining';
import { diningEffectMultiplier } from './base';
import type { SaveV1 } from './save';

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function activeDay(save: SaveV1, at: number): boolean {
  return Boolean(save.dining) && save.dining.date === dayKey(new Date(at));
}

/** Новый день — новый выбор блюда. */
export function ensureDiningDay(save: SaveV1, date = new Date()): void {
  const day = dayKey(date);
  if (save.dining?.date === day) return;
  save.dining = { date: day, claimed: false, buff: null, battles: 0, goldUntil: 0 };
}

export function diningClaimedToday(save: SaveV1, date = new Date()): boolean {
  return save.dining?.date === dayKey(date) && save.dining.claimed === true;
}

export function canClaimDining(save: SaveV1, date = new Date()): boolean {
  return !diningClaimedToday(save, date);
}

/** Выдаёт один бафф на день. Повторный выбор в тот же день отклоняется. */
export function claimDining(save: SaveV1, buffId: DiningBuffId | string, date = new Date()): boolean {
  ensureDiningDay(save, date);
  if (save.dining.claimed) return false;

  const buff = DINING_BY_ID[buffId];
  if (!buff) return false;

  save.dining.claimed = true;
  save.dining.buff = buff.id;
  save.dining.battles = buff.kind === 'battle' ? buff.battles ?? 0 : 0;
  save.dining.goldUntil = buff.kind === 'gold' ? date.getTime() + (buff.durationMs ?? 0) : 0;
  if (buff.kind === 'essence') {
    save.currencies.essence += Math.round((buff.essence ?? 150) * diningEffectMultiplier(save));
  }
  return true;
}

/** Активный бафф: боевой по остатку боёв, золотой — по таймеру. */
export function activeDiningBuff(save: SaveV1, at = Date.now()): DiningBuffDef | null {
  if (!activeDay(save, at)) return null;
  const buff = save.dining.buff ? DINING_BY_ID[save.dining.buff] : undefined;
  if (!buff) return null;
  if (buff.kind === 'battle' && save.dining.battles > 0) return buff;
  if (buff.kind === 'gold' && save.dining.goldUntil > at) return buff;
  return null;
}

/** Модификаторы боя от столовой; пустой объект, если баффа нет. */
export function diningBattleModifiers(
  save: SaveV1,
  at = Date.now(),
): { hp?: number; atk?: number; spd?: number } {
  const buff = activeDiningBuff(save, at);
  if (!buff || buff.kind !== 'battle' || !buff.stat || typeof buff.value !== 'number') return {};
  const value = buff.value * diningEffectMultiplier(save);
  if (buff.stat === 'hp') return { hp: value };
  if (buff.stat === 'atk') return { atk: value };
  return { spd: value };
}

/** Боевой бафф тратится только после победы на этаже. */
export function consumeDiningBattle(save: SaveV1): void {
  if (!save.dining || save.dining.battles <= 0) return;
  save.dining.battles -= 1;
}

export function diningGoldMultiplier(save: SaveV1, at = Date.now()): number {
  const buff = activeDiningBuff(save, at);
  if (!buff || buff.kind !== 'gold') return 1;
  return 1 + (buff.value ?? 0) * diningEffectMultiplier(save);
}

export function diningGoldRemaining(save: SaveV1, at = Date.now()): number {
  if (!activeDay(save, at) || !save.dining || save.dining.goldUntil <= at) return 0;
  return save.dining.goldUntil - at;
}
