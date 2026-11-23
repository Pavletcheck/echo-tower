import { HEROES_BY_ID } from '../data/heroes';
import type { BattleResult, FloorBattleResult } from './battle/types';
import { heroSave } from './gacha';
import type { SaveV1 } from './save';

export interface FallenHero {
  heroId: string;
  essence: number;
}

export interface ReassembleCost {
  gold: number;
  essence: number;
}

/** ID героев, которые погибли к концу боя (включая прошлые волны). */
export function fallenFromResult(result: BattleResult | FloorBattleResult): string[] {
  const allies = 'allies' in result ? result.allies : [];
  const ids = allies.filter((unit) => !unit.alive || unit.hp <= 0).map((unit) => unit.defId);
  return [...new Set(ids)];
}

/**
 * Убирает павших героев из коллекции и отряда, возвращает снаряжение в инвентарь
 * и оставляет эссенцию героя.
 */
export function applyHeroDeaths(save: SaveV1, heroIds: readonly string[]): string[] {
  const removed: string[] = [];
  for (const heroId of [...new Set(heroIds)]) {
    const hero = save.heroes[heroId];
    const def = HEROES_BY_ID[heroId];
    if (!hero || !def) continue;

    for (const stone of hero.engravingSlots ?? []) {
      if (stone) save.inventory.engravings.push(stone);
    }
    for (const item of Object.values(hero.gear ?? {})) {
      if (item) save.inventory.gear.push(item);
    }

    delete save.heroes[heroId];
    save.squad = save.squad.map((id) => (id === heroId ? '' : id));
    save.heroEssences[heroId] = (save.heroEssences[heroId] ?? 0) + 1;
    save.currencies.essence += reassembleCost(heroId).essence;
    removed.push(heroId);
  }
  return removed;
}

/** Павшие герои, которых ещё можно собрать из эссенции. */
export function fallenHeroes(save: SaveV1): FallenHero[] {
  return Object.entries(save.heroEssences)
    .filter(([heroId, essence]) => essence > 0 && !save.heroes[heroId] && Boolean(HEROES_BY_ID[heroId]))
    .map(([heroId, essence]) => ({ heroId, essence }));
}

export function reassembleCost(heroId: string): ReassembleCost {
  const hero = HEROES_BY_ID[heroId];
  const rarity = hero?.rarity ?? 3;
  return {
    gold: 200 + rarity * 100,
    essence: 60 + rarity * 30,
  };
}

export function canReassemble(save: SaveV1, heroId: string): boolean {
  if (save.heroes[heroId]) return false;
  if ((save.heroEssences[heroId] ?? 0) <= 0) return false;
  const cost = reassembleCost(heroId);
  return save.currencies.gold >= cost.gold && save.currencies.essence >= cost.essence;
}

/** Собирает героя заново: базовые ★/уровень, пустые скиллы и артефакт. */
export function reassembleHero(save: SaveV1, heroId: string): boolean {
  if (!canReassemble(save, heroId)) return false;
  const hero = HEROES_BY_ID[heroId];
  if (!hero) return false;

  const cost = reassembleCost(heroId);
  save.currencies.gold -= cost.gold;
  save.currencies.essence -= cost.essence;
  save.heroEssences[heroId] = Math.max(0, (save.heroEssences[heroId] ?? 0) - 1);
  if (save.heroEssences[heroId] === 0) delete save.heroEssences[heroId];

  save.heroes[heroId] = heroSave(hero);
  const empty = save.squad.findIndex((id) => !id);
  if (empty >= 0) {
    const next = [...save.squad];
    next[empty] = heroId;
    save.squad = next;
  }
  return true;
}
