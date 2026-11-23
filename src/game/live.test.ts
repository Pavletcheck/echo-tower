import { describe, expect, it } from 'vitest';
import { CALENDAR_DAYS } from '../data/live';
import { calendarNextDay, claimCalendar } from './calendar';
import { ensureMail, claimAllMail, claimMail, mailCount } from './mail';
import { addPassXp, claimPass, ensurePass, passLevel, seasonKey } from './pass';
import { buyEventItem, eventBattleUnlocked, fightEventBattle, isEventActive } from './event';
import { defaultSave, type SaveV1 } from './save';

const DAY = 86_400_000;
const ACTIVE_EVENT = new Date('2026-11-15T12:00:00Z').getTime();
const ENDED_EVENT = new Date('2027-01-15T12:00:00Z').getTime();

function boost(save: SaveV1): void {
  for (const id of save.squad) {
    const hero = save.heroes[id];
    if (!hero) continue;
    hero.star = 6;
    hero.level = 100;
  }
}

describe('login calendar', () => {
  it('pays once per day and cycles after 28 days', () => {
    const save = defaultSave();
    const at = new Date(2026, 10, 10, 12).getTime();
    expect(claimCalendar(save, at)?.day).toBe(1);
    expect(claimCalendar(save, at)).toBeNull();
    expect(claimCalendar(save, at + DAY)?.day).toBe(2);

    for (let day = 3; day <= CALENDAR_DAYS; day += 1) {
      expect(claimCalendar(save, at + (day - 1) * DAY)?.day).toBe(day);
    }
    expect(calendarNextDay(save)).toBe(1);
    expect(claimCalendar(save, at + CALENDAR_DAYS * DAY)?.day).toBe(1);
    expect(save.live.calendar.claimedDays).toEqual([1]);
  });
});

describe('mail', () => {
  it('seeds welcome, event and return letters once, and expires old mail', () => {
    const save = defaultSave();
    ensureMail(save, ACTIVE_EVENT, 8 * DAY);
    expect(save.live.mail.length).toBeGreaterThanOrEqual(3);
    expect(mailCount(save, ACTIVE_EVENT)).toBe(save.live.mail.length);
    expect(save.live.mail.some((mail) => mail.id.startsWith('mail-return-7-'))).toBe(true);

    const first = save.live.mail[0]!;
    const goldBefore = save.currencies.gold;
    expect(claimMail(save, first.id, ACTIVE_EVENT)).not.toBeNull();
    expect(claimMail(save, first.id, ACTIVE_EVENT)).toBeNull();
    expect(save.currencies.gold).toBeGreaterThanOrEqual(goldBefore);

    const before = save.live.mail.length;
    ensureMail(save, ACTIVE_EVENT, 8 * DAY);
    expect(save.live.mail.length).toBe(before);

    save.live.mail[0]!.expiresAt = ACTIVE_EVENT - 1;
    ensureMail(save, ACTIVE_EVENT, 0);
    expect(save.live.mail.length).toBe(before - 1);

    expect(claimAllMail(save, ACTIVE_EVENT)).toBeGreaterThan(0);
    expect(mailCount(save, ACTIVE_EVENT)).toBe(0);
  });

  it('does not send return mail for short absences', () => {
    const save = defaultSave();
    ensureMail(save, ACTIVE_EVENT, 2 * DAY);
    expect(save.live.mail.some((mail) => mail.id.includes('return'))).toBe(false);
  });
});

describe('season pass', () => {
  it('adds xp, gates premium and resets on a new season', () => {
    const save = defaultSave();
    const at = new Date('2026-01-10T12:00:00Z');
    ensurePass(save, at);
    addPassXp(save, 350, at);
    expect(passLevel(save, at)).toBe(6);

    expect(claimPass(save, 1, 'free', at)).not.toBeNull();
    expect(claimPass(save, 1, 'free', at)).toBeNull();
    expect(claimPass(save, 1, 'premium', at)).toBeNull();

    save.flags.pass = true;
    expect(claimPass(save, 1, 'premium', at)).not.toBeNull();

    const beforeSeason = seasonKey(at);
    ensurePass(save, new Date('2026-03-10T12:00:00Z'));
    expect(save.live.pass.season).not.toBe(beforeSeason);
    expect(save.live.pass.xp).toBe(0);
    expect(save.live.pass.claimedFree).toEqual([]);
  });
});

describe('glass rain event', () => {
  it('runs only inside its dates and pays each battle once', () => {
    const save = defaultSave();
    boost(save);
    expect(isEventActive(ACTIVE_EVENT)).toBe(true);
    expect(isEventActive(ENDED_EVENT)).toBe(false);
    expect(fightEventBattle(save, 0, 1, ENDED_EVENT)).toBeNull();
    expect(eventBattleUnlocked(save, 1)).toBe(false);

    const first = fightEventBattle(save, 0, 2, ACTIVE_EVENT);
    expect(first).not.toBeNull();
    expect(first?.reward).not.toBeNull();
    expect(eventBattleUnlocked(save, 1)).toBe(true);
    expect(fightEventBattle(save, 0, 3, ACTIVE_EVENT)).toBeNull();
  });

  it('exchanges event glass once and rejects purchases after the end date', () => {
    const save = defaultSave();
    save.live.event.currency = 200;
    const essence = save.currencies.essence;

    expect(buyEventItem(save, 'event_essence', ACTIVE_EVENT)).not.toBeNull();
    expect(save.currencies.essence).toBe(essence + 300);
    expect(buyEventItem(save, 'event_essence', ACTIVE_EVENT)).toBeNull();
    expect(buyEventItem(save, 'event_shards', ENDED_EVENT)).toBeNull();
  });
});
