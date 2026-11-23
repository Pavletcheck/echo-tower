import { describe, expect, it } from 'vitest';
import { FTUE_STEP_COUNT } from '../data/ftue';
import { defaultSave, migrate } from './save';
import {
  advanceFtue,
  advanceFtueFrom,
  claimFtueStart,
  completeFtue,
  ftueActive,
  ftueStatus,
  ftueStepDef,
  markNextPanelSeen,
  noteBattleResult,
  restartFtue,
  shouldShowNextPanel,
  skipFtue,
} from './ftue';

describe('ftue', () => {
  it('starts on the squad step for a fresh save', () => {
    const save = defaultSave();
    expect(ftueActive(save)).toBe(true);
    expect(ftueStatus(save)).toBe('active');
    expect(ftueStepDef(save)?.id).toBe('squad');
    expect(claimFtueStart(save)).toBe(true);
    expect(claimFtueStart(save)).toBe(false);
  });

  it('walks all tutorial steps in order and completes once', () => {
    const save = defaultSave();
    const seen: string[] = [];

    for (let index = 0; index < FTUE_STEP_COUNT; index += 1) {
      const step = ftueStepDef(save);
      expect(step).not.toBeNull();
      if (step) seen.push(step.id);
      expect(advanceFtue(save)).toBe(index);
    }

    expect(seen).toEqual(['squad', 'battle', 'result']);
    expect(save.ftue.completed).toBe(true);
    expect(save.ftue.step).toBe(FTUE_STEP_COUNT);
    expect(save.ftue.skipped).toBe(false);
    expect(ftueStatus(save)).toBe('completed');
    expect(advanceFtue(save)).toBeNull();
    expect(completeFtue(save)).toBe(false);
  });

  it('advances only from the expected step', () => {
    const save = defaultSave();
    expect(advanceFtueFrom(save, 2)).toBe(false);
    expect(save.ftue.step).toBe(0);
    expect(advanceFtueFrom(save, 0)).toBe(true);
    expect(save.ftue.step).toBe(1);
  });

  it('can be skipped and reopened from settings', () => {
    const save = defaultSave();
    save.ftue.step = 2;

    expect(skipFtue(save)).toBe(true);
    expect(ftueStatus(save)).toBe('skipped');
    expect(ftueActive(save)).toBe(false);
    expect(skipFtue(save)).toBe(false);

    restartFtue(save);
    expect(ftueActive(save)).toBe(true);
    expect(ftueStatus(save)).toBe('active');
    expect(save.ftue.step).toBe(0);
    expect(save.ftue.restarts).toBe(1);
    expect(save.ftue.startTracked).toBe(false);
    expect(claimFtueStart(save)).toBe(true);
  });

  it('shows the next-steps panel once after the first win and once after the first loss', () => {
    const save = defaultSave();
    expect(shouldShowNextPanel(save)).toBe(false);

    noteBattleResult(save, 'win');
    expect(shouldShowNextPanel(save)).toBe(true);
    markNextPanelSeen(save);
    expect(shouldShowNextPanel(save)).toBe(false);

    noteBattleResult(save, 'lose');
    expect(shouldShowNextPanel(save)).toBe(true);
    markNextPanelSeen(save);
    expect(shouldShowNextPanel(save)).toBe(false);
  });

  it('marks legacy saves as already trained after migration', () => {
    const save = migrate({ currencies: { gold: 1 }, tower: { maxFloor: 7 } });
    expect(ftueActive(save)).toBe(false);
    expect(ftueStatus(save)).toBe('skipped');
    expect(shouldShowNextPanel(save)).toBe(false);
  });

  it('treats a skipped flag as completed even without the completed field', () => {
    const save = migrate({ ftue: { skipped: true, step: 2 } });
    expect(ftueActive(save)).toBe(false);
    expect(ftueStatus(save)).toBe('skipped');
  });
});
