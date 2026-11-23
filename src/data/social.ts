/**
 * Социальный слой: лиги и сезоны Арены, гильдия-lite, друзья и наёмники.
 * Источник чисел — 03_CORE_LOOP_MODES.md (3.4) и 07_META_BASE_LIVEOPS.md.
 * Все имена — данные, не строки UI: RU/EN берётся по locale.
 */

export interface ArenaLeagueDef {
  id: string;
  nameRu: string;
  nameEn: string;
  minRating: number;
  crystals: number;
  tokens: number;
}

/** 10 лиг Арены. Порог растёт, награда за сезон — по последней лиге. */
export const ARENA_LEAGUES: readonly ArenaLeagueDef[] = [
  { id: 'bronze', nameRu: 'Бронза', nameEn: 'Bronze', minRating: 0, crystals: 40, tokens: 30 },
  { id: 'silver', nameRu: 'Серебро', nameEn: 'Silver', minRating: 1_100, crystals: 60, tokens: 45 },
  { id: 'gold', nameRu: 'Золото', nameEn: 'Gold', minRating: 1_300, crystals: 90, tokens: 60 },
  { id: 'platinum', nameRu: 'Платина', nameEn: 'Platinum', minRating: 1_500, crystals: 120, tokens: 80 },
  { id: 'emerald', nameRu: 'Изумруд', nameEn: 'Emerald', minRating: 1_700, crystals: 160, tokens: 100 },
  { id: 'sapphire', nameRu: 'Сапфир', nameEn: 'Sapphire', minRating: 1_900, crystals: 200, tokens: 125 },
  { id: 'amethyst', nameRu: 'Аметист', nameEn: 'Amethyst', minRating: 2_100, crystals: 250, tokens: 150 },
  { id: 'ruby', nameRu: 'Рубин', nameEn: 'Ruby', minRating: 2_300, crystals: 310, tokens: 180 },
  { id: 'diamond', nameRu: 'Алмаз', nameEn: 'Diamond', minRating: 2_500, crystals: 380, tokens: 220 },
  { id: 'echo', nameRu: 'Эхо', nameEn: 'Echo', minRating: 2_700, crystals: 460, tokens: 270 },
];

export const ARENA_START_RATING = 1_000;
export const ARENA_ATTACKS_PER_DAY = 5;
export const ARENA_WIN_RATING = 25;
export const ARENA_LOSS_RATING = 15;
export const ARENA_LEADERBOARD_SIZE = 20;
export const ARENA_HISTORY_LIMIT = 30;
export const ARENA_GHOST_LIMIT = 20;
export const ARENA_SOFT_RESET = 0.5;
export const ARENA_SEASON_DAYS = 7;

/** Имена локальных призраков/ботов: не контентные ID, только отображаемые имена. */
export const ARENA_BOT_NAMES: readonly string[] = [
  'Ashborn',
  'Vesper',
  'Kite',
  'Nox',
  'Sable',
  'Morrow',
  'Ivars',
  'Rune',
  'Hollow',
  'Grim',
  'Seraph',
  'Wisp',
  'Vale',
  'Cinder',
  'Moth',
  'Rook',
  'Thorne',
  'Lyra',
  'Onyx',
  'Pyre',
];

/** Недельный босс гильдии использует существующего босса — ID контента не меняется. */
export const GUILD_BOSS_ID = 'oblivion-tree';
export const GUILD_BOSS_ATTEMPTS_PER_DAY = 3;
export const GUILD_MEMBER_COUNT = 10;
export const GUILD_BOSS_FLOOR_MIN = 20;

export interface GuildMilestoneDef {
  id: string;
  damage: number;
  crystals: number;
  tokens: number;
  essence: number;
}

/** Награды за общий вклад гильдии в недельного босса. */
export const GUILD_MILESTONES: readonly GuildMilestoneDef[] = [
  { id: 'guild-1', damage: 80_000, crystals: 60, tokens: 40, essence: 120 },
  { id: 'guild-2', damage: 220_000, crystals: 120, tokens: 80, essence: 260 },
  { id: 'guild-3', damage: 420_000, crystals: 220, tokens: 140, essence: 480 },
  { id: 'guild-4', damage: 700_000, crystals: 360, tokens: 220, essence: 800 },
];

export interface GuildCandidateDef {
  id: string;
  nameRu: string;
  nameEn: string;
  mottoRu: string;
  mottoEn: string;
  /** Базовый уровень силы участников — определяет вклад в босса. */
  powerBase: number;
}

export const GUILD_CANDIDATES: readonly GuildCandidateDef[] = [
  {
    id: 'guild-glass',
    nameRu: 'Стеклянный Круг',
    nameEn: 'Glass Circle',
    mottoRu: 'Мы слышим эхо раньше, чем оно звучит.',
    mottoEn: 'We hear the echo before it sounds.',
    powerBase: 42_000,
  },
  {
    id: 'guild-ash',
    nameRu: 'Пепельный Клинок',
    nameEn: 'Ash Blade',
    mottoRu: 'Каждый удар оставляет след в истории.',
    mottoEn: 'Every strike leaves a mark in history.',
    powerBase: 55_000,
  },
  {
    id: 'guild-quiet',
    nameRu: 'Тихий Хор',
    nameEn: 'Silent Choir',
    mottoRu: 'Тишина тоже умеет отвечать.',
    mottoEn: 'Silence can answer too.',
    powerBase: 68_000,
  },
];

export const GUILD_MEMBER_NAMES: readonly string[] = [
  'Aster',
  'Bram',
  'Cira',
  'Dorian',
  'Elne',
  'Faye',
  'Galen',
  'Iris',
  'Jorun',
  'Kael',
  'Lumen',
  'Mira',
  'Neris',
  'Orin',
  'Pell',
  'Quill',
  'Rhea',
  'Soren',
  'Tess',
  'Ulric',
];

export const FRIEND_NAMES: readonly string[] = ['Liora', 'Fenrir', 'Ysolde', 'Bran'];

/** Множители силы героев друзей относительно среднего уровня игрока. */
export const FRIEND_POWER_FACTORS: readonly number[] = [0.85, 1, 1.12, 1.45];

/** Наёмник не может быть сильнее этого множителя от средней силы отряда. */
export const MERCENARY_POWER_FACTOR = 1.2;
export const MERCENARY_MAX_COUNT = 1;
