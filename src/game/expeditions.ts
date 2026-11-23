import { hashString, Rng } from '../core/rng';
import { now } from '../core/time';
import { addMasterXp } from './base';
import type { SaveV1 } from './save';

export type ExpeditionType = '2h' | '4h' | '8h';

export interface ExpeditionConfig {
  hours: number;
  heroes: number;
  goldFactor: number;
  essence: number;
  crystalChance: number;
  crystals: number;
}

export const EXPEDITION_CONFIG: Record<ExpeditionType, ExpeditionConfig> = {
  '2h': { hours: 2, heroes: 2, goldFactor: 4, essence: 5, crystalChance: 0.2, crystals: 20 },
  '4h': { hours: 4, heroes: 3, goldFactor: 10, essence: 12, crystalChance: 0.35, crystals: 40 },
  '8h': { hours: 8, heroes: 5, goldFactor: 24, essence: 28, crystalChance: 0.5, crystals: 80 },
};

export interface ExpeditionReward {
  gold: number;
  essence: number;
  crystals: number;
}

export function expeditionOf(save: SaveV1, slot: number) {
  return save.expeditions.find((entry) => entry.slot === slot);
}

export function busyHeroes(save: SaveV1): Set<string> {
  const busy = new Set<string>();
  for (const entry of save.expeditions) for (const hero of entry.heroes) busy.add(hero);
  return busy;
}

export function canStart(save: SaveV1, slot: number, type: ExpeditionType, heroes: string[]): boolean {
  const config = EXPEDITION_CONFIG[type];
  if (expeditionOf(save, slot)) return false;
  if (heroes.length !== config.heroes) return false;
  if (new Set(heroes).size !== heroes.length) return false;

  const busy = busyHeroes(save);
  for (const heroId of heroes) {
    if (!save.heroes[heroId]) return false;
    if (busy.has(heroId)) return false;
  }
  return true;
}

export function startExpedition(
  save: SaveV1,
  slot: number,
  type: ExpeditionType,
  heroes: string[],
  at = now(),
): boolean {
  if (!canStart(save, slot, type, heroes)) return false;
  save.expeditions = save.expeditions.filter((entry) => entry.slot !== slot);
  save.expeditions.push({
    slot,
    type,
    heroes: [...heroes],
    endsAt: at + EXPEDITION_CONFIG[type].hours * 60 * 60 * 1000,
  });
  return true;
}

export function expeditionReady(save: SaveV1, slot: number, at = now()): boolean {
  const entry = expeditionOf(save, slot);
  return Boolean(entry && at >= entry.endsAt);
}

export function expeditionReward(save: SaveV1, slot: number): ExpeditionReward | null {
  const entry = expeditionOf(save, slot);
  if (!entry) return null;
  const config = EXPEDITION_CONFIG[entry.type];
  const floor = Math.max(1, save.tower.maxFloor);
  const rng = new Rng(hashString(`${entry.slot}|${entry.endsAt}|${entry.type}|${floor}`));

  return {
    gold: Math.floor(config.goldFactor * Math.pow(floor, 1.1)),
    essence: config.essence,
    crystals: rng.chance(config.crystalChance) ? config.crystals : 0,
  };
}

export function claimExpedition(save: SaveV1, slot: number, at = now()): ExpeditionReward | null {
  if (!expeditionReady(save, slot, at)) return null;
  const reward = expeditionReward(save, slot);
  if (!reward) return null;
  save.currencies.gold += reward.gold;
  save.currencies.essence += reward.essence;
  save.currencies.crystals += reward.crystals;
  save.expeditions = save.expeditions.filter((entry) => entry.slot !== slot);
  addMasterXp(save, 5);
  return reward;
}

export function speedUpExpedition(save: SaveV1, slot: number, ms = 60 * 60 * 1000, at = now()): boolean {
  const entry = expeditionOf(save, slot);
  if (!entry) return false;
  entry.endsAt = Math.max(at, entry.endsAt - ms);
  return true;
}
