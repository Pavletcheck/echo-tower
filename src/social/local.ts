import { leagueName, leagueOf, arenaHistory, arenaLeaderboard, seasonEndsAt, attacksLeft } from '../game/arena';
import { currentGuild, guildAttemptsLeftAt, guildDisplayName, guildMotto, guildPlayerDamage, guildTotalDamage } from '../game/guild';
import { canHireMercenary, mercenaryCap } from '../game/mercenary';
import type { SaveV1 } from '../game/save';
import type {
  SocialAPI,
  SocialFriendBlockReason,
  SocialFriendView,
  SocialFriendsView,
  SocialGuildView,
  SocialHistoryView,
  SocialLeaderboardRow,
  SocialSeasonView,
  SocialSnapshot,
} from './types';

function friendReason(save: SaveV1, friendId: string): SocialFriendBlockReason {
  const friend = save.social.friends.find((entry) => entry.id === friendId);
  if (!friend) return null;
  if (save.heroes[friend.heroId]) return 'owned';
  if (save.squad.includes(friend.heroId)) return 'squad';
  if (save.social.mercenary?.friendId === friendId) return 'hired';
  if (friend.power > mercenaryCap(save)) return 'limit';
  return null;
}

function seasonView(save: SaveV1, date: Date): SocialSeasonView {
  const league = leagueOf(save.arena.rating);
  return {
    id: save.arena.season,
    league,
    leagueNameRu: leagueName(league, 'ru'),
    leagueNameEn: leagueName(league, 'en'),
    endsAt: seasonEndsAt(date),
    rating: save.arena.rating,
    best: save.arena.seasonBest,
    wins: save.arena.wins,
    losses: save.arena.losses,
    attacksLeft: attacksLeft(save),
  };
}

function guildView(save: SaveV1, date: Date): SocialGuildView | null {
  const guild = currentGuild(save);
  if (!guild) return null;
  return {
    id: guild.id,
    nameRu: guildDisplayName(guild, 'ru'),
    nameEn: guildDisplayName(guild, 'en'),
    mottoRu: guildMotto(guild, 'ru'),
    mottoEn: guildMotto(guild, 'en'),
    week: guild.week,
    members: [...guild.members].sort((a, b) => b.damage - a.damage || a.name.localeCompare(b.name)),
    totalDamage: guildTotalDamage(save),
    playerDamage: guildPlayerDamage(save),
    attemptsLeft: guildAttemptsLeftAt(save, date),
    claimed: [...guild.claimed],
  };
}

function friendsView(save: SaveV1): SocialFriendsView {
  const list: SocialFriendView[] = save.social.friends.map((friend) => {
    const reason = friendReason(save, friend.id);
    return {
      friend,
      hireable: canHireMercenary(save, friend.id),
      hired: save.social.mercenary?.friendId === friend.id,
      reason,
    };
  });
  return { cap: mercenaryCap(save), list, mercenary: save.social.mercenary };
}

/**
 * Локальная реализация SocialAPI: только чтение сейва, без сети и без мутаций.
 * Все значения детерминированы, поэтому оффлайн-игра ведёт себя одинаково.
 */
class LocalSocialAPI implements SocialAPI {
  readonly id = 'local' as const;

  leaderboard(save: SaveV1, date = new Date()): Promise<SocialLeaderboardRow[]> {
    return Promise.resolve(arenaLeaderboard(save, date));
  }

  history(save: SaveV1): Promise<SocialHistoryView> {
    return Promise.resolve({ entries: arenaHistory(save) });
  }

  guild(save: SaveV1, date = new Date()): Promise<SocialGuildView | null> {
    return Promise.resolve(guildView(save, date));
  }

  friends(save: SaveV1): Promise<SocialFriendsView> {
    return Promise.resolve(friendsView(save));
  }

  async snapshot(save: SaveV1, date = new Date()): Promise<SocialSnapshot> {
    const [leaderboard, history, guild, friends] = await Promise.all([
      this.leaderboard(save, date),
      this.history(save),
      this.guild(save, date),
      this.friends(save),
    ]);

    return {
      season: seasonView(save, date),
      leaderboard,
      history: history.entries,
      ghosts: [...save.social.ghosts],
      guild,
      friends,
    };
  }
}

export const localSocialAPI: SocialAPI = new LocalSocialAPI();
