import type { BossDef, EnemyDef, FloorDef, HeroDef, SkillDef } from '../../data/types';
import { BOSSES_BY_ID, ENEMIES_BY_ID } from '../../data/enemies';
import {
  ENEMY_DEF_BASE,
  ENEMY_DEF_GROWTH,
  enemyAtkScale,
  enemyHpScale,
  SKILL_POWER_STEP,
} from '../config';
import { enemyKit, enemyStats, roleAtkMultiplier, roleHpMultiplier, type StatBonus } from './stats';
import type { UnitInit } from './types';

export interface AllyOptions {
  slot: number;
  star: number;
  level: number;
  uid?: string;
  startHp?: number;
  bonus?: StatBonus;
  /** Уровни basic/skill/ultimate/passive: 1..5. */
  skillLevels?: readonly number[];
}

/** Уровень скилла усиливает множитель и числовые эффекты на 8% за уровень. */
function scaleSkill(skill: SkillDef, level: number): SkillDef {
  const steps = Math.min(5, Math.max(1, Math.floor(level))) - 1;
  if (steps <= 0) return skill;
  const factor = 1 + SKILL_POWER_STEP * steps;

  return {
    ...skill,
    mult: skill.mult * factor,
    effects: skill.effects.map((effect) => {
      if (typeof effect.value !== 'number') return effect;
      if (
        effect.kind === 'damage' ||
        effect.kind === 'heal' ||
        effect.kind === 'shield' ||
        effect.kind === 'dot' ||
        effect.kind === 'buff' ||
        effect.kind === 'debuff' ||
        effect.kind === 'special'
      ) {
        return { ...effect, value: effect.value * factor };
      }
      return effect;
    }),
  };
}

export function allyFromHero(hero: HeroDef, options: AllyOptions): UnitInit {
  const skills = options.skillLevels
    ? (hero.skills.map((skill, index) => scaleSkill(skill, options.skillLevels?.[index] ?? 1)) as [
        SkillDef,
        SkillDef,
        SkillDef,
        SkillDef,
      ])
    : hero.skills;

  return {
    uid: options.uid ?? `ally_${hero.id}`,
    defId: hero.id,
    name: hero.nameRu,
    nameEn: hero.nameEn,
    side: 'ally',
    slot: options.slot,
    role: hero.role,
    element: hero.element,
    base: hero.base,
    star: options.star,
    level: options.level,
    skills,
    ...(options.bonus ? { bonus: options.bonus } : {}),
    ...(options.startHp !== undefined ? { startHp: options.startHp } : {}),
  };
}

function enemyHp(floor: number, role: EnemyDef['role'], mult: number): number {
  // Плавный вход: резкий скачок 0.85→1.0 на 6-м этаже отсекал новых игроков.
  const easing = floor <= 10 ? 0.72 : floor <= 20 ? 0.65 : floor <= 25 ? 0.9 : 1;
  return enemyHpScale(floor) * roleHpMultiplier(role) * mult * easing;
}

function enemyAtk(floor: number, role: EnemyDef['role'], mult: number): number {
  const easing = floor <= 10 ? 0.5 : floor <= 20 ? 0.42 : floor <= 25 ? 0.7 : 1;
  return enemyAtkScale(floor) * roleAtkMultiplier(role) * mult * easing;
}

function enemyDef(floor: number, role: EnemyDef['role']): number {
  return ENEMY_DEF_BASE * Math.pow(ENEMY_DEF_GROWTH, floor - 1) * (role === 'vanguard' ? 1.35 : 1);
}

export function enemyFromDef(enemy: EnemyDef, floor: number, slot: number, suffix = ''): UnitInit {
  return {
    uid: `enemy_${enemy.id}_${slot}${suffix}`,
    defId: enemy.id,
    name: enemy.nameRu,
    nameEn: enemy.nameEn,
    side: 'enemy',
    slot,
    role: enemy.role,
    element: enemy.element,
    base: enemyStats(
      enemyHp(floor, enemy.role, enemy.hpMult),
      enemyAtk(floor, enemy.role, enemy.atkMult),
      enemyDef(floor, enemy.role),
      enemy.role === 'ranger' ? 110 : 95,
    ),
    star: 1,
    level: 1,
    skills: enemyKit(enemy.role),
  };
}

export function bossUnits(boss: BossDef, floor: number): UnitInit[] {
  const units = boss.units ?? 1;
  const unitFloor = boss.mode === 'tower' ? floor : Math.max(floor, 20);
  // Босс главы должен быть кульминацией, а не легче предыдущего этажа.
  const towerBoss = boss.mode === 'tower' && floor % 5 === 0;
  const chapterBoss = boss.mode === 'tower' && floor % 10 === 0;
  const bossHp = chapterBoss ? 1.6 : towerBoss ? 1.3 : 1.15;
  const bossAtk = chapterBoss ? 1.2 : towerBoss ? 1.12 : 1;

  return Array.from({ length: units }, (_, index) => ({
    uid: `boss_${boss.id}_${index}`,
    defId: boss.id,
    name: boss.nameRu,
    nameEn: boss.nameEn,
    side: 'enemy' as const,
    slot: units === 1 ? 1 : index,
    role: boss.role,
    element: boss.element,
    base: enemyStats(
      (enemyHp(unitFloor, boss.role, boss.hpMult) / units) * bossHp,
      enemyAtk(unitFloor, boss.role, boss.atkMult) * bossAtk * (units > 1 ? 0.85 : 1),
      enemyDef(floor, boss.role) * 1.15,
      boss.role === 'ranger' ? 110 : 95,
    ),
    star: 1,
    level: 1,
    skills: enemyKit(boss.role),
    isBoss: true,
  }));
}

export function buildWave(floorDef: FloorDef, waveIndex: number): UnitInit[] {
  const wave = floorDef.waves[waveIndex];
  if (!wave) return [];

  const units: UnitInit[] = [];
  let slot = 0;

  for (const stack of wave.enemies) {
    const boss = BOSSES_BY_ID[stack.enemyId];
    if (boss) {
      units.push(...bossUnits(boss, floorDef.floor));
      continue;
    }

    const enemy = ENEMIES_BY_ID[stack.enemyId];
    if (!enemy) continue;

    for (let index = 0; index < stack.count && units.length < 5; index += 1) {
      units.push(enemyFromDef(enemy, floorDef.floor, slot % 5, `_${index}`));
      slot += 1;
    }
  }

  return units.slice(0, 5);
}
