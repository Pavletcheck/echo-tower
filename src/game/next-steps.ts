import { now } from '../core/time';
import { HEROES_BY_ID } from '../data/heroes';
import { levelCap, levelGold } from './config';
import { fallenHeroes } from './hero-loss';
import { starterClaimableCount } from './starter';
import { squadAdvice } from './recommended';
import type { SaveV1 } from './save';

export type NextStepId = 'free-ten' | 'starter' | 'squad' | 'reassemble' | 'roles' | 'upgrade' | 'battle';

export interface NextStep {
  id: NextStepId;
  /** Этаж для шага battle. */
  floor?: number;
  /** Герой для шага upgrade. */
  heroId?: string;
  /** Цена усиления. */
  cost?: number;
}

const MAX_STEPS = 4;

/**
 * «Что делать дальше» — короткий детерминированный список действий.
 * Используется и в лобби, и в панели после первого боя/поражения.
 */
export function nextSteps(save: SaveV1, at = now()): NextStep[] {
  const steps: NextStep[] = [];

  if (!save.gacha.beginnerUsed) steps.push({ id: 'free-ten' });
  if (fallenHeroes(save).length > 0) steps.push({ id: 'reassemble' });
  if (starterClaimableCount(save, at) > 0) steps.push({ id: 'starter' });

  const squadSize = save.squad.filter((id) => Boolean(HEROES_BY_ID[id] && save.heroes[id])).length;
  if (squadSize < 5) steps.push({ id: 'squad' });
  else {
    const advice = squadAdvice(save);
    if (!advice.hasTank || !advice.hasHealer) steps.push({ id: 'roles' });
  }

  let cheapest: { heroId: string; cost: number } | null = null;
  for (const heroId of save.squad) {
    const owned = save.heroes[heroId];
    if (!owned) continue;
    if (owned.level >= levelCap(owned.star)) continue;
    const cost = levelGold(owned.level);
    if (save.currencies.gold < cost) continue;
    if (!cheapest || cost < cheapest.cost) cheapest = { heroId, cost };
  }
  if (cheapest) steps.push({ id: 'upgrade', heroId: cheapest.heroId, cost: cheapest.cost });

  if (save.tower.maxFloor <= 100) {
    steps.push({ id: 'battle', floor: save.tower.maxFloor });
  }

  return steps.slice(0, MAX_STEPS);
}
