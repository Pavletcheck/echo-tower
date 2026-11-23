import { describe, expect, it } from 'vitest';
import { HEROES_BY_ID } from '../data/heroes';
import { defaultSave, type SaveV1 } from './save';
import { heroSave } from './gacha';
import { recommendedSquad, squadAdvice } from './recommended';
import { nextSteps } from './next-steps';

function addHero(save: SaveV1, id: string): void {
  const hero = HEROES_BY_ID[id];
  if (hero) save.heroes[id] = heroSave(hero);
}

describe('recommended squad', () => {
  it('returns five owned heroes with a tank and a healer', () => {
    const save = defaultSave();
    const squad = recommendedSquad(save);

    expect(squad).toHaveLength(5);
    expect(new Set(squad).size).toBe(5);
    expect(squad.every((id) => Boolean(save.heroes[id]))).toBe(true);

    const roles = squad.map((id) => HEROES_BY_ID[id]?.role);
    expect(roles).toContain('vanguard');
    expect(roles.some((role) => role === 'oracle' || role === 'support')).toBe(true);
  });

  it('is deterministic and never includes locked heroes', () => {
    const save = defaultSave();
    delete save.heroes.grom;
    delete save.heroes.lissa;

    const first = recommendedSquad(save);
    const second = recommendedSquad(save);
    expect(first).toEqual(second);
    expect(first).not.toContain('grom');
    expect(first).not.toContain('lissa');
    expect(first.every((id) => Boolean(save.heroes[id]))).toBe(true);
  });

  it('describes element and role coverage', () => {
    const save = defaultSave();
    const advice = squadAdvice(save);
    expect(advice.size).toBe(5);
    expect(advice.hasTank).toBe(true);
    expect(advice.hasHealer).toBe(true);
    expect(advice.dominantElement).toBe('echo');
    expect(advice.dominantCount).toBe(2);
    expect(advice.bonus).toBe(5);

    addHero(save, 'briz');
    addHero(save, 'tess');
    save.squad = ['zip', 'briz', 'tess', 'neya', 'grom'];
    const echoAdvice = squadAdvice(save);
    expect(echoAdvice.dominantElement).toBe('echo');
    expect(echoAdvice.dominantCount).toBe(3);
    expect(echoAdvice.bonus).toBe(10);
    expect(echoAdvice.hasTank).toBe(false);
  });
});

describe('next steps', () => {
  it('points a fresh player to the free ten, squad and battle', () => {
    const save = defaultSave();
    const ids = nextSteps(save).map((step) => step.id);
    expect(ids).toContain('free-ten');
    expect(ids).toContain('battle');
    expect(ids).toContain('upgrade');
    expect(nextSteps(save).length).toBeLessThanOrEqual(4);
  });

  it('starts recommending the squad when slots are empty', () => {
    const save = defaultSave();
    save.squad = ['thorn', '', '', '', ''];
    expect(nextSteps(save).map((step) => step.id)).toContain('squad');
  });

  it('suggests roles when the squad is full but lacks a tank', () => {
    const save = defaultSave();
    addHero(save, 'briz');
    save.squad = ['neya', 'grom', 'lissa', 'zip', 'briz'];
    expect(nextSteps(save).map((step) => step.id)).toContain('roles');
  });

  it('drops the free ten and upgrade steps when they are not useful', () => {
    const save = defaultSave();
    save.gacha.beginnerUsed = true;
    save.tower.maxFloor = 100;
    for (const id of save.squad) {
      const hero = save.heroes[id];
      if (hero) {
        hero.star = 1;
        hero.level = 15;
      }
    }
    save.starter.claimedDays = [1, 2, 3, 4, 5, 6, 7];

    const ids = nextSteps(save).map((step) => step.id);
    expect(ids).not.toContain('free-ten');
    expect(ids).not.toContain('upgrade');
    expect(ids).toContain('battle');
  });
});
