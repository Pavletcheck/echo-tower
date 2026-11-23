import { hashString, Rng } from '../core/rng';
import { BOSSES_BY_ID, ENEMIES } from '../data/enemies';
import {
  CHALLENGE_DEFS,
  ENDGAME_SHOP_ITEMS,
  ENDLESS_RUNS_PER_DAY,
  ENDLESS_START_FLOOR,
  HARD_CHAPTERS,
  TOWER_ELEMENTS,
  TOWER_FLOORS,
  TOWER_MIN_MATCH,
  WORLD_ATTEMPTS_PER_DAY,
  WORLD_BOSS_ID,
  WORLD_TIERS,
  type ChallengeType,
  type HardChapterDef,
} from '../data/endgame';
import { getFloor } from '../data/floors';
import { HEROES_BY_ID, heroPower } from '../data/heroes';
import type { Element } from '../data/types';
import { bossUnits, enemyFromDef } from './battle/factory';
import { simulateFloor } from './battle/floor';
import { simulate } from './battle/sim';
import type { BattleResult, FloorBattleResult } from './battle/types';
import { effectiveLevel } from './resonance';
import { rollGearDrop } from './equipment';
import { applyHeroDeaths, fallenFromResult } from './hero-loss';
import { firstSquadHero } from './rewards';
import { buildSquad } from './squad';
import type { SaveV1 } from './save';

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

/** Сбрасывает дневные/недельные лимиты эндгейма. */
export function ensureEndgame(save: SaveV1, date = new Date()): void {
  const day = dayKey(date);
  const week = weekKey(date);

  if (save.endgame.world.week !== week) {
    save.endgame.world = {
      week,
      day,
      attempts: 0,
      total: 0,
      best: 0,
      claimed: [],
    };
  } else if (save.endgame.world.day !== day) {
    save.endgame.world.day = day;
    save.endgame.world.attempts = 0;
  }

  if (save.endgame.endless.day !== day) {
    save.endgame.endless.day = day;
    save.endgame.endless.runs = 0;
  }

  if (save.endgame.shop.day !== day) {
    save.endgame.shop.day = day;
    save.endgame.shop.bought = {};
  }
}

// ---------- Мировое Эхо ----------

export function worldAttemptsLeft(save: SaveV1, date = new Date()): number {
  ensureEndgame(save, date);
  return Math.max(0, WORLD_ATTEMPTS_PER_DAY - save.endgame.world.attempts);
}

export function worldBossUnits(save: SaveV1) {
  const boss = BOSSES_BY_ID[WORLD_BOSS_ID];
  if (!boss) return [];
  const floor = Math.min(100, Math.max(20, save.tower.maxFloor));
  return bossUnits(boss, floor);
}

export function fightWorld(
  save: SaveV1,
  seed: number,
  date = new Date(),
): { result: BattleResult; attemptsLeft: number; total: number; best: number } | null {
  ensureEndgame(save, date);
  if (worldAttemptsLeft(save, date) <= 0) return null;
  const allies = buildSquad(save);
  if (allies.length === 0) return null;

  const result = simulate({
    seed,
    mode: 'world',
    allies,
    enemies: worldBossUnits(save),
    masterCharges: 3,
    maxTime: 45,
  });

  save.endgame.world.attempts += 1;
  save.endgame.world.total += result.damageDealt;
  save.endgame.world.best = Math.max(save.endgame.world.best, result.damageDealt);
  applyHeroDeaths(save, fallenFromResult(result));

  return {
    result,
    attemptsLeft: WORLD_ATTEMPTS_PER_DAY - save.endgame.world.attempts,
    total: save.endgame.world.total,
    best: save.endgame.world.best,
  };
}

export function worldTierId(id: string): boolean {
  return WORLD_TIERS.some((tier) => tier.id === id);
}

export function claimWorldTier(
  save: SaveV1,
  tierId: string,
  date = new Date(),
): { marks: number; crystals: number } | null {
  ensureEndgame(save, date);
  const tier = WORLD_TIERS.find((entry) => entry.id === tierId);
  if (!tier) return null;
  if (save.endgame.world.claimed.includes(tierId)) return null;
  if (save.endgame.world.total < tier.threshold) return null;

  save.endgame.world.claimed.push(tierId);
  save.currencies.echoMarks += tier.marks;
  save.currencies.crystals += tier.crystals;
  return { marks: tier.marks, crystals: tier.crystals };
}

export interface LeaderboardRow {
  name: string;
  damage: number;
  you: boolean;
}

export function worldLeaderboard(save: SaveV1, date = new Date()): LeaderboardRow[] {
  ensureEndgame(save, date);
  const rng = new Rng(hashString(`world|${save.endgame.world.week}`));
  const names = ['Vesper', 'Ashborn', 'Nox', 'Morrow', 'Sable', 'Rune', 'Hollow', 'Ivars'];
  const rows: LeaderboardRow[] = names.map((name) => ({
    name,
    damage: 30_000 + rng.int(0, 620_000),
    you: false,
  }));

  rows.push({ name: 'Мастер', damage: save.endgame.world.total, you: true });
  return rows.sort((a, b) => b.damage - a.damage).slice(0, 12);
}

// ---------- Башни стихий ----------

export function towerProgress(save: SaveV1, element: Element): number {
  const value = save.endgame.towers[element] ?? 0;
  return Math.min(TOWER_FLOORS, Math.max(0, Math.floor(value)));
}

export function towerSquadCount(save: SaveV1, element: Element): number {
  return save.squad.reduce((total, id) => {
    const hero = HEROES_BY_ID[id];
    return total + (hero && save.heroes[id] && hero.element === element ? 1 : 0);
  }, 0);
}

export function towerSquadValid(save: SaveV1, element: Element): boolean {
  return towerSquadCount(save, element) >= TOWER_MIN_MATCH;
}

/** Автосостав для башни: сильнейшие герои нужной стихии, остальные слоты пустые. */
export function recommendedTowerSquad(save: SaveV1, element: Element): string[] {
  const matches = Object.keys(save.heroes)
    .map((id) => HEROES_BY_ID[id])
    .filter((hero) => Boolean(hero) && hero?.element === element)
    .sort((a, b) => {
      if (!a || !b) return 0;
      const left = heroPower(a, effectiveLevel(save, a.id), save.heroes[a.id]?.star ?? 3);
      const right = heroPower(b, effectiveLevel(save, b.id), save.heroes[b.id]?.star ?? 3);
      return right - left;
    })
    .slice(0, 5)
    .map((hero) => hero?.id ?? '');
  return matches;
}

export function fightTower(
  save: SaveV1,
  element: Element,
  seed: number,
): { result: FloorBattleResult; progress: number; reward: { marks: number; crystals: number; essence: number } | null } | null {
  if (!TOWER_ELEMENTS.includes(element)) return null;
  if (!towerSquadValid(save, element)) return null;
  const current = towerProgress(save, element);
  if (current >= TOWER_FLOORS) return null;

  const floorNumber = current + 1;
  const floor = getFloor(floorNumber);
  if (!floor) return null;

  const result = simulateFloor(floor, buildSquad(save), seed, [], {
    enemyModifiers: { hp: 0.1, atk: 0.05 },
  });
  applyHeroDeaths(save, fallenFromResult(result));
  if (result.outcome !== 'win') return { result, progress: current, reward: null };

  save.endgame.towers[element] = floorNumber;
  const reward = {
    marks: 2 + Math.ceil(floorNumber / 5),
    crystals: 20 + floorNumber * 4,
    essence: 10 + floorNumber * 2,
  };
  save.currencies.echoMarks += reward.marks;
  save.currencies.crystals += reward.crystals;
  save.currencies.essence += reward.essence;

  return { result, progress: floorNumber, reward };
}

// ---------- Бесконечный режим ----------

export function endlessRunsLeft(save: SaveV1, date = new Date()): number {
  ensureEndgame(save, date);
  return Math.max(0, ENDLESS_RUNS_PER_DAY - save.endgame.endless.runs);
}

export function endlessUnlocked(save: SaveV1): boolean {
  return save.tower.maxFloor >= ENDLESS_START_FLOOR;
}

export function fightEndless(
  save: SaveV1,
  seed: number,
  date = new Date(),
): {
  result: BattleResult;
  floor: number;
  best: number;
  reward: { marks: number; crystals: number } | null;
} | null {
  ensureEndgame(save, date);
  if (!endlessUnlocked(save)) return null;
  if (endlessRunsLeft(save, date) <= 0) return null;

  const floorNumber = ENDLESS_START_FLOOR + save.endgame.endless.best + 1;
  const enemies = ENEMIES.filter((enemy) => enemy.family !== 'echo-doubles')
    .slice(0, 3)
    .map((enemy, slot) => enemyFromDef(enemy, floorNumber, slot));

  const result = simulate({
    seed,
    mode: 'tower',
    allies: buildSquad(save),
    enemies,
    masterCharges: 0,
    maxTime: 45,
  });

  save.endgame.endless.runs += 1;
  applyHeroDeaths(save, fallenFromResult(result));
  if (result.outcome === 'win') {
    save.endgame.endless.best += 1;
    const reward = { marks: 5 + save.endgame.endless.best, crystals: 50 + save.endgame.endless.best * 10 };
    save.currencies.echoMarks += reward.marks;
    save.currencies.crystals += reward.crystals;
    return { result, floor: floorNumber, best: save.endgame.endless.best, reward };
  }

  return { result, floor: floorNumber, best: save.endgame.endless.best, reward: null };
}

// ---------- Hard mode глав ----------

export function hardUnlocked(save: SaveV1, chapter: number): boolean {
  const def = HARD_CHAPTERS.find((entry) => entry.chapter === chapter);
  return Boolean(def) && save.tower.maxFloor >= (def?.floor ?? Infinity);
}

export function hardCleared(save: SaveV1, chapter: number): boolean {
  return save.endgame.hard.cleared.includes(chapter);
}

export function fightHard(
  save: SaveV1,
  chapter: number,
  seed: number,
): { result: FloorBattleResult; def: HardChapterDef; reward: { marks: number; crystals: number; shards: number } | null } | null {
  const def = HARD_CHAPTERS.find((entry) => entry.chapter === chapter);
  if (!def || !hardUnlocked(save, chapter) || hardCleared(save, chapter)) return null;
  const floor = getFloor(def.floor);
  if (!floor) return null;

  const result = simulateFloor(floor, buildSquad(save), seed, [], {
    enemyModifiers: { hp: def.hp, atk: def.atk },
    masterCharges: 0,
    maxTime: 45,
  });
  applyHeroDeaths(save, fallenFromResult(result));
  if (result.outcome !== 'win') return { result, def, reward: null };

  save.endgame.hard.cleared.push(chapter);
  save.endgame.hard.cleared.sort((a, b) => a - b);
  save.currencies.echoMarks += def.marks;
  save.currencies.crystals += def.crystals;
  const shardHero = firstSquadHero(save);
  if (shardHero) {
    save.currencies.starShards[shardHero] =
      (save.currencies.starShards[shardHero] ?? 0) + def.shards;
  }
  return { result, def, reward: { marks: def.marks, crystals: def.crystals, shards: def.shards } };
}

// ---------- Испытания глав ----------

export function challengeId(chapter: number, type: ChallengeType): string {
  return `challenge-${chapter}-${type}`;
}

export function challengeUnlocked(save: SaveV1, chapter: number): boolean {
  return save.tower.maxFloor >= chapter * 10;
}

export function challengeClaimed(save: SaveV1, chapter: number, type: ChallengeType): boolean {
  return save.endgame.challenges.claimed.includes(challengeId(chapter, type));
}

export function challengeSquadValid(save: SaveV1, type: ChallengeType): boolean {
  const heroes = save.squad
    .map((id) => (id ? HEROES_BY_ID[id] : undefined))
    .filter((hero) => Boolean(hero) && Boolean(save.heroes[hero!.id]));
  if (heroes.length < 5) return false;
  if (type === 'no-vanguard') return !heroes.some((hero) => hero?.role === 'vanguard');
  if (type === 'four-star') return heroes.every((hero) => hero?.rarity === 4);
  return true;
}

export function fightChallenge(
  save: SaveV1,
  chapter: number,
  type: ChallengeType,
  seed: number,
): {
  result: FloorBattleResult;
  reward: { marks: number; crystals: number; shards: number } | null;
} | null {
  const def = CHALLENGE_DEFS.find((entry) => entry.type === type);
  if (!def || !challengeUnlocked(save, chapter) || challengeClaimed(save, chapter, type)) return null;
  if (!challengeSquadValid(save, type)) return null;

  const floor = getFloor(chapter * 10);
  if (!floor) return null;

  const result = simulateFloor(floor, buildSquad(save), seed, [], {
    enemyModifiers: { hp: 0.1, atk: 0.08 },
    maxTime: type === 'time-limit' ? 20 : 45,
  });
  applyHeroDeaths(save, fallenFromResult(result));
  if (result.outcome !== 'win') return { result, reward: null };

  save.endgame.challenges.claimed.push(challengeId(chapter, type));
  const reward = {
    marks: 8 + chapter * 2,
    crystals: 100 + chapter * 20,
    shards: 15 + chapter * 5,
  };
  save.currencies.echoMarks += reward.marks;
  save.currencies.crystals += reward.crystals;
  const shardHero = firstSquadHero(save);
  if (shardHero) {
    save.currencies.starShards[shardHero] =
      (save.currencies.starShards[shardHero] ?? 0) + reward.shards;
  }
  return { result, reward };
}

// ---------- Магазин эндгейма ----------

export function endgameShopBought(save: SaveV1, itemId: string, date = new Date()): number {
  ensureEndgame(save, date);
  return save.endgame.shop.bought[itemId] ?? 0;
}

export function canBuyEndgame(save: SaveV1, itemId: string, date = new Date()): boolean {
  const item = ENDGAME_SHOP_ITEMS.find((entry) => entry.id === itemId);
  if (!item) return false;
  ensureEndgame(save, date);
  if (save.endgame.shop.bought[itemId] ?? 0) return false;
  return save.currencies.echoMarks >= item.price;
}

export function buyEndgameItem(
  save: SaveV1,
  itemId: string,
  date = new Date(),
): { spent: number; granted: string } | null {
  const item = ENDGAME_SHOP_ITEMS.find((entry) => entry.id === itemId);
  if (!item || !canBuyEndgame(save, itemId, date)) return null;

  save.currencies.echoMarks -= item.price;
  save.endgame.shop.bought[itemId] = (save.endgame.shop.bought[itemId] ?? 0) + 1;

  if (item.grant === 'essence') save.currencies.essence += item.amount;
  else if (item.grant === 'dust') save.currencies.dust += item.amount;
  else if (item.grant === 'shards') {
    const heroId = firstSquadHero(save);
    if (heroId) {
      save.currencies.starShards[heroId] = (save.currencies.starShards[heroId] ?? 0) + item.amount;
    }
  } else if (item.grant === 'gear') {
    const gear = rollGearDrop(hashString(`endgame|${item.id}|${save.endgame.shop.day}`), 1);
    if (gear) save.inventory.gear.push(gear.id);
  }

  return { spent: item.price, granted: item.id };
}
