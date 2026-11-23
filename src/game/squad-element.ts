import type { Element } from '../data/types';
import { HEROES_BY_ID } from '../data/heroes';
import { elementBonus } from './config';
import type { SaveV1 } from './save';

export interface SquadElementBonus {
  element: Element | null;
  count: number;
  /** Процент ATK: 0, 5, 10 или 18. */
  bonus: number;
}

/** Доминирующая стихия отряда и реальный бонус ATK, который получает бой. */
export function squadElementBonus(save: SaveV1): SquadElementBonus {
  const elements = squadElements(save);
  const counts = new Map<Element, number>();
  for (const element of elements) counts.set(element, (counts.get(element) ?? 0) + 1);

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    element: top?.[0] ?? null,
    count: top?.[1] ?? 0,
    bonus: elementBonus(top?.[1] ?? 0),
  };
}

export function squadElements(save: SaveV1): Element[] {
  const elements: Element[] = [];
  for (const heroId of save.squad) {
    const hero = HEROES_BY_ID[heroId];
    if (!hero || !save.heroes[heroId]) continue;
    elements.push(hero.element);
  }
  return elements;
}

/** Применяет бонус стихий к бонусу экипировки. */
export function withElementAtk<T extends { atk: number; specials: string[] }>(bonus: T, atkFraction: number): T {
  if (atkFraction <= 0) return bonus;
  return {
    ...bonus,
    atk: bonus.atk + atkFraction,
    specials: [...bonus.specials],
  };
}
