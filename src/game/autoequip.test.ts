import { describe, expect, it } from 'vitest';
import {
  autoEquip,
  equipGear,
  gearBuildScore,
  gearPreset,
  loadGearPreset,
  saveGearPreset,
  unequipGear,
} from './equipment';
import { defaultSave } from './save';

function allGear(save: ReturnType<typeof defaultSave>): string[] {
  const equipped = Object.values(save.heroes).flatMap((hero) =>
    Object.values(hero.gear ?? {}).filter((id): id is string => Boolean(id)),
  );
  return [...save.inventory.gear, ...equipped];
}

describe('auto-equip', () => {
  it('replaces weaker gear and never lowers the build score', () => {
    const save = defaultSave();
    save.heroes.thorn!.gear = { weapon: 'glass_weapon' };
    save.inventory.gear = ['dawn-blade_weapon', 'dawn-blade_armor', 'glass_boots'];

    const before = gearBuildScore(save, 'thorn');
    const changed = autoEquip(save, 'thorn');
    const after = gearBuildScore(save, 'thorn');

    expect(changed).toContain('weapon');
    expect(save.heroes.thorn?.gear.weapon).toBe('dawn-blade_weapon');
    expect(after).toBeGreaterThanOrEqual(before);
    expect(gearBuildScore(save, 'thorn')).toBe(after);

    const inventory = allGear(save);
    expect(new Set(inventory).size).toBe(inventory.length);
  });

  it('is stable on a second run', () => {
    const save = defaultSave();
    save.inventory.gear = ['dawn-blade_weapon', 'dawn-blade_armor', 'dawn-blade_relic', 'dawn-blade_boots'];

    autoEquip(save, 'thorn');
    const score = gearBuildScore(save, 'thorn');
    const second = autoEquip(save, 'thorn');

    expect(second).toEqual([]);
    expect(gearBuildScore(save, 'thorn')).toBe(score);
  });
});

describe('gear presets', () => {
  it('saves and restores four slots from the inventory', () => {
    const save = defaultSave();
    save.inventory.gear = ['glass_weapon', 'glass_armor'];
    expect(equipGear(save, 'thorn', 'weapon', 'glass_weapon')).toBe(true);
    expect(equipGear(save, 'thorn', 'armor', 'glass_armor')).toBe(true);

    expect(saveGearPreset(save, 'thorn', 0)).toBe(true);
    expect(gearPreset(save, 'thorn', 0)).toMatchObject({
      weapon: 'glass_weapon',
      armor: 'glass_armor',
    });

    expect(unequipGear(save, 'thorn', 'weapon')).toBe(true);
    expect(unequipGear(save, 'thorn', 'armor')).toBe(true);
    expect(loadGearPreset(save, 'thorn', 0)).toBe(2);
    expect(save.heroes.thorn?.gear).toMatchObject({
      weapon: 'glass_weapon',
      armor: 'glass_armor',
    });
  });

  it('skips items that are not in the inventory', () => {
    const save = defaultSave();
    save.inventory.gear = ['glass_weapon'];
    equipGear(save, 'thorn', 'weapon', 'glass_weapon');
    saveGearPreset(save, 'thorn', 1);
    unequipGear(save, 'thorn', 'weapon');

    expect(loadGearPreset(save, 'thorn', 1)).toBe(1);
    expect(loadGearPreset(save, 'thorn', 1)).toBe(0);
    expect(loadGearPreset(save, 'thorn', 99)).toBe(0);
    expect(saveGearPreset(save, 'missing', 0)).toBe(false);
  });
});
