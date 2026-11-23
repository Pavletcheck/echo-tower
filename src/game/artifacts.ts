import { ARTIFACT_MAX_LEVEL, artifactForRole, type ArtifactDef } from '../data/artifacts';
import { HEROES_BY_ID } from '../data/heroes';
import type { StatKey } from '../data/types';
import { addStatBonus, emptyStatBonus, normalizeStatBonus, type StatBonus } from './battle/stats';
import { ARTIFACT_UNLOCK_COST, artifactUpgradeCost } from './config';
import type { SaveV1 } from './save';

export { ARTIFACT_MAX_LEVEL };

const STAT_LABEL: Record<string, string> = {
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  spd: 'SPD',
  crit: 'CRIT',
  cdmg: 'CDMG',
  er: 'ER',
  lifesteal: 'LS',
  elem: 'ELEM',
  dr: 'DR',
  heal: 'HEAL',
  shield: 'SHIELD',
};

export function artifactDef(heroId: string): ArtifactDef | null {
  const hero = HEROES_BY_ID[heroId];
  return hero ? artifactForRole(hero.role) : null;
}

export function artifactLevel(save: SaveV1, heroId: string): number {
  const raw = save.heroes[heroId]?.artifactLevel;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  return Math.min(ARTIFACT_MAX_LEVEL, Math.max(0, Math.floor(raw)));
}

/** Бонус артефакта: perLevel × уровень. */
export function artifactStats(save: SaveV1, heroId: string): StatBonus {
  const def = artifactDef(heroId);
  const level = artifactLevel(save, heroId);
  const bonus = emptyStatBonus();
  if (!def || level <= 0) return bonus;

  const part: Record<string, number> = {};
  for (const [stat, value] of Object.entries(def.perLevel) as Array<[StatKey, number]>) {
    part[stat] = (part[stat] ?? 0) + value * level;
  }
  addStatBonus(bonus, part as Partial<StatBonus>);
  return normalizeStatBonus(bonus);
}

export function artifactUnlockCost(): { shards: number; essence: number } {
  return { ...ARTIFACT_UNLOCK_COST };
}

export function artifactNextCost(save: SaveV1, heroId: string): { gold: number; essence: number } | null {
  const level = artifactLevel(save, heroId);
  if (level <= 0 || level >= ARTIFACT_MAX_LEVEL) return null;
  return artifactUpgradeCost(level);
}

/** Пробуждает артефакт (уровень 0 → 1) за осколки героя и эссенцию. */
export function unlockArtifact(save: SaveV1, heroId: string): boolean {
  if (!save.heroes[heroId] || artifactLevel(save, heroId) > 0) return false;
  const cost = artifactUnlockCost();
  const shards = save.currencies.starShards[heroId] ?? 0;
  if (shards < cost.shards || save.currencies.essence < cost.essence) return false;

  save.currencies.starShards[heroId] = shards - cost.shards;
  save.currencies.essence -= cost.essence;
  save.heroes[heroId]!.artifactLevel = 1;
  return true;
}

/** Улучшает артефакт на один уровень (1..5) за золото и эссенцию. */
export function upgradeArtifact(save: SaveV1, heroId: string): boolean {
  const level = artifactLevel(save, heroId);
  if (level <= 0 || level >= ARTIFACT_MAX_LEVEL) return false;
  const cost = artifactUpgradeCost(level);
  if (save.currencies.gold < cost.gold || save.currencies.essence < cost.essence) return false;

  save.currencies.gold -= cost.gold;
  save.currencies.essence -= cost.essence;
  save.heroes[heroId]!.artifactLevel = level + 1;
  return true;
}

/** Текст бонуса артефакта для UI: «+10% HP · +2 SPD». */
export function artifactBonusText(save: SaveV1, heroId: string): string {
  const def = artifactDef(heroId);
  const level = artifactLevel(save, heroId);
  if (!def || level <= 0) return '';

  return (Object.entries(def.perLevel) as Array<[StatKey, number]>)
    .map(([stat, value]) => {
      const scaled = value * level;
      return stat === 'spd'
        ? `+${Math.round(scaled * 10) / 10} ${STAT_LABEL[stat] ?? stat}`
        : `+${Math.round(scaled * 100)}% ${STAT_LABEL[stat] ?? stat}`;
    })
    .join(' · ');
}
