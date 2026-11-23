import { describe, expect, it } from 'vitest';
import { HEROES_BY_ID } from '../data/heroes';
import { applyHeroDeaths, fallenFromResult, fallenHeroes, reassembleCost, reassembleHero } from './hero-loss';
import { defaultSave } from './save';

describe('hero loss and essence', () => {
  it('removes a fallen hero, keeps essence and returns equipment', () => {
    const save = defaultSave();
    save.heroes.thorn!.gear = { weapon: 'glass_weapon' };
    save.heroes.thorn!.engravingSlots[0] = 'guard_hp_d';
    const essence = save.currencies.essence;

    const removed = applyHeroDeaths(save, ['thorn', 'thorn']);
    expect(removed).toEqual(['thorn']);
    expect(save.heroes.thorn).toBeUndefined();
    expect(save.squad.filter(Boolean)).not.toContain('thorn');
    expect(save.heroEssences.thorn).toBe(1);
    expect(save.currencies.essence).toBeGreaterThan(essence);
    expect(save.inventory.gear).toContain('glass_weapon');
    expect(save.inventory.engravings).toContain('guard_hp_d');
    expect(fallenHeroes(save).some((entry) => entry.heroId === 'thorn')).toBe(true);
  });

  it('reassembles a hero at base progression and fills an empty squad slot', () => {
    const save = defaultSave();
    applyHeroDeaths(save, ['thorn']);
    save.currencies.gold = 10_000;
    save.currencies.essence = 1_000;
    save.heroes.neya!.level = 50;

    expect(reassembleHero(save, 'thorn')).toBe(true);
    expect(save.heroes.thorn?.level).toBe(1);
    expect(save.heroes.thorn?.star).toBe(HEROES_BY_ID.thorn?.rarity);
    expect(save.heroes.thorn?.skillLevels).toEqual([1, 1, 1, 1]);
    expect(save.squad).toContain('thorn');
    expect(save.heroEssences.thorn).toBeUndefined();
    expect(save.currencies.gold).toBe(10_000 - reassembleCost('thorn').gold);
  });

  it('refuses reassembly without the essence marker or resources', () => {
    const save = defaultSave();
    expect(reassembleHero(save, 'thorn')).toBe(false);
    applyHeroDeaths(save, ['thorn']);
    save.currencies.gold = 0;
    save.currencies.essence = 0;
    expect(reassembleHero(save, 'thorn')).toBe(false);
  });

  it('reads fallen heroes from a battle snapshot', () => {
    const result = {
      allies: [
        { uid: 'ally_thorn', defId: 'thorn', hp: 100, maxHp: 100, alive: true, energy: 0 },
        { uid: 'ally_neya', defId: 'neya', hp: 0, maxHp: 100, alive: false, energy: 0 },
      ],
    } as unknown as Parameters<typeof fallenFromResult>[0];
    expect(fallenFromResult(result)).toEqual(['neya']);
  });
});
