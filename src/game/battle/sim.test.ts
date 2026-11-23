import { describe, expect, it } from 'vitest';
import { HEROES_BY_ID } from '../../data/heroes';
import { elementMultiplier } from './formulas';
import { allyFromHero } from './factory';
import { simulate } from './sim';
import { enemyKit, enemyStats } from './stats';
import type { BattleSetup, UnitInit } from './types';

function ally(id: string, slot = 0, level = 30, star = 4): UnitInit {
  const hero = HEROES_BY_ID[id];
  if (!hero) throw new Error(`missing ${id}`);
  return allyFromHero(hero, { slot, level, star });
}

function dummyEnemy(hp = 500, atk = 10, slot = 0): UnitInit {
  return {
    uid: `dummy_${slot}`,
    defId: 'dummy',
    name: 'Dummy',
    side: 'enemy',
    slot,
    role: 'blade',
    element: 'echo',
    base: enemyStats(hp, atk, 40, 90),
    star: 1,
    level: 1,
    skills: enemyKit('blade'),
  };
}

function setup(overrides: Partial<BattleSetup> = {}): BattleSetup {
  return {
    seed: 12345,
    mode: 'tower',
    allies: [ally('belquist')],
    enemies: [dummyEnemy()],
    masterCharges: 0,
    maxTime: 30,
    ...overrides,
  };
}

describe('battle simulation', () => {
  it('is deterministic for the same seed', () => {
    const first = simulate(setup());
    const second = simulate(setup());
    expect(first.outcome).toBe(second.outcome);
    expect(first.log).toEqual(second.log);
    expect(first.damageDealt).toBe(second.damageDealt);
  });

  it('depends on the seed', () => {
    const damage = [1, 2, 3, 4, 5].map(
      (seed) =>
        simulate(setup({ seed, enemies: [dummyEnemy(100_000, 1)], maxTime: 10 })).damageDealt,
    );
    expect(new Set(damage).size).toBeGreaterThan(1);
  });

  it('wins against a weak dummy and never leaves negative HP', () => {
    const result = simulate(setup());
    expect(result.outcome).toBe('win');
    for (const unit of [...result.allies, ...result.enemies]) {
      expect(unit.hp).toBeGreaterThanOrEqual(0);
      expect(unit.hp).toBeLessThanOrEqual(unit.maxHp);
    }
  });

  it('times out when nobody can finish the fight', () => {
    const result = simulate(
      setup({
        allies: [ally('iria')],
        enemies: [dummyEnemy(100_000, 1)],
        maxTime: 1,
      }),
    );
    expect(result.outcome).toBe('timeout');
    expect(result.timeMs).toBeLessThanOrEqual(1000);
  });

  it('never spends more Master actions than charges', () => {
    const result = simulate(
      setup({
        allies: [ally('belquist'), ally('cassian', 1)],
        enemies: [dummyEnemy(50_000, 10), dummyEnemy(50_000, 10, 2)],
        masterCharges: 2,
        masterActions: [
          { at: 0.5, type: 'command' },
          { at: 1, type: 'seal' },
          { at: 1.5, type: 'sacrifice' },
          { at: 2, type: 'command' },
        ],
        maxTime: 5,
      }),
    );
    const masterEvents = result.log.filter((event) => event.type === 'master');
    expect(masterEvents.length).toBeLessThanOrEqual(2);
  });

  it('applies enemy modifiers to enemies and not to allies', () => {
    const plain = simulate(setup({ enemies: [dummyEnemy(1_000, 10)], maxTime: 0.1 }));
    const buffed = simulate(
      setup({
        enemies: [dummyEnemy(1_000, 10)],
        enemyModifiers: { hp: 1 },
        maxTime: 0.1,
      }),
    );

    expect(buffed.enemies[0]?.maxHp).toBe((plain.enemies[0]?.maxHp ?? 0) * 2);
    expect(buffed.allies[0]?.maxHp).toBe(plain.allies[0]?.maxHp);
  });

  it('creates an echo when an ally shatters', () => {
    const result = simulate(
      setup({
        allies: [ally('iria', 0, 1, 3)],
        enemies: [dummyEnemy(50_000, 500)],
        maxTime: 20,
      }),
    );
    expect(result.outcome).toBe('lose');
    expect(result.echoes).toHaveLength(1);
    expect(result.log.some((event) => event.type === 'shatter')).toBe(true);
  });
});

describe('element ring', () => {
  it('gives advantage, disadvantage and neutral multipliers', () => {
    expect(elementMultiplier('echo', 'ash')).toBe(1.25);
    expect(elementMultiplier('ash', 'echo')).toBe(0.8);
    expect(elementMultiplier('echo', 'frost')).toBe(1);
  });
});
