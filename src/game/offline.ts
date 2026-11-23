import { now } from '../core/time';
import { idleEssence, idleGold } from './idle';
import type { SaveV1 } from './save';

/** Минимальная пауза, после которой показываем сводку. */
export const OFFLINE_MIN_MS = 5 * 60 * 1000;

export interface OfflineReport {
  awayMs: number;
  gold: number;
  essence: number;
}

/** Доход, накопленный с прошлого визита; null, если пауза слишком короткая. */
export function offlineReport(save: SaveV1, at = now()): OfflineReport | null {
  const awayMs = at - save.lastSeen;
  if (!Number.isFinite(awayMs) || awayMs < OFFLINE_MIN_MS) return null;

  return {
    awayMs,
    gold: idleGold(save, at),
    essence: idleEssence(save, at),
  };
}
