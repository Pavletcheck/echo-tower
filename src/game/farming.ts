import { getFloor } from '../data/floors';
import { xpMultiplier } from './base';
import { REPEAT_GOLD_RATE, levelCap, levelXp } from './config';
import { diningGoldMultiplier } from './dining';
import { addPassXp } from './pass';
import type { SaveV1 } from './save';

export interface RepeatReward {
  gold: number;
  shards: number;
  xp: number;
  gearId?: string;
}

export interface SweepResult extends RepeatReward {
  floor: number;
}

/** Награда за повторное прохождение пройденного этажа: только 10% золота. */
export function repeatReward(save: SaveV1, floorNumber: number): RepeatReward | null {
  const floor = getFloor(floorNumber);
  if (!floor) return null;
  if (!save.tower.clears[String(floorNumber)]) return null;

  const gold = Math.round(floor.reward.gold * REPEAT_GOLD_RATE * diningGoldMultiplier(save));
  return {
    gold,
    shards: 0,
    xp: 0,
  };
}

/** Начисляет XP отряду с повышением уровней и уважает кап ★. */
export function grantSquadXp(save: SaveV1, xp: number): number {
  let levels = 0;
  const amount = Math.max(0, Math.round(xp * xpMultiplier(save)));
  for (const heroId of save.squad) {
    const hero = save.heroes[heroId];
    if (!hero) continue;
    hero.xp += amount;
    const cap = levelCap(hero.star);
    while (hero.level < cap && hero.xp >= levelXp(hero.level)) {
      hero.xp -= levelXp(hero.level);
      hero.level += 1;
      levels += 1;
    }
  }
  return levels;
}

export function autoNextFloor(_save: SaveV1, currentFloor: number): number | null {
  if (!Number.isFinite(currentFloor) || currentFloor >= 100) return null;
  return Math.max(1, Math.floor(currentFloor) + 1);
}

/**
 * Sweep пройденного этажа: та же награда, что и за повторный бой,
 * но без анимации — только 10% золота.
 */
export function sweepFloor(save: SaveV1, floorNumber: number): SweepResult | null {
  const reward = repeatReward(save, floorNumber);
  if (!reward) return null;

  save.currencies.gold += reward.gold;
  addPassXp(save, 1);
  return { ...reward, floor: floorNumber };
}
