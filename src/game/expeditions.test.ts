import { describe, expect, it } from 'vitest';
import {
  claimExpedition,
  canStart,
  expeditionOf,
  expeditionReady,
  expeditionReward,
  speedUpExpedition,
  startExpedition,
} from './expeditions';
import { defaultSave } from './save';

const HEROES = ['thorn', 'neya'];

describe('expeditions', () => {
  it('starts a two-hour expedition with two heroes', () => {
    const save = defaultSave();
    const at = 1_000_000;
    expect(startExpedition(save, 0, '2h', HEROES, at)).toBe(true);
    const entry = expeditionOf(save, 0);
    expect(entry?.endsAt).toBe(at + 2 * 60 * 60 * 1000);
    expect(entry?.heroes).toEqual(HEROES);
  });

  it('does not allow the same hero in two expeditions', () => {
    const save = defaultSave();
    startExpedition(save, 0, '2h', HEROES);
    expect(canStart(save, 1, '2h', HEROES)).toBe(false);
    expect(startExpedition(save, 1, '2h', HEROES)).toBe(false);
  });

  it('requires the exact number of heroes for the duration', () => {
    const save = defaultSave();
    expect(canStart(save, 0, '8h', HEROES)).toBe(false);
    expect(canStart(save, 0, '2h', ['thorn'])).toBe(false);
  });

  it('does not claim before the timer ends', () => {
    const save = defaultSave();
    const at = 1_000_000;
    startExpedition(save, 0, '2h', HEROES, at);
    expect(expeditionReady(save, 0, at + 1000)).toBe(false);
    expect(claimExpedition(save, 0, at + 1000)).toBeNull();
  });

  it('claims rewards and frees the slot', () => {
    const save = defaultSave();
    const at = 1_000_000;
    save.tower.maxFloor = 40;
    startExpedition(save, 0, '2h', HEROES, at);
    const reward = expeditionReward(save, 0);
    expect(reward?.gold).toBeGreaterThan(0);

    const gold = save.currencies.gold;
    const claim = claimExpedition(save, 0, at + 2 * 60 * 60 * 1000);
    expect(claim).not.toBeNull();
    expect(save.currencies.gold).toBe(gold + (claim?.gold ?? 0));
    expect(expeditionOf(save, 0)).toBeUndefined();
  });

  it('speeds up with a rewarded ad', () => {
    const save = defaultSave();
    const at = 1_000_000;
    startExpedition(save, 0, '4h', ['thorn', 'neya', 'grom'], at);
    const before = expeditionOf(save, 0)?.endsAt ?? 0;
    expect(speedUpExpedition(save, 0, 60 * 60 * 1000, at)).toBe(true);
    expect(expeditionOf(save, 0)?.endsAt).toBe(before - 60 * 60 * 1000);
  });
});
