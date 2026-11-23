import type { HeroBaseStats, Role, SkillDef, SkillEffect } from '../../data/types';
import { starMultiplier } from '../config';
import type { CombatStats, UnitInit } from './types';

export interface StatGrowth {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

export const DEFAULT_GROWTH: StatGrowth = { hp: 0.08, atk: 0.06, def: 0.05, spd: 0.005 };

export function combatStats(base: HeroBaseStats, star: number, level: number, growth: StatGrowth = DEFAULT_GROWTH): CombatStats {
  const multiplier = starMultiplier(star);
  const levels = Math.max(0, level - 1);

  return {
    hp: base.hp * multiplier * (1 + growth.hp * levels),
    atk: base.atk * multiplier * (1 + growth.atk * levels),
    def: base.def * multiplier * (1 + growth.def * levels),
    spd: base.spd * (1 + growth.spd * levels),
    crit: 0.05,
    cdmg: 1.5,
    er: 1,
  };
}

/**
 * Бонусы экипировки. hp/atk/def/crit/cdmg/er/lifesteal/elem/dr/heal/shield — доли
 * (0.08 = +8%), spd — абсолютное значение. specials — флаги сет-эффектов.
 */
export interface StatBonus {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  crit: number;
  cdmg: number;
  er: number;
  lifesteal: number;
  elem: number;
  dr: number;
  heal: number;
  shield: number;
  specials: string[];
}

/** Потолки бонусов, чтобы старые/битые сейвы и будущий контент не ломали бой. */
export const STAT_BONUS_CAPS: Readonly<Record<keyof Omit<StatBonus, 'specials'>, number>> = {
  hp: 4,
  atk: 4,
  def: 4,
  spd: 150,
  crit: 0.8,
  cdmg: 3,
  er: 1.5,
  lifesteal: 0.6,
  elem: 1,
  dr: 0.75,
  heal: 1,
  shield: 1,
};

export const CRIT_CAP = 1;
export const CDMG_CAP = 6;
export const ER_CAP = 3;
export const DR_CAP = 0.8;

export function emptyStatBonus(): StatBonus {
  return {
    hp: 0,
    atk: 0,
    def: 0,
    spd: 0,
    crit: 0,
    cdmg: 0,
    er: 0,
    lifesteal: 0,
    elem: 0,
    dr: 0,
    heal: 0,
    shield: 0,
    specials: [],
  };
}

function clampBonus(key: keyof Omit<StatBonus, 'specials'>, value: number): number {
  const cap = STAT_BONUS_CAPS[key];
  return Math.min(cap, Math.max(0, Number.isFinite(value) ? value : 0));
}

/** Приводит произвольный бонус к безопасному виду: без минусов и выше капа. */
export function normalizeStatBonus(bonus: Partial<StatBonus> | undefined): StatBonus {
  const result = emptyStatBonus();
  if (!bonus) return result;

  for (const key of Object.keys(STAT_BONUS_CAPS) as Array<keyof Omit<StatBonus, 'specials'>>) {
    result[key] = clampBonus(key, bonus[key] ?? 0);
  }
  result.specials = [...new Set(Array.isArray(bonus.specials) ? bonus.specials : [])];
  return result;
}

export function addStatBonus(target: StatBonus, add: Partial<StatBonus> | undefined): StatBonus {
  if (!add) return target;
  for (const key of Object.keys(STAT_BONUS_CAPS) as Array<keyof Omit<StatBonus, 'specials'>>) {
    target[key] += add[key] ?? 0;
  }
  for (const special of add.specials ?? []) {
    if (!target.specials.includes(special)) target.specials.push(special);
  }
  return target;
}

/** Применяет бонусы к базовым статам; результат не может уйти в минус. */
export function applyStatBonus(stats: CombatStats, bonus: Partial<StatBonus> | undefined): CombatStats {
  const b = normalizeStatBonus(bonus);
  return {
    hp: Math.max(0, stats.hp * (1 + b.hp)),
    atk: Math.max(0, stats.atk * (1 + b.atk)),
    def: Math.max(0, stats.def * (1 + b.def)),
    spd: Math.max(0, stats.spd + b.spd),
    crit: Math.min(CRIT_CAP, Math.max(0, stats.crit + b.crit)),
    cdmg: Math.min(CDMG_CAP, Math.max(0, stats.cdmg + b.cdmg)),
    er: Math.min(ER_CAP, Math.max(0, stats.er + b.er)),
  };
}

/** Единая точка расчёта статов юнита: база по ★/уровню + экипировка. */
export function unitCombatStats(init: Pick<UnitInit, 'base' | 'star' | 'level' | 'bonus'>): CombatStats {
  return applyStatBonus(combatStats(init.base, init.star, init.level), init.bonus);
}

/** Статы врага уже посчитаны от этажа: звезда и уровень = 1, чтобы не масштабировать дважды. */
export function enemyStats(hp: number, atk: number, def: number, spd: number): HeroBaseStats {
  return { hp, atk, def, spd };
}

const ROLE_HP: Record<Role, number> = {
  vanguard: 1.35,
  blade: 1.0,
  ranger: 0.9,
  arcanist: 0.85,
  oracle: 0.95,
  support: 1.1,
};

const ROLE_ATK: Record<Role, number> = {
  vanguard: 0.85,
  blade: 1.1,
  ranger: 1.15,
  arcanist: 1.15,
  oracle: 0.9,
  support: 0.95,
};

export function roleHpMultiplier(role: Role): number {
  return ROLE_HP[role];
}

export function roleAtkMultiplier(role: Role): number {
  return ROLE_ATK[role];
}

/**
 * Универсальные скиллы врагов: базовая атака, роль-скилл и роль-ульта.
 * Герои используют свои уникальные скиллы из данных.
 */
export function enemyKit(role: Role): [SkillDef, SkillDef, SkillDef, SkillDef] {
  const control: Record<Role, SkillEffect[]> = {
    vanguard: [{ kind: 'control', status: 'taunt', duration: 2 }],
    blade: [{ kind: 'dot', status: 'bleed', value: 0.06, duration: 3 }],
    ranger: [{ kind: 'debuff', status: 'mark', duration: 4 }],
    arcanist: [{ kind: 'control', status: 'slow', duration: 3 }],
    oracle: [{ kind: 'heal', value: 1.2 }],
    support: [{ kind: 'debuff', status: 'curse', value: 0.15, duration: 4 }],
  };

  return [
    {
      id: `enemy_${role}_basic`,
      kind: 'basic',
      nameRu: 'Атака',
      nameEn: 'Attack',
      target: 'enemy',
      mult: 1,
      cooldown: 0,
      cost: 0,
      effects: [{ kind: 'damage', value: 1 }],
      descriptionRu: '100% ATK.',
      descriptionEn: '100% ATK.',
    },
    {
      id: `enemy_${role}_skill`,
      kind: 'skill',
      nameRu: 'Приём',
      nameEn: 'Technique',
      target: role === 'oracle' ? 'ally-lowest' : role === 'arcanist' ? 'all-enemies' : 'enemy',
      mult: role === 'oracle' ? 1.2 : 1.4,
      cooldown: 6,
      cost: 50,
      effects: role === 'oracle' ? [{ kind: 'heal', value: 1.2 }] : [{ kind: 'damage', value: 1.4 }, ...control[role]],
      descriptionRu: '160% ATK с эффектом роли.',
      descriptionEn: '160% ATK with a role effect.',
    },
    {
      id: `enemy_${role}_ultimate`,
      kind: 'ultimate',
      nameRu: 'Ярость',
      nameEn: 'Fury',
      target: 'all-enemies',
      mult: 1.8,
      cooldown: 8,
      cost: 100,
      effects: [{ kind: 'damage', value: 1.8 }],
      descriptionRu: '180% ATK по всем.',
      descriptionEn: '180% ATK to all.',
    },
    {
      id: `enemy_${role}_passive`,
      kind: 'passive',
      nameRu: 'Инстинкт',
      nameEn: 'Instinct',
      target: 'self',
      mult: 0,
      cooldown: 0,
      cost: 0,
      effects: [],
      descriptionRu: 'Пассивный враг.',
      descriptionEn: 'Passive enemy.',
    },
  ];
}
