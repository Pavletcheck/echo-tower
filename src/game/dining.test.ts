import { describe, expect, it } from 'vitest';
import {
  activeDiningBuff,
  canClaimDining,
  claimDining,
  consumeDiningBattle,
  diningBattleModifiers,
  diningClaimedToday,
  diningGoldMultiplier,
  diningGoldRemaining,
  ensureDiningDay,
} from './dining';
import { defaultSave } from './save';

const DAY = new Date(2026, 10, 15, 12, 0, 0);
const NEXT_DAY = new Date(2026, 10, 16, 12, 0, 0);

describe('dining', () => {
  it('allows one meal per day and blocks a second claim', () => {
    const save = defaultSave();
    ensureDiningDay(save, DAY);
    expect(canClaimDining(save, DAY)).toBe(true);
    expect(diningClaimedToday(save, DAY)).toBe(false);

    expect(claimDining(save, 'guard-soup', DAY)).toBe(true);
    expect(diningClaimedToday(save, DAY)).toBe(true);
    expect(canClaimDining(save, DAY)).toBe(false);
    expect(claimDining(save, 'spicy-sauce', DAY)).toBe(false);
    expect(activeDiningBuff(save, DAY.getTime())?.id).toBe('guard-soup');
  });

  it('applies a battle buff for three wins, then expires', () => {
    const save = defaultSave();
    claimDining(save, 'guard-soup', DAY);
    expect(diningBattleModifiers(save, DAY.getTime())).toEqual({ hp: 0.1 });

    consumeDiningBattle(save);
    consumeDiningBattle(save);
    expect(save.dining.battles).toBe(1);
    expect(diningBattleModifiers(save, DAY.getTime())).toEqual({ hp: 0.1 });

    consumeDiningBattle(save);
    expect(save.dining.battles).toBe(0);
    expect(diningBattleModifiers(save, DAY.getTime())).toEqual({});
    expect(activeDiningBuff(save, DAY.getTime())).toBeNull();
  });

  it('applies the gold buff for one hour', () => {
    const save = defaultSave();
    claimDining(save, 'honey-bread', DAY);
    const start = DAY.getTime();
    expect(diningGoldMultiplier(save, start + 1_000)).toBe(1.15);
    expect(diningGoldRemaining(save, start + 1_000)).toBeGreaterThan(0);
    expect(diningGoldMultiplier(save, start + 3_600_001)).toBe(1);
  });

  it('grants essence instantly for coffee', () => {
    const save = defaultSave();
    const before = save.currencies.essence;
    expect(claimDining(save, 'black-coffee', DAY)).toBe(true);
    expect(save.currencies.essence).toBe(before + 150);
    expect(activeDiningBuff(save, DAY.getTime())).toBeNull();
  });

  it('resets the meal on the next day', () => {
    const save = defaultSave();
    claimDining(save, 'guard-soup', DAY);
    ensureDiningDay(save, NEXT_DAY);
    expect(save.dining.claimed).toBe(false);
    expect(save.dining.battles).toBe(0);
    expect(canClaimDining(save, NEXT_DAY)).toBe(true);
    expect(claimDining(save, 'ice-tea', NEXT_DAY)).toBe(true);
    expect(diningBattleModifiers(save, NEXT_DAY.getTime())).toEqual({ spd: 0.1 });
  });
});
