import { kvGet, kvSet } from '../core/storage';
import { now } from '../core/time';
import { ARTIFACT_MAX_LEVEL } from '../data/artifacts';
import {
  BUILDINGS,
  BUILDING_MAX_LEVEL,
  EXCHANGE_BY_ID,
  MASTER_LEVEL_MAX,
} from '../data/base';
import { FTUE_STEP_COUNT } from '../data/ftue';
import { GLASS_RAIN } from '../data/live';
import { PASS_MAX_LEVEL } from '../data/live';
import { ARENA_ATTACKS_PER_DAY, ARENA_GHOST_LIMIT, ARENA_HISTORY_LIMIT } from '../data/social';
import type { LiveReward } from './rewards';
import { SKILL_MAX_LEVEL } from './config';

/**
 * Текущая версия схемы. Имя типа SaveV1 сохранено ради совместимости импортов;
 * изменения только аддитивные, старые сейвы нормализуются в migrate().
 */
export const SAVE_VERSION = 10 as const;
export const SAVE_KEY = 'save';
export const SAVE_BACKUP_KEY = 'save-backup';
const EXPORT_PREFIX = 'ET1:';

export type Locale = 'ru' | 'en';

export interface HeroSave {
  id: string;
  star: number;
  level: number;
  xp: number;
  engravingSlots: (string | null)[];
  gear: { weapon?: string; armor?: string; relic?: string; boots?: string };
  memorySeen: boolean;
  /** Уровни basic/skill/ultimate/passive: 1..5. */
  skillLevels: number[];
  /** Уровень signature-артефакта: 0 — не пробуждён, 1..5. */
  artifactLevel: number;
  /** Сколько осколков героя потрачено на ascension (для возврата при сбросе). */
  ascensionShardsSpent: number;
  /** Сколько золота потрачено на повышение уровня (для возврата при сбросе). */
  levelGoldSpent: number;
}

export interface Currencies {
  gold: number;
  crystals: number;
  seals: number;
  essence: number;
  dust: number;
  arenaTokens: number;
  /** Валюта эндгейма: Мировое Эхо, башни, бесконечный режим. */
  echoMarks: number;
  starShards: Record<string, number>;
}

/** Прогресс обучения: пять шагов, пропуск и повторный запуск. */
export interface FtueSave {
  /** Индекс текущего шага 0..FTUE_STEP_COUNT. */
  step: number;
  completed: boolean;
  skipped: boolean;
  startedAt: number;
  completedAt: number;
  /** Событие ftue_start отправлено. */
  startTracked: boolean;
  firstWin: boolean;
  firstLoss: boolean;
  winPanelSeen: boolean;
  lossPanelSeen: boolean;
  restarts: number;
}

/** Стартовые 7-дневные миссии. Награды выдаются один раз на день. */
export interface StarterSave {
  claimedDays: number[];
  /** Одноразовые флаги стартовых наград (на будущее). */
  claimed: string[];
}

/** Снимок четырёх слотов снаряжения для пресета. */
export interface GearLoadout {
  weapon?: string;
  armor?: string;
  relic?: string;
  boots?: string;
}

export interface MailSave {
  id: string;
  key: string;
  rewards: LiveReward;
  createdAt: number;
  expiresAt: number;
  claimed: boolean;
  params?: Record<string, string | number>;
}

export interface LiveSave {
  calendar: {
    cycleStart: string;
    lastClaimDay: string;
    claimedDays: number[];
  };
  mail: MailSave[];
  pass: {
    season: string;
    xp: number;
    claimedFree: number[];
    claimedPaid: number[];
  };
  event: {
    id: string;
    cleared: number[];
    currency: number;
    claimed: string[];
  };
}

/** Один бой Арены в истории сезона. */
export interface ArenaHistoryEntrySave {
  id: string;
  season: string;
  at: number;
  opponentId: string;
  opponentName: string;
  ghostId?: string;
  win: boolean;
  ratingBefore: number;
  ratingAfter: number;
  power: number;
  revenge: boolean;
  revenged: boolean;
}

export interface GhostHeroSave {
  heroId: string;
  level: number;
  star: number;
}

/** Снимок отряда-призрака для асинхронного PvP и реванша. */
export interface GhostSquadSave {
  id: string;
  name: string;
  season: string;
  day: string;
  power: number;
  heroes: GhostHeroSave[];
  createdAt: number;
  source: 'bot' | 'self';
}

export interface GuildMemberSave {
  id: string;
  name: string;
  power: number;
  /** Урон по недельному боссу гильдии за текущую неделю. */
  damage: number;
  you: boolean;
}

/** Гильдия-lite: без чата и модерации, только участники и общий босс. */
export interface GuildSave {
  id: string;
  name: string;
  joinedWeek: string;
  week: string;
  members: GuildMemberSave[];
  attemptsDay: string;
  attempts: number;
  claimed: string[];
}

export interface FriendSave {
  id: string;
  name: string;
  heroId: string;
  level: number;
  star: number;
  power: number;
}

/** Один герой друга в отряде; храним снимок, чтобы друг не «пропал» оффлайн. */
export interface MercenarySave {
  friendId: string;
  friendName: string;
  heroId: string;
  level: number;
  star: number;
  power: number;
  hiredAt: number;
  week: string;
}

export interface SocialSave {
  guild: GuildSave | null;
  friends: FriendSave[];
  friendsSeeded: boolean;
  mercenary: MercenarySave | null;
  ghosts: GhostSquadSave[];
}

/** База Мастера: уровни построек, опыт, награды и обмен ресурсов. */
export interface BaseSave {
  buildings: Record<string, number>;
  masterXp: number;
  claimedMasterLevels: number[];
  exchangeDay: string;
  exchangeUsed: Record<string, number>;
}

/** Повторяемый эндгейм после 100-го этажа. */
export interface EndgameSave {
  world: {
    week: string;
    day: string;
    attempts: number;
    total: number;
    best: number;
    claimed: string[];
  };
  /** Максимальный пройденный этаж каждой стихийной башни: 0..30. */
  towers: Record<string, number>;
  endless: { day: string; runs: number; best: number };
  /** Пройденные hard-главы (1..10). */
  hard: { cleared: number[] };
  /** Одноразовые награды испытаний глав. */
  challenges: { claimed: string[] };
  shop: { day: string; bought: Record<string, number> };
}

export interface SaveV1 {
  version: typeof SAVE_VERSION;
  createdAt: number;
  lastSeen: number;
  player: { name: string; masterLevel: number; locale: Locale };
  currencies: Currencies;
  heroes: Record<string, HeroSave>;
  squad: string[];
  /** Пять слотов резонанса: герои подтягиваются к уровню топ-5. */
  resonance: string[];
  /** Три пользовательских пресета отряда (по 5 id, могут быть пустыми). */
  squadPresets: string[][];
  /** До трёх пресетов снаряжения на героя. */
  gearPresets: Record<string, GearLoadout[]>;
  tower: { maxFloor: number; clears: Record<string, { stars: number; first: boolean }> };
  idle: { lastClaim: number; capHours: number };
  gacha: {
    pity5: number;
    featuredGuaranteed: boolean;
    totalPulls: number;
    freeAt: number;
    beginnerUsed: boolean;
  };
  shop: {
    date: string;
    bought: Record<string, number>;
    /** ISO-неделя для товаров с недельным лимитом. */
    week: string;
    weeklyBought: Record<string, number>;
    adsToday: number;
  };
  inventory: {
    engravings: string[];
    gear: string[];
    /** Уровень усиления по id предмета: 0..20. */
    gearLevels: Record<string, number>;
  };
  dining: {
    date: string;
    claimed: boolean;
    buff: string | null;
    battles: number;
    goldUntil: number;
  };
  rift: { runsToday: number; date: string; best: number };
  arena: {
    rating: number;
    league: number;
    attacksToday: number;
    date: string;
    /** ISO-неделя текущего сезона; при смене — мягкий сброс. */
    season: string;
    seasonBest: number;
    wins: number;
    losses: number;
    history: ArenaHistoryEntrySave[];
  };
  expeditions: Array<{ slot: number; heroes: string[]; endsAt: number; type: '2h' | '4h' | '8h' }>;
  trials: { date: string; used: Record<string, number> };
  quests: {
    day: string;
    week: string;
    daily: Record<string, number>;
    weekly: Record<string, number>;
    lifetime: Record<string, number>;
    claimedDaily: string[];
    claimedWeekly: string[];
    claimedLifetime: string[];
  };
  settings: {
    music: number;
    sfx: number;
    musicEnabled: boolean;
    sfxEnabled: boolean;
    haptics: boolean;
    quality: 'auto' | 'low' | 'high';
    /** Скорость проигрывания боя, сохраняется между сессиями. */
    battleSpeed: 1 | 2 | 3 | 4;
  };
  /** Эссенция павших героев: id → количество. Позволяет собрать героя заново. */
  heroEssences: Record<string, number>;
  flags: Record<string, boolean>;
  echoes: Array<{ heroId: string; name: string; floor: number; date: number }>;
  ftue: FtueSave;
  starter: StarterSave;
  endgame: EndgameSave;
  live: LiveSave;
  social: SocialSave;
  base: BaseSave;
}

function defaultEndgame(): EndgameSave {
  return {
    world: { week: '', day: '', attempts: 0, total: 0, best: 0, claimed: [] },
    towers: {},
    endless: { day: '', runs: 0, best: 0 },
    hard: { cleared: [] },
    challenges: { claimed: [] },
    shop: { day: '', bought: {} },
  };
}

function defaultSocial(): SocialSave {
  return {
    guild: null,
    friends: [],
    friendsSeeded: false,
    mercenary: null,
    ghosts: [],
  };
}

function defaultBase(): BaseSave {
  return {
    buildings: Object.fromEntries(BUILDINGS.map((building) => [building.id, 1])),
    masterXp: 0,
    claimedMasterLevels: [],
    exchangeDay: '',
    exchangeUsed: {},
  };
}

function heroSave(id: string, star: number, level = 1): HeroSave {  return {
    id,
    star,
    level,
    xp: 0,
    engravingSlots: [null, null, null, null, null, null],
    gear: {},
    memorySeen: false,
    skillLevels: [1, 1, 1, 1],
    artifactLevel: 0,
    ascensionShardsSpent: 0,
    levelGoldSpent: 0,
  };
}

export function defaultSave(): SaveV1 {
  const timestamp = now();

  return {
    version: SAVE_VERSION,
    createdAt: timestamp,
    lastSeen: timestamp,
    player: { name: 'Мастер', masterLevel: 1, locale: 'ru' },
    currencies: {
      gold: 1_250,
      crystals: 300,
      seals: 1,
      essence: 120,
      dust: 60,
      arenaTokens: 0,
      echoMarks: 0,
      starShards: {},
    },
    heroes: {
      thorn: heroSave('thorn', 3, 8),
      neya: heroSave('neya', 3, 8),
      grom: heroSave('grom', 3, 8),
      lissa: heroSave('lissa', 3, 8),
      zip: heroSave('zip', 3, 8),
    },
    squad: ['thorn', 'neya', 'grom', 'lissa', 'zip'],
    resonance: [],
    squadPresets: [[], [], []],
    tower: { maxFloor: 1, clears: {} },
    idle: { lastClaim: timestamp, capHours: 8 },
    gacha: { pity5: 0, featuredGuaranteed: false, totalPulls: 0, freeAt: 0, beginnerUsed: false },
    shop: { date: '', bought: {}, week: '', weeklyBought: {}, adsToday: 0 },
    inventory: { engravings: [], gear: [], gearLevels: {} },
    dining: { date: '', claimed: false, buff: null, battles: 0, goldUntil: 0 },
    rift: { runsToday: 0, date: '', best: 0 },
    arena: {
      rating: 1_000,
      league: 1,
      attacksToday: 0,
      date: '',
      season: '',
      seasonBest: 1_000,
      wins: 0,
      losses: 0,
      history: [],
    },
    expeditions: [],
    trials: { date: '', used: {} },
    quests: {
      day: '',
      week: '',
      daily: {},
      weekly: {},
      lifetime: {},
      claimedDaily: [],
      claimedWeekly: [],
      claimedLifetime: [],
    },
    settings: {
      music: 0.6,
      sfx: 0.8,
      musicEnabled: true,
      sfxEnabled: true,
      haptics: true,
      quality: 'auto',
      battleSpeed: 1,
    },
    flags: {},
    heroEssences: {},
    echoes: [],
    gearPresets: {},
    ftue: {
      step: 0,
      completed: false,
      skipped: false,
      startedAt: timestamp,
      completedAt: 0,
      startTracked: false,
      firstWin: false,
      firstLoss: false,
      winPanelSeen: false,
      lossPanelSeen: false,
      restarts: 0,
    },
    starter: { claimedDays: [], claimed: [] },
    endgame: defaultEndgame(),
    live: {
      calendar: { cycleStart: '', lastClaimDay: '', claimedDays: [] },
      mail: [],
      pass: { season: '', xp: 0, claimedFree: [], claimedPaid: [] },
      event: { id: GLASS_RAIN.id, cleared: [], currency: 0, claimed: [] },
    },
    social: defaultSocial(),
    base: defaultBase(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Старые сейвы не знали о слотах гравировок и снаряжении — восстанавливаем безопасно. */
function normalizeHeroSave(id: string, raw: unknown): HeroSave {
  const base = heroSave(id, 3);
  if (!isRecord(raw)) return base;

  const star = typeof raw.star === 'number' ? Math.min(6, Math.max(1, Math.round(raw.star))) : base.star;
  const level = typeof raw.level === 'number' ? Math.max(1, Math.floor(raw.level)) : base.level;
  const xp = typeof raw.xp === 'number' && Number.isFinite(raw.xp) ? Math.max(0, raw.xp) : 0;

  const rawSlots = Array.isArray(raw.engravingSlots) ? raw.engravingSlots : [];
  const engravingSlots = Array.from({ length: 6 }, (_, index) => {
    const value = rawSlots[index];
    return typeof value === 'string' && value.length > 0 ? value : null;
  });

  const rawGear = isRecord(raw.gear) ? raw.gear : {};
  const gear: HeroSave['gear'] = {};
  for (const slot of ['weapon', 'armor', 'relic', 'boots'] as const) {
    const value = rawGear[slot];
    if (typeof value === 'string' && value.length > 0) gear[slot] = value;
  }

  const rawSkills = Array.isArray(raw.skillLevels) ? raw.skillLevels : [];
  const skillLevels = Array.from({ length: 4 }, (_, index) =>
    intInRange(rawSkills[index], 1, SKILL_MAX_LEVEL, 1),
  );

  return {
    id,
    star,
    level,
    xp,
    engravingSlots,
    gear,
    memorySeen: raw.memorySeen === true,
    skillLevels,
    artifactLevel: intInRange(raw.artifactLevel, 0, ARTIFACT_MAX_LEVEL, 0),
    ascensionShardsSpent: intInRange(raw.ascensionShardsSpent, 0, 100_000, 0),
    levelGoldSpent: intInRange(raw.levelGoldSpent, 0, 100_000_000, 0),
  };
}

function normalizeHeroes(raw: unknown, fallback: Record<string, HeroSave>): Record<string, HeroSave> {
  if (!isRecord(raw)) return fallback;
  const heroes: Record<string, HeroSave> = {};
  for (const [id, value] of Object.entries(raw)) heroes[id] = normalizeHeroSave(id, value);
  return heroes;
}

function intInRange(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

/**
 * Старые сейвы не знали об обучении: не показываем им туториал и панель
 * «Что делать дальше», чтобы не ломать привычный вход в игру.
 */
function normalizeFtue(raw: unknown, base: FtueSave, legacy: boolean): FtueSave {
  if (!isRecord(raw)) {
    return legacy
      ? {
          ...base,
          step: FTUE_STEP_COUNT,
          completed: true,
          skipped: true,
          startTracked: true,
          winPanelSeen: true,
          lossPanelSeen: true,
        }
      : base;
  }

  const step = intInRange(raw.step, 0, FTUE_STEP_COUNT, base.step);
  const skipped = raw.skipped === true;
  const completed = raw.completed === true || skipped || step >= FTUE_STEP_COUNT;

  return {
    step: completed ? FTUE_STEP_COUNT : step,
    completed,
    skipped,
    startedAt:
      typeof raw.startedAt === 'number' && Number.isFinite(raw.startedAt) ? Math.max(0, raw.startedAt) : base.startedAt,
    completedAt:
      typeof raw.completedAt === 'number' && Number.isFinite(raw.completedAt) ? Math.max(0, raw.completedAt) : 0,
    startTracked: raw.startTracked === true || legacy,
    firstWin: raw.firstWin === true,
    firstLoss: raw.firstLoss === true,
    winPanelSeen: raw.winPanelSeen === true || legacy,
    lossPanelSeen: raw.lossPanelSeen === true || legacy,
    restarts: intInRange(raw.restarts, 0, 999, 0),
  };
}

function normalizeStarter(raw: unknown, base: StarterSave): StarterSave {
  if (!isRecord(raw)) return base;

  const days = Array.isArray(raw.claimedDays)
    ? [...new Set(raw.claimedDays.filter((day): day is number => typeof day === 'number' && Number.isFinite(day)).map((day) => Math.floor(day)))]
        .filter((day) => day >= 1 && day <= 7)
        .sort((a, b) => a - b)
    : [];

  const claimed = Array.isArray(raw.claimed)
    ? [...new Set(raw.claimed.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : [];

  return { ...base, claimedDays: days, claimed };
}

/** Три слота пресетов, без пустых строк и дублей внутри одного состава. */
function normalizePresets(raw: unknown): string[][] {
  const slots = Array.isArray(raw) ? raw : [];
  return Array.from({ length: 3 }, (_, slot) => {
    const list = Array.isArray(slots[slot]) ? slots[slot] : [];
    const heroes = list.filter((id): id is string => typeof id === 'string' && id.length > 0);
    return [...new Set(heroes)].slice(0, 5);
  });
}

function normalizeGearLoadout(raw: unknown): GearLoadout {
  if (!isRecord(raw)) return {};
  const result: GearLoadout = {};
  for (const slot of ['weapon', 'armor', 'relic', 'boots'] as const) {
    const value = raw[slot];
    if (typeof value === 'string' && value.length > 0) result[slot] = value;
  }
  return result;
}

function normalizeGearPresets(raw: unknown): Record<string, GearLoadout[]> {
  if (!isRecord(raw)) return {};
  const result: Record<string, GearLoadout[]> = {};
  for (const [heroId, list] of Object.entries(raw)) {
    if (!heroId || !Array.isArray(list)) continue;
    result[heroId] = Array.from({ length: 3 }, (_, slot) => normalizeGearLoadout(list[slot]));
  }
  return result;
}

function normalizeBattleSpeed(value: unknown): 1 | 2 | 3 | 4 {
  if (value === 2 || value === 3 || value === 4) return value;
  return 1;
}

function normalizeResonance(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.filter((id): id is string => typeof id === 'string' && id.length > 0);
  return [...new Set(ids)].slice(0, 5);
}

function numberList(raw: unknown, min: number, max: number): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)))]
    .map((value) => Math.floor(value))
    .filter((value) => value >= min && value <= max)
    .sort((a, b) => a - b);
}

function normalizeLive(raw: unknown, base: LiveSave): LiveSave {
  if (!isRecord(raw)) return base;
  const rawCalendar = isRecord(raw.calendar) ? raw.calendar : {};
  const rawPass = isRecord(raw.pass) ? raw.pass : {};
  const rawEvent = isRecord(raw.event) ? raw.event : {};

  const mail: MailSave[] = Array.isArray(raw.mail)
    ? raw.mail
        .filter((entry): entry is Record<string, unknown> => isRecord(entry))
        .map((entry) => ({
          id: typeof entry.id === 'string' ? entry.id : '',
          key: typeof entry.key === 'string' ? entry.key : 'mail.unknown',
          rewards: isRecord(entry.rewards) ? (entry.rewards as LiveReward) : {},
          createdAt: typeof entry.createdAt === 'number' ? Math.max(0, entry.createdAt) : 0,
          expiresAt: typeof entry.expiresAt === 'number' ? Math.max(0, entry.expiresAt) : 0,
          claimed: entry.claimed === true,
          ...(isRecord(entry.params) ? { params: entry.params as Record<string, string | number> } : {}),
        }))
        .filter((entry) => entry.id.length > 0)
    : [];

  return {
    calendar: {
      cycleStart: typeof rawCalendar.cycleStart === 'string' ? rawCalendar.cycleStart : '',
      lastClaimDay: typeof rawCalendar.lastClaimDay === 'string' ? rawCalendar.lastClaimDay : '',
      claimedDays: numberList(rawCalendar.claimedDays, 1, 28),
    },
    mail,
    pass: {
      season: typeof rawPass.season === 'string' ? rawPass.season : '',
      xp: intInRange(rawPass.xp, 0, PASS_MAX_LEVEL * 100, 0),
      claimedFree: numberList(rawPass.claimedFree, 1, PASS_MAX_LEVEL),
      claimedPaid: numberList(rawPass.claimedPaid, 1, PASS_MAX_LEVEL),
    },
    event: {
      id: typeof rawEvent.id === 'string' ? rawEvent.id : GLASS_RAIN.id,
      cleared: numberList(rawEvent.cleared, 0, 4),
      currency: intInRange(rawEvent.currency, 0, 10_000_000, 0),
      claimed: Array.isArray(rawEvent.claimed)
        ? [...new Set(rawEvent.claimed.filter((id): id is string => typeof id === 'string'))]
        : [],
    },
  };
}

function normalizeEndgame(raw: unknown, base: EndgameSave): EndgameSave {
  if (!isRecord(raw)) return base;

  const rawWorld = isRecord(raw.world) ? raw.world : {};
  const rawEndless = isRecord(raw.endless) ? raw.endless : {};
  const rawHard = isRecord(raw.hard) ? raw.hard : {};
  const rawChallenges = isRecord(raw.challenges) ? raw.challenges : {};
  const rawShop = isRecord(raw.shop) ? raw.shop : {};

  const towers: Record<string, number> = {};
  if (isRecord(raw.towers)) {
    for (const [element, value] of Object.entries(raw.towers)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        towers[element] = Math.min(30, Math.max(0, Math.floor(value)));
      }
    }
  }

  const cleared = Array.isArray(rawHard.cleared)
    ? [...new Set(rawHard.cleared.filter((value): value is number => typeof value === 'number'))]
        .map((value) => Math.floor(value))
        .filter((value) => value >= 1 && value <= 10)
        .sort((a, b) => a - b)
    : [];

  const claimed = Array.isArray(rawWorld.claimed)
    ? [...new Set(rawWorld.claimed.filter((id): id is string => typeof id === 'string'))]
    : [];
  const challengeClaimed = Array.isArray(rawChallenges.claimed)
    ? [...new Set(rawChallenges.claimed.filter((id): id is string => typeof id === 'string'))]
    : [];

  const bought: Record<string, number> = {};
  if (isRecord(rawShop.bought)) {
    for (const [id, value] of Object.entries(rawShop.bought)) {
      if (typeof value === 'number' && Number.isFinite(value)) bought[id] = Math.max(0, Math.floor(value));
    }
  }

  return {
    world: {
      week: typeof rawWorld.week === 'string' ? rawWorld.week : '',
      day: typeof rawWorld.day === 'string' ? rawWorld.day : '',
      attempts: intInRange(rawWorld.attempts, 0, 3, 0),
      total: intInRange(rawWorld.total, 0, 100_000_000, 0),
      best: intInRange(rawWorld.best, 0, 100_000_000, 0),
      claimed,
    },
    towers,
    endless: {
      day: typeof rawEndless.day === 'string' ? rawEndless.day : '',
      runs: intInRange(rawEndless.runs, 0, 3, 0),
      best: intInRange(rawEndless.best, 0, 10_000, 0),
    },
    hard: { cleared },
    challenges: { claimed: challengeClaimed },
    shop: {
      day: typeof rawShop.day === 'string' ? rawShop.day : '',
      bought,
    },
  };
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeArenaHistory(raw: unknown): ArenaHistoryEntrySave[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const entries: ArenaHistoryEntrySave[] = [];

  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = stringValue(item.id);
    const season = stringValue(item.season);
    if (!id || !season || seen.has(id)) continue;
    seen.add(id);
    entries.push({
      id,
      season,
      at: intInRange(item.at, 0, Number.MAX_SAFE_INTEGER, 0),
      opponentId: stringValue(item.opponentId),
      opponentName: stringValue(item.opponentName),
      ...(typeof item.ghostId === 'string' && item.ghostId ? { ghostId: item.ghostId } : {}),
      win: item.win === true,
      ratingBefore: intInRange(item.ratingBefore, 0, 100_000, 0),
      ratingAfter: intInRange(item.ratingAfter, 0, 100_000, 0),
      power: intInRange(item.power, 0, 100_000_000, 0),
      revenge: item.revenge === true,
      revenged: item.revenged === true,
    });
  }

  return entries.sort((a, b) => b.at - a.at).slice(0, ARENA_HISTORY_LIMIT);
}

function normalizeArena(raw: unknown, base: SaveV1['arena']): SaveV1['arena'] {
  if (!isRecord(raw)) return base;
  const rating = intInRange(raw.rating, 0, 100_000, base.rating);
  return {
    rating,
    league: intInRange(raw.league, 1, 10, 1),
    attacksToday: intInRange(raw.attacksToday, 0, ARENA_ATTACKS_PER_DAY, 0),
    date: stringValue(raw.date),
    season: stringValue(raw.season),
    seasonBest: intInRange(raw.seasonBest, 0, 100_000, rating),
    wins: intInRange(raw.wins, 0, 1_000_000, 0),
    losses: intInRange(raw.losses, 0, 1_000_000, 0),
    history: normalizeArenaHistory(raw.history),
  };
}

function normalizeGhost(raw: unknown): GhostSquadSave | null {
  if (!isRecord(raw)) return null;
  const id = stringValue(raw.id);
  if (!id) return null;

  const seen = new Set<string>();
  const heroes: GhostHeroSave[] = [];
  if (Array.isArray(raw.heroes)) {
    for (const item of raw.heroes) {
      if (!isRecord(item)) continue;
      const heroId = stringValue(item.heroId);
      if (!heroId || seen.has(heroId)) continue;
      seen.add(heroId);
      heroes.push({
        heroId,
        level: intInRange(item.level, 1, 10_000, 1),
        star: intInRange(item.star, 1, 6, 3),
      });
      if (heroes.length >= 5) break;
    }
  }
  if (heroes.length === 0) return null;

  return {
    id,
    name: stringValue(raw.name, 'Echo'),
    season: stringValue(raw.season),
    day: stringValue(raw.day),
    power: intInRange(raw.power, 0, 100_000_000, 0),
    heroes,
    createdAt: intInRange(raw.createdAt, 0, Number.MAX_SAFE_INTEGER, 0),
    source: raw.source === 'self' ? 'self' : 'bot',
  };
}

function normalizeGuildMembers(raw: unknown, playerName: string): GuildMemberSave[] {
  const seen = new Set<string>();
  const members: GuildMemberSave[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!isRecord(item)) continue;
      const id = stringValue(item.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      members.push({
        id,
        name: stringValue(item.name, id),
        power: intInRange(item.power, 0, 100_000_000, 0),
        damage: intInRange(item.damage, 0, 1_000_000_000, 0),
        you: item.you === true,
      });
      if (members.length >= 20) break;
    }
  }

  if (members.length > 0 && !members.some((member) => member.you)) {
    members.push({ id: 'you', name: playerName, power: 0, damage: 0, you: true });
  }
  return members;
}

function normalizeGuild(raw: unknown, playerName: string): GuildSave | null {
  if (!isRecord(raw)) return null;
  const id = stringValue(raw.id);
  const name = stringValue(raw.name, id);
  if (!id) return null;

  return {
    id,
    name,
    joinedWeek: stringValue(raw.joinedWeek),
    week: stringValue(raw.week),
    members: normalizeGuildMembers(raw.members, playerName),
    attemptsDay: stringValue(raw.attemptsDay),
    attempts: intInRange(raw.attempts, 0, 3, 0),
    claimed: Array.isArray(raw.claimed)
      ? [...new Set(raw.claimed.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0))]
      : [],
  };
}

function normalizeFriends(raw: unknown): FriendSave[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const heroSeen = new Set<string>();
  const friends: FriendSave[] = [];

  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = stringValue(item.id);
    const heroId = stringValue(item.heroId);
    if (!id || !heroId || seen.has(id) || heroSeen.has(heroId)) continue;
    seen.add(id);
    heroSeen.add(heroId);
    friends.push({
      id,
      name: stringValue(item.name, id),
      heroId,
      level: intInRange(item.level, 1, 10_000, 1),
      star: intInRange(item.star, 1, 6, 3),
      power: intInRange(item.power, 0, 100_000_000, 0),
    });
    if (friends.length >= 8) break;
  }

  return friends;
}

function normalizeMercenary(raw: unknown): MercenarySave | null {
  if (!isRecord(raw)) return null;
  const friendId = stringValue(raw.friendId);
  const heroId = stringValue(raw.heroId);
  if (!friendId || !heroId) return null;

  return {
    friendId,
    friendName: stringValue(raw.friendName, friendId),
    heroId,
    level: intInRange(raw.level, 1, 10_000, 1),
    star: intInRange(raw.star, 1, 6, 3),
    power: intInRange(raw.power, 0, 100_000_000, 0),
    hiredAt: intInRange(raw.hiredAt, 0, Number.MAX_SAFE_INTEGER, 0),
    week: stringValue(raw.week),
  };
}

function normalizeSocial(raw: unknown, base: SocialSave, playerName: string): SocialSave {
  if (!isRecord(raw)) return base;

  const ghosts: GhostSquadSave[] = [];
  const ghostSeen = new Set<string>();
  if (Array.isArray(raw.ghosts)) {
    for (const item of raw.ghosts) {
      const ghost = normalizeGhost(item);
      if (!ghost || ghostSeen.has(ghost.id)) continue;
      ghostSeen.add(ghost.id);
      ghosts.push(ghost);
      if (ghosts.length >= ARENA_GHOST_LIMIT) break;
    }
  }

  return {
    guild: normalizeGuild(raw.guild, playerName),
    friends: normalizeFriends(raw.friends),
    friendsSeeded: raw.friendsSeeded === true,
    mercenary: normalizeMercenary(raw.mercenary),
    ghosts,
  };
}

function normalizeBase(raw: unknown, base: BaseSave): BaseSave {
  if (!isRecord(raw)) return base;

  const rawBuildings = isRecord(raw.buildings) ? raw.buildings : {};
  const buildings: Record<string, number> = {};
  for (const building of BUILDINGS) {
    buildings[building.id] = intInRange(rawBuildings[building.id], 1, BUILDING_MAX_LEVEL, 1);
  }

  const exchangeUsed: Record<string, number> = {};
  if (isRecord(raw.exchangeUsed)) {
    for (const [id, value] of Object.entries(raw.exchangeUsed)) {
      const offer = EXCHANGE_BY_ID[id];
      if (!offer) continue;
      exchangeUsed[id] = intInRange(value, 0, offer.dailyLimit, 0);
    }
  }

  return {
    buildings,
    masterXp: intInRange(raw.masterXp, 0, 1_000_000_000, 0),
    claimedMasterLevels: numberList(raw.claimedMasterLevels, 2, MASTER_LEVEL_MAX),
    exchangeDay: stringValue(raw.exchangeDay),
    exchangeUsed,
  };
}

/**
 * Терпимая миграция: любые недостающие поля берутся из defaultSave.
 * Версия схемы аддитивная: старые записи дочитываются до текущей формы.
 */
export function migrate(raw: unknown): SaveV1 {  const base = defaultSave();
  if (!isRecord(raw)) return base;

  const rawPlayer = isRecord(raw.player) ? raw.player : {};
  const rawCurrencies = isRecord(raw.currencies) ? raw.currencies : {};
  const rawSettings = isRecord(raw.settings) ? raw.settings : {};
  const rawDining = isRecord(raw.dining) ? raw.dining : {};
  const rawShop = isRecord(raw.shop) ? raw.shop : {};
  const legacyFtue = raw.ftue === undefined;

  const merged: SaveV1 = {
    ...base,
    ...(raw as Partial<SaveV1>),
    version: SAVE_VERSION,
    player: {
      ...base.player,
      ...(rawPlayer as Partial<SaveV1['player']>),
      masterLevel: intInRange(rawPlayer.masterLevel, 1, MASTER_LEVEL_MAX, base.player.masterLevel),
    },
    currencies: {
      gold: intInRange(rawCurrencies.gold, 0, 999_999_999, base.currencies.gold),
      crystals: intInRange(rawCurrencies.crystals, 0, 999_999_999, base.currencies.crystals),
      seals: intInRange(rawCurrencies.seals, 0, 999_999, base.currencies.seals),
      essence: intInRange(rawCurrencies.essence, 0, 999_999_999, base.currencies.essence),
      dust: intInRange(rawCurrencies.dust, 0, 999_999_999, base.currencies.dust),
      arenaTokens: intInRange(rawCurrencies.arenaTokens, 0, 999_999_999, base.currencies.arenaTokens),
      echoMarks: intInRange(rawCurrencies.echoMarks, 0, 999_999_999, base.currencies.echoMarks),
      starShards: isRecord(rawCurrencies.starShards)
        ? Object.fromEntries(
            Object.entries(rawCurrencies.starShards)
              .filter(([id, value]) => typeof id === 'string' && typeof value === 'number' && Number.isFinite(value))
              .map(([id, value]) => [id, Math.max(0, Math.floor(value as number))]),
          )
        : {},
    },
    heroes: normalizeHeroes(raw.heroes, base.heroes),
    gacha: { ...base.gacha, ...(isRecord(raw.gacha) ? (raw.gacha as Partial<SaveV1['gacha']>) : {}) },
    shop: {
      ...base.shop,
      date: typeof rawShop.date === 'string' ? rawShop.date : '',
      bought: isRecord(rawShop.bought)
        ? Object.fromEntries(
            Object.entries(rawShop.bought)
              .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
              .map(([id, value]) => [id, Math.max(0, Math.floor(value as number))]),
          )
        : {},
      week: typeof rawShop.week === 'string' ? rawShop.week : '',
      weeklyBought: isRecord(rawShop.weeklyBought)
        ? Object.fromEntries(
            Object.entries(rawShop.weeklyBought)
              .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
              .map(([id, value]) => [id, Math.max(0, Math.floor(value as number))]),
          )
        : {},
      adsToday:
        typeof rawShop.adsToday === 'number' && Number.isFinite(rawShop.adsToday)
          ? Math.max(0, Math.floor(rawShop.adsToday))
          : 0,
    },
    inventory: {
      ...base.inventory,
      ...(isRecord(raw.inventory) ? (raw.inventory as Partial<SaveV1['inventory']>) : {}),
      engravings:
        isRecord(raw.inventory) && Array.isArray(raw.inventory.engravings)
          ? raw.inventory.engravings.filter((id): id is string => typeof id === 'string')
          : [],
      gear:
        isRecord(raw.inventory) && Array.isArray(raw.inventory.gear)
          ? raw.inventory.gear.filter((id): id is string => typeof id === 'string')
          : [],
      gearLevels:
        isRecord(raw.inventory) && isRecord(raw.inventory.gearLevels)
          ? Object.fromEntries(
              Object.entries(raw.inventory.gearLevels)
                .filter(([, level]) => typeof level === 'number' && Number.isFinite(level))
                .map(([id, level]) => [id, Math.max(0, Math.floor(level as number))]),
            )
          : {},
    },
    dining: {
      date: typeof rawDining.date === 'string' ? rawDining.date : '',
      claimed: rawDining.claimed === true,
      buff: typeof rawDining.buff === 'string' ? rawDining.buff : null,
      battles:
        typeof rawDining.battles === 'number' && Number.isFinite(rawDining.battles)
          ? Math.max(0, Math.floor(rawDining.battles))
          : 0,
      goldUntil:
        typeof rawDining.goldUntil === 'number' && Number.isFinite(rawDining.goldUntil)
          ? Math.max(0, rawDining.goldUntil)
          : 0,
    },
    settings: {
      music:
        typeof rawSettings.music === 'number' && Number.isFinite(rawSettings.music)
          ? Math.min(1, Math.max(0, rawSettings.music))
          : base.settings.music,
      sfx:
        typeof rawSettings.sfx === 'number' && Number.isFinite(rawSettings.sfx)
          ? Math.min(1, Math.max(0, rawSettings.sfx))
          : base.settings.sfx,
      musicEnabled: rawSettings.musicEnabled !== false,
      sfxEnabled: rawSettings.sfxEnabled !== false,
      haptics: typeof rawSettings.haptics === 'boolean' ? rawSettings.haptics : base.settings.haptics,
      quality:
        rawSettings.quality === 'low' || rawSettings.quality === 'high' || rawSettings.quality === 'auto'
          ? rawSettings.quality
          : base.settings.quality,
      battleSpeed: normalizeBattleSpeed(rawSettings.battleSpeed),
    },
    flags: isRecord(raw.flags) ? (raw.flags as Record<string, boolean>) : {},
    heroEssences: isRecord(raw.heroEssences)
      ? Object.fromEntries(
          Object.entries(raw.heroEssences)
            .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
            .map(([id, value]) => [id, Math.max(0, Math.floor(value as number))]),
        )
      : {},
    ftue: normalizeFtue(raw.ftue, base.ftue, legacyFtue),
    starter: normalizeStarter(raw.starter, base.starter),
    squadPresets: normalizePresets(raw.squadPresets),
    gearPresets: normalizeGearPresets(raw.gearPresets),
    resonance: normalizeResonance(raw.resonance),
    endgame: normalizeEndgame(raw.endgame, base.endgame),
    live: normalizeLive(raw.live, base.live),
    arena: normalizeArena(raw.arena, base.arena),
    social: normalizeSocial(
      raw.social,
      base.social,
      typeof rawPlayer.name === 'string' && rawPlayer.name.length > 0 ? rawPlayer.name : base.player.name,
    ),
    base: normalizeBase(raw.base, base.base),
  };

  const rawTower = isRecord(raw.tower) ? raw.tower : {};
  const rawIdle = isRecord(raw.idle) ? raw.idle : {};
  const validClears: SaveV1['tower']['clears'] = {};
  if (isRecord(rawTower.clears)) {
    for (const [floor, value] of Object.entries(rawTower.clears)) {
      const number = Number(floor);
      if (!Number.isInteger(number) || number < 1 || number > 100 || !isRecord(value)) continue;
      validClears[floor] = {
        stars: intInRange(value.stars, 0, 3, 0),
        first: value.first === true,
      };
    }
  }
  merged.tower = {
    maxFloor: intInRange(rawTower.maxFloor, 1, 100, base.tower.maxFloor),
    clears: validClears,
  };
  merged.idle = {
    lastClaim:
      typeof rawIdle.lastClaim === 'number' && Number.isFinite(rawIdle.lastClaim)
        ? Math.max(0, rawIdle.lastClaim)
        : base.idle.lastClaim,
    capHours: intInRange(rawIdle.capHours, 1, 24, base.idle.capHours),
  };

  const squadSource = Array.isArray(raw.squad) ? raw.squad : base.squad;
  const squad: string[] = [];
  for (const id of squadSource) {
    if (squad.length >= 5) break;
    if (typeof id !== 'string' || !id || !merged.heroes[id] || squad.includes(id)) {
      squad.push('');
    } else {
      squad.push(id);
    }
  }
  while (squad.length < 5) squad.push('');
  merged.squad = squad;

  if (!Array.isArray(merged.echoes)) merged.echoes = [];
  merged.expeditions = Array.isArray(merged.expeditions)
    ? merged.expeditions.filter(
        (entry) =>
          entry &&
          typeof entry.slot === 'number' &&
          Array.isArray(entry.heroes) &&
          typeof entry.endsAt === 'number' &&
          (entry.type === '2h' || entry.type === '4h' || entry.type === '8h'),
      )
    : [];
  merged.trials = {
    date: typeof merged.trials?.date === 'string' ? merged.trials.date : '',
    used: isRecord(merged.trials?.used) ? (merged.trials.used as Record<string, number>) : {},
  };

  const rawQuests = isRecord(raw.quests) ? raw.quests : {};
  merged.quests = {
    day: typeof rawQuests.day === 'string' ? rawQuests.day : '',
    week: typeof rawQuests.week === 'string' ? rawQuests.week : '',
    daily: isRecord(rawQuests.daily) ? (rawQuests.daily as Record<string, number>) : {},
    weekly: isRecord(rawQuests.weekly) ? (rawQuests.weekly as Record<string, number>) : {},
    lifetime: isRecord(rawQuests.lifetime) ? (rawQuests.lifetime as Record<string, number>) : {},
    claimedDaily: Array.isArray(rawQuests.claimedDaily) ? (rawQuests.claimedDaily as string[]) : [],
    claimedWeekly: Array.isArray(rawQuests.claimedWeekly) ? (rawQuests.claimedWeekly as string[]) : [],
    claimedLifetime: Array.isArray(rawQuests.claimedLifetime) ? (rawQuests.claimedLifetime as string[]) : [],
  };

  return merged;
}

function looksLikeSave(raw: unknown): raw is Record<string, unknown> {
  return (
    isRecord(raw) &&
    (typeof raw.version === 'number' || isRecord(raw.heroes) || isRecord(raw.currencies))
  );
}

export async function loadSave(): Promise<SaveV1> {
  const raw = await kvGet<unknown>(SAVE_KEY);
  if (!looksLikeSave(raw)) {
    // Повреждённый/чужой объект: пробуем предыдущий сейв, а не начинаем с нуля.
    const backup = await kvGet<unknown>(SAVE_BACKUP_KEY);
    if (looksLikeSave(backup)) {
      const recovered = migrate(backup);
      recovered.flags.saveRecovered = true;
      return recovered;
    }
  }
  return migrate(raw);
}

export async function persistSave(save: SaveV1): Promise<void> {
  const current = await kvGet<unknown>(SAVE_KEY);
  // Другая вкладка успела записать более свежий сейв — не затираем его своим старым.
  if (
    looksLikeSave(current) &&
    typeof current.lastSeen === 'number' &&
    current.lastSeen > save.lastSeen + 2_000
  ) {
    return;
  }
  if (looksLikeSave(current)) await kvSet(SAVE_BACKUP_KEY, current);
  await kvSet(SAVE_KEY, { ...save, lastSeen: now() });
}

export async function resetSave(): Promise<SaveV1> {
  const fresh = defaultSave();
  await persistSave(fresh);
  return fresh;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Код переноса прогресса: ET1:<base64 от UTF-8 JSON>. */
export function encodeSave(save: SaveV1): string {
  const bytes = new TextEncoder().encode(JSON.stringify(save));
  return `${EXPORT_PREFIX}${bytesToBase64(bytes)}`;
}

export function decodeSave(code: string): SaveV1 {
  const trimmed = code.trim();
  if (!trimmed.startsWith(EXPORT_PREFIX)) throw new Error('Неверный формат кода сохранения');
  const json = new TextDecoder().decode(base64ToBytes(trimmed.slice(EXPORT_PREFIX.length)));
  return migrate(JSON.parse(json));
}
