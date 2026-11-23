/**
 * Все числа баланса — здесь и в src/data/*.ts. Никаких магических чисел в UI.
 * Источник: Prompt/05_PROGRESSION_ECONOMY.md
 */

export const STAR_MULT = [1, 1.15, 1.32, 1.55, 1.85, 2.2] as const;
export const MAX_STAR = 6;
export const MIN_STAR = 1;

export function starMultiplier(star: number): number {
  const index = Math.min(MAX_STAR, Math.max(MIN_STAR, Math.round(star))) - 1;
  return STAR_MULT[index];
}

export const levelCap = (star: number): number => 15 * Math.min(MAX_STAR, Math.max(MIN_STAR, star));
export const levelGold = (level: number): number => Math.floor(12 * Math.pow(level, 1.55));
export const levelXp = (level: number): number => Math.floor(8 * Math.pow(level, 1.4));

export const floorGold = (floor: number): number => Math.floor(40 * Math.pow(floor, 1.2));
export const floorXp = (floor: number): number => Math.floor(6 * Math.pow(floor, 1.15));
/** Повторное прохождение пройденного этажа: только 10% золота, без прочих наград. */
export const REPEAT_GOLD_RATE = 0.1;
export const idleGoldPerMinute = (floor: number): number => 0.8 * Math.pow(floor, 1.35);
export const idleEssencePerMinute = (floor: number): number => 0.05 * Math.pow(floor, 1.05);
export const idleCapHours = (premium: boolean): number => (premium ? 12 : 8);

export const enhanceCost = (level: number): number => Math.floor(30 * Math.pow(level, 1.4));

/** Усиление снаряжения: +5% к основному стату за уровень, максимум +20. */
export const GEAR_MAX_LEVEL = 20;
export const GEAR_LEVEL_STEP = 0.05;

/** Шансы дропа снаряжения в режимах. Этажи 5/10 главы и Испытания — гарантированно. */
export const GEAR_DROP_RIFT = 0.35;
export const GEAR_DROP_ARENA = 0.2;
export const GEAR_DROP_TRIAL = 1;

export const GACHA_COST_SINGLE = 300;
export const GACHA_COST_TEN = 2700;
export const PITY_SOFT = 45;
export const PITY_HARD = 70;
export const PITY_RATE_5 = 0.012;
export const PITY_RATE_4 = 0.1;

export const MASTER_CHARGES = 3;

/** Прогрессия героя 2.0: звёзды, скиллы, резонанс и артефакты. */
export const ASCENSION_COST: Readonly<Record<number, number>> = {
  2: 15,
  3: 30,
  4: 60,
  5: 100,
  6: 160,
};

export function ascensionCost(star: number): number {
  return ASCENSION_COST[Math.min(6, Math.max(1, Math.floor(star)) + 1)] ?? 0;
}

export const SKILL_MAX_LEVEL = 5;
export const SKILL_POWER_STEP = 0.08;

export function skillUpgradeCost(level: number): { gold: number; essence: number } {
  const next = Math.min(SKILL_MAX_LEVEL, Math.max(1, Math.floor(level) + 1));
  return {
    gold: Math.floor(180 * Math.pow(next, 1.35)),
    essence: Math.floor(35 * Math.pow(next, 1.2)),
  };
}

export const ARTIFACT_UNLOCK_COST = { shards: 15, essence: 100 } as const;

export function artifactUpgradeCost(level: number): { gold: number; essence: number } {
  const next = Math.min(5, Math.max(1, Math.floor(level) + 1));
  return {
    gold: 400 * next,
    essence: 80 * next,
  };
}

export const RESET_REFUND = 0.9;
export const RESONANCE_SLOTS = 5;

/** Бонус отряда за единство стихии: 2 героя +5%, 3 +10%, 5 +18% ATK. */
export const ELEMENT_BONUS_TIERS: ReadonlyArray<{ count: number; bonus: number }> = [
  { count: 5, bonus: 18 },
  { count: 3, bonus: 10 },
  { count: 2, bonus: 5 },
];

export function elementBonus(count: number): number {
  return ELEMENT_BONUS_TIERS.find((tier) => count >= tier.count)?.bonus ?? 0;
}

/** Масштаб врагов по этажам. Калибруется через npm run balance. */
export const ENEMY_HP_BASE = 3_900;
export const ENEMY_HP_GROWTH = 1.035;
export const ENEMY_HP_MID = 9_400;
export const ENEMY_HP_LATE_GROWTH = 1.016;

export const ENEMY_ATK_BASE = 273;
export const ENEMY_ATK_GROWTH = 1.042;
export const ENEMY_ATK_MID = 700;
export const ENEMY_ATK_LATE_GROWTH = 1.012;

export const ENEMY_DEF_BASE = 55;
export const ENEMY_DEF_GROWTH = 1.022;

/** Этаж, после которого кривая врагов становится плоской (совпадает со скачком ★4). */
export const ENEMY_CURVE_KNEE = 25;

export function enemyHpScale(floor: number): number {
  const f = Math.max(1, floor);
  return f <= ENEMY_CURVE_KNEE
    ? ENEMY_HP_BASE * Math.pow(ENEMY_HP_GROWTH, f - 1)
    : ENEMY_HP_MID * Math.pow(ENEMY_HP_LATE_GROWTH, f - ENEMY_CURVE_KNEE);
}

export function enemyAtkScale(floor: number): number {
  const f = Math.max(1, floor);
  return f <= ENEMY_CURVE_KNEE
    ? ENEMY_ATK_BASE * Math.pow(ENEMY_ATK_GROWTH, f - 1)
    : ENEMY_ATK_MID * Math.pow(ENEMY_ATK_LATE_GROWTH, f - ENEMY_CURVE_KNEE);
}
