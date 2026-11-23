import {
  BASE_TRIAL_ATTEMPTS,
  BUILDING_BY_ID,
  BUILDING_MAX_LEVEL,
  EXCHANGE_BY_ID,
  MASTER_LEVEL_MAX,
  MAX_SUMMON_DISCOUNT,
  masterReward,
  masterXpToNext,
  type BuildingCost,
  type BuildingId,
  type ExchangeOfferDef,
  type MasterReward,
} from '../data/base';
import type { SaveV1 } from './save';

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function ensureBase(save: SaveV1): void {
  if (!save.base) {
    save.base = {
      buildings: Object.fromEntries(Object.keys(BUILDING_BY_ID).map((id) => [id, 1])),
      masterXp: 0,
      claimedMasterLevels: [],
      exchangeDay: '',
      exchangeUsed: {},
    };
  }
  if (!save.base.buildings) save.base.buildings = {};
  for (const id of Object.keys(BUILDING_BY_ID)) {
    if (!Number.isFinite(save.base.buildings[id])) save.base.buildings[id] = 1;
  }
  if (!Array.isArray(save.base.claimedMasterLevels)) save.base.claimedMasterLevels = [];
  if (!save.base.exchangeUsed) save.base.exchangeUsed = {};
  if (save.player.masterLevel < 1) save.player.masterLevel = 1;
  if (save.player.masterLevel > MASTER_LEVEL_MAX) save.player.masterLevel = MASTER_LEVEL_MAX;
}

export function buildingLevel(save: SaveV1, id: BuildingId): number {
  const level = save.base?.buildings?.[id];
  if (!Number.isFinite(level)) return 1;
  return Math.min(BUILDING_MAX_LEVEL, Math.max(1, Math.floor(level)));
}

/** Базовый прирост эффекта: на 1-м уровне постройка ещё ничего не даёт. */
export function buildingEffect(save: SaveV1, id: BuildingId): number {
  const def = BUILDING_BY_ID[id];
  if (!def) return 0;
  return def.perLevel * (buildingLevel(save, id) - 1);
}

export function summonDiscount(save: SaveV1): number {
  return Math.min(MAX_SUMMON_DISCOUNT, buildingEffect(save, 'altar'));
}

export function xpMultiplier(save: SaveV1): number {
  return 1 + buildingEffect(save, 'barracks');
}

export function diningEffectMultiplier(save: SaveV1): number {
  return 1 + buildingEffect(save, 'dining');
}

export function trialAttempts(save: SaveV1): number {
  return BASE_TRIAL_ATTEMPTS + Math.round(buildingEffect(save, 'training'));
}

export function crystalFloorMultiplier(save: SaveV1): number {
  return 1 + buildingEffect(save, 'archive');
}

export function nextBuildingCost(save: SaveV1, id: BuildingId): BuildingCost | null {
  const def = BUILDING_BY_ID[id];
  if (!def) return null;
  const level = buildingLevel(save, id);
  if (level >= BUILDING_MAX_LEVEL) return null;
  return def.costs[level - 1] ?? null;
}

function canAfford(save: SaveV1, cost: BuildingCost): boolean {
  return (
    (cost.gold ?? 0) <= save.currencies.gold &&
    (cost.crystals ?? 0) <= save.currencies.crystals &&
    (cost.essence ?? 0) <= save.currencies.essence &&
    (cost.dust ?? 0) <= save.currencies.dust
  );
}

function spend(save: SaveV1, cost: BuildingCost): void {
  save.currencies.gold -= cost.gold ?? 0;
  save.currencies.crystals -= cost.crystals ?? 0;
  save.currencies.essence -= cost.essence ?? 0;
  save.currencies.dust -= cost.dust ?? 0;
}

export function canUpgradeBuilding(save: SaveV1, id: BuildingId): boolean {
  const cost = nextBuildingCost(save, id);
  return Boolean(cost) && canAfford(save, cost as BuildingCost);
}

export interface BuildingUpgradeResult {
  id: BuildingId;
  level: number;
  cost: BuildingCost;
}

/** Улучшает постройку до 5-го уровня, строго проверяя валюты. */
export function upgradeBuilding(save: SaveV1, id: BuildingId): BuildingUpgradeResult | null {
  ensureBase(save);
  const cost = nextBuildingCost(save, id);
  if (!cost || !canAfford(save, cost)) return null;

  spend(save, cost);
  const level = buildingLevel(save, id) + 1;
  save.base.buildings[id] = level;
  addMasterXp(save, 20);
  return { id, level, cost };
}

export function ensureExchangeDay(save: SaveV1, date = new Date()): void {
  ensureBase(save);
  const day = dayKey(date);
  if (save.base.exchangeDay === day) return;
  save.base.exchangeDay = day;
  save.base.exchangeUsed = {};
}

export function exchangeUsed(save: SaveV1, offerId: string): number {
  return save.base?.exchangeUsed?.[offerId] ?? 0;
}

export function exchangeLeft(save: SaveV1, offerId: string): number {
  const offer = EXCHANGE_BY_ID[offerId];
  if (!offer) return 0;
  return Math.max(0, offer.dailyLimit - exchangeUsed(save, offerId));
}

function currencyBalance(save: SaveV1, currency: ExchangeOfferDef['cost']['currency']): number {
  return save.currencies[currency];
}

function addCurrency(save: SaveV1, currency: ExchangeOfferDef['give']['currency'], amount: number): void {
  save.currencies[currency] += amount;
}

export function canExchange(save: SaveV1, offerId: string): boolean {
  const offer = EXCHANGE_BY_ID[offerId];
  if (!offer) return false;
  if (exchangeLeft(save, offerId) <= 0) return false;
  return currencyBalance(save, offer.cost.currency) >= offer.cost.amount;
}

export interface ExchangeResult {
  id: string;
  spent: number;
  gained: number;
}

/** Обмен ресурсов с дневным лимитом; валюты не уходят в минус. */
export function exchangeResource(save: SaveV1, offerId: string, date = new Date()): ExchangeResult | null {
  ensureExchangeDay(save, date);
  if (!canExchange(save, offerId)) return null;
  const offer = EXCHANGE_BY_ID[offerId];
  if (!offer) return null;

  save.currencies[offer.cost.currency] -= offer.cost.amount;
  addCurrency(save, offer.give.currency, offer.give.amount);
  save.base.exchangeUsed[offerId] = (save.base.exchangeUsed[offerId] ?? 0) + 1;
  addMasterXp(save, 1);
  return { id: offer.id, spent: offer.cost.amount, gained: offer.give.amount };
}

export function masterLevel(save: SaveV1): number {
  return Math.min(MASTER_LEVEL_MAX, Math.max(1, Math.floor(save.player.masterLevel || 1)));
}

export function masterXp(save: SaveV1): number {
  return Math.max(0, Math.floor(save.base?.masterXp ?? 0));
}

/** Начисляет опыт Мастера и возвращает число полученных уровней. */
export function addMasterXp(save: SaveV1, amount: number): number {
  ensureBase(save);
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  save.base.masterXp += Math.floor(amount);
  let gained = 0;
  while (save.player.masterLevel < MASTER_LEVEL_MAX) {
    const need = masterXpToNext(save.player.masterLevel);
    if (save.base.masterXp < need) break;
    save.base.masterXp -= need;
    save.player.masterLevel += 1;
    gained += 1;
  }
  if (save.player.masterLevel >= MASTER_LEVEL_MAX) save.base.masterXp = 0;
  return gained;
}

export function masterRewardOf(level: number): MasterReward {
  return masterReward(level);
}

export function masterXpNeeded(save: SaveV1): number {
  return masterXpToNext(masterLevel(save));
}

export function claimableMasterLevels(save: SaveV1): number[] {
  const claimed = new Set(save.base?.claimedMasterLevels ?? []);
  const levels: number[] = [];
  for (let level = 2; level <= masterLevel(save); level += 1) {
    if (!claimed.has(level)) levels.push(level);
  }
  return levels;
}

export function canClaimMasterReward(save: SaveV1, level: number): boolean {
  if (!Number.isInteger(level) || level < 2 || level > masterLevel(save)) return false;
  return !(save.base?.claimedMasterLevels ?? []).includes(level);
}

/** Награда за уровень Мастера выдаётся один раз. */
export function claimMasterReward(save: SaveV1, level: number): MasterReward | null {
  ensureBase(save);
  if (!canClaimMasterReward(save, level)) return null;
  const reward = masterReward(level);
  save.base.claimedMasterLevels.push(level);
  save.base.claimedMasterLevels.sort((a, b) => a - b);
  save.currencies.gold += reward.gold;
  save.currencies.crystals += reward.crystals;
  save.currencies.essence += reward.essence;
  save.currencies.seals += reward.seals;
  return reward;
}
