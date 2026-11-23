import { now } from '../core/time';
import { idleEssencePerMinute, idleGoldPerMinute } from './config';
import type { SaveV1 } from './save';

export function idleCapHours(save: SaveV1): number {
  return save.flags.pass ? 12 : 8;
}

export function idleElapsedMs(save: SaveV1, at = now()): number {
  const cap = idleCapHours(save) * 60 * 60 * 1000;
  const elapsed = at - save.idle.lastClaim;
  if (elapsed <= 0) return 0;
  return Math.min(cap, elapsed);
}

export function idleGold(save: SaveV1, at = now()): number {
  const perMinute = idleGoldPerMinute(save.tower.maxFloor);
  const minutes = idleElapsedMs(save, at) / 60_000;
  return Math.floor(perMinute * minutes);
}

export function idleEssence(save: SaveV1, at = now()): number {
  const perMinute = idleEssencePerMinute(save.tower.maxFloor);
  const minutes = idleElapsedMs(save, at) / 60_000;
  return Math.floor(perMinute * minutes);
}

/** Забирает накопленное; multiplier = 2 после rewarded-рекламы. */
export function claimIdle(save: SaveV1, multiplier = 1, at = now()): number {
  const amount = Math.floor(idleGold(save, at) * multiplier);
  const essence = Math.floor(idleEssence(save, at) * multiplier);
  save.currencies.gold += amount;
  save.currencies.essence += essence;
  save.idle.lastClaim = at;
  return amount;
}

export function idleProgress(save: SaveV1, at = now()): number {
  const cap = idleCapHours(save) * 60 * 60 * 1000;
  return Math.min(1, idleElapsedMs(save, at) / cap);
}
