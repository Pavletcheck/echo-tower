import type { UnitBattleStats } from './types';

/** Суммирует строки графика боя по uid: волны и повторные расчёты складываются. */
export function mergeBattleStats(
  base: readonly UnitBattleStats[],
  add: readonly UnitBattleStats[],
): UnitBattleStats[] {
  const map = new Map<string, UnitBattleStats>();

  for (const line of [...base, ...add]) {
    const current = map.get(line.uid);
    if (!current) {
      map.set(line.uid, { ...line });
      continue;
    }
    current.damageDealt += line.damageDealt;
    current.damageTaken += line.damageTaken;
    current.healing += line.healing;
  }

  return [...map.values()];
}

/** Доля урона героя в общем уроне отряда, 0..1. */
export function damageShare(stats: readonly UnitBattleStats[], uid: string): number {
  const allies = stats.filter((line) => line.side === 'ally');
  const total = allies.reduce((sum, line) => sum + line.damageDealt, 0);
  if (total <= 0) return 0;
  const own = allies.find((line) => line.uid === uid)?.damageDealt ?? 0;
  return Math.min(1, Math.max(0, own / total));
}

/** Только союзники, отсортированные по нанесённому урону. */
export function allyBattleStats(stats: readonly UnitBattleStats[]): UnitBattleStats[] {
  return stats.filter((line) => line.side === 'ally').sort((a, b) => b.damageDealt - a.damageDealt);
}
