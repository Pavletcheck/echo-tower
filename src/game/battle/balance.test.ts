import { describe, expect, it } from 'vitest';
import { FLOORS } from '../../data/floors';
import { HEROES_BY_ID } from '../../data/heroes';
import { allyFromHero } from './factory';
import { simulateFloor } from './floor';
import type { UnitInit } from './types';

const SQUAD = ['belquist', 'iria', 'morvain', 'cassian', 'sylvana'] as const;

function squad(level: number, star: number): UnitInit[] {
  return SQUAD.map((id, slot) => {
    const hero = HEROES_BY_ID[id];
    if (!hero) throw new Error(`missing ${id}`);
    return allyFromHero(hero, { slot, star, level });
  });
}

function firstFloor(number: number) {
  const floor = FLOORS.find((item) => item.floor === number);
  if (!floor) throw new Error(`missing floor ${number}`);
  return floor;
}

describe('floor simulation', () => {
  it('clears the first floor with the starter squad', () => {
    const result = simulateFloor(firstFloor(1), squad(10, 5), 101);
    expect(result.outcome).toBe('win');
    expect(result.wavesCleared).toBe(3);
  });

  it('clears the final floor with an endgame squad', () => {
    const result = simulateFloor(firstFloor(100), squad(90, 6), 202);
    expect(result.outcome).toBe('win');
    expect(result.wavesCleared).toBe(3);
  });

  it('keeps every floor within a sane time budget', () => {
    for (const floorNumber of [1, 25, 50, 75, 100]) {
      const result = simulateFloor(firstFloor(floorNumber), squad(50, 5), 300 + floorNumber);
      expect(result.timeMs).toBeLessThanOrEqual(135_000);
      expect(result.waves.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic across runs', () => {
    const first = simulateFloor(firstFloor(30), squad(30, 5), 555);
    const second = simulateFloor(firstFloor(30), squad(30, 5), 555);
    expect(first.outcome).toBe(second.outcome);
    expect(first.damageDealt).toBe(second.damageDealt);
    expect(first.wavesCleared).toBe(second.wavesCleared);
  });
});
