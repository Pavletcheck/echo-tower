import type { LiveReward } from '../game/rewards';

export const CALENDAR_DAYS = 28;

/** 28-дневный календарь: недельные вехи жирнее, обычные дни — небольшие награды. */
export const CALENDAR_REWARDS: readonly LiveReward[] = Array.from({ length: CALENDAR_DAYS }, (_, index) => {
  const day = index + 1;
  if (day === 7) return { crystals: 100, seals: 1 };
  if (day === 14) return { crystals: 150, essence: 100 };
  if (day === 21) return { crystals: 200, dust: 100 };
  if (day === 28) return { crystals: 300, echoMarks: 10 };
  if (day % 5 === 0) return { gold: 1_500, essence: 40 };
  if (day % 3 === 0) return { gold: 800, dust: 20 };
  return { gold: 500, crystals: 10 };
});

export const PASS_MAX_LEVEL = 50;
// 50 уровней × 60 = 3 000 XP: сезон реально закрывается за 4 недели дейликов.
export const PASS_XP_PER_LEVEL = 60;
export const PASS_XP_QUEST = 10;
export const PASS_XP_FLOOR = 2;

export interface PassLevelDef {
  level: number;
  free: LiveReward;
  premium: LiveReward;
}

/** 50 уровней пропуска: бесплатная ветка и платная (без подключения платежей). */
export const PASS_LEVELS: readonly PassLevelDef[] = Array.from({ length: PASS_MAX_LEVEL }, (_, index) => {
  const level = index + 1;
  if (level % 25 === 0) {
    return {
      level,
      free: { crystals: 500, echoMarks: 10 },
      premium:
        level === PASS_MAX_LEVEL
          ? { crystals: 1_000, seals: 2, item: 'skin_nira_glass' }
          : { crystals: 1_000, seals: 2, item: 'frame_pass' },
    };
  }
  if (level % 10 === 0) {
    return { level, free: { crystals: 250, dust: 100 }, premium: { crystals: 400, essence: 250 } };
  }
  if (level % 5 === 0) {
    return { level, free: { crystals: 100 }, premium: { crystals: 150, seals: 1 } };
  }
  return { level, free: { gold: 500 + level * 60 }, premium: { essence: 40 + level * 4 } };
});

export interface EventBattleDef {
  index: number;
  floor: number;
  titleKey: string;
  bodyKey: string;
  glass: number;
}

export interface EventShopDef {
  id: string;
  nameRu: string;
  nameEn: string;
  price: number;
  reward: LiveReward;
}

export interface EventDef {
  id: string;
  start: string;
  end: string;
  nameRu: string;
  nameEn: string;
  descRu: string;
  descEn: string;
  battles: readonly EventBattleDef[];
  shop: readonly EventShopDef[];
}

/** Первый ивент: 5 сюжетных боёв, стекло и обмен. */
export const GLASS_RAIN: EventDef = {
  id: 'glass-rain',
  start: '2026-11-01T00:00:00Z',
  end: '2026-12-15T23:59:59Z',
  nameRu: 'Стеклянный дождь',
  nameEn: 'Glass Rain',
  descRu: 'Осколки мира падают на Башню. Пройдите 5 сюжетных боёв и обменяйте стекло на награды.',
  descEn: 'Shards of the world fall on the Tower. Clear 5 story battles and exchange glass for rewards.',
  battles: [
    {
      index: 0,
      floor: 5,
      titleKey: 'event.battle.1.title',
      bodyKey: 'event.battle.1.body',
      glass: 20,
    },
    {
      index: 1,
      floor: 10,
      titleKey: 'event.battle.2.title',
      bodyKey: 'event.battle.2.body',
      glass: 30,
    },
    {
      index: 2,
      floor: 15,
      titleKey: 'event.battle.3.title',
      bodyKey: 'event.battle.3.body',
      glass: 40,
    },
    {
      index: 3,
      floor: 20,
      titleKey: 'event.battle.4.title',
      bodyKey: 'event.battle.4.body',
      glass: 50,
    },
    {
      index: 4,
      floor: 25,
      titleKey: 'event.battle.5.title',
      bodyKey: 'event.battle.5.body',
      glass: 60,
    },
  ],
  shop: [
    {
      id: 'event_shards',
      nameRu: 'Осколки героя ×20',
      nameEn: 'Hero shards ×20',
      price: 25,
      reward: { shards: 20 },
    },
    {
      id: 'event_essence',
      nameRu: 'Эссенция ×300',
      nameEn: 'Essence ×300',
      price: 30,
      reward: { essence: 300 },
    },
    {
      id: 'event_dust',
      nameRu: 'Пыль ×200',
      nameEn: 'Dust ×200',
      price: 35,
      reward: { dust: 200 },
    },
    {
      id: 'event_skin',
      nameRu: 'Облик Ниры «Стеклянная»',
      nameEn: 'Nira “Glass” skin',
      price: 150,
      reward: { item: 'skin_glass_nira' },
    },
  ],
};

export interface ReturnTier {
  days: number;
  key: string;
  rewards: LiveReward;
}

export const RETURN_TIERS: readonly ReturnTier[] = [
  { days: 3, key: 'mail.return.3', rewards: { gold: 3_000, crystals: 50 } },
  { days: 7, key: 'mail.return.7', rewards: { gold: 8_000, crystals: 120, seals: 1 } },
  { days: 14, key: 'mail.return.14', rewards: { gold: 15_000, crystals: 250, seals: 2, echoMarks: 10 } },
];

export const MAIL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
