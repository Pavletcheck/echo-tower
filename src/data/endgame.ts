import type { Element } from './types';

export const WORLD_BOSS_ID = 'oblivion-tree';
export const WORLD_ATTEMPTS_PER_DAY = 3;
export const WORLD_TIERS: ReadonlyArray<{
  id: string;
  threshold: number;
  marks: number;
  crystals: number;
}> = [
  { id: 'tier1', threshold: 50_000, marks: 5, crystals: 50 },
  { id: 'tier2', threshold: 150_000, marks: 10, crystals: 100 },
  { id: 'tier3', threshold: 300_000, marks: 20, crystals: 200 },
  { id: 'tier4', threshold: 500_000, marks: 40, crystals: 400 },
];

export const TOWER_FLOORS = 30;
export const TOWER_MIN_MATCH = 3;
export const TOWER_ELEMENTS: readonly Element[] = ['echo', 'ash', 'frost', 'rot', 'light'];

export const ENDLESS_RUNS_PER_DAY = 3;
export const ENDLESS_START_FLOOR = 100;

export interface HardChapterDef {
  chapter: number;
  floor: number;
  nameRu: string;
  nameEn: string;
  hp: number;
  atk: number;
  marks: number;
  crystals: number;
  shards: number;
}

/** Hard mode глав: те же боссы, но с модификаторами и отдельной наградой. */
export const HARD_CHAPTERS: readonly HardChapterDef[] = Array.from({ length: 10 }, (_, index) => {
  const chapter = index + 1;
  return {
    chapter,
    floor: chapter * 10,
    nameRu: `Глава ${chapter}: усиление`,
    nameEn: `Chapter ${chapter}: empowered`,
    hp: 0.15 + index * 0.03,
    atk: 0.12 + index * 0.025,
    marks: 6 + index * 2,
    crystals: 80 + index * 20,
    shards: 10 + index * 5,
  };
});

export type ChallengeType = 'no-vanguard' | 'four-star' | 'time-limit';

export interface ChallengeDef {
  type: ChallengeType;
  nameRu: string;
  nameEn: string;
  descRu: string;
  descEn: string;
}

export const CHALLENGE_DEFS: ReadonlyArray<ChallengeDef> = [
  {
    type: 'no-vanguard',
    nameRu: 'Без стража',
    nameEn: 'No vanguard',
    descRu: 'Пройдите этаж главы без героя-стража в отряде.',
    descEn: 'Clear the chapter floor without a vanguard in the squad.',
  },
  {
    type: 'four-star',
    nameRu: 'Только 4★',
    nameEn: '4★ only',
    descRu: 'Пройдите этаж отрядом только из 4★ героев.',
    descEn: 'Clear the floor with a squad of 4★ heroes only.',
  },
  {
    type: 'time-limit',
    nameRu: '20 секунд',
    nameEn: '20 seconds',
    descRu: 'Пройдите этаж за 20 секунд боя.',
    descEn: 'Clear the floor within 20 seconds of combat.',
  },
];

export type EndgameShopGrant = 'shards' | 'essence' | 'dust' | 'gear';

export interface EndgameShopItemDef {
  id: string;
  nameRu: string;
  nameEn: string;
  price: number;
  amount: number;
  grant: EndgameShopGrant;
  limit: 'daily' | 'weekly';
}

export const ENDGAME_SHOP_ITEMS: readonly EndgameShopItemDef[] = [
  {
    id: 'endgame_shards',
    nameRu: 'Осколки героя ×25',
    nameEn: 'Hero shards ×25',
    price: 15,
    amount: 25,
    grant: 'shards',
    limit: 'daily',
  },
  {
    id: 'endgame_essence',
    nameRu: 'Эссенция Эха ×500',
    nameEn: 'Echo essence ×500',
    price: 12,
    amount: 500,
    grant: 'essence',
    limit: 'daily',
  },
  {
    id: 'endgame_dust',
    nameRu: 'Пыль Граней ×300',
    nameEn: 'Facet dust ×300',
    price: 10,
    amount: 300,
    grant: 'dust',
    limit: 'daily',
  },
  {
    id: 'endgame_gear',
    nameRu: 'Снаряжение Эха',
    nameEn: 'Echo gear',
    price: 25,
    amount: 1,
    grant: 'gear',
    limit: 'daily',
  },
];
