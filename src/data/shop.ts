import type { IapItemDef, ShopItemDef } from './types';

export const SHOP_ITEMS: readonly ShopItemDef[] = [
  { id: 'shop_seal', slot: 'daily', nameRu: 'Печать Призыва', nameEn: 'Summon Seal', currency: 'gold', price: 8_000, amount: 1, limit: 'daily' },
  { id: 'shop_shards', slot: 'daily', nameRu: 'Осколки героя ×10', nameEn: 'Hero shards ×10', currency: 'gold', price: 12_000, amount: 10, limit: 'daily' },
  { id: 'shop_essence', slot: 'daily', nameRu: 'Эссенция Эха ×200', nameEn: 'Echo Essence ×200', currency: 'gold', price: 6_000, amount: 200, limit: 'daily' },
  { id: 'shop_dust', slot: 'daily', nameRu: 'Пыль Граней ×100', nameEn: 'Facet Dust ×100', currency: 'gold', price: 5_000, amount: 100, limit: 'daily' },
  { id: 'shop_crystals', slot: 'daily', nameRu: 'Кристаллы ×100', nameEn: 'Crystals ×100', currency: 'gold', price: 20_000, amount: 100, limit: 'daily' },
  { id: 'shop_gear', slot: 'daily', nameRu: 'Снаряжение дня', nameEn: 'Gear of the Day', currency: 'gold', price: 7_000, amount: 1, limit: 'daily' },

  { id: 'arena_engraving', slot: 'arena', nameRu: 'Гравировка A', nameEn: 'Engraving A', currency: 'arenaTokens', price: 300, amount: 1, limit: 'weekly' },
  { id: 'arena_shards', slot: 'arena', nameRu: 'Осколки героя ×10', nameEn: 'Hero shards ×10', currency: 'arenaTokens', price: 150, amount: 10, limit: 'daily' },
  { id: 'arena_frame', slot: 'arena', nameRu: 'Рамка «Золото»', nameEn: 'Gold frame', currency: 'arenaTokens', price: 500, amount: 1, limit: 'weekly' },
  { id: 'arena_gear', slot: 'arena', nameRu: 'Снаряжение Арены', nameEn: 'Arena Gear', currency: 'arenaTokens', price: 400, amount: 1, limit: 'weekly' },

  { id: 'crystal_engraving_c', slot: 'crystals', nameRu: 'Гравировка C', nameEn: 'Engraving C', currency: 'crystals', price: 300, amount: 1, limit: 'daily' },
  { id: 'crystal_engraving_b', slot: 'crystals', nameRu: 'Гравировка B', nameEn: 'Engraving B', currency: 'crystals', price: 900, amount: 1, limit: 'daily' },
];

export const SHOP_BY_ID: Record<string, ShopItemDef> = Object.fromEntries(
  SHOP_ITEMS.map((item) => [item.id, item]),
);

/**
 * Только детерминированные товары. Платных лутбоксов нет.
 * На Poki/CrazyGames платежи отключены на уровне платформы.
 */
export const IAP_ITEMS: readonly IapItemDef[] = [
  {
    sku: 'pass_echo',
    nameRu: 'Пропуск Эха',
    nameEn: 'Echo Pass',
    priceRub: 499,
    priceUsd: 4.99,
    priceStars: 250,
    contentsRu: '50 уровней: косметика, 1 200 кристаллов, 3 гравировки A, 5★ на выбор',
    contentsEn: '50 levels: cosmetics, 1,200 crystals, 3 A-engravings, a 5★ of choice',
    platforms: ['yandex', 'telegram'],
  },
  {
    sku: 'starter_pack',
    nameRu: 'Стартовый набор',
    nameEn: 'Starter Pack',
    priceRub: 299,
    priceUsd: 2.99,
    priceStars: 150,
    contentsRu: '10 печатей, 500 кристаллов, гравировка A',
    contentsEn: '10 seals, 500 crystals, one A-engraving',
    platforms: ['yandex', 'telegram'],
  },
  {
    sku: 'remove_ads',
    nameRu: 'Убрать рекламу',
    nameEn: 'Remove Ads',
    priceRub: 399,
    priceUsd: 3.99,
    priceStars: 200,
    contentsRu: 'Убирает межстраничную рекламу; rewarded остаётся по желанию',
    contentsEn: 'Removes interstitials; rewarded ads stay optional',
    platforms: ['yandex', 'telegram'],
  },
  {
    sku: 'skin_nira_glass',
    nameRu: 'Облик Ниры «Стеклянная»',
    nameEn: 'Nira “Glass” Skin',
    priceRub: 349,
    priceUsd: 3.49,
    priceStars: 175,
    contentsRu: 'Облик, аватар и 300 кристаллов',
    contentsEn: 'Skin, avatar and 300 crystals',
    platforms: ['yandex', 'telegram'],
  },
  {
    sku: 'crystals_600',
    nameRu: 'Кристаллы ×1 200',
    nameEn: 'Crystals ×1,200',
    priceRub: 199,
    priceUsd: 1.99,
    priceStars: 100,
    contentsRu: '1 200 эхо-кристаллов',
    contentsEn: '1,200 echo crystals',
    platforms: ['yandex', 'telegram'],
  },
];

export const IAP_BY_SKU: Record<string, IapItemDef> = Object.fromEntries(
  IAP_ITEMS.map((item) => [item.sku, item]),
);
