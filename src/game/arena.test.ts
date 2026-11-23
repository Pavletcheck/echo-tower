import { describe, expect, it } from 'vitest';
import {
  applyArenaResult,
  arenaOpponents,
  attacksLeft,
  ensureArenaDay,
  leagueName,
  leagueOf,
  opponentUnits,
} from './arena';
import { defaultSave } from './save';

describe('arena', () => {
  it('builds three deterministic opponents with five heroes', () => {
    const save = defaultSave();
    const first = arenaOpponents(save, new Date(2026, 10, 15));
    const second = arenaOpponents(save, new Date(2026, 10, 15));
    expect(first).toHaveLength(3);
    expect(first[0]?.heroes).toHaveLength(5);
    expect(first.map((opponent) => opponent.name)).toEqual(second.map((opponent) => opponent.name));
    expect(first.map((opponent) => opponent.power)).toEqual(second.map((opponent) => opponent.power));
  });

  it('converts opponents into enemy units', () => {
    const save = defaultSave();
    const units = opponentUnits(arenaOpponents(save)[0]!);
    expect(units).toHaveLength(5);
    expect(units.every((unit) => unit.side === 'enemy')).toBe(true);
  });

  it('maps rating to leagues', () => {
    expect(leagueOf(900)).toBe(1);
    expect(leagueOf(1_150)).toBe(2);
    expect(leagueOf(1_350)).toBe(3);
    expect(leagueOf(1_600)).toBe(4);
    expect(leagueName(4, 'ru')).toBe('Платина');
  });

  it('applies win and loss rewards', () => {
    const save = defaultSave();
    const start = save.arena.rating;
    const win = applyArenaResult(save, true);
    expect(win.rating).toBe(start + 25);
    expect(win.tokens).toBe(60);
    expect(save.arena.attacksToday).toBe(1);
    expect(attacksLeft(save)).toBe(4);

    const before = save.arena.rating;
    applyArenaResult(save, false);
    expect(save.arena.rating).toBe(before - 15);
  });

  it('resets daily attacks', () => {
    const save = defaultSave();
    save.arena.date = 'old';
    save.arena.attacksToday = 5;
    ensureArenaDay(save, new Date(2026, 10, 15));
    expect(save.arena.attacksToday).toBe(0);
    expect(attacksLeft(save)).toBe(5);
  });
});
