import { describe, expect, it } from 'vitest';
import { GUILD_CANDIDATES, GUILD_MILESTONES } from '../data/social';
import {
  applyArenaResult,
  arenaHistory,
  arenaLeaderboard,
  arenaOpponents,
  attacksLeft,
  canRevenge,
  ensureArenaSeason,
  ensureGhosts,
  fightArena,
  fightRevenge,
  leagueName,
  leagueOf,
} from './arena';
import {
  canClaimGuildMilestone,
  claimGuildMilestone,
  ensureGuildWeek,
  fightGuildBoss,
  guildBossAttemptsLeft,
  guildPlayerDamage,
  guildTotalDamage,
  joinGuild,
  leaveGuild,
} from './guild';
import {
  ensureFriends,
  hireMercenary,
  mercenaryCap,
  mercenaryIsActive,
} from './mercenary';
import { buildSquad } from './squad';
import { defaultSave, migrate } from './save';
import { localSocialAPI } from '../social/local';

const DAY_A = new Date(2026, 10, 15);
const DAY_B = new Date(2026, 10, 16);
const WEEK_B = new Date(2026, 10, 23);

function lossEntry(ghostId: string, id = 'arena-loss'): Parameters<typeof canRevenge>[1] {
  return {
    id,
    season: '2026-W47',
    at: 1,
    opponentId: ghostId,
    opponentName: 'Ghost',
    ghostId,
    win: false,
    ratingBefore: 1_100,
    ratingAfter: 1_085,
    power: 1_000,
    revenge: false,
    revenged: false,
  };
}

describe('arena seasons', () => {
  it('keeps the league map compatible and extends it to ten leagues', () => {
    expect(leagueOf(900)).toBe(1);
    expect(leagueOf(1_150)).toBe(2);
    expect(leagueOf(1_350)).toBe(3);
    expect(leagueOf(1_600)).toBe(4);
    expect(leagueOf(2_700)).toBe(10);
    expect(leagueName(10, 'ru')).toBe('Эхо');
    expect(leagueName(4, 'en')).toBe('Platinum');
  });

  it('soft-resets the weekly season exactly once and keeps history', () => {
    const save = defaultSave();
    ensureArenaSeason(save, DAY_A);
    save.arena.rating = 1_600;
    save.arena.attacksToday = 5;
    save.arena.wins = 3;
    save.arena.losses = 2;
    save.arena.seasonBest = 1_700;
    save.arena.history = [lossEntry('ghost-old')];
    const crystalsBefore = save.currencies.crystals;
    const tokensBefore = save.currencies.arenaTokens;

    const reset = ensureArenaSeason(save, WEEK_B);
    expect(reset).not.toBeNull();
    expect(save.arena.season).not.toBe('2026-W47');
    expect(save.arena.rating).toBe(1_300);
    expect(save.arena.attacksToday).toBe(0);
    expect(save.arena.wins).toBe(0);
    expect(save.arena.losses).toBe(0);
    expect(attacksLeft(save)).toBe(5);
    expect(save.arena.history).toHaveLength(1);
    expect(save.currencies.crystals).toBe(crystalsBefore + (reset?.crystals ?? 0));
    expect(save.currencies.arenaTokens).toBe(tokensBefore + (reset?.tokens ?? 0));

    const afterReset = save.currencies.crystals;
    expect(ensureArenaSeason(save, WEEK_B)).toBeNull();
    expect(save.currencies.crystals).toBe(afterReset);
  });

  it('records results and advances the season best rating', () => {
    const save = defaultSave();
    ensureArenaSeason(save, DAY_A);
    applyArenaResult(save, true, 7);
    applyArenaResult(save, false, 8);
    expect(save.arena.wins).toBe(1);
    expect(save.arena.losses).toBe(1);
    expect(save.arena.seasonBest).toBeGreaterThanOrEqual(save.arena.rating);
    expect(save.arena.league).toBe(leagueOf(save.arena.rating));
  });

  it('sorts the local leaderboard and always contains the player', () => {
    const save = defaultSave();
    ensureArenaSeason(save, DAY_A);
    const rows = arenaLeaderboard(save, DAY_A);
    expect(rows[0]?.rank).toBe(1);
    expect(rows.some((row) => row.you)).toBe(true);
    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index - 1]?.score ?? 0).toBeGreaterThanOrEqual(rows[index]?.score ?? 0);
      expect(rows[index]?.rank ?? 0).toBeGreaterThan(rows[index - 1]?.rank ?? 0);
    }
  });

  it('creates ghosts once per day and prunes old snapshots', () => {
    const save = defaultSave();
    ensureArenaSeason(save, DAY_A);
    const first = ensureGhosts(save, DAY_A);
    expect(first).toHaveLength(3);
    expect(ensureGhosts(save, DAY_A)).toHaveLength(3);
    expect(save.social.ghosts).toHaveLength(3);
    expect(new Set(save.social.ghosts.map((ghost) => ghost.id)).size).toBe(3);

    for (let index = 0; index < 40; index += 1) {
      save.social.ghosts.push({
        id: `ghost-extra-${index}`,
        name: `Ghost ${index}`,
        season: 'old',
        day: 'old',
        power: 1,
        heroes: [{ heroId: 'neya', level: 1, star: 3 }],
        createdAt: index,
        source: 'bot',
      });
    }
    ensureGhosts(save, DAY_B);
    expect(save.social.ghosts.length).toBeLessThanOrEqual(20);
  });
});

describe('arena battles', () => {
  it('is deterministic for the same seed and opponent', () => {
    const first = defaultSave();
    const second = defaultSave();
    ensureArenaSeason(first, DAY_A);
    ensureArenaSeason(second, DAY_A);
    const opponentA = arenaOpponents(first, DAY_A)[0];
    const opponentB = arenaOpponents(second, DAY_A)[0];
    expect(opponentA).toEqual(opponentB);
    expect(opponentA && opponentB).toBeTruthy();
    if (!opponentA || !opponentB) return;

    const left = fightArena(first, opponentA, 987_654, DAY_A);
    const right = fightArena(second, opponentB, 987_654, DAY_A);
    expect(left?.result.outcome).toBe(right?.result.outcome);
    expect(left?.result.damageDealt).toBe(right?.result.damageDealt);
    expect(left?.result.timeMs).toBe(right?.result.timeMs);
    expect(left?.historyId).toBe(right?.historyId);
  });

  it('supports a revenge only for a lost battle with a stored ghost', () => {
    const save = defaultSave();
    ensureArenaSeason(save, DAY_A);
    const ghosts = ensureGhosts(save, DAY_A);
    const ghost = ghosts[0];
    expect(ghost).toBeTruthy();
    if (!ghost) return;

    const entry = lossEntry(ghost.id);
    save.arena.history = [entry];
    expect(canRevenge(save, entry)).toBe(true);

    const outcome = fightRevenge(save, entry.id, 424242, DAY_A);
    expect(outcome).not.toBeNull();
    expect(entry.revenged).toBe(true);
    expect(arenaHistory(save)[0]?.revenge).toBe(true);
    expect(canRevenge(save, entry)).toBe(false);
  });
});

describe('mercenaries', () => {
  it('adds exactly one friend hero and never duplicates it', () => {
    const save = defaultSave();
    ensureFriends(save);
    expect(save.social.friends.length).toBeGreaterThan(0);

    const friend = save.social.friends.find((entry) => entry.power <= mercenaryCap(save));
    expect(friend).toBeTruthy();
    if (!friend) return;

    expect(hireMercenary(save, friend.id, DAY_A)).toBe(true);
    expect(mercenaryIsActive(save)).toBe(true);
    expect(hireMercenary(save, friend.id, DAY_A)).toBe(false);

    const allies = buildSquad(save);
    const ids = allies.map((unit) => unit.defId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id === friend.heroId)).toHaveLength(1);
    expect(allies.length).toBe(save.squad.filter(Boolean).length + 1);
  });

  it('blocks a mercenary that is already owned or sits in the squad', () => {
    const save = defaultSave();
    ensureFriends(save);
    const friend = save.social.friends[0];
    expect(friend).toBeTruthy();
    if (!friend) return;

    const owned = { ...(save.heroes.thorn ?? save.heroes.neya)! };
    save.heroes[friend.heroId] = owned;
    expect(hireMercenary(save, friend.id, DAY_A)).toBe(false);

    delete save.heroes[friend.heroId];
    save.squad[0] = friend.heroId;
    expect(hireMercenary(save, friend.id, DAY_A)).toBe(false);
  });
});

describe('guild-lite', () => {
  it('joins once, accumulates shared boss damage and resets weekly', () => {
    const save = defaultSave();
    const guildId = GUILD_CANDIDATES[0]?.id ?? '';
    expect(joinGuild(save, 'missing', DAY_A)).toBe(false);
    expect(joinGuild(save, guildId, DAY_A)).toBe(true);
    expect(joinGuild(save, guildId, DAY_A)).toBe(false);
    expect(save.social.guild?.members.some((member) => member.you)).toBe(true);

    const before = guildTotalDamage(save);
    expect(before).toBeGreaterThan(0);
    const outcome = fightGuildBoss(save, 3_141_592, DAY_A);
    expect(outcome).not.toBeNull();
    expect(outcome?.total).toBe(before + (outcome?.damage ?? 0));
    expect(guildBossAttemptsLeft(save, DAY_A)).toBe(2);

    const milestone = GUILD_MILESTONES[0];
    expect(milestone).toBeTruthy();
    if (!milestone) return;
    const player = save.social.guild?.members.find((member) => member.you);
    expect(player).toBeTruthy();
    if (!player) return;
    player.damage = milestone.damage;
    expect(canClaimGuildMilestone(save, milestone.id, DAY_A)).toBe(true);

    const crystals = save.currencies.crystals;
    const reward = claimGuildMilestone(save, milestone.id, DAY_A);
    expect(reward?.crystals).toBe(milestone.crystals);
    expect(save.currencies.crystals).toBe(crystals + milestone.crystals);
    expect(claimGuildMilestone(save, milestone.id, DAY_A)).toBeNull();

    const weekBefore = save.social.guild?.week;
    ensureGuildWeek(save, WEEK_B);
    expect(save.social.guild?.week).not.toBe(weekBefore);
    expect(save.social.guild?.claimed).toEqual([]);
    expect(guildPlayerDamage(save)).toBe(0);
    expect(save.social.guild?.attempts).toBe(0);
  });

  it('can be left without breaking the save', () => {
    const save = defaultSave();
    joinGuild(save, GUILD_CANDIDATES[1]?.id ?? '', DAY_A);
    expect(leaveGuild(save)).toBe(true);
    expect(save.social.guild).toBeNull();
    expect(leaveGuild(save)).toBe(false);
  });
});

describe('social save migration', () => {
  it('normalizes broken arena and social data without losing progress', () => {
    const migrated = migrate({
      arena: {
        rating: 1_234,
        attacksToday: 99,
        season: '2020-W01',
        wins: 2,
        losses: 3,
        seasonBest: 1_300,
        history: [
          { ...lossEntry('ghost-1', 'h1'), at: 5 },
          { ...lossEntry('ghost-1', 'h1'), at: 4 },
          { ...lossEntry('ghost-2', 'h2'), at: 6, win: true },
        ],
      },
      social: {
        friends: [
          { id: 'f1', name: 'Liora', heroId: 'neya', level: 7, star: 3, power: 900 },
          { id: 'f1', name: 'Dup', heroId: 'thorn', level: 7, star: 3, power: 900 },
        ],
        friendsSeeded: true,
        mercenary: { friendId: 'f1', heroId: 'neya', level: 7, star: 3, power: 900, hiredAt: 1 },
        ghosts: [
          {
            id: 'g1',
            name: 'Ghost',
            season: '2020-W01',
            day: '1',
            power: 10,
            heroes: [{ heroId: 'neya', level: 3, star: 3 }],
            createdAt: 1,
          },
        ],
        guild: {
          id: 'guild-glass',
          name: 'Glass Circle',
          week: '2020-W01',
          attempts: 9,
          claimed: ['guild-1', 'guild-1'],
          members: [{ id: 'm1', name: 'Aster', power: 10, damage: 5, you: true }],
        },
      },
    });

    expect(migrated.arena.rating).toBe(1_234);
    expect(migrated.arena.attacksToday).toBe(5);
    expect(migrated.arena.history).toHaveLength(2);
    expect(migrated.arena.history[0]?.id).toBe('h2');
    expect(migrated.social.friends).toHaveLength(1);
    expect(migrated.social.mercenary?.heroId).toBe('neya');
    expect(migrated.social.ghosts).toHaveLength(1);
    expect(migrated.social.guild?.attempts).toBe(3);
    expect(migrated.social.guild?.claimed).toEqual(['guild-1']);
  });

  it('adds safe social defaults to legacy saves', () => {
    const migrated = migrate({ currencies: { gold: 10 } });
    expect(migrated.social.guild).toBeNull();
    expect(migrated.social.friends).toEqual([]);
    expect(migrated.social.mercenary).toBeNull();
    expect(migrated.social.ghosts).toEqual([]);
    expect(migrated.arena.season).toBe('');
    expect(migrated.arena.history).toEqual([]);
  });
});

describe('SocialAPI local implementation', () => {
  it('exposes the same deterministic data through the interface', async () => {
    const save = defaultSave();
    ensureArenaSeason(save, DAY_A);
    ensureGhosts(save, DAY_A);
    ensureFriends(save);
    joinGuild(save, GUILD_CANDIDATES[0]?.id ?? '', DAY_A);

    const snapshot = await localSocialAPI.snapshot(save, DAY_A);
    expect(snapshot.season.rating).toBe(save.arena.rating);
    expect(snapshot.leaderboard.some((row) => row.you)).toBe(true);
    expect(snapshot.ghosts).toHaveLength(3);
    expect(snapshot.friends.list.length).toBeGreaterThan(0);
    expect(snapshot.guild?.members.some((member) => member.you)).toBe(true);

    const board = await localSocialAPI.leaderboard(save, DAY_A);
    expect(board.map((row) => row.rank)).toEqual(snapshot.leaderboard.map((row) => row.rank));

    const history = await localSocialAPI.history(save);
    expect(history.entries).toEqual([]);
  });
});
