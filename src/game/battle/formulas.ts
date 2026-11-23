import type { Element } from '../../data/types';

export const MITIGATION_K = 800;

/** Убывающая отдача защиты: 800/(800+DEF). */
export function mitigation(defense: number): number {
  return MITIGATION_K / (MITIGATION_K + Math.max(0, defense));
}

const ELEMENT_BEATS: Record<Element, Element> = {
  echo: 'ash',
  ash: 'frost',
  frost: 'rot',
  rot: 'light',
  light: 'echo',
};

export const ELEMENT_CHAIN: readonly Element[] = ['echo', 'ash', 'frost', 'rot', 'light'];

export function elementMultiplier(attacker: Element, defender: Element): number {
  if (ELEMENT_BEATS[attacker] === defender) return 1.25;
  if (ELEMENT_BEATS[defender] === attacker) return 0.8;
  return 1;
}

export function damageAfterMitigation(atk: number, skillMultiplier: number, defense: number): number {
  return atk * skillMultiplier * mitigation(defense);
}

/** Крит всегда тратит бросок RNG — иначе симуляции расходятся. */
export function critMultiplier(roll: number, critChance: number, critDamage: number): number {
  return roll < critChance ? critDamage : 1;
}

export function clampDamage(value: number): number {
  return Math.max(1, value);
}

export function totalHpFraction(units: ReadonlyArray<{ hp: number; maxHp: number; alive: boolean }>): number {
  const total = units.reduce((sum, unit) => sum + unit.maxHp, 0);
  if (total <= 0) return 0;
  return units.reduce((sum, unit) => sum + Math.max(0, unit.hp), 0) / total;
}
