import { localSocialAPI } from './local';
import type { SocialAPI } from './types';

let active: SocialAPI = localSocialAPI;

/** Текущая реализация социального слоя. UI и команды зависят только от интерфейса. */
export function socialAPI(): SocialAPI {
  return active;
}

/** Точка замены на серверную реализацию в следующем этапе. */
export function setSocialAPI(api: SocialAPI): void {
  active = api;
}

export { localSocialAPI };
export type {
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
