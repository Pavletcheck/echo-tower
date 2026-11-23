import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { effectiveHp, selectEnemyTarget } from './ai';
import type { Unit } from './types';

function fakeUnit(partial: Partial<Unit>): Unit {
  return {
    uid: 'u',
    defId: 'u',
    name: 'u',
    side: 'ally',
    slot: 0,
    role: 'ranger',
    element: 'echo',
    skills: [],
    isBoss: false,
    hp: 100,
    maxHp: 100,
    def: 0,
    alive: true,
    statuses: [],
    ...partial,
  } as unknown as Unit;
}

describe('target selection', () => {
  it('prefers a weak backline hero over a strong front tank', () => {
    const tank = fakeUnit({ uid: 'tank', hp: 6_000, maxHp: 6_000, def: 300, slot: 0, role: 'vanguard' });
    const weak = fakeUnit({ uid: 'weak', hp: 450, maxHp: 450, def: 20, slot: 4, role: 'ranger' });
    const attacker = fakeUnit({ uid: 'attacker', role: 'blade' });

    expect(effectiveHp(weak)).toBeLessThan(effectiveHp(tank));
    expect(selectEnemyTarget(attacker, [tank, weak])?.uid).toBe('weak');
  });

  it('switches to the tank when it is nearly dead', () => {
    const tank = fakeUnit({ uid: 'tank', hp: 120, maxHp: 6_000, def: 300, slot: 0, role: 'vanguard' });
    const weak = fakeUnit({ uid: 'weak', hp: 450, maxHp: 450, def: 20, slot: 4, role: 'ranger' });
    const attacker = fakeUnit({ uid: 'attacker' });

    expect(selectEnemyTarget(attacker, [tank, weak])?.uid).toBe('tank');
  });

  it('targets the weak hero more often than the tank but does not ignore the tank', () => {
    const tank = fakeUnit({ uid: 'tank', hp: 6_000, maxHp: 6_000, def: 300, slot: 0, role: 'vanguard' });
    const weak = fakeUnit({ uid: 'weak', hp: 450, maxHp: 450, def: 20, slot: 4, role: 'ranger' });
    const attacker = fakeUnit({ uid: 'attacker' });
    const rng = new Rng(2026);

    let weakHits = 0;
    let tankHits = 0;
    for (let index = 0; index < 200; index += 1) {
      const target = selectEnemyTarget(attacker, [tank, weak], rng);
      if (target?.uid === 'weak') weakHits += 1;
      if (target?.uid === 'tank') tankHits += 1;
    }

    expect(weakHits).toBeGreaterThan(tankHits);
    expect(tankHits).toBeGreaterThan(0);
  });
});
