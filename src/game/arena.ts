import { hashString, Rng } from '../core/rng';
import { HEROES, HEROES_BY_ID, heroPower } from '../data/heroes';
import {
  ARENA_ATTACKS_PER_DAY,
  ARENA_BOT_NAMES,
  ARENA_GHOST_LIMIT,
  ARENA_HISTORY_LIMIT,
  ARENA_LEADERBOARD_SIZE,
  ARENA_LEAGUES,
  ARENA_LOSS_RATING,
  ARENA_SEASON_DAYS,
  ARENA_SOFT_RESET,
  ARENA_START_RATING,
  ARENA_WIN_RATING,
} from '../data/social';
import { allyFromHero } from './battle/factory';
import { simulate } from './battle/sim';
import type { BattleResult, UnitInit } from './battle/types';
import { addMasterXp } from './base';
import { GEAR_DROP_ARENA } from './config';
import { rollGearDrop } from './equipment';
import { applyHeroDeaths, fallenFromResult } from './hero-loss';
import type { ArenaHistoryEntrySave, GhostSquadSave, SaveV1 } from './save';
import { buildSquad } from './squad';

export interface ArenaOpponentHero {
  heroId: string;
  level: number;
  star: number;
}

export interface ArenaOpponent {
  id: string;
  name: string;
  power: number;
  heroes: ArenaOpponentHero[];
}

export interface ArenaSeasonReset {
  season: string;
  previousSeason: string;
  league: number;
  previousRating: number;
  previousBest: number;
  rating: number;
  crystals: number;
  tokens: number;
}

export interface ArenaLeaderboardRow {
  rank: number;
  id: string;
  name: string;
  score: number;
  you: boolean;
}

export interface ArenaFightOutcome {
  result: BattleResult;
  opponent: ArenaOpponent;
  win: boolean;
  ratingBefore: number;
  ratingAfter: number;
  tokens: number;
  crystals: number;
  gearId: string | null;
  historyId: string;
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

/** Конец текущего сезона: ближайший понедельник, 00:00 локального времени. */
export function seasonEndsAt(date = new Date()): number {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay() || 7;
  start.setDate(start.getDate() + (8 - day));
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

export const ARENA_SEASON_MS = ARENA_SEASON_DAYS * 86_400_000;

export function ensureArenaDay(save: SaveV1, date = new Date()): void {
  const day = dayKey(date);
  if (save.arena.date !== day) {
    save.arena.date = day;
    save.arena.attacksToday = 0;
  }
}

/**
 * Сезон Арены — ISO-неделя. При смене недели: мягкий сброс рейтинга,
 * награда по прошлой лиге, очистка дневных атак. История боёв сохраняется.
 */
export function ensureArenaSeason(save: SaveV1, date = new Date()): ArenaSeasonReset | null {
  const week = weekKey(date);
  const day = dayKey(date);

  if (!save.arena.season) {
    save.arena.season = week;
    save.arena.seasonBest = Math.max(save.arena.seasonBest || 0, save.arena.rating);
    save.arena.league = leagueOf(save.arena.rating);
    ensureArenaDay(save, date);
    return null;
  }

  if (save.arena.season !== week) {
    const previousSeason = save.arena.season;
    const previousLeague = leagueOf(save.arena.rating);
    const reward = leagueReward(previousLeague);
    const previousRating = save.arena.rating;
    const previousBest = Math.max(save.arena.seasonBest || 0, previousRating);

    save.arena.rating = Math.max(
      0,
      Math.round(ARENA_START_RATING + (previousRating - ARENA_START_RATING) * ARENA_SOFT_RESET),
    );
    save.arena.seasonBest = save.arena.rating;
    save.arena.season = week;
    save.arena.league = leagueOf(save.arena.rating);
    save.arena.attacksToday = 0;
    save.arena.date = day;
    save.arena.wins = 0;
    save.arena.losses = 0;
    save.currencies.crystals += reward.crystals;
    save.currencies.arenaTokens += reward.tokens;

    return {
      season: week,
      previousSeason,
      league: previousLeague,
      previousRating,
      previousBest,
      rating: save.arena.rating,
      crystals: reward.crystals,
      tokens: reward.tokens,
    };
  }

  ensureArenaDay(save, date);
  return null;
}

export function leagueOf(rating: number): number {
  for (let index = ARENA_LEAGUES.length - 1; index >= 0; index -= 1) {
    const league = ARENA_LEAGUES[index];
    if (league && rating >= league.minRating) return index + 1;
  }
  return 1;
}

export function leagueName(league: number, locale: 'ru' | 'en'): string {
  const entry = ARENA_LEAGUES[Math.min(ARENA_LEAGUES.length, Math.max(1, league)) - 1] ?? ARENA_LEAGUES[0];
  if (!entry) return '';
  return locale === 'ru' ? entry.nameRu : entry.nameEn;
}

export function leagueReward(league: number): { crystals: number; tokens: number } {
  const entry = ARENA_LEAGUES[Math.min(ARENA_LEAGUES.length, Math.max(1, league)) - 1] ?? ARENA_LEAGUES[0];
  return { crystals: entry?.crystals ?? 0, tokens: entry?.tokens ?? 0 };
}

export function attacksLeft(save: SaveV1): number {
  return Math.max(0, ARENA_ATTACKS_PER_DAY - save.arena.attacksToday);
}

function rollOpponents(save: SaveV1, date = new Date()): ArenaOpponent[] {
  const day = dayKey(date);
  const seed = hashString(`${day}|${save.tower.maxFloor}`);
  const rng = new Rng(seed);
  const pool = HEROES.filter((hero) => hero.rarity >= 4 && hero.id !== 'nira');

  return [0.85, 1, 1.18].map((factor, index) => {
    const heroes: ArenaOpponentHero[] = [];
    const used = new Set<string>();

    while (heroes.length < 5 && used.size < pool.length) {
      const hero = pool[rng.int(0, pool.length - 1)];
      if (!hero || used.has(hero.id)) continue;
      used.add(hero.id);
      const level = Math.max(1, Math.round((save.tower.maxFloor + 1) * factor));
      const star = Math.min(6, Math.max(3, hero.rarity + (level >= 50 ? 1 : 0)));
      heroes.push({ heroId: hero.id, level, star });
    }

    const power = heroes.reduce((total, entry) => {
      const hero = HEROES_BY_ID[entry.heroId];
      return total + (hero ? heroPower(hero, entry.level, entry.star) : 0);
    }, 0);

    return {
      id: `opp_${index}`,
      name: ARENA_BOT_NAMES[(seed + index * 3) % ARENA_BOT_NAMES.length] ?? `Bot ${index + 1}`,
      power,
      heroes,
    };
  });
}

/** Призраки сегодняшнего дня; если их ещё нет в сейве — детерминированные боты. */
export function arenaOpponents(save: SaveV1, date = new Date()): ArenaOpponent[] {
  const season = save.arena.season || weekKey(date);
  const day = dayKey(date);
  const today = (save.social?.ghosts ?? []).filter((ghost) => ghost.season === season && ghost.day === day);
  if (today.length >= 3) return today.slice(0, 3).map(ghostToOpponent);
  return rollOpponents(save, date);
}

function ghostToOpponent(ghost: GhostSquadSave): ArenaOpponent {
  return {
    id: ghost.id,
    name: ghost.name,
    power: ghost.power,
    heroes: ghost.heroes.map((entry) => ({ heroId: entry.heroId, level: entry.level, star: entry.star })),
  };
}

export function ghostById(save: SaveV1, ghostId: string): GhostSquadSave | null {
  return (save.social?.ghosts ?? []).find((ghost) => ghost.id === ghostId) ?? null;
}

/**
 * Фиксирует три призрачных отряда на день. Снимки хранятся до 20 штук,
 * чтобы реванш работал оффлайн и без сервера.
 */
export function ensureGhosts(save: SaveV1, date = new Date()): GhostSquadSave[] {
  const season = save.arena.season || weekKey(date);
  const day = dayKey(date);
  const current = save.social.ghosts.filter((ghost) => ghost.season === season && ghost.day === day);
  if (current.length >= 3) return current.slice(0, 3);

  const at = date.getTime();
  const bots = rollOpponents(save, date);
  for (let index = current.length; index < 3; index += 1) {
    const bot = bots[index];
    if (!bot) continue;
    const id = `ghost-${season}-${day}-${index}`;
    if (save.social.ghosts.some((ghost) => ghost.id === id)) continue;
    save.social.ghosts.push({
      id,
      name: bot.name,
      season,
      day,
      power: bot.power,
      heroes: bot.heroes.map((entry) => ({ ...entry })),
      createdAt: at,
      source: 'bot',
    });
  }

  save.social.ghosts.sort((a, b) => a.createdAt - b.createdAt);
  if (save.social.ghosts.length > ARENA_GHOST_LIMIT) {
    save.social.ghosts = save.social.ghosts.slice(-ARENA_GHOST_LIMIT);
  }
  return save.social.ghosts.filter((ghost) => ghost.season === season && ghost.day === day).slice(0, 3);
}

export function opponentUnits(opponent: ArenaOpponent): UnitInit[] {
  return opponent.heroes
    .map((entry, slot) => {
      const hero = HEROES_BY_ID[entry.heroId];
      if (!hero) return null;
      return allyFromHero(hero, { slot, star: entry.star, level: entry.level });
    })
    .filter((unit): unit is UnitInit => unit !== null)
    .map((unit) => ({ ...unit, side: 'enemy' as const, uid: `enemy_${unit.uid}` }));
}

export function applyArenaResult(
  save: SaveV1,
  win: boolean,
  seed = hashString(`${save.arena.date}|${save.arena.rating}|${save.arena.attacksToday}`),
): { rating: number; tokens: number; crystals: number; gearId: string | null } {
  const ratingDelta = win ? ARENA_WIN_RATING : -ARENA_LOSS_RATING;
  const tokens = win ? 60 : 20;
  const crystals = win ? 20 : 0;

  save.arena.rating = Math.max(0, save.arena.rating + ratingDelta);
  save.arena.league = leagueOf(save.arena.rating);
  save.arena.seasonBest = Math.max(save.arena.seasonBest || 0, save.arena.rating);
  save.arena.attacksToday += 1;
  if (win) save.arena.wins += 1;
  else save.arena.losses += 1;
  addMasterXp(save, 5);
  save.currencies.arenaTokens += tokens;
  save.currencies.crystals += crystals;

  const gear = win ? rollGearDrop(seed, GEAR_DROP_ARENA) : null;
  if (gear) save.inventory.gear.push(gear.id);

  return { rating: save.arena.rating, tokens, crystals, gearId: gear?.id ?? null };
}

function pushHistory(save: SaveV1, entry: ArenaHistoryEntrySave): void {
  save.arena.history.unshift(entry);
  if (save.arena.history.length > ARENA_HISTORY_LIMIT) {
    save.arena.history.length = ARENA_HISTORY_LIMIT;
  }
}

export function arenaHistory(save: SaveV1): ArenaHistoryEntrySave[] {
  return [...save.arena.history].sort((a, b) => b.at - a.at).slice(0, ARENA_HISTORY_LIMIT);
}

/** Один асинхронный бой Арены. Симуляция детерминирована переданным seed. */
export function fightArena(
  save: SaveV1,
  opponent: ArenaOpponent,
  seed: number,
  date = new Date(),
): ArenaFightOutcome | null {
  ensureArenaSeason(save, date);
  if (attacksLeft(save) <= 0) return null;

  const allies = buildSquad(save);
  if (allies.length === 0) return null;

  const ratingBefore = save.arena.rating;
  const result = simulate({
    seed,
    mode: 'arena',
    allies,
    enemies: opponentUnits(opponent),
    masterCharges: 0,
    maxTime: 45,
  });

  applyHeroDeaths(save, fallenFromResult(result));
  const win = result.outcome === 'win';
  const rewards = applyArenaResult(save, win, hashString(`${seed}|${opponent.id}|gear`));
  const historyId = `arena-${save.arena.season}-${date.getTime()}-${save.arena.attacksToday}-${hashString(opponent.id)}`;
  pushHistory(save, {
    id: historyId,
    season: save.arena.season,
    at: date.getTime(),
    opponentId: opponent.id,
    opponentName: opponent.name,
    ...(opponent.id.startsWith('ghost-') ? { ghostId: opponent.id } : {}),
    win,
    ratingBefore,
    ratingAfter: save.arena.rating,
    power: opponent.power,
    revenge: false,
    revenged: false,
  });

  return {
    result,
    opponent,
    win,
    ratingBefore,
    ratingAfter: save.arena.rating,
    tokens: rewards.tokens,
    crystals: rewards.crystals,
    gearId: rewards.gearId,
    historyId,
  };
}

/** Реванш доступен по проигранному бою, если снимок призрака ещё в сейве. */
export function canRevenge(save: SaveV1, entry: ArenaHistoryEntrySave): boolean {
  if (entry.win || entry.revenged || !entry.ghostId) return false;
  return ghostById(save, entry.ghostId) !== null;
}

export function fightRevenge(
  save: SaveV1,
  historyId: string,
  seed: number,
  date = new Date(),
): ArenaFightOutcome | null {
  const entry = save.arena.history.find((item) => item.id === historyId);
  if (!entry || !canRevenge(save, entry)) return null;
  if (attacksLeft(save) <= 0) return null;

  const ghost = entry.ghostId ? ghostById(save, entry.ghostId) : null;
  if (!ghost) return null;

  const outcome = fightArena(save, ghostToOpponent(ghost), seed, date);
  if (!outcome) return null;

  entry.revenged = true;
  const fresh = save.arena.history.find((item) => item.id === outcome.historyId);
  if (fresh) fresh.revenge = true;
  return outcome;
}

/**
 * Локальный лидерборд сезона: детерминированные соперники + игрок.
 * Сортировка по рейтингу, при равенстве — по имени, ранги непрерывные.
 */
export function arenaLeaderboard(save: SaveV1, date = new Date()): ArenaLeaderboardRow[] {
  const season = save.arena.season || weekKey(date);
  const rng = new Rng(hashString(`arena-board|${season}`));
  const bots = ARENA_BOT_NAMES.map((name, index) => ({
    id: `board_${index}`,
    name,
    score: 780 + rng.int(0, 2_350),
    you: false,
  }));

  const rows = [
    ...bots,
    { id: 'you', name: save.player.name, score: save.arena.rating, you: true },
  ].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const ranked = rows.map((row, index) => ({ ...row, rank: index + 1 }));
  const top = ranked.slice(0, ARENA_LEADERBOARD_SIZE);
  const self = ranked.find((row) => row.you);
  if (self && !top.some((row) => row.you)) top.push(self);
  return top;
}
