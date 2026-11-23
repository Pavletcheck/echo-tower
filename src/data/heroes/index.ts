import type { Element, HeroDef, Role } from '../types';
import { FOUR_STAR } from './four-star';
import { FIVE_STAR } from './five-star';
import { THREE_STAR } from './three-star';

export {
  ELEMENT_COLOR,
  ELEMENT_EN,
  ELEMENT_RU,
  ROLE_EN,
  ROLE_ORDER,
  ROLE_RU,
  elementName,
  roleName,
} from './common';

export { H, S } from './common';
export type { HeroInput, SkillOptions, SkillSpec } from './common';

/** 32 героя: 8 в 5★-тире (включая сюжетную Ниру), 12 в 4★, 12 в 3★. */
export const HEROES: readonly HeroDef[] = [...FIVE_STAR, ...FOUR_STAR, ...THREE_STAR];

export const HEROES_BY_ID: Record<string, HeroDef> = Object.fromEntries(
  HEROES.map((hero) => [hero.id, hero]),
);

export function heroName(id: string, locale: 'ru' | 'en'): string {
  const hero = HEROES_BY_ID[id];
  if (!hero) return id;
  return locale === 'ru' ? hero.nameRu : hero.nameEn;
}

export function heroesByRarity(rarity: 3 | 4 | 5): readonly HeroDef[] {
  return HEROES.filter((hero) => hero.rarity === rarity);
}

export function heroesByRole(role: Role): readonly HeroDef[] {
  return HEROES.filter((hero) => hero.role === role);
}

export function heroesByElement(element: Element): readonly HeroDef[] {
  return HEROES.filter((hero) => hero.element === element);
}

/** Грубая оценка силы для сортировки в UI: не боевая формула. */
export function heroPower(hero: HeroDef, level: number, star: number): number {
  const starFactor = 1 + (star - 1) * 0.25;
  return Math.round((hero.base.hp * 0.12 + hero.base.atk * 1.4 + hero.base.def * 0.8) * level * starFactor);
}
