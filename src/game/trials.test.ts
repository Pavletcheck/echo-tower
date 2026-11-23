import { describe, expect, it } from 'vitest';
import { HEROES_BY_ID } from '../data/heroes';
import { defaultSave } from './save';
import {
  applyTrialWin,
  attemptsLeft,
  canTrial,
  ensureTrialDay,
  spendTrialAttempt,
  trialEligible,
  trialEnemy,
} from './trials';

describe('trials', () => {
  it('requires max level and a star below six', () => {
    const save = defaultSave();
    expect(trialEligible(save, 'thorn')).toBe(false);
    const hero = save.heroes.thorn!;
    hero.level = 75;
    expect(trialEligible(save, 'thorn')).toBe(true);
    expect(canTrial(save, 'thorn')).toBe(true);

    hero.star = 6;
    expect(trialEligible(save, 'thorn')).toBe(false);
  });

  it('limits attempts to three per day', () => {
    const save = defaultSave();
    save.heroes.thorn!.level = 75;
    expect(attemptsLeft(save, 'thorn')).toBe(3);
    spendTrialAttempt(save, 'thorn');
    spendTrialAttempt(save, 'thorn');
    spendTrialAttempt(save, 'thorn');
    expect(attemptsLeft(save, 'thorn')).toBe(0);
    expect(canTrial(save, 'thorn')).toBe(false);
  });

  it('raises a star and resets xp on win', () => {
    const save = defaultSave();
    const hero = save.heroes.thorn!;
    hero.star = 5;
    hero.level = 75;
    hero.xp = 42;
    expect(applyTrialWin(save, 'thorn')).toBe(true);
    expect(hero.star).toBe(6);
    expect(hero.xp).toBe(0);
    expect(applyTrialWin(save, 'thorn')).toBe(false);
  });

  it('builds a mirror enemy', () => {
    const hero = HEROES_BY_ID.thorn;
    expect(hero).toBeTruthy();
    const enemy = trialEnemy(hero!, 5, 75);
    expect(enemy.side).toBe('enemy');
    expect(enemy.hpMult).toBeLessThanOrEqual(1);
    expect(enemy.atkMult).toBeLessThanOrEqual(1);
  });

  it('resets daily attempts', () => {
    const save = defaultSave();
    save.trials.date = 'old';
    save.trials.used = { thorn: 3 };
    ensureTrialDay(save, new Date(2026, 10, 15));
    expect(save.trials.used).toEqual({});
  });
});
