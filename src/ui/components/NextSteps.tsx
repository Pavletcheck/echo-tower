import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { heroName } from '../../data/heroes';
import { markNextPanelSeen } from '../../game/ftue';
import { nextSteps, type NextStep } from '../../game/next-steps';
import { commit, save$ } from '../../game/state';
import { Modal } from './Modal';
import { battleFloor$, openHero, summonBanner$ } from '../nav';
import s from './NextSteps.module.css';

export interface NextStepsProps {
  /** Показывать заголовок панели после первого боя/поражения. */
  reason?: 'win' | 'lose' | null;
  onClose: () => void;
}

export function nextStepParams(step: NextStep): Record<string, string | number> {
  if (step.id === 'battle') return { n: step.floor ?? save$.value.tower.maxFloor };
  if (step.id === 'upgrade' && step.heroId) return { name: heroName(step.heroId, locale$.value) };
  return {};
}

export function NextSteps({ reason = null, onClose }: NextStepsProps) {
  const steps = nextSteps(save$.value);
  const title = reason === 'win' ? t('next.panel.win') : reason === 'lose' ? t('next.panel.loss') : t('next.title');

  const close = (): void => {
    if (reason) {
      commit((draft) => {
        markNextPanelSeen(draft);
      }, 'next-panel-seen');
    }
    onClose();
  };

  const open = (step: NextStep): void => {
    close();

    switch (step.id) {
      case 'free-ten':
        summonBanner$.value = 'beginner';
        navigate('summon');
        return;
      case 'starter':
        navigate('starter');
        return;
      case 'reassemble':
        navigate('heroes');
        return;
      case 'squad':
      case 'roles':
        navigate('squad');
        return;
      case 'upgrade':
        if (step.heroId) openHero(step.heroId);
        else navigate('heroes');
        return;
      case 'battle':
        battleFloor$.value = step.floor ?? save$.value.tower.maxFloor;
        navigate('battle');
        return;
      default:
        navigate('lobby');
    }
  };

  return (
    <Modal title={title} onClose={close}>
      {reason ? (
        <p class="muted">{reason === 'win' ? t('next.panel.winBody') : t('next.panel.lossBody')}</p>
      ) : null}

      <div class={s.list}>
        {steps.map((step) => (
          <div key={step.id} class={s.row}>
            <div class={s.info}>
              <b>{t(`next.${step.id}.title`, nextStepParams(step))}</b>
              <span>{t(`next.${step.id}.hint`, nextStepParams(step))}</span>
            </div>
            <button class="btn btn--sm btn--gold" onClick={() => open(step)}>
              {step.id === 'battle' ? t('next.action.battle') : t('next.action.go')}
            </button>
          </div>
        ))}
      </div>

      {steps.length === 0 ? <p class="muted">{t('next.close')}</p> : null}

      <button class="btn btn--wide" onClick={close}>
        {t('next.close')}
      </button>
    </Modal>
  );
}
