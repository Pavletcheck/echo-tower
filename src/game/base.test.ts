import { describe, expect, it } from 'vitest';
import {
  BUILDING_MAX_LEVEL,
  MASTER_LEVEL_MAX,
  masterReward,
} from '../data/base';
import {
  addMasterXp,
  buildingLevel,
  canExchange,
  canUpgradeBuilding,
  claimMasterReward,
  claimableMasterLevels,
  crystalFloorMultiplier,
  diningEffectMultiplier,
  ensureExchangeDay,
  exchangeLeft,
  exchangeResource,
  masterLevel,
  masterXp,
  nextBuildingCost,
  summonDiscount,
  trialAttempts,
  upgradeBuilding,
  xpMultiplier,
} from './base';
import { pullCost } from './gacha';
import { defaultSave, migrate } from './save';
import { attemptsLeft } from './trials';

function noNegative(save: ReturnType<typeof defaultSave>): void {
  for (const value of Object.values(save.currencies)) {
    if (typeof value === 'number') expect(value).toBeGreaterThanOrEqual(0);
  }
}

describe('base buildings', () => {
  it('starts every building at level 1', () => {
    const save = defaultSave();
    expect(buildingLevel(save, 'altar')).toBe(1);
    expect(buildingLevel(save, 'barracks')).toBe(1);
    expect(buildingLevel(save, 'dining')).toBe(1);
    expect(buildingLevel(save, 'training')).toBe(1);
    expect(buildingLevel(save, 'archive')).toBe(1);
  });

  it('upgrades to level 5, spends exact cost and stops at the cap', () => {
    const save = defaultSave();
    save.currencies.gold = 2_000_000;
    save.currencies.crystals = 1_000;

    const firstCost = nextBuildingCost(save, 'altar');
    expect(firstCost).toEqual({ gold: 40_000, crystals: 30 });
    const goldBefore = save.currencies.gold;
    const crystalsBefore = save.currencies.crystals;

    const first = upgradeBuilding(save, 'altar');
    expect(first?.level).toBe(2);
    expect(save.currencies.gold).toBe(goldBefore - 40_000);
    expect(save.currencies.crystals).toBe(crystalsBefore - 30);
    expect(summonDiscount(save)).toBeCloseTo(0.02, 5);

    while (buildingLevel(save, 'altar') < BUILDING_MAX_LEVEL) {
      expect(upgradeBuilding(save, 'altar')).not.toBeNull();
    }
    expect(buildingLevel(save, 'altar')).toBe(BUILDING_MAX_LEVEL);
    expect(nextBuildingCost(save, 'altar')).toBeNull();
    expect(upgradeBuilding(save, 'altar')).toBeNull();
    noNegative(save);
  });

  it('does not allow an upgrade without resources and never goes negative', () => {
    const save = defaultSave();
    save.currencies.gold = 0;
    save.currencies.crystals = 0;
    const before = { ...save.currencies };
    expect(canUpgradeBuilding(save, 'altar')).toBe(false);
    expect(upgradeBuilding(save, 'altar')).toBeNull();
    expect(save.currencies).toEqual(before);
    expect(buildingLevel(save, 'altar')).toBe(1);
    noNegative(save);
  });

  it('applies building effects to adjacent systems', () => {
    const save = defaultSave();
    save.base.buildings = {
      altar: 5,
      barracks: 5,
      dining: 5,
      training: 5,
      archive: 5,
    };

    expect(xpMultiplier(save)).toBeCloseTo(1.2, 5);
    expect(diningEffectMultiplier(save)).toBeCloseTo(1.2, 5);
    expect(trialAttempts(save)).toBe(7);
    expect(attemptsLeft(save, 'thorn')).toBe(7);
    expect(crystalFloorMultiplier(save)).toBeCloseTo(1.08, 5);
    expect(pullCost('standard', 1, false, save).amount).toBe(276);
    expect(pullCost('standard', 10, false, save).amount).toBe(2_484);
    expect(pullCost('standard', 1, true, save)).toEqual({ currency: 'seals', amount: 1 });
  });
});

describe('resource exchange', () => {
  it('respects the daily limit and resets the next day', () => {
    const day = new Date(2026, 10, 15);
    const nextDay = new Date(2026, 10, 16);
    const save = defaultSave();
    save.currencies.gold = 10_000;
    const crystalsBefore = save.currencies.crystals;

    expect(exchangeLeft(save, 'gold-crystals')).toBe(3);
    expect(exchangeResource(save, 'gold-crystals', day)).not.toBeNull();
    expect(save.currencies.gold).toBe(9_000);
    expect(save.currencies.crystals).toBe(crystalsBefore + 10);
    expect(exchangeLeft(save, 'gold-crystals')).toBe(2);

    expect(exchangeResource(save, 'gold-crystals', day)).not.toBeNull();
    expect(exchangeResource(save, 'gold-crystals', day)).not.toBeNull();
    expect(exchangeLeft(save, 'gold-crystals')).toBe(0);
    expect(canExchange(save, 'gold-crystals')).toBe(false);
    expect(exchangeResource(save, 'gold-crystals', day)).toBeNull();

    ensureExchangeDay(save, nextDay);
    expect(exchangeLeft(save, 'gold-crystals')).toBe(3);
    noNegative(save);
  });

  it('does not exchange without the required resource', () => {
    const save = defaultSave();
    save.currencies.dust = 99;
    const before = save.currencies.dust;
    expect(canExchange(save, 'dust-essence')).toBe(false);
    expect(exchangeResource(save, 'dust-essence')).toBeNull();
    expect(save.currencies.dust).toBe(before);
    noNegative(save);
  });
});

describe('master level', () => {
  it('grows from xp, caps at the maximum and pays each reward once', () => {
    const save = defaultSave();
    expect(masterLevel(save)).toBe(1);
    const gained = addMasterXp(save, 1_000);
    expect(gained).toBeGreaterThan(0);
    expect(masterLevel(save)).toBeGreaterThan(1);
    expect(claimableMasterLevels(save).length).toBeGreaterThan(0);

    const reward = masterReward(2);
    const goldBefore = save.currencies.gold;
    const paid = claimMasterReward(save, 2);
    expect(paid).toEqual(reward);
    expect(save.currencies.gold).toBe(goldBefore + reward.gold);
    expect(claimMasterReward(save, 2)).toBeNull();

    save.player.masterLevel = MASTER_LEVEL_MAX;
    expect(addMasterXp(save, 999_999)).toBe(0);
    expect(masterLevel(save)).toBe(MASTER_LEVEL_MAX);
    expect(masterXp(save)).toBe(0);
    noNegative(save);
  });
});

describe('base save migration', () => {
  it('normalizes broken building, exchange and master data', () => {
    const migrated = migrate({
      player: { masterLevel: 99 },
      base: {
        buildings: { altar: 99, barracks: 0, forge: -3, unknown: 5 },
        masterXp: -50,
        claimedMasterLevels: [2, 2, 1, 99, 3],
        exchangeDay: 7,
        exchangeUsed: { 'gold-crystals': 99, unknown: 4 },
      },
    });

    expect(migrated.player.masterLevel).toBe(MASTER_LEVEL_MAX);
    expect(migrated.base.buildings.altar).toBe(BUILDING_MAX_LEVEL);
    expect(migrated.base.buildings.barracks).toBe(1);
    expect(migrated.base.buildings.forge).toBeUndefined();
    expect(migrated.base.buildings.unknown).toBeUndefined();
    expect(migrated.base.masterXp).toBe(0);
    expect(migrated.base.claimedMasterLevels).toEqual([2, 3]);
    expect(migrated.base.exchangeDay).toBe('');
    expect(migrated.base.exchangeUsed['gold-crystals']).toBe(3);
    expect(migrated.base.exchangeUsed.unknown).toBeUndefined();
  });

  it('adds safe base defaults to legacy saves', () => {
    const migrated = migrate({ currencies: { gold: 10 }, player: { name: 'Old' } });
    expect(migrated.base.buildings).toEqual({
      altar: 1,
      barracks: 1,
      dining: 1,
      training: 1,
      archive: 1,
    });
    expect(migrated.base.masterXp).toBe(0);
    expect(migrated.base.claimedMasterLevels).toEqual([]);
    expect(migrated.base.exchangeUsed).toEqual({});
    expect(migrated.player.masterLevel).toBe(1);
  });
});
