import { describe, expect, it } from 'vitest';
import { BATTLE_BACKGROUND_COUNT, battleBackground } from './backgrounds';

describe('battle backgrounds', () => {
  it('maps every chapter to its manifest file', () => {
    for (let chapter = 1; chapter <= BATTLE_BACKGROUND_COUNT; chapter += 1) {
      expect(battleBackground(chapter)).toBe(
        `assets/bg/battle/ch${String(chapter).padStart(2, '0')}.webp`,
      );
    }
  });

  it('clamps unknown chapter numbers instead of building broken paths', () => {
    expect(battleBackground(0)).toBe('assets/bg/battle/ch01.webp');
    expect(battleBackground(-5)).toBe('assets/bg/battle/ch01.webp');
    expect(battleBackground(11)).toBe('assets/bg/battle/ch10.webp');
    expect(battleBackground(2.4)).toBe('assets/bg/battle/ch02.webp');
  });
});
