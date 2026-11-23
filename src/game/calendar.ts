import { now } from '../core/time';
import { CALENDAR_DAYS, CALENDAR_REWARDS } from '../data/live';
import { grantLiveReward, type LiveReward } from './rewards';
import type { SaveV1 } from './save';

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function calendarNextDay(save: SaveV1): number {
  const claimed = save.live.calendar.claimedDays.length;
  if (claimed >= CALENDAR_DAYS) return 1;
  return claimed + 1;
}

export function calendarClaimedToday(save: SaveV1, at = now()): boolean {
  return save.live.calendar.lastClaimDay === dayKey(new Date(at));
}

export function canClaimCalendar(save: SaveV1, at = now()): boolean {
  return !calendarClaimedToday(save, at);
}

/** Одна награда календаря в день; после 28-го дня цикл начинается заново. */
export function claimCalendar(
  save: SaveV1,
  at = now(),
): { day: number; reward: LiveReward } | null {
  if (!canClaimCalendar(save, at)) return null;

  if (save.live.calendar.claimedDays.length >= CALENDAR_DAYS) {
    save.live.calendar.claimedDays = [];
    save.live.calendar.cycleStart = dayKey(new Date(at));
  }

  const day = save.live.calendar.claimedDays.length + 1;
  const reward = CALENDAR_REWARDS[day - 1];
  if (!reward) return null;

  save.live.calendar.cycleStart ||= dayKey(new Date(at));
  save.live.calendar.lastClaimDay = dayKey(new Date(at));
  save.live.calendar.claimedDays.push(day);
  grantLiveReward(save, reward);
  return { day, reward };
}
