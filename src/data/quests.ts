import type { QuestDef, QuestMetric, QuestReward, QuestType } from './types';

function q(
  id: string,
  type: QuestType,
  metric: QuestMetric,
  target: number,
  titleRu: string,
  titleEn: string,
  reward: QuestReward,
): QuestDef {
  return { id, type, metric, target, titleRu, titleEn, reward };
}

/** 60 квестов: 20 дневных, 15 недельных, 15 достижений, 10 ивентовых. */
export const QUESTS: readonly QuestDef[] = [
  // ---------- daily ----------
  q('q01', 'daily', 'floors', 3, 'Пройти 3 этажа', 'Clear 3 floors', { crystals: 40 }),
  q('q02', 'daily', 'floors', 5, 'Пройти 5 этажей', 'Clear 5 floors', { crystals: 30 }),
  q('q03', 'daily', 'wins', 10, 'Победить 10 врагов', 'Defeat 10 enemies', { crystals: 20 }),
  q('q04', 'daily', 'summons', 1, 'Совершить 1 призыв', 'Make 1 summon', { crystals: 20 }),
  q('q05', 'daily', 'summons', 10, 'Совершить 10 призывов', 'Make 10 summons', { crystals: 30 }),
  q('q06', 'daily', 'rift', 1, 'Пройти Разлом', 'Clear the Rift', { crystals: 30, essence: 50 }),
  q('q07', 'daily', 'riftWins', 1, 'Победить в Разломе', 'Win in the Rift', { crystals: 20 }),
  q('q08', 'daily', 'arena', 3, '3 боя на Арене', 'Fight 3 Arena battles', { crystals: 30, arenaTokens: 100 }),
  q('q09', 'daily', 'arenaWins', 1, 'Победить на Арене', 'Win an Arena battle', { crystals: 20 }),
  q('q10', 'daily', 'upgrades', 3, 'Усилить героя 3 раза', 'Upgrade a hero 3 times', { crystals: 20 }),
  q('q11', 'daily', 'levelups', 5, 'Повысить уровень 5 раз', 'Level up 5 times', { crystals: 20 }),
  q('q12', 'daily', 'merges', 3, 'Слить 3 гравировки', 'Merge 3 engravings', { crystals: 15 }),
  q('q13', 'daily', 'gear', 1, 'Надеть снаряжение', 'Equip a gear item', { crystals: 15 }),
  q('q14', 'daily', 'expeditions', 1, 'Отправить экспедицию', 'Send an expedition', { crystals: 10, gold: 5_000 }),
  q('q15', 'daily', 'expeditions', 2, 'Забрать экспедицию', 'Collect an expedition', { crystals: 10 }),
  q('q16', 'daily', 'masterHand', 5, 'Использовать «Руку Мастера» 5 раз', 'Use the Master’s Hand 5 times', { crystals: 15 }),
  q('q17', 'daily', 'bossKills', 1, 'Победить босса', 'Defeat a boss', { crystals: 30 }),
  q('q18', 'daily', 'spendGold', 20_000, 'Потратить 20 000 золота', 'Spend 20,000 gold', { crystals: 15 }),
  q('q19', 'daily', 'ads', 1, 'Посмотреть рекламу 1 раз', 'Watch 1 ad', { crystals: 10 }),
  q('q20', 'daily', 'login', 1, 'Зайти в игру', 'Log in', { crystals: 10 }),

  // ---------- weekly ----------
  q('q21', 'weekly', 'floors', 15, 'Пройти 15 этажей', 'Clear 15 floors', { crystals: 100 }),
  q('q22', 'weekly', 'floors', 25, 'Пройти 25 этажей', 'Clear 25 floors', { crystals: 150 }),
  q('q23', 'weekly', 'rift', 3, 'Пройти 3 Разлома', 'Clear 3 Rifts', { crystals: 100, essence: 200 }),
  q('q24', 'weekly', 'arena', 10, '10 боёв на Арене', 'Fight 10 Arena battles', { crystals: 150, arenaTokens: 300 }),
  q('q25', 'weekly', 'starups', 1, 'Пройти 1 испытание ★', 'Clear 1 star trial', { crystals: 100 }),
  q('q26', 'weekly', 'starups', 3, 'Пройти 3 испытания ★', 'Clear 3 star trials', { crystals: 150, item: 'guard_hp_b' }),
  q('q27', 'weekly', 'bossKills', 5, 'Победить 5 боссов', 'Defeat 5 bosses', { crystals: 150 }),
  q('q28', 'weekly', 'summons', 20, 'Совершить 20 призывов', 'Make 20 summons', { seals: 1 }),
  q('q29', 'weekly', 'levelups', 5, 'Повысить уровень героя 5 раз', 'Level up a hero 5 times', { crystals: 80 }),
  q('q30', 'weekly', 'merges', 3, 'Слить 3 гравировки', 'Merge 3 engravings', { essence: 100 }),
  q('q31', 'weekly', 'expeditions', 5, 'Провести 5 экспедиций', 'Run 5 expeditions', { crystals: 100 }),
  q('q32', 'weekly', 'arenaWins', 10, 'Победить на Арене 10 раз', 'Win 10 Arena battles', { arenaTokens: 200 }),
  q('q33', 'weekly', 'clears', 1, 'Пройти главу', 'Clear a chapter', { crystals: 200 }),
  q('q34', 'weekly', 'spendGold', 100_000, 'Потратить 100 000 золота', 'Spend 100,000 gold', { crystals: 100 }),
  q('q35', 'weekly', 'ads', 10, 'Посмотреть 10 реклам', 'Watch 10 ads', { crystals: 50 }),

  // ---------- achievements ----------
  q('q36', 'achievement', 'floors', 10, 'Первый шаг', 'First Step', { crystals: 100 }),
  q('q37', 'achievement', 'floors', 50, 'Половина пути', 'Halfway Up', { crystals: 300 }),
  q('q38', 'achievement', 'floors', 100, 'Вершина', 'The Summit', { crystals: 1_000, item: 'title_summit' }),
  q('q39', 'achievement', 'heroes', 10, 'Коллекционер I', 'Collector I', { crystals: 200 }),
  q('q40', 'achievement', 'heroes', 32, 'Коллекционер II', 'Collector II', { item: 'frame_archive' }),
  q('q41', 'achievement', 'collection', 1, 'Первая звезда', 'First Star', { crystals: 150 }),
  q('q42', 'achievement', 'starups', 1, 'Сияние', 'Radiance', { crystals: 500, item: 'blade_atk_s' }),
  q('q43', 'achievement', 'wins', 1_000, 'Ветеран', 'Veteran', { crystals: 300 }),
  q('q44', 'achievement', 'rift', 50, 'Бесконечный разлом', 'Endless Rift', { essence: 300 }),
  q('q45', 'achievement', 'arenaLeague', 2, 'Арена: Серебро', 'Arena: Silver', { item: 'frame_silver' }),
  q('q46', 'achievement', 'arenaLeague', 3, 'Арена: Золото', 'Arena: Gold', { arenaTokens: 300, item: 'frame_gold' }),
  q('q47', 'achievement', 'arenaLeague', 4, 'Арена: Эхо', 'Arena: Echo', { arenaTokens: 500, item: 'title_echo' }),
  q('q48', 'achievement', 'codex', 12, 'Хранитель памяти', 'Keeper of Memory', { crystals: 200 }),
  q('q49', 'achievement', 'masterHand', 100, 'Мастер руки', 'Master of the Hand', { crystals: 100 }),
  q('q50', 'achievement', 'noShatter', 20, 'Без потерь', 'No Losses', { crystals: 200 }),

  // ---------- event ----------
  q('q51', 'event', 'eventBattles', 5, 'Пройти 5 сюжетных боёв ивента', 'Clear 5 event story battles', { eventMarks: 100 }),
  q('q52', 'event', 'bossKills', 1, 'Победить босса ивента', 'Defeat the event boss', { eventMarks: 200 }),
  q('q53', 'event', 'eventCurrency', 300, 'Собрать 300 ивент-валюты', 'Collect 300 event currency', { crystals: 100 }),
  q('q54', 'event', 'eventCurrency', 600, 'Собрать 600 ивент-валюты', 'Collect 600 event currency', { crystals: 200 }),
  q('q55', 'event', 'eventCurrency', 1_200, 'Собрать 1 200 ивент-валюты', 'Collect 1,200 event currency', { item: 'skin_glass_nira' }),
  q('q56', 'event', 'eventBattles', 10, 'Пройти ивент-этаж 10 раз', 'Clear an event floor 10 times', { eventMarks: 150 }),
  q('q57', 'event', 'eventHeroUse', 5, 'Использовать героя ивента 5 раз', 'Use the event hero 5 times', { eventMarks: 50 }),
  q('q58', 'event', 'eventNoShatter', 1, 'Пройти ивент без Раскола', 'Clear the event without a shatter', { crystals: 100 }),
  q('q59', 'event', 'eventShop', 3, 'Купить 3 товара в магазине ивента', 'Buy 3 event shop items', { eventMarks: 50 }),
  q('q60', 'event', 'eventLogin', 7, 'Зайти 7 дней ивента', 'Log in 7 event days', { crystals: 300 }),
];

export const QUESTS_BY_ID: Record<string, QuestDef> = Object.fromEntries(
  QUESTS.map((quest) => [quest.id, quest]),
);

export const DAILY_QUESTS = QUESTS.filter((quest) => quest.type === 'daily');
export const WEEKLY_QUESTS = QUESTS.filter((quest) => quest.type === 'weekly');
export const ACHIEVEMENTS = QUESTS.filter((quest) => quest.type === 'achievement');
export const EVENT_QUESTS = QUESTS.filter((quest) => quest.type === 'event');
