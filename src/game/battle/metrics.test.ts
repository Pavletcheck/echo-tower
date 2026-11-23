import { describe, expect, it } from 'vitest';
import { allyBattleStats, damageShare, mergeBattleStats } from './metrics';
import type { UnitBattleStats } from './types';

function line(uid: string, damage: number, healing = 0, taken = 0): UnitBattleStats {
  return {
    uid,
    defId: uid,
    name: uid,
    side: 'ally',
    damageDealt: damage,
    damageTaken: taken,
    healing,
  };
}

describe('battle metrics', () => {
  it('sums damage, healing and taken damage across waves', () => {
    const first = [line('ally_thorn', 100, 10, 50), line('ally_neya', 40, 80, 20)];
    const second = [line('ally_thorn', 60, 0, 30), line('ally_neya', 20, 40, 10)];

    const merged = mergeBattleStats(first, second);
    const thorn = merged.find((entry) => entry.uid === 'ally_thorn');
    const neya = merged.find((entry) => entry.uid === 'ally_neya');

    expect(thorn).toMatchObject({ damageDealt: 160, healing: 10, damageTaken: 80 });
    expect(neya).toMatchObject({ damageDealt: 60, healing: 120, damageTaken: 30 });
  });

  it('computes a share that sums to one and sorts allies by damage', () => {
    const stats = [line('a', 300), line('b', 100), line('c', 100)];
    expect(damageShare(stats, 'a')).toBeCloseTo(0.6, 6);
    expect(damageShare(stats, 'b')).toBeCloseTo(0.2, 6);
    expect(damageShare(stats, 'missing')).toBe(0);

    const totalShare = stats.reduce((sum, entry) => sum + damageShare(stats, entry.uid), 0);
    expect(totalShare).toBeCloseTo(1, 6);

    expect(allyBattleStats(stats).map((entry) => entry.uid)).toEqual(['a', 'b', 'c']);
  });

  it('returns zero share for an empty battle', () => {
    expect(damageShare([], 'a')).toBe(0);
  });
});
