import { t } from '../core/i18n';
import type { StarterReward } from '../data/starter';
import type { QuestReward } from '../data/types';
import type { LiveReward } from '../game/rewards';

/** Единый текст награды для квестов, стартовых миссий, почты, календаря и пропуска. */
export function rewardLines(reward: QuestReward | StarterReward | LiveReward): string[] {
  const lines: string[] = [];
  if (reward.gold) lines.push(`+${reward.gold} ${t('resource.gold.gen')}`);
  if (reward.crystals) lines.push(`+${reward.crystals} ${t('resource.crystals.gen')}`);
  if (reward.seals) lines.push(`+${reward.seals} ${t('resource.seals.gen')}`);
  if (reward.essence) lines.push(`+${reward.essence} ${t('resource.essence.gen')}`);
  if (reward.dust) lines.push(`+${reward.dust} ${t('resource.dust.gen')}`);

  if ('shards' in reward && reward.shards) lines.push(`+${reward.shards} ${t('battle.shards')}`);
  if ('echoMarks' in reward && reward.echoMarks) {
    lines.push(`+${reward.echoMarks} ${t('endgame.marksShort')}`);
  }
  if ('glass' in reward && reward.glass) lines.push(`+${reward.glass} ${t('event.glass')}`);
  if ('arenaTokens' in reward && reward.arenaTokens) {
    lines.push(`+${reward.arenaTokens} ${t('resource.arena')}`);
  }
  if ('item' in reward && reward.item) lines.push(`+ ${t('common.item')}`);
  return lines;
}
