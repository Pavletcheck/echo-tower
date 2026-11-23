import { describe, expect, it } from 'vitest';
import {
  createRiftRun,
  ensureRiftDay,
  riftModifiers,
  riftReward,
  rollBoons,
  RIFT_SEQUENCE,
} from './rift';
import { defaultSave } from './save';

describe('rift', () => {
  it('creates a six-room run in a fixed order', () => {
    const run = createRiftRun(1000);
    expect(run.rooms).toHaveLength(6);
    expect(run.rooms.map((room) => room.type)).toEqual([...RIFT_SEQUENCE]);
    expect(run.index).toBe(0);
  });

  it('rolls three unique boons', () => {
    const run = createRiftRun(1000);
    const boons = rollBoons(run);
    expect(boons).toHaveLength(3);
    expect(new Set(boons.map((boon) => boon.id)).size).toBe(3);
  });

  it('turns stat boons into battle modifiers', () => {
    const mods = riftModifiers(['b01', 'b02', 'b06']);
    expect(mods.atk).toBeCloseTo(0.15);
    expect(mods.hp).toBeCloseTo(0.2);
    expect(mods.lifesteal).toBeCloseTo(0.08);
  });

  it('gives special boons a small attack bonus', () => {
    const mods = riftModifiers(['b07', 'b08']);
    expect(mods.atk).toBeCloseTo(0.08);
  });

  it('resets daily runs', () => {
    const save = defaultSave();
    save.rift.date = 'old';
    save.rift.runsToday = 2;
    ensureRiftDay(save, new Date(2026, 0, 2));
    expect(save.rift.runsToday).toBe(0);
    expect(save.rift.date).toBe('2026-1-2');
  });

  it('rewards a completed run', () => {
    const reward = riftReward();
    expect(reward.crystals).toBeGreaterThan(0);
    expect(reward.essence).toBeGreaterThan(0);
  });
});
