import { describe, expect, it } from 'vitest';
import {
  floorGold,
  floorXp,
  idleGoldPerMinute,
  levelCap,
  levelGold,
  starMultiplier,
  MAX_STAR,
} from './config';

describe('progression formulas', () => {
  it('keeps the reference gold value at floor 100', () => {
    // 40 * 100^1.2 = 10047 — «около 10 000» из референса.
    expect(floorGold(100)).toBe(10_047);
  });

  it('grows floor rewards monotonically', () => {
    for (let floor = 2; floor <= 100; floor += 1) {
      expect(floorGold(floor)).toBeGreaterThan(floorGold(floor - 1));
      expect(floorXp(floor)).toBeGreaterThan(floorXp(floor - 1));
      expect(idleGoldPerMinute(floor)).toBeGreaterThan(idleGoldPerMinute(floor - 1));
    }
  });

  it('caps hero level by star: 15 per star', () => {
    expect(levelCap(3)).toBe(45);
    expect(levelCap(5)).toBe(75);
    expect(levelCap(6)).toBe(90);
    expect(levelCap(99)).toBe(15 * MAX_STAR);
  });

  it('clamps star multiplier', () => {
    expect(starMultiplier(1)).toBe(1);
    expect(starMultiplier(5)).toBe(1.85);
    expect(starMultiplier(6)).toBe(2.2);
    expect(starMultiplier(0)).toBe(1);
    expect(starMultiplier(99)).toBe(2.2);
  });

  it('level cost rises with level', () => {
    expect(levelGold(1)).toBe(12);
    expect(levelGold(50)).toBeGreaterThan(levelGold(40));
  });
});
