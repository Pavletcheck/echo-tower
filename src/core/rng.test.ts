import { describe, expect, it } from 'vitest';
import { battleSeed, hashString, Rng } from './rng';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const left = Array.from({ length: 32 }, () => a.nextU32());
    const right = Array.from({ length: 32 }, () => b.nextU32());
    expect(left).toEqual(right);
  });

  it('produces different streams for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(a.nextU32()).not.toBe(b.nextU32());
  });

  it('keeps next() within [0, 1)', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('picks only existing items', () => {
    const rng = new Rng(99);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i += 1) expect(items).toContain(rng.pick(items));
  });
});

describe('hashing', () => {
  it('is stable for the same string', () => {
    expect(hashString('belquist|iria')).toBe(hashString('belquist|iria'));
  });

  it('changes when composition changes', () => {
    const first = battleSeed('save-1', 10, 1, ['a', 'b']);
    const second = battleSeed('save-1', 10, 1, ['b', 'a']);
    expect(first).not.toBe(second);
  });
});
