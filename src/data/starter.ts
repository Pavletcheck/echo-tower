/**
 * 7-дневные стартовые миссии. День открывается по календарю от createdAt сейва.
 * Награды выдаются один раз: прогресс хранится в save.starter.claimedDays.
 */

export type StarterMetric = 'maxFloor' | 'clears' | 'summons' | 'heroes' | 'upgrades' | 'wins' | 'masterHand';

export interface StarterReward {
  gold?: number;
  crystals?: number;
  seals?: number;
  essence?: number;
  dust?: number;
}

export interface StarterMissionDef {
  id: string;
  day: number;
  metric: StarterMetric;
  target: number;
  titleKey: string;
  bodyKey: string;
  reward: StarterReward;
}

export const STARTER_DAY_COUNT = 7;
export const STARTER_DAY_MS = 24 * 60 * 60 * 1000;

export const STARTER_MISSIONS: readonly StarterMissionDef[] = [
  {
    id: 'start-d1',
    day: 1,
    metric: 'clears',
    target: 1,
    titleKey: 'starter.mission.d1.title',
    bodyKey: 'starter.mission.d1.body',
    reward: { gold: 1_500, crystals: 150 },
  },
  {
    id: 'start-d2',
    day: 2,
    metric: 'maxFloor',
    target: 3,
    titleKey: 'starter.mission.d2.title',
    bodyKey: 'starter.mission.d2.body',
    reward: { gold: 2_500, seals: 1 },
  },
  {
    id: 'start-d3',
    day: 3,
    metric: 'summons',
    target: 10,
    titleKey: 'starter.mission.d3.title',
    bodyKey: 'starter.mission.d3.body',
    reward: { crystals: 300 },
  },
  {
    id: 'start-d4',
    day: 4,
    metric: 'heroes',
    target: 6,
    titleKey: 'starter.mission.d4.title',
    bodyKey: 'starter.mission.d4.body',
    reward: { crystals: 200, essence: 100 },
  },
  {
    id: 'start-d5',
    day: 5,
    metric: 'upgrades',
    target: 3,
    titleKey: 'starter.mission.d5.title',
    bodyKey: 'starter.mission.d5.body',
    reward: { gold: 5_000, essence: 150 },
  },
  {
    id: 'start-d6',
    day: 6,
    metric: 'wins',
    target: 30,
    titleKey: 'starter.mission.d6.title',
    bodyKey: 'starter.mission.d6.body',
    reward: { crystals: 250, dust: 150 },
  },
  {
    id: 'start-d7',
    day: 7,
    metric: 'maxFloor',
    target: 10,
    titleKey: 'starter.mission.d7.title',
    bodyKey: 'starter.mission.d7.body',
    reward: { crystals: 500, seals: 1 },
  },
];

export const STARTER_BY_ID: Record<string, StarterMissionDef> = Object.fromEntries(
  STARTER_MISSIONS.map((mission) => [mission.id, mission]),
);
