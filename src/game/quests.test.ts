import { describe, expect, it } from 'vitest';
import { QUESTS_BY_ID } from '../data/quests';
import { defaultSave } from './save';
import {
  canClaim,
  claimQuest,
  ensureQuestCycles,
  isQuestClaimed,
  questProgress,
  trackQuest,
} from './quests';

const daily = QUESTS_BY_ID.q01!;
const weekly = QUESTS_BY_ID.q21!;
const achievement = QUESTS_BY_ID.q38!;

describe('quests', () => {
  it('tracks progress across daily, weekly and lifetime', () => {
    const save = defaultSave();
    trackQuest(save, 'floors', 4);
    expect(questProgress(save, daily)).toBe(4);
    expect(questProgress(save, weekly)).toBe(4);
    expect(questProgress(save, achievement)).toBe(4);
  });

  it('resets daily and weekly cycles but keeps lifetime', () => {
    const save = defaultSave();
    ensureQuestCycles(save, new Date(2024, 0, 10));
    trackQuest(save, 'floors', 3);

    ensureQuestCycles(save, new Date(2024, 0, 11));
    expect(questProgress(save, daily)).toBe(0);
    expect(questProgress(save, achievement)).toBe(3);

    ensureQuestCycles(save, new Date(2024, 0, 18));
    expect(questProgress(save, weekly)).toBe(0);
    expect(questProgress(save, achievement)).toBe(3);
  });

  it('claims only completed quests once', () => {
    const save = defaultSave();
    trackQuest(save, 'floors', 3);
    expect(canClaim(save, daily)).toBe(true);

    const before = save.currencies.crystals;
    const reward = claimQuest(save, daily);
    expect(reward?.crystals).toBe(40);
    expect(save.currencies.crystals).toBe(before + 40);
    expect(isQuestClaimed(save, daily)).toBe(true);
    expect(claimQuest(save, daily)).toBeNull();
  });

  it('does not claim incomplete quests', () => {
    const save = defaultSave();
    trackQuest(save, 'floors', 1);
    expect(canClaim(save, daily)).toBe(false);
    expect(claimQuest(save, daily)).toBeNull();
  });

  it('grants item rewards into the inventory', () => {
    const save = defaultSave();
    trackQuest(save, 'floors', 100);
    const reward = claimQuest(save, achievement);
    expect(reward).not.toBeNull();
    expect(save.flags.title_summit).toBe(true);
  });
});

