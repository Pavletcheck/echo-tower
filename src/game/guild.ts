import { hashString, Rng } from '../core/rng';
import { BOSSES_BY_ID } from '../data/enemies';
import { HEROES_BY_ID, heroPower } from '../data/heroes';
import {
  GUILD_BOSS_ATTEMPTS_PER_DAY,
  GUILD_BOSS_FLOOR_MIN,
  GUILD_BOSS_ID,
  GUILD_CANDIDATES,
  GUILD_MEMBER_COUNT,
  GUILD_MEMBER_NAMES,
  GUILD_MILESTONES,
  type GuildCandidateDef,
  type GuildMilestoneDef,
} from '../data/social';
import { simulate } from './battle/sim';
import { bossUnits } from './battle/factory';
import type { BattleResult } from './battle/types';
import { addMasterXp } from './base';
import { applyHeroDeaths, fallenFromResult } from './hero-loss';
import { effectiveLevel } from './resonance';
import type { GuildMemberSave, GuildSave, SaveV1 } from './save';
import { buildSquad } from './squad';

export interface GuildFightOutcome {
  result: BattleResult;
  damage: number;
  total: number;
  attemptsLeft: number;
  contribution: number;
}

export interface GuildMilestoneReward {
  id: string;
  crystals: number;
  tokens: number;
  essence: number;
}

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

/** Сила отряда для отображения вклада; не боевая формула. */
function squadPower(save: SaveV1): number {
  return save.squad.reduce((total, heroId) => {
    const hero = HEROES_BY_ID[heroId];
    const owned = save.heroes[heroId];
    if (!hero || !owned) return total;
    return total + heroPower(hero, effectiveLevel(save, heroId), owned.star);
  }, 0);
}

export function guildCandidates(): readonly GuildCandidateDef[] {
  return GUILD_CANDIDATES;
}

export function guildDisplayName(guild: GuildSave | null, locale: 'ru' | 'en'): string {
  if (!guild) return '';
  const def = GUILD_CANDIDATES.find((entry) => entry.id === guild.id);
  if (def) return locale === 'ru' ? def.nameRu : def.nameEn;
  return guild.name;
}

export function guildMotto(guild: GuildSave | null, locale: 'ru' | 'en'): string {
  if (!guild) return '';
  const def = GUILD_CANDIDATES.find((entry) => entry.id === guild.id);
  if (!def) return '';
  return locale === 'ru' ? def.mottoRu : def.mottoEn;
}

/** Гильдия из сейва (для UI и SocialAPI). */
export function currentGuild(save: SaveV1): GuildSave | null {
  return save.social.guild;
}

/**
 * Недельный сброс гильдии: восстанавливает урон участников из seed недели,
 * обнуляет вклад игрока и награды. Гильдейские бои не зависят от сети.
 */
export function ensureGuildWeek(save: SaveV1, date = new Date()): GuildSave | null {
  const guild = save.social.guild;
  if (!guild) return null;

  const week = weekKey(date);
  const day = dayKey(date);
  const power = squadPower(save);

  if (guild.week !== week) {
    guild.week = week;
    guild.attempts = 0;
    guild.attemptsDay = day;
    guild.claimed = [];
    const rng = new Rng(hashString(`${guild.id}|${week}`));
    for (const member of guild.members) {
      if (member.you) {
        member.damage = 0;
        continue;
      }
      member.damage = Math.max(4_000, Math.round(member.power * (0.07 + rng.next() * 0.11)));
    }
  } else if (guild.attemptsDay !== day) {
    guild.attemptsDay = day;
    guild.attempts = 0;
  }

  let player = guild.members.find((member) => member.you);
  if (!player) {
    player = { id: 'you', name: save.player.name, power, damage: 0, you: true };
    guild.members.push(player);
  }
  player.name = save.player.name;
  player.power = power;
  return guild;
}

function buildMembers(def: GuildCandidateDef, save: SaveV1): GuildMemberSave[] {
  const seed = hashString(`${def.id}|${save.createdAt}|${save.player.name}`);
  const rng = new Rng(seed);
  const members: GuildMemberSave[] = [];

  for (let index = 0; index < GUILD_MEMBER_COUNT; index += 1) {
    const name =
      GUILD_MEMBER_NAMES[(seed + index * 7) % GUILD_MEMBER_NAMES.length] ?? `Echo ${index + 1}`;
    const power = Math.round(def.powerBase * (0.75 + rng.next() * 0.5));
    members.push({
      id: `${def.id}-m${index}`,
      name,
      power,
      damage: 0,
      you: false,
    });
  }

  members.push({
    id: 'you',
    name: save.player.name,
    power: squadPower(save),
    damage: 0,
    you: true,
  });
  return members;
}

/** Вступление в локальную гильдию. Повторное вступление не создаёт дублей. */
export function joinGuild(save: SaveV1, guildId: string, date = new Date()): boolean {
  if (save.social.guild) return false;
  const def = GUILD_CANDIDATES.find((entry) => entry.id === guildId);
  if (!def) return false;

  save.social.guild = {
    id: def.id,
    name: def.nameRu,
    joinedWeek: weekKey(date),
    week: '',
    members: buildMembers(def, save),
    attemptsDay: '',
    attempts: 0,
    claimed: [],
  };
  ensureGuildWeek(save, date);
  return true;
}

export function leaveGuild(save: SaveV1): boolean {
  if (!save.social.guild) return false;
  save.social.guild = null;
  return true;
}

export function guildBossAttemptsLeft(save: SaveV1, date = new Date()): number {
  const guild = ensureGuildWeek(save, date);
  if (!guild) return 0;
  return Math.max(0, GUILD_BOSS_ATTEMPTS_PER_DAY - guild.attempts);
}

/** Чистое чтение для UI/SocialAPI: не сбрасывает день и не мутирует сейв. */
export function guildAttemptsLeftAt(save: SaveV1, date = new Date()): number {
  const guild = save.social.guild;
  if (!guild) return 0;
  const sameDay = guild.attemptsDay === dayKey(date);
  return Math.max(0, GUILD_BOSS_ATTEMPTS_PER_DAY - (sameDay ? guild.attempts : 0));
}

export function guildBossUnits(save: SaveV1) {
  const boss = BOSSES_BY_ID[GUILD_BOSS_ID];
  if (!boss) return [];
  const floor = Math.max(GUILD_BOSS_FLOOR_MIN, save.tower.maxFloor);
  return bossUnits(boss, floor);
}

export function guildTotalDamage(save: SaveV1): number {
  const guild = save.social.guild;
  if (!guild) return 0;
  return guild.members.reduce((total, member) => total + member.damage, 0);
}

/** Вклад игрока — его урон по общему боссу за неделю. */
export function guildPlayerDamage(save: SaveV1): number {
  return save.social.guild?.members.find((member) => member.you)?.damage ?? 0;
}

/** Участники по вкладу: детерминированная сортировка, без сервера. */
export function guildContribution(save: SaveV1): GuildMemberSave[] {
  const guild = save.social.guild;
  if (!guild) return [];
  return [...guild.members].sort((a, b) => b.damage - a.damage || a.name.localeCompare(b.name));
}

/** Бой с общим недельным боссом. Урон суммируется между участниками. */
export function fightGuildBoss(
  save: SaveV1,
  seed: number,
  date = new Date(),
): GuildFightOutcome | null {
  const guild = ensureGuildWeek(save, date);
  if (!guild) return null;
  if (guildBossAttemptsLeft(save, date) <= 0) return null;

  const allies = buildSquad(save);
  if (allies.length === 0) return null;

  const result = simulate({
    seed,
    mode: 'guild',
    allies,
    enemies: guildBossUnits(save),
    masterCharges: 0,
    maxTime: 45,
  });

  guild.attempts += 1;
  const player = guild.members.find((member) => member.you);
  if (player) player.damage += result.damageDealt;
  addMasterXp(save, 10);
  applyHeroDeaths(save, fallenFromResult(result));

  return {
    result,
    damage: result.damageDealt,
    total: guildTotalDamage(save),
    attemptsLeft: Math.max(0, GUILD_BOSS_ATTEMPTS_PER_DAY - guild.attempts),
    contribution: player?.damage ?? 0,
  };
}

export function guildMilestoneClaimed(save: SaveV1, milestoneId: string): boolean {
  return save.social.guild?.claimed.includes(milestoneId) ?? false;
}

export function guildMilestones(): readonly GuildMilestoneDef[] {
  return GUILD_MILESTONES;
}

export function canClaimGuildMilestone(
  save: SaveV1,
  milestoneId: string,
  date = new Date(),
): boolean {
  const guild = ensureGuildWeek(save, date);
  if (!guild) return false;
  const milestone = GUILD_MILESTONES.find((entry) => entry.id === milestoneId);
  if (!milestone) return false;
  if (guild.claimed.includes(milestoneId)) return false;
  return guildTotalDamage(save) >= milestone.damage;
}

/** Награда за общий вклад выдаётся один раз за неделю. */
export function claimGuildMilestone(
  save: SaveV1,
  milestoneId: string,
  date = new Date(),
): GuildMilestoneReward | null {
  if (!canClaimGuildMilestone(save, milestoneId, date)) return null;
  const milestone = GUILD_MILESTONES.find((entry) => entry.id === milestoneId);
  const guild = save.social.guild;
  if (!milestone || !guild) return null;

  guild.claimed.push(milestoneId);
  save.currencies.crystals += milestone.crystals;
  save.currencies.arenaTokens += milestone.tokens;
  save.currencies.essence += milestone.essence;

  return {
    id: milestone.id,
    crystals: milestone.crystals,
    tokens: milestone.tokens,
    essence: milestone.essence,
  };
}
