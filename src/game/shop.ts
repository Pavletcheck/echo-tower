import { hashString } from '../core/rng';
import type { GearDef, IapItemDef, ShopItemDef } from '../data/types';
import { SHOP_ITEMS } from '../data/shop';
import { rollGearDrop } from './equipment';
import { firstSquadHero } from './rewards';
import type { SaveV1 } from './save';

const ENGRAVING_GRANTS: Record<string, string> = {
  arena_engraving: 'whisper_crit_a',
  crystal_engraving_c: 'guard_hp_c',
  crystal_engraving_b: 'blade_atk_b',
};

function shopDay(date = new Date()): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** ISO-неделя: товары с лимитом «weekly» не должны сбрасываться каждый день. */
export function shopWeek(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

export function ensureShopWeek(save: SaveV1, date = new Date()): void {
  const week = shopWeek(date);
  if (save.shop.week !== week) {
    save.shop.week = week;
    save.shop.weeklyBought = {};
  }
}

export function ensureShopDay(save: SaveV1, date = new Date()): void {
  ensureShopWeek(save, date);
  const day = shopDay(date);
  if (save.shop.date !== day) {
    save.shop.date = day;
    save.shop.bought = {};
    save.shop.adsToday = 0;
  }
}

export function boughtToday(save: SaveV1, itemId: string): number {
  return save.shop.bought[itemId] ?? 0;
}

export function boughtThisWeek(save: SaveV1, itemId: string): number {
  return save.shop.weeklyBought?.[itemId] ?? 0;
}

/** Сколько раз товар куплен в рамках своего лимита (день или неделя). */
export function boughtFor(save: SaveV1, item: ShopItemDef): number {
  return item.limit === 'weekly' ? boughtThisWeek(save, item.id) : boughtToday(save, item.id);
}

export function canBuy(save: SaveV1, item: ShopItemDef, date = new Date()): boolean {
  ensureShopDay(save, date);
  if (item.limit !== 'none' && boughtFor(save, item) >= 1) return false;
  const balance =
    item.currency === 'gold'
      ? save.currencies.gold
      : item.currency === 'crystals'
        ? save.currencies.crystals
        : save.currencies.arenaTokens;
  return balance >= item.price;
}

function grant(save: SaveV1, item: ShopItemDef): void {
  const engraving = ENGRAVING_GRANTS[item.id];
  if (engraving) {
    save.inventory.engravings.push(engraving);
    return;
  }

  if (item.id === 'shop_gear' || item.id === 'arena_gear') {
    const seed = hashString(`${item.id}|${save.shop.date}|${boughtFor(save, item)}`);
    const gear = rollGearDrop(seed, 1);
    if (gear) save.inventory.gear.push(gear.id);
    return;
  }

  switch (item.id) {
    case 'shop_seal':
      save.currencies.seals += item.amount;
      return;
    case 'shop_shards':
    case 'arena_shards': {
      const heroId = firstSquadHero(save);
      if (heroId) save.currencies.starShards[heroId] = (save.currencies.starShards[heroId] ?? 0) + item.amount;
      return;
    }
    case 'shop_essence':
      save.currencies.essence += item.amount;
      return;
    case 'shop_dust':
      save.currencies.dust += item.amount;
      return;
    case 'shop_crystals':
      save.currencies.crystals += item.amount;
      return;
    case 'arena_frame':
      save.flags.frame_gold = true;
      return;
    default:
      return;
  }
}

export function buyItem(save: SaveV1, itemId: string, date = new Date()): boolean {
  const item = SHOP_ITEMS.find((entry) => entry.id === itemId);
  if (!item) return false;
  ensureShopDay(save, date);
  if (!canBuy(save, item, date)) return false;

  if (item.currency === 'gold') save.currencies.gold -= item.price;
  else if (item.currency === 'crystals') save.currencies.crystals -= item.price;
  else save.currencies.arenaTokens -= item.price;

  grant(save, item);
  if (item.limit === 'weekly') {
    save.shop.weeklyBought[item.id] = (save.shop.weeklyBought[item.id] ?? 0) + 1;
  } else {
    save.shop.bought[item.id] = (save.shop.bought[item.id] ?? 0) + 1;
  }
  return true;
}

/** Какой предмет даст товар со снаряжением — для превью в магазине. */
export function shopGearPreview(save: SaveV1, itemId: string): GearDef | null {
  const item = SHOP_ITEMS.find((entry) => entry.id === itemId);
  if (!item || (itemId !== 'shop_gear' && itemId !== 'arena_gear')) return null;
  const seed = hashString(`${itemId}|${save.shop.date || shopDay()}|${boughtFor(save, item)}`);
  return rollGearDrop(seed, 1);
}

const ONE_TIME_SKUS = new Set(['pass_echo', 'starter_pack', 'remove_ads', 'skin_nira_glass']);

/** Выдаёт содержимое покупки. Возвращает false, если покупка уже была применена. */
export function grantIap(save: SaveV1, item: IapItemDef): boolean {
  const ownedKey = `iap_${item.sku}`;
  if (ONE_TIME_SKUS.has(item.sku)) {
    if (save.flags[ownedKey]) return false;
    save.flags[ownedKey] = true;
  }

  switch (item.sku) {
    case 'pass_echo':
      save.flags.pass = true;
      save.currencies.crystals += 1_200;
      save.inventory.engravings.push('blade_atk_a', 'guard_hp_a', 'whisper_crit_a');
      return true;
    case 'starter_pack':
      save.currencies.crystals += 500;
      save.currencies.seals += 10;
      save.inventory.engravings.push('blade_atk_a');
      return true;
    case 'remove_ads':
      save.flags.noAds = true;
      return true;
    case 'skin_nira_glass':
      save.flags.skin_nira = true;
      save.currencies.crystals += 300;
      return true;
    case 'crystals_600':
      // SKU остаётся прежним, чтобы не ломать консоль площадки; ценность поднята до 1 200.
      save.currencies.crystals += 1_200;
      return true;
    default:
      return false;
  }
}

export function canWatchAd(save: SaveV1): boolean {
  ensureShopDay(save);
  return save.shop.adsToday < 5;
}

export function grantAdCrystals(save: SaveV1): boolean {
  ensureShopDay(save);
  if (save.shop.adsToday >= 5) return false;
  save.shop.adsToday += 1;
  save.currencies.crystals += 50;
  return true;
}
