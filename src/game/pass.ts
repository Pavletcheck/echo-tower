import { PASS_LEVELS, PASS_MAX_LEVEL, PASS_XP_PER_LEVEL } from '../data/live';
import { grantLiveReward, type LiveReward } from './rewards';
import type { SaveV1 } from './save';

export type PassBranch = 'free' | 'premium';

function weekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** Сезон = 4 недели. */
export function seasonKey(date = new Date()): string {
  return `${date.getUTCFullYear()}-S${Math.floor((weekNumber(date) - 1) / 4) + 1}`;
}

export function ensurePass(save: SaveV1, date = new Date()): void {
  const season = seasonKey(date);
  if (save.live.pass.season !== season) {
    // Невостребованные платные награды прошлого сезона не сгорают.
    const oldLevel = Math.min(
      PASS_MAX_LEVEL,
      1 + Math.floor(Math.max(0, save.live.pass.xp) / PASS_XP_PER_LEVEL),
    );
    if (save.flags.pass) {
      for (let level = 1; level <= oldLevel; level += 1) {
        if (save.live.pass.claimedPaid.includes(level)) continue;
        const reward = passReward(level, 'premium');
        if (reward) grantLiveReward(save, reward);
      }
    }
    save.live.pass.season = season;
    save.live.pass.xp = 0;
    save.live.pass.claimedFree = [];
    save.live.pass.claimedPaid = [];
  }
}

export function passLevel(save: SaveV1, date = new Date()): number {
  ensurePass(save, date);
  return Math.min(PASS_MAX_LEVEL, 1 + Math.floor(save.live.pass.xp / PASS_XP_PER_LEVEL));
}

export function addPassXp(save: SaveV1, amount: number, date = new Date()): number {
  ensurePass(save, date);
  if (amount <= 0) return passLevel(save, date);
  save.live.pass.xp = Math.min(PASS_MAX_LEVEL * PASS_XP_PER_LEVEL, save.live.pass.xp + Math.floor(amount));
  return passLevel(save, date);
}

export function passReward(level: number, branch: PassBranch): LiveReward | null {
  const def = PASS_LEVELS.find((entry) => entry.level === level);
  if (!def) return null;
  return branch === 'free' ? def.free : def.premium;
}

export function passClaimed(save: SaveV1, level: number, branch: PassBranch): boolean {
  return (branch === 'free' ? save.live.pass.claimedFree : save.live.pass.claimedPaid).includes(level);
}

export function canClaimPass(
  save: SaveV1,
  level: number,
  branch: PassBranch,
  date = new Date(),
): boolean {
  ensurePass(save, date);
  if (passClaimed(save, level, branch)) return false;
  if (level < 1 || level > passLevel(save, date)) return false;
  if (branch === 'premium' && !save.flags.pass) return false;
  return passReward(level, branch) !== null;
}

export function claimPass(
  save: SaveV1,
  level: number,
  branch: PassBranch,
  date = new Date(),
): LiveReward | null {
  if (!canClaimPass(save, level, branch, date)) return null;
  const reward = passReward(level, branch);
  if (!reward) return null;
  if (branch === 'free') save.live.pass.claimedFree.push(level);
  else save.live.pass.claimedPaid.push(level);
  grantLiveReward(save, reward);
  return reward;
}

export function claimAllPass(save: SaveV1, branch: PassBranch, date = new Date()): number {
  let count = 0;
  for (let level = 1; level <= passLevel(save, date); level += 1) {
    if (claimPass(save, level, branch, date)) count += 1;
  }
  return count;
}
