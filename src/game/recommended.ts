import { HEROES_BY_ID, heroPower } from '../data/heroes';
import type { Element, HeroDef, Role } from '../data/types';
import { elementBonus } from './config';
import { effectiveLevel } from './resonance';
import type { SaveV1 } from './save';

interface OwnedHero {
  hero: HeroDef;
  power: number;
}

function ownedHeroes(save: SaveV1): OwnedHero[] {
  const entries: OwnedHero[] = [];
  for (const [id, owned] of Object.entries(save.heroes)) {
    const hero = HEROES_BY_ID[id];
    if (!hero) continue;
    entries.push({ hero, power: heroPower(hero, effectiveLevel(save, id), owned.star) });
  }
  return entries.sort((a, b) => b.power - a.power);
}

function isHealer(role: Role): boolean {
  return role === 'oracle' || role === 'support';
}

/**
 * Детерминированный рекомендованный отряд: сильнейшая стихия, страж и целитель,
 * затем лучшие по мощи герои. Никогда не предлагает несуществующих героев.
 */
export function recommendedSquad(save: SaveV1): string[] {
  const entries = ownedHeroes(save);
  if (entries.length === 0) return [];

  const elementStats = new Map<Element, { count: number; power: number }>();
  for (const { hero, power } of entries) {
    const current = elementStats.get(hero.element) ?? { count: 0, power: 0 };
    current.count += 1;
    current.power += power;
    elementStats.set(hero.element, current);
  }

  const dominant = [...elementStats.entries()].sort((a, b) => {
    if (b[1].power !== a[1].power) return b[1].power - a[1].power;
    return b[1].count - a[1].count;
  })[0]?.[0];

  const preferred = dominant ? entries.filter((entry) => entry.hero.element === dominant) : entries;
  const picked: string[] = [];

  const add = (hero: HeroDef | undefined): void => {
    if (!hero || picked.includes(hero.id) || picked.length >= 5) return;
    picked.push(hero.id);
  };

  add(preferred.find((entry) => entry.hero.role === 'vanguard')?.hero ?? entries.find((entry) => entry.hero.role === 'vanguard')?.hero);
  add(preferred.find((entry) => isHealer(entry.hero.role))?.hero ?? entries.find((entry) => isHealer(entry.hero.role))?.hero);

  for (const entry of preferred) add(entry.hero);
  for (const entry of entries) add(entry.hero);

  return picked;
}

export interface SquadAdvice {
  size: number;
  hasTank: boolean;
  hasHealer: boolean;
  dominantElement: Element | null;
  dominantCount: number;
  bonus: number;
}

/** Короткая подсказка по стихиям и ролям для экрана отряда. */
export function squadAdvice(save: SaveV1): SquadAdvice {
  const squadHeroes = save.squad
    .map((id) => HEROES_BY_ID[id])
    .filter((hero): hero is HeroDef => Boolean(hero));

  const counts = new Map<Element, number>();
  for (const hero of squadHeroes) counts.set(hero.element, (counts.get(hero.element) ?? 0) + 1);

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    size: squadHeroes.length,
    hasTank: squadHeroes.some((hero) => hero.role === 'vanguard'),
    hasHealer: squadHeroes.some((hero) => isHealer(hero.role)),
    dominantElement: top?.[0] ?? null,
    dominantCount: top?.[1] ?? 0,
    bonus: elementBonus(top?.[1] ?? 0),
  };
}
