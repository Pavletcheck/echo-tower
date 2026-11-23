import { describe, expect, it } from 'vitest';
import { ENGRAVINGS_BY_ID } from '../data/engravings';
import { GEAR, GEAR_BY_ID } from '../data/gear';
import { HEROES_BY_ID } from '../data/heroes';
import { applyArenaResult } from './arena';
import { allyFromHero } from './battle/factory';
import { combatStats, emptyStatBonus, normalizeStatBonus, unitCombatStats } from './battle/stats';
import { simulate } from './battle/sim';
import type { UnitInit } from './battle/types';
import { enhanceCost } from './config';
import {
  enhanceGear,
  equipEngraving,
  equipGear,
  equipmentStats,
  gearDropForFloor,
  gearLevel,
  gearNextEnhanceCost,
  gearStats,
  grantStarterGear,
  mergeEngravings,
  rollGearDrop,
  unequipEngraving,
  unequipGear,
} from './equipment';
import { createRiftRun, riftGearDrop } from './rift';
import { defaultSave, migrate, type SaveV1 } from './save';
import { buyItem, shopGearPreview } from './shop';
import { buildSquad } from './squad';
import { grantTrialGear } from './trials';

function newSave(engravings: string[] = [], gear: string[] = []): SaveV1 {
  const save = defaultSave();
  save.inventory.engravings = [...engravings];
  save.inventory.gear = [...gear];
  return save;
}

function dummyEnemy(): UnitInit {
  const hero = HEROES_BY_ID.thorn;
  if (!hero) throw new Error('missing thorn');
  return {
    ...allyFromHero(hero, { slot: 0, star: 1, level: 1, uid: 'dummy' }),
    side: 'enemy',
    base: { hp: 1_000_000, atk: 1, def: 0, spd: 1 },
  };
}

describe('equipment: engravings', () => {
  it('equips and unequips a stone, moving it between inventory and slot', () => {
    const save = newSave(['whisper_crit_d']);

    expect(equipEngraving(save, 'thorn', 0, 'whisper_crit_d')).toBe(true);
    expect(save.heroes.thorn?.engravingSlots[0]).toBe('whisper_crit_d');
    expect(save.inventory.engravings).toEqual([]);

    expect(unequipEngraving(save, 'thorn', 0)).toBe(true);
    expect(save.heroes.thorn?.engravingSlots[0]).toBeNull();
    expect(save.inventory.engravings).toEqual(['whisper_crit_d']);
  });

  it('returns the previous stone to inventory when a slot is replaced', () => {
    const save = newSave(['blade_atk_d', 'blade_atk_c']);

    expect(equipEngraving(save, 'thorn', 0, 'blade_atk_d')).toBe(true);
    expect(equipEngraving(save, 'thorn', 0, 'blade_atk_c')).toBe(true);

    expect(save.heroes.thorn?.engravingSlots[0]).toBe('blade_atk_c');
    expect(save.inventory.engravings).toEqual(['blade_atk_d']);
  });

  it('rejects unknown stones, unknown heroes and bad slots', () => {
    const save = newSave(['whisper_crit_d']);

    expect(equipEngraving(save, 'nobody', 0, 'whisper_crit_d')).toBe(false);
    expect(equipEngraving(save, 'thorn', 0, 'missing')).toBe(false);
    expect(equipEngraving(save, 'thorn', 6, 'whisper_crit_d')).toBe(false);
    expect(equipEngraving(save, 'thorn', -1, 'whisper_crit_d')).toBe(false);
    expect(save.inventory.engravings).toEqual(['whisper_crit_d']);
  });

  it('repairs a hero record without the six slot array', () => {
    const save = newSave(['whisper_crit_d']);
    save.heroes.thorn!.engravingSlots = undefined as unknown as (string | null)[];
    expect(equipEngraving(save, 'thorn', 0, 'whisper_crit_d')).toBe(true);
    expect(save.heroes.thorn?.engravingSlots).toHaveLength(6);
    expect(save.heroes.thorn?.engravingSlots[0]).toBe('whisper_crit_d');
  });

  it('merges 3 stones of a grade into 1 of the next grade in the same set', () => {
    const save = newSave(['whisper_crit_d', 'whisper_crit_d', 'whisper_crit_d', 'guard_hp_d']);

    expect(mergeEngravings(save, 'D')).toBe(1);
    expect(save.inventory.engravings).toContain('whisper_crit_c');
    expect(save.inventory.engravings).toContain('guard_hp_d');
    expect(save.inventory.engravings.filter((id) => ENGRAVINGS_BY_ID[id]?.grade === 'D')).toHaveLength(1);
    expect(save.quests.daily.merges ?? save.quests.lifetime.merges).toBe(1);
  });

  it('supports multiple merges in one call and refuses incomplete or SS stacks', () => {
    const save = newSave(Array.from({ length: 6 }, () => 'guard_hp_d'));

    expect(mergeEngravings(save, 'D', 2)).toBe(2);
    expect(save.inventory.engravings).toEqual(['guard_hp_c', 'guard_hp_c']);

    expect(mergeEngravings(save, 'D')).toBe(0);
    expect(mergeEngravings(save, 'SS')).toBe(0);
    expect(save.inventory.engravings).toEqual(['guard_hp_c', 'guard_hp_c']);
  });

  it('applies the 2-piece tier before 4 and 6', () => {
    const save = newSave(['whisper_crit_d', 'whisper_crit_c']);
    save.heroes.thorn!.engravingSlots = ['whisper_crit_d', 'whisper_crit_c'];
    save.inventory.engravings = [];

    const bonus = equipmentStats(save, 'thorn');
    expect(bonus.crit).toBeCloseTo((2 + 3) / 100 + 0.03, 6);
    expect(bonus.cdmg).toBe(0);
  });

  it('applies 2/4/6 set bonuses cumulatively', () => {
    const save = newSave([
      'guard_hp_d',
      'guard_hp_c',
      'guard_hp_b',
      'guard_hp_a',
      'guard_hp_s',
      'guard_hp_ss',
    ]);
    save.heroes.thorn!.engravingSlots = [...save.inventory.engravings];
    save.inventory.engravings = [];

    const bonus = equipmentStats(save, 'thorn');
    const stoneHp = (3 + 5 + 8 + 12 + 17 + 24) / 100;
    expect(bonus.hp).toBeCloseTo(stoneHp + 0.08 + 0.12 + 0.2, 6);
    expect(bonus.shield).toBeCloseTo(0.1, 6);
    expect(bonus.specials).toContain('engraving:guard:6');

    const fourOnly = newSave(['whisper_crit_d', 'whisper_crit_c', 'whisper_crit_b', 'whisper_crit_a']);
    fourOnly.heroes.thorn!.engravingSlots = [...fourOnly.inventory.engravings];
    fourOnly.inventory.engravings = [];
    const whisper = equipmentStats(fourOnly, 'thorn');
    expect(whisper.crit).toBeCloseTo((2 + 3 + 4 + 6) / 100 + 0.03 + 0.06, 6);
    expect(whisper.cdmg).toBeCloseTo(0.25, 6);
    expect(whisper.specials).not.toContain('engraving:whisper:6');
  });
});

describe('equipment: gear', () => {
  it('equips and unequips gear in the matching slot', () => {
    const save = newSave([], ['glass_weapon', 'glass_armor']);

    expect(equipGear(save, 'thorn', 'weapon', 'glass_armor')).toBe(false);
    expect(equipGear(save, 'thorn', 'weapon', 'glass_weapon')).toBe(true);
    expect(save.heroes.thorn?.gear.weapon).toBe('glass_weapon');
    expect(save.inventory.gear).toEqual(['glass_armor']);

    expect(unequipGear(save, 'thorn', 'weapon')).toBe(true);
    expect(save.heroes.thorn?.gear.weapon).toBeUndefined();
    expect(save.inventory.gear).toContain('glass_weapon');
  });

  it('returns replaced gear to inventory', () => {
    const save = newSave([], ['glass_weapon', 'choir_weapon']);

    expect(equipGear(save, 'thorn', 'weapon', 'glass_weapon')).toBe(true);
    expect(equipGear(save, 'thorn', 'weapon', 'choir_weapon')).toBe(true);
    expect(save.heroes.thorn?.gear.weapon).toBe('choir_weapon');
    expect(save.inventory.gear).toEqual(['glass_weapon']);
  });

  it('sums item stats and 2/4 set bonuses', () => {
    const save = newSave([], ['echo-guard_weapon', 'echo-guard_armor', 'echo-guard_relic', 'echo-guard_boots']);
    save.heroes.thorn!.gear = {
      weapon: 'echo-guard_weapon',
      armor: 'echo-guard_armor',
      relic: 'echo-guard_relic',
      boots: 'echo-guard_boots',
    };
    save.inventory.gear = [];

    const bonus = gearStats(save, 'thorn');
    expect(bonus.hp).toBeCloseTo(0.22 + 0.1 + 0.1, 6);
    expect(bonus.atk).toBeCloseTo(0.18 + 0.1, 6);
    expect(bonus.def).toBeCloseTo(0.12 + 0.06, 6);
    expect(bonus.crit).toBeCloseTo(0.05, 6);
    expect(bonus.er).toBeCloseTo(0.08, 6);
    expect(bonus.spd).toBeCloseTo(6, 6);
    expect(bonus.specials).toContain('gear:echo-guard:4');
  });

  it('grants the four common starter items exactly once', () => {
    const save = newSave();

    expect(grantStarterGear(save)).toBe(true);
    expect(save.inventory.gear).toHaveLength(4);
    expect(save.inventory.gear.every((id) => GEAR_BY_ID[id]?.rarity === 'common')).toBe(true);
    expect(grantStarterGear(save)).toBe(false);
    expect(save.inventory.gear).toHaveLength(4);
  });

  it('drops gear deterministically on chapter boss floors', () => {
    expect(gearDropForFloor(4)).toBeNull();
    expect(gearDropForFloor(6)).toBeNull();

    const first = gearDropForFloor(5);
    const repeat = gearDropForFloor(5);
    expect(first).not.toBeNull();
    expect(repeat?.id).toBe(first?.id);
    expect(GEAR.some((item) => item.id === first?.id)).toBe(true);

    expect(gearDropForFloor(10)?.id).toBe(GEAR[1]?.id);
  });
});

describe('equipment: enhancement', () => {
  it('spends dust and raises the main stat by 5% per level', () => {
    const save = newSave([], ['glass_weapon']);
    save.heroes.thorn!.gear = { weapon: 'glass_weapon' };
    save.inventory.gear = [];
    save.currencies.dust = 10_000;

    const before = gearStats(save, 'thorn').atk;
    expect(gearNextEnhanceCost(save, 'glass_weapon')).toBe(enhanceCost(1));
    expect(enhanceGear(save, 'glass_weapon')).toBe(1);
    expect(save.currencies.dust).toBe(10_000 - enhanceCost(1));
    expect(gearLevel(save, 'glass_weapon')).toBe(1);
    expect(gearStats(save, 'thorn').atk).toBeCloseTo(before * 1.05, 6);
  });

  it('enhances several levels, then stops at the cap or without dust', () => {
    const save = newSave([], ['glass_weapon']);
    save.heroes.thorn!.gear = { weapon: 'glass_weapon' };
    save.inventory.gear = [];
    save.currencies.dust = 100_000;

    expect(enhanceGear(save, 'glass_weapon', 3)).toBe(3);
    expect(gearLevel(save, 'glass_weapon')).toBe(3);

    save.inventory.gearLevels.glass_weapon = 20;
    expect(gearNextEnhanceCost(save, 'glass_weapon')).toBe(0);
    expect(enhanceGear(save, 'glass_weapon')).toBe(0);

    save.inventory.gearLevels.glass_weapon = 0;
    save.currencies.dust = 0;
    expect(enhanceGear(save, 'glass_weapon')).toBe(0);
  });

  it('does not enhance items the player does not own', () => {
    const save = newSave();
    save.currencies.dust = 10_000;
    expect(enhanceGear(save, 'glass_weapon')).toBe(0);
    expect(gearNextEnhanceCost(save, 'missing')).toBe(0);
  });
});

describe('equipment: additional gear sources', () => {
  it('rolls deterministic gear and respects the chance', () => {
    expect(rollGearDrop(123, 0)).toBeNull();
    const first = rollGearDrop(123, 1);
    const second = rollGearDrop(123, 1);
    expect(first).not.toBeNull();
    expect(second?.id).toBe(first?.id);
  });

  it('drops gear from a completed Rift run', () => {
    let drop = null;
    for (let startedAt = 0; startedAt < 200 && !drop; startedAt += 1) {
      drop = riftGearDrop(createRiftRun(startedAt));
    }
    expect(drop).not.toBeNull();
  });

  it('grants gear for an Arena win when the deterministic roll hits', () => {
    let found: string | null = null;
    for (let seed = 0; seed < 200 && !found; seed += 1) {
      const save = defaultSave();
      const reward = applyArenaResult(save, true, seed);
      if (reward.gearId) {
        found = reward.gearId;
        expect(save.inventory.gear).toContain(reward.gearId);
      }
    }
    expect(found).not.toBeNull();

    const loss = defaultSave();
    const reward = applyArenaResult(loss, false, 1);
    expect(reward.gearId).toBeNull();
    expect(loss.inventory.gear).toEqual([]);
  });

  it('grants gear on a successful star trial', () => {
    const save = defaultSave();
    save.heroes.thorn!.star = 5;
    const id = grantTrialGear(save, 'thorn');
    expect(id).not.toBeNull();
    expect(save.inventory.gear).toContain(id);
  });

  it('sells deterministic gear in the shop and previews the same item', () => {
    const save = defaultSave();
    save.currencies.gold = 50_000;
    const preview = shopGearPreview(save, 'shop_gear');
    expect(preview?.id).toBeTruthy();

    expect(buyItem(save, 'shop_gear')).toBe(true);
    expect(save.inventory.gear).toHaveLength(1);
    expect(save.inventory.gear[0]).toBe(preview?.id);

    const again = defaultSave();
    again.currencies.gold = 50_000;
    buyItem(again, 'shop_gear');
    expect(again.inventory.gear[0]).toBe(save.inventory.gear[0]);
  });
});

describe('equipment: combat impact', () => {
  it('applies bonuses on top of base stats without negatives and with caps', () => {
    const base = combatStats({ hp: 1000, atk: 100, def: 50, spd: 100 }, 5, 20);
    const boosted = unitCombatStats({
      base: { hp: 1000, atk: 100, def: 50, spd: 100 },
      star: 5,
      level: 20,
      bonus: { ...emptyStatBonus(), hp: 0.5, atk: 0.25, spd: 12, crit: 0.2 },
    });

    expect(boosted.hp).toBeCloseTo(base.hp * 1.5, 6);
    expect(boosted.atk).toBeCloseTo(base.atk * 1.25, 6);
    expect(boosted.spd).toBeCloseTo(base.spd + 12, 6);
    expect(boosted.crit).toBeCloseTo(base.crit + 0.2, 6);

    const dirty = normalizeStatBonus({ hp: -5, crit: 99, dr: 99, spd: -10, specials: ['a', 'a'] });
    expect(dirty.hp).toBe(0);
    expect(dirty.spd).toBe(0);
    expect(dirty.crit).toBe(0.8);
    expect(dirty.dr).toBe(0.75);
    expect(dirty.specials).toEqual(['a']);
  });

  it('buildSquad returns units with equipment bonuses', () => {
    const save = newSave(['blade_atk_a']);
    expect(equipEngraving(save, 'thorn', 0, 'blade_atk_a')).toBe(true);

    const unit = buildSquad(save).find((entry) => entry.defId === 'thorn');
    expect(unit?.bonus?.atk).toBeCloseTo(0.17, 6);

    const base = combatStats(unit!.base, unit!.star, unit!.level);
    expect(unitCombatStats(unit!).atk).toBeGreaterThan(base.atk);
  });

  it('a equipped attack stone increases damage in the simulation', () => {
    const hero = HEROES_BY_ID.thorn;
    if (!hero) throw new Error('missing thorn');

    const plain = allyFromHero(hero, { slot: 0, star: 5, level: 20 });
    const buffed = allyFromHero(hero, {
      slot: 0,
      star: 5,
      level: 20,
      bonus: { ...emptyStatBonus(), atk: 1 },
    });

    const setup = (ally: UnitInit) => ({
      seed: 777,
      mode: 'tower' as const,
      allies: [ally],
      enemies: [dummyEnemy()],
      masterCharges: 0,
      maxTime: 20,
    });

    const before = simulate(setup(plain));
    const after = simulate(setup(buffed));

    expect(before.outcome).toBe('timeout');
    expect(after.damageDealt).toBeGreaterThan(before.damageDealt * 1.5);
  });
});

describe('save: equipment migration', () => {
  it('opens a legacy hero without engravingSlots/gear without losing progress', () => {
    const migrated = migrate({
      currencies: { gold: 500, crystals: 12 },
      heroes: {
        thorn: { id: 'thorn', star: 5, level: 7, xp: 12 },
      },
      tower: { maxFloor: 14, clears: {} },
    });

    expect(migrated.currencies.gold).toBe(500);
    expect(migrated.heroes.thorn?.level).toBe(7);
    expect(migrated.heroes.thorn?.xp).toBe(12);
    expect(migrated.heroes.thorn?.engravingSlots).toEqual([null, null, null, null, null, null]);
    expect(migrated.heroes.thorn?.gear).toEqual({});
    expect(migrated.inventory.gearLevels).toEqual({});
    expect(migrated.tower.maxFloor).toBe(14);
  });

  it('pads short slot arrays and keeps valid gear entries', () => {
    const migrated = migrate({
      heroes: {
        thorn: {
          id: 'thorn',
          star: 5,
          level: 10,
          engravingSlots: ['blade_atk_a'],
          gear: { weapon: 'glass_weapon', armor: 42 },
        },
      },
      inventory: { gearLevels: { glass_weapon: 3, broken: -4, nope: 'x' } },
    });

    expect(migrated.heroes.thorn?.engravingSlots[0]).toBe('blade_atk_a');
    expect(migrated.heroes.thorn?.engravingSlots).toHaveLength(6);
    expect(migrated.heroes.thorn?.engravingSlots.slice(1)).toEqual([null, null, null, null, null]);
    expect(migrated.heroes.thorn?.gear).toEqual({ weapon: 'glass_weapon' });
    expect(migrated.inventory.gearLevels).toEqual({ glass_weapon: 3, broken: 0 });
  });
});
