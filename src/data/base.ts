/**
 * База Мастера: постройки, крафт гравировок, обмен ресурсов и мастер-уровень.
 * Источник: 05_PROGRESSION_ECONOMY.md и 07_META_BASE_LIVEOPS.md (1–2).
 * Все числа — здесь, UI только читает и вызывает команды.
 */

export type BuildingId = 'altar' | 'barracks' | 'dining' | 'training' | 'archive';

export interface ResourceCost {
  gold?: number;
  crystals?: number;
  essence?: number;
  dust?: number;
}

export interface BuildingCost extends ResourceCost {}

export type BuildingEffectKind = 'summon' | 'xp' | 'dining' | 'trial' | 'crystals';

export interface BuildingDef {
  id: BuildingId;
  nameKey: string;
  descKey: string;
  effect: BuildingEffectKind;
  /** Прирост эффекта за каждый уровень выше первого. */
  perLevel: number;
  /** Стоимость уровней 2..5. */
  costs: readonly BuildingCost[];
}

export const BUILDING_MAX_LEVEL = 5;

export const BUILDINGS: readonly BuildingDef[] = [
  {
    id: 'altar',
    nameKey: 'buildings.altar',
    descKey: 'buildings.altar.desc',
    effect: 'summon',
    perLevel: 0.02,
    costs: [
      { gold: 40_000, crystals: 30 },
      { gold: 90_000, crystals: 60 },
      { gold: 180_000, crystals: 120 },
      { gold: 320_000, crystals: 240 },
    ],
  },
  {
    id: 'barracks',
    nameKey: 'buildings.barracks',
    descKey: 'buildings.barracks.desc',
    effect: 'xp',
    perLevel: 0.05,
    costs: [
      { gold: 45_000 },
      { gold: 100_000 },
      { gold: 210_000 },
      { gold: 420_000 },
    ],
  },
  {
    id: 'dining',
    nameKey: 'buildings.dining',
    descKey: 'buildings.dining.desc',
    effect: 'dining',
    perLevel: 0.05,
    costs: [
      { gold: 35_000 },
      { gold: 80_000 },
      { gold: 170_000 },
      { gold: 340_000 },
    ],
  },
  {
    id: 'training',
    nameKey: 'buildings.training',
    descKey: 'buildings.training.desc',
    effect: 'trial',
    perLevel: 1,
    costs: [
      { gold: 55_000 },
      { gold: 120_000 },
      { gold: 250_000 },
      { gold: 500_000 },
    ],
  },
  {
    id: 'archive',
    nameKey: 'buildings.archive',
    descKey: 'buildings.archive.desc',
    effect: 'crystals',
    perLevel: 0.02,
    costs: [
      { gold: 60_000 },
      { gold: 130_000 },
      { gold: 270_000 },
      { gold: 540_000 },
    ],
  },
];

export const BUILDING_BY_ID: Record<string, BuildingDef> = Object.fromEntries(
  BUILDINGS.map((building) => [building.id, building]),
);

export const BASE_TRIAL_ATTEMPTS = 3;
export const MAX_SUMMON_DISCOUNT = 0.5;

export type ExchangeCurrency = 'gold' | 'crystals' | 'essence' | 'dust';

export interface ExchangeOfferDef {
  id: string;
  cost: { currency: ExchangeCurrency; amount: number };
  give: { currency: ExchangeCurrency; amount: number };
  dailyLimit: number;
}

/** Курсы намеренно невыгодные: обмен — это предохранитель, а не основной доход. */
export const EXCHANGE_OFFERS: readonly ExchangeOfferDef[] = [
  {
    id: 'gold-crystals',
    cost: { currency: 'gold', amount: 1_000 },
    give: { currency: 'crystals', amount: 10 },
    dailyLimit: 3,
  },
  {
    id: 'crystals-gold',
    cost: { currency: 'crystals', amount: 10 },
    give: { currency: 'gold', amount: 1_200 },
    dailyLimit: 3,
  },
  {
    id: 'essence-dust',
    cost: { currency: 'essence', amount: 200 },
    give: { currency: 'dust', amount: 100 },
    dailyLimit: 2,
  },
  {
    id: 'dust-essence',
    cost: { currency: 'dust', amount: 100 },
    give: { currency: 'essence', amount: 150 },
    dailyLimit: 2,
  },
];

export const EXCHANGE_BY_ID: Record<string, ExchangeOfferDef> = Object.fromEntries(
  EXCHANGE_OFFERS.map((offer) => [offer.id, offer]),
);

export const MASTER_LEVEL_MAX = 30;

/** Опыт до следующего уровня Мастера. */
export function masterXpToNext(level: number): number {
  return Math.floor(100 * Math.pow(Math.max(1, level), 1.25));
}

export interface MasterReward {
  gold: number;
  crystals: number;
  essence: number;
  seals: number;
}

/** Награда за достигнутый уровень; уровень 1 — старт без награды. */
export function masterReward(level: number): MasterReward {
  const safe = Math.max(2, Math.min(MASTER_LEVEL_MAX, Math.floor(level)));
  return {
    gold: 1_000 + safe * 500,
    crystals: 20 + safe * 5,
    essence: 20 + safe * 3,
    seals: safe % 5 === 0 ? 1 : 0,
  };
}
