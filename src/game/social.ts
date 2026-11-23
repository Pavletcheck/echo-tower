import { ensureArenaSeason, ensureGhosts } from './arena';
import { ensureGuildWeek } from './guild';
import { ensureFriends, syncMercenary } from './mercenary';
import type { SaveV1 } from './save';

/**
 * Единая точка входа социальных данных при загрузке/открытии экранов.
 * Ничего не требует от сети: все снимки строятся локально и детерминированно.
 */
export function ensureSocial(save: SaveV1, date = new Date()): void {
  ensureArenaSeason(save, date);
  ensureGhosts(save, date);
  ensureGuildWeek(save, date);
  ensureFriends(save);
  syncMercenary(save);
}
