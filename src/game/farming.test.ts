import { describe, expect, it } from 'vitest';
import { getFloor } from '../data/floors';
import { REPEAT_GOLD_RATE } from './config';
import { autoNextFloor, repeatReward, sweepFloor } from './farming';
import { defaultSave } from './save';

function clearedSave() {
  const save = defaultSave();
  save.tower.clears = {
    '1': { stars: 3, first: true },
    '2': { stars: 3, first: true },
  };
  save.tower.maxFloor = 3;
  return save;
}

describe('floor farming', () => {
  it('does not sweep a floor that was never cleared', () => {
    const save = defaultSave();
    const gold = save.currencies.gold;

    expect(repeatReward(save, 3)).toBeNull();
    expect(sweepFloor(save, 3)).toBeNull();
    expect(save.currencies.gold).toBe(gold);
  });

  it('sweeps a cleared floor without any key cost', () => {
    const save = clearedSave();
    const gold = save.currencies.gold;

    const result = sweepFloor(save, 1);
    expect(result).not.toBeNull();
    expect(result?.gold).toBeGreaterThan(0);
    expect(save.currencies.gold).toBe(gold + (result?.gold ?? 0));
    expect('keysLeft' in (result as object)).toBe(false);
  });

  it('gives only 10% gold for a repeated floor', () => {
    const save = clearedSave();
    const floor = getFloor(1);
    expect(floor).toBeTruthy();
    if (!floor) return;

    const reward = repeatReward(save, 1);
    expect(reward?.gold).toBe(Math.round(floor.reward.gold * REPEAT_GOLD_RATE));
    expect(reward?.shards).toBe(0);
    expect(reward?.xp).toBe(0);
    expect(reward?.gearId).toBeUndefined();
  });

  it('does not grant shards, gear or xp when sweeping a cleared floor', () => {
    const save = clearedSave();
    const shardsBefore = { ...save.currencies.starShards };
    const gearBefore = save.inventory.gear.length;
    const heroXpBefore = save.heroes.thorn?.xp ?? 0;
    const passXpBefore = save.live.pass.xp;

    const result = sweepFloor(save, 1);
    expect(result?.shards).toBe(0);
    expect(result?.xp).toBe(0);
    expect(result?.gearId).toBeUndefined();
    expect(save.currencies.starShards).toEqual(shardsBefore);
    expect(save.inventory.gear).toHaveLength(gearBefore);
    expect(save.heroes.thorn?.xp ?? 0).toBe(heroXpBefore);
    // Sweep даёт +1 XP пропуска, но не геройский опыт.
    expect(save.live.pass.xp).toBe(passXpBefore + 1);
  });

  it('auto-next advances floors without a key gate', () => {
    const save = defaultSave();
    const floors: number[] = [];
    let floor = 1;

    for (let index = 0; index < 5; index += 1) {
      const next = autoNextFloor(save, floor);
      expect(next).not.toBeNull();
      if (next === null) break;
      floors.push(next);
      floor = next;
    }

    expect(floors).toEqual([2, 3, 4, 5, 6]);
  });

  it('stops at floor 100', () => {
    const save = defaultSave();
    expect(autoNextFloor(save, 100)).toBeNull();
    expect(autoNextFloor(save, 99)).toBe(100);
  });
});
