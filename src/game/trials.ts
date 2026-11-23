import { hashString } from '../core/rng';
import { HEROES_BY_ID } from '../data/heroes';
import type { HeroDef } from '../data/types';
import { allyFromHero } from './battle/factory';
import type { UnitInit } from './battle/types';
import { trialAttempts } from './base';
import { GEAR_DROP_TRIAL, levelCap } from './config';
import { rollGearDrop } from './equipment';
import type { SaveV1 } from './save';

export function ensureTrialDay(save: SaveV1, date = new Date()): void {
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  if (save.trials.date !== day) {
    save.trials.date = day;
    save.trials.used = {};
  }
}

export function attemptsLeft(save: SaveV1, heroId: string): number {
  return Math.max(0, trialAttempts(save) - (save.trials.used[heroId] ?? 0));
}

export function trialEligible(save: SaveV1, heroId: string): boolean {
  const hero = save.heroes[heroId];
  if (!hero) return false;
  return hero.star < 6 && hero.level >= levelCap(hero.star);
}

export function canTrial(save: SaveV1, heroId: string): boolean {
  return trialEligible(save, heroId) && attemptsLeft(save, heroId) > 0;
}

export function trialEnemy(hero: HeroDef, star: number, level: number): UnitInit {
  const unit = allyFromHero(hero, { slot: 0, star, level, uid: `mirror_${hero.id}` });
  return {
    ...unit,
    side: 'enemy',
    name: `${hero.nameRu} · отражение`,
    nameEn: `${hero.nameEn} · reflection`,
    hpMult: 0.95,
    atkMult: 0.9,
  };
}

export function spendTrialAttempt(save: SaveV1, heroId: string): void {
  save.trials.used[heroId] = (save.trials.used[heroId] ?? 0) + 1;
}

/** Повышает ★ и сохраняет уровень. Возвращает false, если герой не найден или уже ★6. */
export function applyTrialWin(save: SaveV1, heroId: string): boolean {
  const hero = save.heroes[heroId];
  if (!hero || hero.star >= 6) return false;
  hero.star += 1;
  hero.xp = 0;
  return true;
}

/** За успешное Испытание выдаёт предмет, детерминированный по герою и новому ★. */
export function grantTrialGear(save: SaveV1, heroId: string): string | null {
  const hero = save.heroes[heroId];
  if (!hero) return null;
  const gear = rollGearDrop(hashString(`trial|${heroId}|${hero.star}`), GEAR_DROP_TRIAL);
  if (!gear) return null;
  save.inventory.gear.push(gear.id);
  return gear.id;
}

export function trialHero(heroId: string): HeroDef | undefined {
  return HEROES_BY_ID[heroId];
}
