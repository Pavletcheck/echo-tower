import { HEROES, HEROES_BY_ID } from '../data/heroes';
import { heroSave, squadAverageLevel } from './gacha';
import type { SaveV1 } from './save';

/** Подарок пропуска: выбор одного 5★ героя. */
const GIFT_PREFIX = 'passGift_';

export function passGiftHeroes(): string[] {
  return HEROES.filter((hero) => hero.rarity === 5).map((hero) => hero.id);
}

/** Пропуск куплен, но герой ещё не выбран. */
export function passGiftAvailable(save: SaveV1): boolean {
  return Boolean(save.flags.pass) && !passGiftClaimed(save);
}

export function passGiftClaimed(save: SaveV1): boolean {
  return Object.keys(save.flags).some((key) => key.startsWith(GIFT_PREFIX));
}

export function passGiftChosen(save: SaveV1): string | null {
  const key = Object.keys(save.flags).find((flag) => flag.startsWith(GIFT_PREFIX));
  return key ? key.slice(GIFT_PREFIX.length) : null;
}

/**
 * Выдаёт выбранного 5★ героя. Если он уже есть — даёт 30 осколков звёзд
 * вместо дубликата, чтобы выбор не был пустым.
 */
export function claimPassGift(save: SaveV1, heroId: string): boolean {
  if (!passGiftAvailable(save)) return false;
  const def = HEROES_BY_ID[heroId];
  if (!def || def.rarity !== 5) return false;

  save.flags[GIFT_PREFIX + heroId] = true;

  if (save.heroes[heroId]) {
    save.currencies.starShards[heroId] = (save.currencies.starShards[heroId] ?? 0) + 30;
    return true;
  }

  const created = heroSave(def);
  created.level = squadAverageLevel(save);
  save.heroes[heroId] = created;
  const empty = save.squad.findIndex((id) => !id || !save.heroes[id]);
  if (empty >= 0) {
    const next = [...save.squad];
    next[empty] = heroId;
    save.squad = next;
  }
  return true;
}
