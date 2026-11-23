import { HEROES_BY_ID } from '../data/heroes';
import {
  ARTIFACT_UNLOCK_COST,
  ascensionCost,
  artifactUpgradeCost,
  RESET_REFUND,
  SKILL_MAX_LEVEL,
  skillUpgradeCost,
} from './config';
import { artifactLevel } from './artifacts';
import { trackQuest } from './quests';
import type { SaveV1 } from './save';

export function ascensionShards(save: SaveV1, heroId: string): number {
  const hero = save.heroes[heroId];
  return hero ? ascensionCost(hero.star) : 0;
}

export function canAscend(save: SaveV1, heroId: string): boolean {
  const hero = save.heroes[heroId];
  if (!hero || hero.star >= 6) return false;
  return (save.currencies.starShards[heroId] ?? 0) >= ascensionCost(hero.star);
}

/** Повышает ★ за осколки героя (альтернатива Испытанию). */
export function ascendHero(save: SaveV1, heroId: string): boolean {
  const hero = save.heroes[heroId];
  if (!hero || hero.star >= 6) return false;
  const cost = ascensionCost(hero.star);
  const shards = save.currencies.starShards[heroId] ?? 0;
  if (shards < cost) return false;

  save.currencies.starShards[heroId] = shards - cost;
  hero.star += 1;
  hero.ascensionShardsSpent = (hero.ascensionShardsSpent ?? 0) + cost;
  return true;
}

export function skillLevel(save: SaveV1, heroId: string, index: number): number {
  const raw = save.heroes[heroId]?.skillLevels?.[index];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1;
  return Math.min(SKILL_MAX_LEVEL, Math.max(1, Math.floor(raw)));
}

export function skillCost(save: SaveV1, heroId: string, index: number): { gold: number; essence: number } | null {
  const level = skillLevel(save, heroId, index);
  if (level >= SKILL_MAX_LEVEL) return null;
  return skillUpgradeCost(level);
}

/** Уровни скиллов: gold + essence. */
export function upgradeSkill(save: SaveV1, heroId: string, index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= 4) return false;
  const level = skillLevel(save, heroId, index);
  if (level >= SKILL_MAX_LEVEL) return false;
  const cost = skillUpgradeCost(level);
  const hero = save.heroes[heroId];
  if (!hero) return false;
  if (save.currencies.gold < cost.gold || save.currencies.essence < cost.essence) return false;

  save.currencies.gold -= cost.gold;
  save.currencies.essence -= cost.essence;
  if (!Array.isArray(hero.skillLevels)) hero.skillLevels = [1, 1, 1, 1];
  hero.skillLevels[index] = level + 1;
  trackQuest(save, 'upgrades', 1);
  trackQuest(save, 'spendGold', cost.gold);
  return true;
}

export interface HeroRefund {
  gold: number;
  essence: number;
  shards: number;
}

/** Сколько ресурсов вернётся при сбросе (90% вложенного). */
export function heroRefund(save: SaveV1, heroId: string): HeroRefund {
  const hero = save.heroes[heroId];
  if (!hero) return { gold: 0, essence: 0, shards: 0 };

  let gold = Math.max(0, Math.floor(hero.levelGoldSpent ?? 0));
  let essence = 0;
  let shards = Math.max(0, Math.floor(hero.ascensionShardsSpent ?? 0));

  for (let index = 0; index < 4; index += 1) {
    const current = skillLevel(save, heroId, index);
    for (let step = 1; step < current; step += 1) {
      const cost = skillUpgradeCost(step);
      gold += cost.gold;
      essence += cost.essence;
    }
  }

  const artifact = artifactLevel(save, heroId);
  if (artifact > 0) {
    shards += ARTIFACT_UNLOCK_COST.shards;
    essence += ARTIFACT_UNLOCK_COST.essence;
    for (let step = 1; step < artifact; step += 1) {
      const cost = artifactUpgradeCost(step);
      gold += cost.gold;
      essence += cost.essence;
    }
  }

  return {
    gold: Math.floor(gold * RESET_REFUND),
    essence: Math.floor(essence * RESET_REFUND),
    shards: Math.floor(shards * RESET_REFUND),
  };
}

export function canResetHero(save: SaveV1, heroId: string): boolean {
  const hero = save.heroes[heroId];
  if (!hero) return false;
  const def = HEROES_BY_ID[heroId];
  const baseStar = def?.rarity ?? 3;
  const skillsUpgraded = Array.from({ length: 4 }, (_, index) => skillLevel(save, heroId, index)).some(
    (level) => level > 1,
  );
  return (
    hero.level > 1 ||
    hero.star > baseStar ||
    skillsUpgraded ||
    artifactLevel(save, heroId) > 0 ||
    (hero.ascensionShardsSpent ?? 0) > 0
  );
}

/**
 * Сбрасывает героя к базовой звезде и 1 уровню, возвращая 90% вложенного.
 * Отряд не трогаем: герой остаётся в тех же слотах.
 */
export function resetHero(save: SaveV1, heroId: string): HeroRefund | null {
  const hero = save.heroes[heroId];
  if (!hero) return null;
  if (!canResetHero(save, heroId)) return null;

  const refund = heroRefund(save, heroId);
  const def = HEROES_BY_ID[heroId];

  hero.level = 1;
  hero.xp = 0;
  hero.star = def?.rarity ?? 3;
  hero.skillLevels = [1, 1, 1, 1];
  hero.artifactLevel = 0;
  hero.ascensionShardsSpent = 0;
  hero.levelGoldSpent = 0;
  save.resonance = (save.resonance ?? []).filter((id) => id !== heroId);

  save.currencies.gold += refund.gold;
  save.currencies.essence += refund.essence;
  save.currencies.starShards[heroId] = (save.currencies.starShards[heroId] ?? 0) + refund.shards;

  return refund;
}
