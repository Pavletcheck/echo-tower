import { describe, expect, it } from 'vitest';
import { decodeSave, defaultSave, encodeSave, migrate } from './save';
import { STARTER_DAY_MS, STARTER_MISSIONS } from '../data/starter';
import {
  canClaimStarter,
  claimStarter,
  isStarterClaimed,
  starterClaimableCount,
  starterDay,
  starterProgress,
} from './starter';

const DAY1 = STARTER_MISSIONS[0]!;
const DAY2 = STARTER_MISSIONS[1]!;
const DAY3 = STARTER_MISSIONS[2]!;

function clearedSave() {
  const save = defaultSave();
  save.tower.clears = { '1': { stars: 3, first: true } };
  save.tower.maxFloor = 2;
  return save;
}

describe('starter missions', () => {
  it('opens one mission per day from the save creation date', () => {
    const save = defaultSave();
    const created = save.createdAt;
    expect(starterDay(save, created)).toBe(1);
    expect(starterDay(save, created + STARTER_DAY_MS - 1)).toBe(1);
    expect(starterDay(save, created + STARTER_DAY_MS)).toBe(2);
    expect(starterDay(save, created + 30 * STARTER_DAY_MS)).toBe(7);
    expect(starterDay(save, created - STARTER_DAY_MS)).toBe(1);
  });

  it('claims every mission reward exactly once', () => {
    const save = clearedSave();
    const at = save.createdAt;
    const gold = save.currencies.gold;
    const crystals = save.currencies.crystals;

    expect(canClaimStarter(save, DAY1, at)).toBe(true);
    expect(claimStarter(save, DAY1, at)).toEqual({ gold: 1_500, crystals: 150 });
    expect(isStarterClaimed(save, DAY1)).toBe(true);
    expect(save.currencies.gold).toBe(gold + 1_500);
    expect(save.currencies.crystals).toBe(crystals + 150);

    expect(claimStarter(save, DAY1, at)).toBeNull();
    expect(save.currencies.gold).toBe(gold + 1_500);
    expect(save.currencies.crystals).toBe(crystals + 150);
    expect(starterClaimableCount(save, at)).toBe(0);
  });

  it('does not open future days early', () => {
    const save = clearedSave();
    save.tower.maxFloor = 3;
    expect(canClaimStarter(save, DAY2, save.createdAt)).toBe(false);
    expect(claimStarter(save, DAY2, save.createdAt)).toBeNull();

    const tomorrow = save.createdAt + STARTER_DAY_MS;
    expect(canClaimStarter(save, DAY2, tomorrow)).toBe(true);
    expect(claimStarter(save, DAY2, tomorrow)).toEqual({ gold: 2_500, seals: 1 });
  });

  it('requires the mission progress before claiming', () => {
    const save = defaultSave();
    const at = save.createdAt + 2 * STARTER_DAY_MS;
    expect(starterProgress(save, DAY3)).toBe(save.gacha.totalPulls);
    expect(canClaimStarter(save, DAY3, at)).toBe(false);

    save.gacha.totalPulls = 10;
    expect(canClaimStarter(save, DAY3, at)).toBe(true);
    expect(claimStarter(save, DAY3, at)).toEqual({ crystals: 300 });
  });

  it('does not pay twice after a reload or export/import', () => {
    const save = clearedSave();
    const at = save.createdAt;
    claimStarter(save, DAY1, at);
    const crystals = save.currencies.crystals;

    const reloaded = decodeSave(encodeSave(save));
    expect(claimStarter(reloaded, DAY1, at)).toBeNull();
    expect(reloaded.currencies.crystals).toBe(crystals);
  });

  it('lets a migrated legacy save claim starter missions without breaking old progress', () => {
    const legacy = migrate({
      currencies: { gold: 10 },
      tower: { maxFloor: 4, clears: { '1': { stars: 3, first: true } } },
      quests: { lifetime: { floors: 4, wins: 12 } },
    });

    expect(legacy.currencies.gold).toBe(10);
    expect(legacy.tower.maxFloor).toBe(4);
    expect(legacy.starter.claimedDays).toEqual([]);

    const at = legacy.createdAt;
    expect(claimStarter(legacy, DAY1, at)).not.toBeNull();
    expect(claimStarter(legacy, DAY1, at)).toBeNull();
  });
});
