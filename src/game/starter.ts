import { now } from '../core/time';
import {
  STARTER_DAY_COUNT,
  STARTER_DAY_MS,
  STARTER_MISSIONS,
  type StarterMissionDef,
  type StarterReward,
} from '../data/starter';
import type { SaveV1 } from './save';

/** Календарный день стартовой программы: 1..7, защита от перевода часов назад. */
export function starterDay(save: SaveV1, at = now()): number {
  const created = save.createdAt > 0 ? save.createdAt : at;
  const elapsed = Math.max(0, at - created);
  return Math.min(STARTER_DAY_COUNT, Math.floor(elapsed / STARTER_DAY_MS) + 1);
}

export function starterProgress(save: SaveV1, mission: StarterMissionDef): number {
  switch (mission.metric) {
    case 'maxFloor':
      return save.tower.maxFloor;
    case 'clears':
      return Object.keys(save.tower.clears).length;
    case 'summons':
      return save.gacha.totalPulls;
    case 'heroes':
      return Object.keys(save.heroes).length;
    case 'upgrades':
      return save.quests.lifetime.upgrades ?? 0;
    case 'wins':
      return save.quests.lifetime.wins ?? 0;
    case 'masterHand':
      return save.quests.lifetime.masterHand ?? 0;
    default:
      return 0;
  }
}

export function starterMissionUnlocked(save: SaveV1, mission: StarterMissionDef, at = now()): boolean {
  return mission.day <= starterDay(save, at);
}

export function isStarterClaimed(save: SaveV1, mission: StarterMissionDef): boolean {
  return save.starter.claimedDays.includes(mission.day);
}

export function canClaimStarter(save: SaveV1, mission: StarterMissionDef, at = now()): boolean {
  return (
    starterMissionUnlocked(save, mission, at) &&
    !isStarterClaimed(save, mission) &&
    starterProgress(save, mission) >= mission.target
  );
}

function grantStarterReward(save: SaveV1, reward: StarterReward): void {
  save.currencies.gold += reward.gold ?? 0;
  save.currencies.crystals += reward.crystals ?? 0;
  save.currencies.seals += reward.seals ?? 0;
  save.currencies.essence += reward.essence ?? 0;
  save.currencies.dust += reward.dust ?? 0;
}

/** Мутирует сейв. Повторный вызов для того же дня вернёт null. */
export function claimStarter(save: SaveV1, mission: StarterMissionDef, at = now()): StarterReward | null {
  if (!canClaimStarter(save, mission, at)) return null;
  save.starter.claimedDays.push(mission.day);
  save.starter.claimedDays.sort((a, b) => a - b);
  grantStarterReward(save, mission.reward);
  return mission.reward;
}

export function starterClaimableCount(save: SaveV1, at = now()): number {
  return STARTER_MISSIONS.filter((mission) => canClaimStarter(save, mission, at)).length;
}

export function starterClaimedCount(save: SaveV1): number {
  return save.starter.claimedDays.length;
}
