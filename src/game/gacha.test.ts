import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { HEROES } from '../data/heroes';
import { decodeSave, defaultSave, encodeSave, migrate, type SaveV1 } from './save';
import { featuredHero, freePullAvailable, performPull, pullAvailability, heroSave } from './gacha';

function save(): SaveV1 {
  const state = defaultSave();
  state.currencies.crystals = 30_000;
  state.currencies.seals = 10;
  return state;
}

describe('gacha', () => {
  it('hard pity guarantees a five star at pull 70', () => {
    const state = save();
    state.gacha.pity5 = 69;
    const results = performPull(state, 'standard', 1, new Rng(1));
    expect(results).toHaveLength(1);
    expect(results[0]?.rarity).toBe(5);
    expect(state.gacha.pity5).toBe(0);
  });

  it('a ten pull always contains at least one 4 star or better', () => {
    for (let seed = 1; seed <= 120; seed += 1) {
      const state = save();
      const results = performPull(state, 'standard', 10, new Rng(seed));
      expect(results).toHaveLength(10);
      expect(results.some((result) => result.rarity >= 4)).toBe(true);
    }
  });

  it('beginner banner guarantees a five star and can be used once', () => {
    const state = save();
    const results = performPull(state, 'beginner', 10, new Rng(7));
    expect(results.some((result) => result.rarity === 5)).toBe(true);
    expect(state.gacha.beginnerUsed).toBe(true);
    expect(pullAvailability(state, 'beginner', 10).ok).toBe(false);
  });

  it('starter ten is free, guarantees a five star and is available once per save', () => {
    const state = save();
    state.currencies.crystals = 0;
    const before = state.currencies.crystals;
    expect(pullAvailability(state, 'beginner', 10).ok).toBe(true);

    const results = performPull(state, 'beginner', 10, new Rng(21));
    expect(results).toHaveLength(10);
    expect(results.some((result) => result.rarity === 5)).toBe(true);
    expect(state.currencies.crystals).toBe(before);
    expect(state.gacha.beginnerUsed).toBe(true);
    expect(pullAvailability(state, 'beginner', 10).ok).toBe(false);

    const second = performPull(state, 'beginner', 10, new Rng(22));
    expect(second).toEqual([]);
    expect(state.gacha.totalPulls).toBe(10);

    const reloaded = decodeSave(encodeSave(state));
    expect(pullAvailability(reloaded, 'beginner', 10).ok).toBe(false);
    expect(performPull(reloaded, 'beginner', 10, new Rng(23))).toEqual([]);
  });

  it('keeps the free ten available for a migrated legacy save', () => {
    const legacy = migrate({ version: 1, currencies: { crystals: 0 }, gacha: { totalPulls: 42 } });
    expect(legacy.gacha.beginnerUsed).toBe(false);
    expect(pullAvailability(legacy, 'beginner', 10).ok).toBe(true);
    const results = performPull(legacy, 'beginner', 10, new Rng(77));
    expect(results.some((result) => result.rarity === 5)).toBe(true);
    expect(legacy.gacha.beginnerUsed).toBe(true);
  });

  it('starter ten guarantees exactly one five star and allows duplicates in other slots', () => {
    for (let seed = 30; seed < 45; seed += 1) {
      const state = save();
      const results = performPull(state, 'beginner', 10, new Rng(seed));
      expect(results).toHaveLength(10);
      expect(results.filter((result) => result.rarity === 5)).toHaveLength(1);
      expect(results[9]?.rarity).toBe(5);
      expect(results.slice(0, 9).every((result) => result.rarity <= 4)).toBe(true);
    }
  });

  it('starter ten may return duplicates of already owned heroes', () => {
    const state = save();
    for (const hero of HEROES) {
      if (hero.rarity === 3 && hero.id !== 'nira') state.heroes[hero.id] = heroSave(hero);
    }
    const results = performPull(state, 'beginner', 10, new Rng(88));
    expect(results.filter((result) => !result.isNew).length).toBeGreaterThan(0);
    expect(results.filter((result) => result.rarity === 5)).toHaveLength(1);
  });

  it('featured banner honours the guarantee', () => {
    const state = save();
    const featured = featuredHero();
    state.gacha.pity5 = 69;
    state.gacha.featuredGuaranteed = true;
    const results = performPull(state, 'featured', 1, new Rng(3));
    expect(results[0]?.hero.id).toBe(featured.id);
    expect(state.gacha.featuredGuaranteed).toBe(false);
  });

  it('converts duplicates into star shards', () => {
    const state = save();
    const featured = featuredHero();
    state.heroes[featured.id] = heroSave(featured);
    state.gacha.pity5 = 69;
    state.gacha.featuredGuaranteed = true;
    const results = performPull(state, 'featured', 1, new Rng(5));
    expect(results[0]?.isNew).toBe(false);
    expect(results[0]?.shards).toBe(40);
    expect(state.currencies.starShards[featured.id]).toBe(40);
  });

  it('free pull does not spend crystals and has a cooldown', () => {
    const state = save();
    const crystals = state.currencies.crystals;
    expect(freePullAvailable(state)).toBe(true);
    const results = performPull(state, 'standard', 1, new Rng(9), { free: true });
    expect(results).toHaveLength(1);
    expect(state.currencies.crystals).toBe(crystals);
    expect(freePullAvailable(state)).toBe(false);
  });

  it('spends crystals and seals correctly', () => {
    const crystalState = save();
    const before = crystalState.currencies.crystals;
    performPull(crystalState, 'standard', 10, new Rng(11));
    expect(crystalState.currencies.crystals).toBe(before - 2_700);

    const sealState = save();
    const seals = sealState.currencies.seals;
    performPull(sealState, 'standard', 1, new Rng(12), { useSeal: true });
    expect(sealState.currencies.seals).toBe(seals - 1);
  });
});
