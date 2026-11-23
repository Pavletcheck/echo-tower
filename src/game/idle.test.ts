import { describe, expect, it } from 'vitest';
import { claimIdle, idleCapHours, idleGold, idleProgress } from './idle';
import { defaultSave } from './save';

describe('idle income', () => {
  it('accrues gold from the highest floor', () => {
    const save = defaultSave();
    save.tower.maxFloor = 50;
    save.idle.lastClaim = 0;
    const twoHours = 2 * 60 * 60 * 1000;
    const gold = idleGold(save, twoHours);
    expect(gold).toBeGreaterThan(10_000);
    expect(gold).toBeLessThan(20_000);
  });

  it('caps at eight hours by default and twelve with the pass', () => {
    const save = defaultSave();
    save.tower.maxFloor = 50;
    save.idle.lastClaim = 0;
    const twentyHours = 20 * 60 * 60 * 1000;

    expect(idleCapHours(save)).toBe(8);
    const capped = idleGold(save, twentyHours);
    const eightHours = idleGold(save, 8 * 60 * 60 * 1000);
    expect(capped).toBe(eightHours);

    save.flags.pass = true;
    expect(idleCapHours(save)).toBe(12);
    expect(idleGold(save, twentyHours)).toBe(idleGold(save, 12 * 60 * 60 * 1000));
  });

  it('claims once and resets the timer', () => {
    const save = defaultSave();
    save.tower.maxFloor = 30;
    save.idle.lastClaim = 0;
    const at = 3 * 60 * 60 * 1000;
    const before = save.currencies.gold;
    const essenceBefore = save.currencies.essence;
    const amount = claimIdle(save, 1, at);
    expect(amount).toBeGreaterThan(0);
    expect(save.currencies.gold).toBe(before + amount);
    expect(save.currencies.essence).toBeGreaterThan(essenceBefore);
    expect(save.idle.lastClaim).toBe(at);
    expect(idleGold(save, at)).toBe(0);
    expect(idleProgress(save, at)).toBe(0);
  });

  it('doubles the claim after a rewarded ad', () => {
    const save = defaultSave();
    save.idle.lastClaim = 0;
    const at = 60 * 60 * 1000;
    const base = idleGold(save, at);
    const doubled = claimIdle(save, 2, at);
    expect(doubled).toBe(base * 2);
  });
});
