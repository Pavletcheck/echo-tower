import { ENGRAVINGS_BY_ID } from '../data/engravings';
import { QUESTS } from '../data/quests';
import type { QuestDef, QuestReward, QuestType } from '../data/types';
import { addPassXp } from './pass';
import { firstSquadHero } from './rewards';
import type { SaveV1 } from './save';

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

export function ensureQuestCycles(save: SaveV1, date = new Date()): void {
  const day = dayKey(date);
  const week = weekKey(date);

  if (save.quests.day !== day) {
    save.quests.day = day;
    save.quests.daily = {};
    save.quests.claimedDaily = [];
  }

  if (save.quests.week !== week) {
    save.quests.week = week;
    save.quests.weekly = {};
    save.quests.claimedWeekly = [];
  }
}

export function trackQuest(save: SaveV1, metric: string, amount = 1): void {
  if (amount <= 0) return;
  ensureQuestCycles(save);
  save.quests.daily[metric] = (save.quests.daily[metric] ?? 0) + amount;
  save.quests.weekly[metric] = (save.quests.weekly[metric] ?? 0) + amount;
  save.quests.lifetime[metric] = (save.quests.lifetime[metric] ?? 0) + amount;
}

export function questProgress(save: SaveV1, quest: QuestDef): number {
  if (quest.type === 'daily') return save.quests.daily[quest.metric] ?? 0;
  if (quest.type === 'weekly') return save.quests.weekly[quest.metric] ?? 0;
  return save.quests.lifetime[quest.metric] ?? 0;
}

export function isQuestComplete(save: SaveV1, quest: QuestDef): boolean {
  return questProgress(save, quest) >= quest.target;
}

export function isQuestClaimed(save: SaveV1, quest: QuestDef): boolean {
  if (quest.type === 'daily') return save.quests.claimedDaily.includes(quest.id);
  if (quest.type === 'weekly') return save.quests.claimedWeekly.includes(quest.id);
  return save.quests.claimedLifetime.includes(quest.id);
}

export function canClaim(save: SaveV1, quest: QuestDef): boolean {
  return isQuestComplete(save, quest) && !isQuestClaimed(save, quest);
}

function grantReward(save: SaveV1, reward: QuestReward): void {
  save.currencies.gold += reward.gold ?? 0;
  save.currencies.crystals += reward.crystals ?? 0;
  save.currencies.seals += reward.seals ?? 0;
  save.currencies.essence += reward.essence ?? 0;
  save.currencies.dust += reward.dust ?? 0;
  save.currencies.arenaTokens += reward.arenaTokens ?? 0;

  if (reward.shards) {
    const heroId = firstSquadHero(save);
    if (heroId) save.currencies.starShards[heroId] = (save.currencies.starShards[heroId] ?? 0) + reward.shards;
  }

  if (reward.item) {
    if (ENGRAVINGS_BY_ID[reward.item]) save.inventory.engravings.push(reward.item);
    else save.flags[reward.item] = true;
  }
}

export function claimQuest(save: SaveV1, quest: QuestDef): QuestReward | null {
  if (!canClaim(save, quest)) return null;

  if (quest.type === 'daily') save.quests.claimedDaily.push(quest.id);
  else if (quest.type === 'weekly') save.quests.claimedWeekly.push(quest.id);
  else save.quests.claimedLifetime.push(quest.id);

  grantReward(save, quest.reward);
  if (quest.type === 'daily') addPassXp(save, 10);
  return quest.reward;
}

export function questsOfType(type: QuestType): readonly QuestDef[] {
  return QUESTS.filter((quest) => quest.type === type);
}

export function claimableCount(save: SaveV1): number {
  return QUESTS.filter((quest) => quest.type !== 'event' && canClaim(save, quest)).length;
}

export const QUEST_TYPES: readonly QuestType[] = ['daily', 'weekly', 'achievement'];
