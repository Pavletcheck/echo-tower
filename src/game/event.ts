import { now } from '../core/time';
import { GLASS_RAIN } from '../data/live';
import { getFloor } from '../data/floors';
import { simulateFloor } from './battle/floor';
import type { FloorBattleResult } from './battle/types';
import { applyHeroDeaths, fallenFromResult } from './hero-loss';
import { trackQuest } from './quests';
import { grantLiveReward, type LiveReward } from './rewards';
import { buildSquad } from './squad';
import type { SaveV1 } from './save';

export function isEventActive(at = now()): boolean {
  return at >= Date.parse(GLASS_RAIN.start) && at <= Date.parse(GLASS_RAIN.end);
}

export function eventEndsAt(): number {
  return Date.parse(GLASS_RAIN.end);
}

export function ensureEvent(save: SaveV1): void {
  if (save.live.event.id !== GLASS_RAIN.id) {
    save.live.event = { id: GLASS_RAIN.id, cleared: [], currency: 0, claimed: [] };
  }
}

export function eventBattleUnlocked(save: SaveV1, index: number): boolean {
  ensureEvent(save);
  if (index === 0) return true;
  return save.live.event.cleared.includes(index - 1);
}

export function eventBattleCleared(save: SaveV1, index: number): boolean {
  return save.live.event.cleared.includes(index);
}

export function eventShopClaimed(save: SaveV1, id: string): boolean {
  return save.live.event.claimed.includes(id);
}

export function fightEventBattle(
  save: SaveV1,
  index: number,
  seed: number,
  at = now(),
): { result: FloorBattleResult; glass: number; reward: LiveReward | null } | null {
  ensureEvent(save);
  if (!isEventActive(at)) return null;
  const battle = GLASS_RAIN.battles[index];
  if (!battle || eventBattleCleared(save, index) || !eventBattleUnlocked(save, index)) return null;

  const floor = getFloor(battle.floor);
  if (!floor) return null;

  const result = simulateFloor(floor, buildSquad(save), seed, [], {
    modifiers: { hp: -0.15, atk: -0.1 },
    masterCharges: 3,
    maxTime: 45,
  });

  if (result.outcome !== 'win') {
    applyHeroDeaths(save, fallenFromResult(result));
    return { result, glass: save.live.event.currency, reward: null };
  }

  applyHeroDeaths(save, fallenFromResult(result));
  save.live.event.cleared.push(index);
  save.live.event.cleared.sort((a, b) => a - b);
  save.live.event.currency += battle.glass;
  trackQuest(save, 'eventBattles', 1);
  trackQuest(save, 'eventCurrency', battle.glass);
  if (result.echoes.length === 0) trackQuest(save, 'eventNoShatter', 1);

  return {
    result,
    glass: save.live.event.currency,
    reward: { glass: battle.glass },
  };
}

export function buyEventItem(
  save: SaveV1,
  itemId: string,
  at = now(),
): { reward: LiveReward; glassLeft: number } | null {
  ensureEvent(save);
  if (!isEventActive(at)) return null;
  const item = GLASS_RAIN.shop.find((entry) => entry.id === itemId);
  if (!item || eventShopClaimed(save, itemId)) return null;
  if (save.live.event.currency < item.price) return null;

  save.live.event.currency -= item.price;
  save.live.event.claimed.push(itemId);
  grantLiveReward(save, item.reward);
  trackQuest(save, 'eventShop', 1);
  return { reward: item.reward, glassLeft: save.live.event.currency };
}

export function eventResetAt(): number {
  return Date.parse(GLASS_RAIN.end);
}
