import { now } from '../core/time';
import { FTUE_STEPS, FTUE_STEP_COUNT, type FtueStepDef } from '../data/ftue';
import type { SaveV1 } from './save';

/** Активное обучение: не завершено и не пропущено. */
export function ftueActive(save: SaveV1): boolean {
  return !save.ftue.completed && save.ftue.step < FTUE_STEP_COUNT;
}

export function ftueStepDef(save: SaveV1): FtueStepDef | null {
  if (!ftueActive(save)) return null;
  return FTUE_STEPS[save.ftue.step] ?? null;
}

/** Возвращает предыдущий шаг, если обучение действительно сдвинулось. */
export function advanceFtue(save: SaveV1, at = now()): number | null {
  if (!ftueActive(save)) return null;
  const previous = save.ftue.step;
  save.ftue.step = Math.min(FTUE_STEP_COUNT, previous + 1);
  if (save.ftue.step >= FTUE_STEP_COUNT) {
    save.ftue.completed = true;
    save.ftue.completedAt = at;
  }
  return previous;
}

/** Сдвигает обучение только если игрок всё ещё на ожидаемом шаге. */
export function advanceFtueFrom(save: SaveV1, expected: number, at = now()): boolean {
  if (!ftueActive(save) || save.ftue.step !== expected) return false;
  advanceFtue(save, at);
  return true;
}

export function completeFtue(save: SaveV1, at = now()): boolean {
  if (save.ftue.completed) return false;
  save.ftue.step = FTUE_STEP_COUNT;
  save.ftue.completed = true;
  save.ftue.completedAt = at;
  return true;
}

export function skipFtue(save: SaveV1, at = now()): boolean {
  if (save.ftue.completed) return false;
  save.ftue.step = FTUE_STEP_COUNT;
  save.ftue.completed = true;
  save.ftue.skipped = true;
  save.ftue.completedAt = at;
  return true;
}

/** Повторное открытие из настроек: шаги начинаются заново, награды не трогаем. */
export function restartFtue(save: SaveV1, at = now()): void {
  save.ftue.step = 0;
  save.ftue.completed = false;
  save.ftue.skipped = false;
  save.ftue.startedAt = at;
  save.ftue.completedAt = 0;
  save.ftue.startTracked = false;
  save.ftue.restarts += 1;
}

export function noteBattleResult(save: SaveV1, outcome: 'win' | 'lose'): void {
  if (outcome === 'win') save.ftue.firstWin = true;
  else save.ftue.firstLoss = true;
}

/** Панель «Что делать дальше» показывается один раз после первой победы и поражения. */
export function shouldShowNextPanel(save: SaveV1): boolean {
  return (
    (save.ftue.firstWin && !save.ftue.winPanelSeen) ||
    (save.ftue.firstLoss && !save.ftue.lossPanelSeen)
  );
}

export function markNextPanelSeen(save: SaveV1): void {
  if (save.ftue.firstWin) save.ftue.winPanelSeen = true;
  if (save.ftue.firstLoss) save.ftue.lossPanelSeen = true;
}

/** Первый показ обучения в этой жизни сейва: нужно для события ftue_start. */
export function claimFtueStart(save: SaveV1): boolean {
  if (save.ftue.startTracked || !ftueActive(save)) return false;
  save.ftue.startTracked = true;
  return true;
}

export function ftueStatus(save: SaveV1): 'active' | 'skipped' | 'completed' {
  if (ftueActive(save)) return 'active';
  return save.ftue.skipped ? 'skipped' : 'completed';
}
