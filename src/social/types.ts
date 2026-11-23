import type {
  ArenaHistoryEntrySave,
  FriendSave,
  GhostSquadSave,
  GuildMemberSave,
  MercenarySave,
  SaveV1,
} from '../game/save';

export interface SocialSeasonView {
  id: string;
  league: number;
  leagueNameRu: string;
  leagueNameEn: string;
  endsAt: number;
  rating: number;
  best: number;
  wins: number;
  losses: number;
  attacksLeft: number;
}

export interface SocialLeaderboardRow {
  rank: number;
  id: string;
  name: string;
  score: number;
  you: boolean;
}

export interface SocialGuildView {
  id: string;
  nameRu: string;
  nameEn: string;
  mottoRu: string;
  mottoEn: string;
  week: string;
  members: GuildMemberSave[];
  totalDamage: number;
  playerDamage: number;
  attemptsLeft: number;
  claimed: string[];
}

export type SocialFriendBlockReason = 'owned' | 'squad' | 'limit' | 'hired' | null;

export interface SocialFriendView {
  friend: FriendSave;
  hireable: boolean;
  hired: boolean;
  reason: SocialFriendBlockReason;
}

export interface SocialFriendsView {
  cap: number;
  list: SocialFriendView[];
  mercenary: MercenarySave | null;
}

export interface SocialHistoryView {
  entries: ArenaHistoryEntrySave[];
}

export interface SocialSnapshot {
  season: SocialSeasonView;
  leaderboard: SocialLeaderboardRow[];
  history: ArenaHistoryEntrySave[];
  ghosts: GhostSquadSave[];
  guild: SocialGuildView | null;
  friends: SocialFriendsView;
}

/**
 * Контракт социального слоя. Локальная реализация работает оффлайн;
 * будущий сервер подменяет её без изменений в UI и игровых командах.
 */
export interface SocialAPI {
  readonly id: 'local' | 'server';
  snapshot(save: SaveV1, date?: Date): Promise<SocialSnapshot>;
  leaderboard(save: SaveV1, date?: Date): Promise<SocialLeaderboardRow[]>;
  history(save: SaveV1): Promise<SocialHistoryView>;
  guild(save: SaveV1, date?: Date): Promise<SocialGuildView | null>;
  friends(save: SaveV1): Promise<SocialFriendsView>;
}
