import { ENGRAVINGS_BY_ID } from '../data/engravings';
import { GEAR_BY_ID } from '../data/gear';
import type { SaveV1 } from './save';

export interface LiveReward {
  gold?: number;
  crystals?: number;
  seals?: number;
  essence?: number;
  dust?: number;
  shards?: number;
  echoMarks?: number;
  glass?: number;
  item?: string;
}

/** Первый реально существующий герой отряда — получатель осколков. */
export function firstSquadHero(save: SaveV1): string | null {
  return save.squad.find((id) => Boolean(id && save.heroes[id])) ?? null;
}

/** Единая выдача наград календаря, почты, пропуска и ивента. */
export function grantLiveReward(save: SaveV1, reward: LiveReward): void {
  save.currencies.gold += reward.gold ?? 0;
  save.currencies.crystals += reward.crystals ?? 0;
  save.currencies.seals += reward.seals ?? 0;
  save.currencies.essence += reward.essence ?? 0;
  save.currencies.dust += reward.dust ?? 0;
  save.currencies.echoMarks += reward.echoMarks ?? 0;
  save.live.event.currency += reward.glass ?? 0;

  if (reward.shards) {
    const heroId = firstSquadHero(save);
    if (heroId) {
      save.currencies.starShards[heroId] = (save.currencies.starShards[heroId] ?? 0) + reward.shards;
    }
  }

  if (reward.item) {
    if (ENGRAVINGS_BY_ID[reward.item]) save.inventory.engravings.push(reward.item);
    else if (GEAR_BY_ID[reward.item]) save.inventory.gear.push(reward.item);
    else if (reward.item === 'skin_nira_glass') save.flags.skin_nira = true;
    else save.flags[reward.item] = true;
  }
}
