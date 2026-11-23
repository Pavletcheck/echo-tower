import { describe, expect, it } from 'vitest';
import { HEROES_BY_ID } from '../data/heroes';
import { artifactLevel, artifactStats, unlockArtifact, upgradeArtifact } from './artifacts';
import { allyFromHero } from './battle/factory';
import { equipmentStats } from './equipment';
import { heroSave } from './gacha';
import { buildHeroUnit } from './squad';
import {
  ascendHero,
  ascensionShards,
  heroRefund,
  resetHero,
  skillLevel,
  upgradeSkill,
} from './progression';
import { effectiveLevel, resonanceLevel, setResonanceSlot } from './resonance';
import { defaultSave } from './save';

describe('hero progression 2.0', () => {
  it('ascends a hero with star shards and remembers the spend', () => {
    const save = defaultSave();
    save.currencies.starShards.thorn = 100;
    const cost = ascensionShards(save, 'thorn');

    expect(ascendHero(save, 'thorn')).toBe(true);
    expect(save.heroes.thorn?.star).toBe(4);
    expect(save.currencies.starShards.thorn).toBe(100 - cost);
    expect(save.heroes.thorn?.ascensionShardsSpent).toBe(cost);
  });

  it('upgrades skills for gold and essence and scales battle power', () => {
    const save = defaultSave();
    save.currencies.gold = 50_000;
    save.currencies.essence = 5_000;

    expect(upgradeSkill(save, 'thorn', 0)).toBe(true);
    expect(skillLevel(save, 'thorn', 0)).toBe(2);
    expect(save.currencies.gold).toBeLessThan(50_000);
    expect(save.currencies.essence).toBeLessThan(5_000);

    const hero = HEROES_BY_ID.thorn;
    if (!hero) throw new Error('thorn missing');
    const base = allyFromHero(hero, { slot: 0, star: 3, level: 8 });
    const leveled = allyFromHero(hero, { slot: 0, star: 3, level: 8, skillLevels: [5, 1, 1, 1] });
    expect(leveled.skills[0]?.mult).toBeGreaterThan(base.skills[0]?.mult ?? 0);

    while (upgradeSkill(save, 'thorn', 0)) {
      // доводим до максимума
    }
    expect(skillLevel(save, 'thorn', 0)).toBe(5);
  });

  it('unlocks and upgrades the role artifact, and its stats reach the build', () => {
    const save = defaultSave();
    save.currencies.starShards.thorn = 30;
    save.currencies.essence = 2_000;
    save.currencies.gold = 20_000;

    const before = equipmentStats(save, 'thorn').hp;
    expect(unlockArtifact(save, 'thorn')).toBe(true);
    expect(artifactLevel(save, 'thorn')).toBe(1);
    expect(artifactStats(save, 'thorn').hp).toBeGreaterThan(0);
    expect(equipmentStats(save, 'thorn').hp).toBeGreaterThan(before);

    expect(upgradeArtifact(save, 'thorn')).toBe(true);
    expect(artifactLevel(save, 'thorn')).toBe(2);

    while (upgradeArtifact(save, 'thorn')) {
      // доводим до 5
    }
    expect(artifactLevel(save, 'thorn')).toBe(5);
    expect(upgradeArtifact(save, 'thorn')).toBe(false);
  });

  it('raises lagging heroes to the top-5 level through resonance', () => {
    const save = defaultSave();
    const levels: Record<string, number> = { thorn: 40, neya: 39, grom: 38, lissa: 37, zip: 36 };
    for (const [id, level] of Object.entries(levels)) {
      const hero = save.heroes[id];
      if (hero) hero.level = level;
    }

    expect(resonanceLevel(save)).toBe(36);

    const briz = HEROES_BY_ID.briz;
    if (!briz) throw new Error('briz missing');
    save.heroes.briz = heroSave(briz);
    expect(effectiveLevel(save, 'briz')).toBe(1);

    expect(setResonanceSlot(save, 0, 'briz')).toBe(true);
    expect(effectiveLevel(save, 'briz')).toBe(36);
    expect(effectiveLevel(save, 'zip')).toBe(36);

    const unit = buildHeroUnit(save, 'briz', 0);
    expect(unit?.level).toBe(36);
  });

  it('refunds 90% on reset, resets progression and keeps the squad', () => {
    const save = defaultSave();
    save.currencies.gold = 100_000;
    save.currencies.essence = 10_000;
    save.currencies.starShards.thorn = 200;
    save.heroes.thorn!.level = 20;
    save.heroes.thorn!.levelGoldSpent = 5_000;
    upgradeSkill(save, 'thorn', 0);
    ascendHero(save, 'thorn');
    unlockArtifact(save, 'thorn');

    const refund = heroRefund(save, 'thorn');
    expect(refund.gold).toBeGreaterThanOrEqual(Math.floor(5_000 * 0.9));
    const gold = save.currencies.gold;
    const essence = save.currencies.essence;
    const shards = save.currencies.starShards.thorn ?? 0;
    const squad = [...save.squad];

    const granted = resetHero(save, 'thorn');
    expect(granted).toEqual(refund);
    expect(save.heroes.thorn?.level).toBe(1);
    expect(save.heroes.thorn?.star).toBe(3);
    expect(save.heroes.thorn?.skillLevels).toEqual([1, 1, 1, 1]);
    expect(save.heroes.thorn?.artifactLevel).toBe(0);
    expect(save.currencies.gold).toBe(gold + refund.gold);
    expect(save.currencies.essence).toBe(essence + refund.essence);
    expect(save.currencies.starShards.thorn).toBe(shards + refund.shards);
    expect(save.squad).toEqual(squad);
  });
});
