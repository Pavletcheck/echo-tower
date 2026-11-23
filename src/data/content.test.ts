import { describe, expect, it } from 'vitest';
import { BOSSES, ENEMIES } from './enemies';
import { ENGRAVINGS, ENGRAVING_SETS } from './engravings';
import { FLOORS } from './floors';
import { GEAR, GEAR_SETS } from './gear';
import { HEROES } from './heroes';
import { QUESTS } from './quests';
import { RIFT_BOONS } from './rift';
import { IAP_ITEMS, SHOP_ITEMS } from './shop';

describe('content integrity', () => {
  it('has the full roster', () => {
    expect(HEROES).toHaveLength(32);
    expect(new Set(HEROES.map((hero) => hero.id)).size).toBe(32);
    expect(HEROES.filter((hero) => hero.rarity === 5)).toHaveLength(8);
    expect(HEROES.filter((hero) => hero.rarity === 4)).toHaveLength(12);
    expect(HEROES.filter((hero) => hero.rarity === 3)).toHaveLength(12);
  });

  it('gives every hero four skills in order', () => {
    for (const hero of HEROES) {
      expect(hero.skills.map((skill) => skill.kind)).toEqual(['basic', 'skill', 'ultimate', 'passive']);
      expect(hero.skills.every((skill) => skill.id.startsWith(`${hero.id}_`))).toBe(true);
    }
  });

  it('has 100 floors with valid references', () => {
    expect(FLOORS).toHaveLength(100);
    for (const floor of FLOORS) {
      expect(floor.waves).toHaveLength(3);
      for (const wave of floor.waves) {
        for (const stack of wave.enemies) {
          const exists = ENEMIES.some((enemy) => enemy.id === stack.enemyId) || BOSSES.some((boss) => boss.id === stack.enemyId);
          expect(exists).toBe(true);
        }
      }
      if (floor.floor % 5 === 0) expect(floor.bossId).toBeTruthy();
    }
  });

  it('keeps floor 100 reward in the reference range', () => {
    const last = FLOORS[99];
    expect(last?.reward.gold).toBe(10_047);
    expect(last?.firstClear.crystals).toBe(120);
  });

  it('has 40 engravings and 6 sets', () => {
    expect(ENGRAVINGS).toHaveLength(40);
    expect(ENGRAVING_SETS).toHaveLength(6);
    expect(new Set(ENGRAVINGS.map((item) => item.id)).size).toBe(40);
  });

  it('has 24 gear items across 6 sets', () => {
    expect(GEAR).toHaveLength(24);
    expect(GEAR_SETS).toHaveLength(6);
    for (const set of GEAR_SETS) {
      expect(GEAR.filter((item) => item.setId === set.id)).toHaveLength(4);
    }
  });

  it('has 60 quests and 40 rift boons', () => {
    expect(QUESTS).toHaveLength(60);
    expect(RIFT_BOONS).toHaveLength(40);
    expect(new Set(QUESTS.map((quest) => quest.id)).size).toBe(60);
  });

  it('has unique shop and IAP ids', () => {
    expect(new Set(SHOP_ITEMS.map((item) => item.id)).size).toBe(SHOP_ITEMS.length);
    expect(new Set(IAP_ITEMS.map((item) => item.sku)).size).toBe(IAP_ITEMS.length);
  });

  it('has 12 bosses with patterns', () => {
    expect(BOSSES).toHaveLength(12);
    expect(BOSSES.every((boss) => boss.patterns.length >= 2)).toBe(true);
  });
});
