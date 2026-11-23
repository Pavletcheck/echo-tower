import { describe, expect, it } from 'vitest';
import { buildWave } from './battle/factory';
import { simulate } from './battle/sim';
import { getFloor } from '../data/floors';
import { HEROES_BY_ID } from '../data/heroes';
import { heroSave } from './gacha';
import { defaultSave, type SaveV1 } from './save';
import { buildHeroUnit, buildSquad } from './squad';
import { squadElementBonus } from './squad-element';
import { loadSquadPreset, saveSquadPreset } from './squad-presets';

function addHero(save: SaveV1, id: string): void {
  const hero = HEROES_BY_ID[id];
  if (hero) save.heroes[id] = heroSave(hero);
}

describe('squad element bonus', () => {
  it('adds the real element bonus to every squad unit', () => {
    const save = defaultSave();
    expect(squadElementBonus(save)).toEqual({ element: 'echo', count: 2, bonus: 5 });

    const base = buildHeroUnit(save, 'thorn', 0);
    const squad = buildSquad(save).find((unit) => unit.defId === 'thorn');
    expect(base?.bonus?.atk).toBeDefined();
    expect(squad?.bonus?.atk).toBeCloseTo((base?.bonus?.atk ?? 0) + 0.05, 6);
  });

  it('gives +10% for three heroes of the same element', () => {
    const save = defaultSave();
    addHero(save, 'briz');
    save.squad = ['thorn', 'zip', 'briz', 'neya', 'grom'];

    expect(squadElementBonus(save)).toEqual({ element: 'echo', count: 3, bonus: 10 });
    const unit = buildSquad(save)[0];
    const base = buildHeroUnit(save, 'thorn', 0);
    expect(unit?.bonus?.atk).toBeCloseTo((base?.bonus?.atk ?? 0) + 0.1, 6);
  });

  it('changes battle damage with the same seed', () => {
    const floor = getFloor(1);
    if (!floor) throw new Error('floor 1 missing');

    const withBonus = buildSquad(defaultSave());
    const withoutBonus = withBonus.map((unit) => ({
      ...unit,
      bonus: unit.bonus ? { ...unit.bonus, atk: Math.max(0, unit.bonus.atk - 0.05) } : unit.bonus,
    }));

    const [template] = buildWave(floor, 0);
    if (!template) throw new Error('wave missing');
    const dummy = [
      {
        ...template,
        base: { ...template.base, hp: 1_000_000, atk: 0, def: 0, spd: 1 },
        atkMult: 0,
        side: 'enemy' as const,
      },
    ];

    const boosted = simulate({
      seed: 424242,
      mode: 'tower',
      allies: withBonus,
      enemies: dummy,
      masterCharges: 0,
      maxTime: 10,
    });
    const plain = simulate({
      seed: 424242,
      mode: 'tower',
      allies: withoutBonus,
      enemies: dummy,
      masterCharges: 0,
      maxTime: 10,
    });

    expect(boosted.damageDealt).toBeGreaterThan(plain.damageDealt);
  });
});

describe('squad presets', () => {
  it('saves and loads a composition without duplicates', () => {
    const save = defaultSave();
    save.squad = ['thorn', 'neya', 'grom', 'lissa', 'zip'];
    expect(saveSquadPreset(save, 0)).toBe(true);
    expect(save.squadPresets[0]).toEqual(['thorn', 'neya', 'grom', 'lissa', 'zip']);

    save.squad = ['zip', '', '', '', ''];
    expect(loadSquadPreset(save, 0)).toBe(true);
    expect(save.squad).toEqual(['thorn', 'neya', 'grom', 'lissa', 'zip']);
    expect(new Set(save.squad).size).toBe(5);
  });

  it('ignores unavailable heroes and keeps empty slots valid', () => {
    const save = defaultSave();
    save.squadPresets[1] = ['thorn', 'ghost', 'thorn', 'neya', 'missing'];
    expect(loadSquadPreset(save, 1)).toBe(true);
    expect(save.squad).toEqual(['thorn', 'neya', '', '', '']);

    save.squadPresets[2] = ['ghost'];
    expect(loadSquadPreset(save, 2)).toBe(false);
    expect(loadSquadPreset(save, 9)).toBe(false);
  });

  it('does not save an empty squad', () => {
    const save = defaultSave();
    save.squad = ['', '', '', '', ''];
    expect(saveSquadPreset(save, 0)).toBe(false);
    expect(save.squadPresets[0]).toEqual([]);
  });
});
