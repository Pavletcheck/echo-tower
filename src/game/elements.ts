import { BOSSES_BY_ID, ENEMIES_BY_ID } from '../data/enemies';
import type { Element, FloorDef } from '../data/types';
import { elementMultiplier } from './battle/formulas';

export interface CounterPreview {
  dominant: Element | null;
  /** Стихии отряда, которые бьют сильнее (×1.25). */
  strong: Element[];
  /** Стихии отряда, которые бьют слабее (×0.8). */
  weak: Element[];
}

export function dominantElement(elements: readonly Element[]): Element | null {
  const counts = new Map<Element, number>();
  for (const element of elements) counts.set(element, (counts.get(element) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Контрстихии: доминирующая стихия врагов и сильные/слабые стихии игрока. */
export function counterPreview(attacker: readonly Element[], defenders: readonly Element[]): CounterPreview {
  const dominant = dominantElement(defenders);
  if (!dominant) return { dominant: null, strong: [], weak: [] };

  const present = [...new Set(attacker)];
  return {
    dominant,
    strong: present.filter((element) => elementMultiplier(element, dominant) > 1),
    weak: present.filter((element) => elementMultiplier(element, dominant) < 1),
  };
}

/** Все стихии врагов этажа, включая боссов: для превью контрпиков. */
export function floorEnemyElements(floor: FloorDef): Element[] {
  const elements: Element[] = [];

  for (const wave of floor.waves) {
    for (const stack of wave.enemies) {
      const boss = BOSSES_BY_ID[stack.enemyId];
      if (boss) {
        for (let index = 0; index < stack.count; index += 1) elements.push(boss.element);
        continue;
      }
      const enemy = ENEMIES_BY_ID[stack.enemyId];
      if (!enemy) continue;
      for (let index = 0; index < stack.count; index += 1) elements.push(enemy.element);
    }
  }

  return elements;
}

export function floorCounterPreview(floor: FloorDef, squadElements: readonly Element[]): CounterPreview {
  return counterPreview(squadElements, floorEnemyElements(floor));
}
