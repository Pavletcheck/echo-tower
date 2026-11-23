import { now } from '../core/time';
import { GLASS_RAIN, MAIL_TTL_MS, RETURN_TIERS } from '../data/live';
import { grantLiveReward, type LiveReward } from './rewards';
import type { MailSave, SaveV1 } from './save';

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function eventActive(at: number): boolean {
  return at >= Date.parse(GLASS_RAIN.start) && at <= Date.parse(GLASS_RAIN.end);
}

function addMail(
  save: SaveV1,
  id: string,
  key: string,
  rewards: LiveReward,
  at: number,
  expiresAt: number,
): void {
  if (save.live.mail.some((mail) => mail.id === id)) return;
  save.live.mail.push({
    id,
    key,
    rewards,
    createdAt: at,
    expiresAt,
    claimed: false,
  });
}

/** Чистит просроченную почту и выдаёт приветствие, событие и возврат. */
export function ensureMail(save: SaveV1, at = now(), awayMs = 0): void {
  save.live.mail = save.live.mail.filter((mail) => mail.expiresAt > at);

  if (!save.flags.mailWelcome) {
    addMail(save, 'mail-welcome', 'mail.welcome', { gold: 1_000, crystals: 100 }, at, at + MAIL_TTL_MS);
    save.flags.mailWelcome = true;
  }

  if (eventActive(at) && !save.flags[`mailEvent:${GLASS_RAIN.id}`]) {
    addMail(
      save,
      `mail-event-${GLASS_RAIN.id}`,
      'mail.event',
      { glass: 50 },
      at,
      Date.parse(GLASS_RAIN.end) + MAIL_TTL_MS,
    );
    save.flags[`mailEvent:${GLASS_RAIN.id}`] = true;
  }

  const daysAway = Math.floor(awayMs / 86_400_000);
  const tier = [...RETURN_TIERS].reverse().find((entry) => daysAway >= entry.days);
  if (tier) {
    const id = `mail-return-${tier.days}-${dayKey(new Date(at))}`;
    addMail(save, id, tier.key, tier.rewards, at, at + MAIL_TTL_MS);
  }
}

export function unreadMail(save: SaveV1, at = now()): MailSave[] {
  return save.live.mail.filter((mail) => !mail.claimed && mail.expiresAt > at);
}

export function mailCount(save: SaveV1, at = now()): number {
  return unreadMail(save, at).length;
}

export function claimMail(save: SaveV1, id: string, at = now()): LiveReward | null {
  const mail = save.live.mail.find((entry) => entry.id === id);
  if (!mail || mail.claimed || mail.expiresAt <= at) return null;
  mail.claimed = true;
  grantLiveReward(save, mail.rewards);
  return mail.rewards;
}

export function claimAllMail(save: SaveV1, at = now()): number {
  let count = 0;
  for (const mail of save.live.mail) {
    if (mail.claimed || mail.expiresAt <= at) continue;
    mail.claimed = true;
    grantLiveReward(save, mail.rewards);
    count += 1;
  }
  return count;
}
