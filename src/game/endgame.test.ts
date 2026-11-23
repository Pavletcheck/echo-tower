import { describe, expect, it } from 'vitest';
import { ENDLESS_START_FLOOR, TOWER_FLOORS } from '../data/endgame';
import {
  buyEndgameItem,
  canBuyEndgame,
  challengeSquadValid,
  claimWorldTier,
  endlessRunsLeft,
  ensureEndgame,
  fightChallenge,
  fightEndless,
  fightHard,
  fightTower,
  fightWorld,
  hardCleared,
  hardUnlocked,
  towerProgress,
  towerSquadValid,
  worldAttemptsLeft,
} from './endgame';
import { heroSave } from './gacha';
import { HEROES_BY_ID } from '../data/heroes';
import { defaultSave, type SaveV1 } from './save';

const DAY = new Date(2026, 10, 10);
const NEXT_DAY = new Date(2026, 10, 11);
const NEXT_WEEK = new Date(2026, 10, 18);

function addHero(save: SaveV1, id: string): void {
  const hero = HEROES_BY_ID[id];
  if (hero) save.heroes[id] = heroSave(hero);
}

function boost(save: SaveV1): void {
  for (const id of save.squad) {
    const hero = save.heroes[id];
    if (!hero) continue;
    hero.star = 6;
    hero.level = 100;
    hero.skillLevels = [5, 5, 5, 5];
    hero.artifactLevel = 5;
  }
}

describe('endgame cycles', () => {
  it('resets weekly and daily limits without losing tower progress', () => {
    const save = defaultSave();
    save.endgame.world = { week: '1999-W1', day: 'old', attempts: 3, total: 900, best: 400, claimed: ['tier1'] };
    save.endgame.towers.echo = 7;
    save.endgame.endless.runs = 3;
    save.endgame.shop.bought = { endgame_essence: 1 };

    ensureEndgame(save, DAY);
    expect(save.endgame.world.total).toBe(0);
    expect(save.endgame.world.attempts).toBe(0);
    expect(save.endgame.world.claimed).toEqual([]);
    expect(save.endgame.endless.runs).toBe(0);
    expect(save.endgame.shop.bought).toEqual({});
    expect(save.endgame.towers.echo).toBe(7);

    save.endgame.world.attempts = 2;
    save.endgame.world.total = 123;
    ensureEndgame(save, NEXT_DAY);
    expect(save.endgame.world.attempts).toBe(0);
    expect(save.endgame.world.total).toBe(123);

    ensureEndgame(save, NEXT_WEEK);
    expect(save.endgame.world.total).toBe(0);
  });

  it('spends world attempts and claims weekly tiers once', () => {
    const save = defaultSave();
    save.tower.maxFloor = 30;
    boost(save);
    ensureEndgame(save, DAY);

    let total = 0;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = fightWorld(save, 1000 + attempt, DAY);
      expect(result).not.toBeNull();
      expect(result?.result.damageDealt).toBeGreaterThan(0);
      total += result?.result.damageDealt ?? 0;
    }
    expect(worldAttemptsLeft(save, DAY)).toBe(0);
    expect(save.endgame.world.total).toBe(total);
    expect(fightWorld(save, 2000, DAY)).toBeNull();

    save.endgame.world.total = 600_000;
    const first = claimWorldTier(save, 'tier1', DAY);
    expect(first).not.toBeNull();
    expect(claimWorldTier(save, 'tier1', DAY)).toBeNull();
    expect(() => claimWorldTier(save, 'missing', DAY)).not.toThrow();
  });
});

describe('endgame modes', () => {
  it('enforces the element composition for towers', () => {
    const save = defaultSave();
    expect(towerSquadValid(save, 'echo')).toBe(false);
    expect(fightTower(save, 'echo', 1)).toBeNull();

    addHero(save, 'briz');
    save.squad = ['thorn', 'zip', 'briz', 'neya', 'grom'];
    expect(towerSquadValid(save, 'echo')).toBe(true);

    const result = fightTower(save, 'echo', 7);
    expect(result).not.toBeNull();
    if (result?.reward) {
      expect(towerProgress(save, 'echo')).toBe(1);
      expect(save.currencies.echoMarks).toBeGreaterThan(0);
    }
  });

  it('unlocks endless mode only after floor 100', () => {
    const save = defaultSave();
    save.tower.maxFloor = ENDLESS_START_FLOOR - 1;
    expect(fightEndless(save, 1, DAY)).toBeNull();

    save.tower.maxFloor = ENDLESS_START_FLOOR;
    boost(save);
    const runsBefore = endlessRunsLeft(save, DAY);
    const result = fightEndless(save, 3, DAY);
    expect(result).not.toBeNull();
    expect(endlessRunsLeft(save, DAY)).toBe(runsBefore - 1);
    expect(save.endgame.endless.runs).toBe(1);
    expect(save.tower.maxFloor).toBe(ENDLESS_START_FLOOR);
  });

  it('unlocks hard chapters by main progress and pays once', () => {
    const save = defaultSave();
    expect(hardUnlocked(save, 1)).toBe(false);
    save.tower.maxFloor = 10;
    boost(save);
    expect(hardUnlocked(save, 1)).toBe(true);

    const first = fightHard(save, 1, 11);
    expect(first).not.toBeNull();
    if (first?.reward) {
      expect(hardCleared(save, 1)).toBe(true);
      expect(fightHard(save, 1, 12)).toBeNull();
      expect(save.currencies.echoMarks).toBeGreaterThanOrEqual(first.reward.marks);
    }
  });

  it('checks challenge restrictions and rewards them once', () => {
    const save = defaultSave();
    expect(challengeSquadValid(save, 'no-vanguard')).toBe(false);
    expect(challengeSquadValid(save, 'four-star')).toBe(false);
    expect(challengeSquadValid(save, 'time-limit')).toBe(true);

    save.tower.maxFloor = 10;
    addHero(save, 'briz');
    save.squad = ['zip', 'briz', 'neya', 'grom', 'lissa'];
    boost(save);
    expect(challengeSquadValid(save, 'no-vanguard')).toBe(true);

    const result = fightChallenge(save, 1, 'no-vanguard', 21);
    expect(result).not.toBeNull();
    if (result?.reward) {
      expect(fightChallenge(save, 1, 'no-vanguard', 22)).toBeNull();
      expect(save.currencies.echoMarks).toBeGreaterThan(0);
    }
  });

  it('limits endgame shop purchases per day', () => {
    const save = defaultSave();
    save.currencies.echoMarks = 100;
    ensureEndgame(save, DAY);
    const essence = save.currencies.essence;

    expect(canBuyEndgame(save, 'endgame_essence', DAY)).toBe(true);
    expect(buyEndgameItem(save, 'endgame_essence', DAY)).not.toBeNull();
    expect(save.currencies.essence).toBe(essence + 500);
    expect(buyEndgameItem(save, 'endgame_essence', DAY)).toBeNull();

    ensureEndgame(save, NEXT_DAY);
    expect(canBuyEndgame(save, 'endgame_essence', NEXT_DAY)).toBe(true);
  });

  it('keeps towers at 30 floors', () => {
    const save = defaultSave();
    save.endgame.towers.echo = 99;
    expect(towerProgress(save, 'echo')).toBe(TOWER_FLOORS);
  });
});
