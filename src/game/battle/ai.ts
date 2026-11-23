import type { SkillDef } from '../../data/types';
import type { Rng } from '../../core/rng';
import { hasStatus } from './effects';
import { mitigation } from './formulas';
import type { Unit } from './types';

/** Ульта важнее скилла, скилл важнее базовой атаки. */
export function selectSkill(unit: Unit): SkillDef {
  const [basic, skill, ultimate] = unit.skills;

  if (unit.energy >= ultimate.cost && (unit.cooldowns[ultimate.id] ?? 0) <= 0) return ultimate;
  if (unit.energy >= skill.cost && (unit.cooldowns[skill.id] ?? 0) <= 0) return skill;
  return basic;
}

/** Провокация перебивает любой выбор цели. */
export function tauntTarget(enemies: readonly Unit[]): Unit | null {
  const taunter = enemies.find((enemy) => enemy.alive && hasStatus(enemy, 'taunt'));
  return taunter ?? null;
}

/** Эффективное HP: слабый герой без защиты умирает быстрее сильного танка. */
export function effectiveHp(unit: Pick<Unit, 'hp' | 'def'>): number {
  return unit.hp / Math.max(0.05, mitigation(unit.def));
}

export function selectEnemyTarget(_unit: Unit, enemies: readonly Unit[], rng?: Rng): Unit | null {
  const taunted = tauntTarget(enemies);
  if (taunted) return taunted;

  const pool = enemies.filter((enemy) => enemy.alive);
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0] as Unit;

  if (!rng) {
    return pool.reduce(
      (best, enemy) => (effectiveHp(enemy) < effectiveHp(best) ? enemy : best),
      pool[0] as Unit,
    );
  }

  // Слабый герой — вероятная цель, но не единственная: танк тоже получает удары.
  const weights = pool.map((enemy) => {
    const hp = Math.max(1, effectiveHp(enemy));
    return 1 / (hp * hp);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng.next() * total;
  for (let index = 0; index < pool.length; index += 1) {
    roll -= weights[index] ?? 0;
    if (roll <= 0) return pool[index] ?? null;
  }
  return pool[pool.length - 1] ?? null;
}

export function selectLowestAlly(allies: readonly Unit[]): Unit | null {
  const pool = allies.filter((ally) => ally.alive && ally.hp > 0);
  if (pool.length === 0) return null;

  return pool.reduce((best, ally) => {
    const ratio = ally.hp / ally.maxHp;
    const bestRatio = best.hp / best.maxHp;
    return ratio < bestRatio ? ally : best;
  }, pool[0] as Unit);
}

/** Случайная цель из живых — нужна для AoE-фокуса и «Печати». */
export function selectRandomEnemy(enemies: readonly Unit[], roll: number): Unit | null {
  const pool = enemies.filter((enemy) => enemy.alive);
  if (pool.length === 0) return null;
  return pool[Math.floor(roll * pool.length) % pool.length] ?? null;
}
