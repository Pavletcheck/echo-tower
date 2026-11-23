/** Сценарий первого часа: пять шагов обучения. Тексты — только в i18n. */

export type FtueStepId = 'squad' | 'battle' | 'result' | 'upgrade' | 'summon';

export interface FtueStepDef {
  id: FtueStepId;
  titleKey: string;
  bodyKey: string;
  actionKey: string;
  /** Значение атрибута data-ftue у подсвечиваемого элемента. */
  target: string;
}

export const FTUE_STEPS: readonly FtueStepDef[] = [
  {
    id: 'squad',
    titleKey: 'tutorial.squad.title',
    bodyKey: 'tutorial.squad.body',
    actionKey: 'tutorial.squad.action',
    target: 'squad',
  },
  {
    id: 'battle',
    titleKey: 'tutorial.battle.title',
    bodyKey: 'tutorial.battle.body',
    actionKey: 'tutorial.battle.action',
    target: 'battle',
  },
  {
    id: 'result',
    titleKey: 'tutorial.result.title',
    bodyKey: 'tutorial.result.body',
    actionKey: 'tutorial.result.action',
    target: 'battle-result',
  },
];

export const FTUE_STEP_COUNT = FTUE_STEPS.length;
