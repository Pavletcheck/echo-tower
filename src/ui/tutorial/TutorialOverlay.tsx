import { useEffect } from 'preact/hooks';
import { track } from '../../analytics/events';
import { t } from '../../core/i18n';
import { navigate, screen$ } from '../../core/router';
import { FTUE_STEPS } from '../../data/ftue';
import {
  advanceFtue,
  claimFtueStart,
  completeFtue,
  ftueActive,
  ftueStepDef,
  skipFtue,
} from '../../game/ftue';
import { commit, save$ } from '../../game/state';
import { battleFloor$, openHero, summonBanner$ } from '../nav';
import { GuideAvatar } from '../components/GuideBubble';
import { guideName } from '../../data/guide';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import s from './TutorialOverlay.module.css';

export function TutorialOverlay() {
  const save = save$.value;
  const step = ftueStepDef(save);

  useEffect(() => {
    if (!ftueActive(save$.value) || save$.value.ftue.startTracked) return;
    let tracked = false;
    commit((draft) => {
      tracked = claimFtueStart(draft);
    }, 'ftue-start');
    if (tracked) track('ftue_start', { restarts: save$.value.ftue.restarts });
  }, [save.ftue.restarts]);

  useEffect(() => {
    if (!step) return;
    const target = document.querySelector(`[data-ftue="${step.target}"]`);
    if (!(target instanceof HTMLElement)) return;
    target.classList.add('ftue-target');
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return () => target.classList.remove('ftue-target');
  }, [step?.id, screen$.value]);

  if (!step) return null;
  // На титуле и загрузке подсказки не мешают первому тапу.
  if (screen$.value === 'boot' || screen$.value === 'title') return null;
  // Бой не перекрываем: итоговая панель сама показывает шаг «итог».
  if (screen$.value === 'battle') return null;

  const targetScreen =
    step.id === 'squad' ? 'squad' : step.id === 'summon' ? 'summon' : step.id === 'upgrade' ? 'hero' : 'battle';
  const compact = screen$.value !== 'lobby' && screen$.value !== targetScreen;

  if (compact) {
    return (
      <button class={s.chip} onClick={() => navigate(targetScreen)} aria-label={t('tutorial.title')}>
        <span class={s.chipDot} />
        {t(step.titleKey)}
        <span class={s.chipArrow}>→</span>
      </button>
    );
  }

  const finish = (): void => {
    let changed = false;
    commit((draft) => {
      changed = completeFtue(draft);
    }, 'ftue-complete');
    if (changed) {
      track('ftue_complete', { step: step.id });
      toast(t('tutorial.complete'), 'success');
    }
  };

  const skip = (): void => {
    let changed = false;
    commit((draft) => {
      changed = skipFtue(draft);
    }, 'ftue-skip');
    if (changed) {
      track('ftue_skip', { step: step.id });
      toast(t('tutorial.skipped'), 'success');
    }
  };

  const next = (): void => {
    const from = step.id;

    if (from === 'summon') {
      finish();
      navigate('lobby');
      return;
    }

    let advanced = false;
    commit((draft) => {
      advanced = advanceFtue(draft) !== null;
    }, 'ftue-step');
    if (!advanced) return;

    const nextIndex = Math.min(FTUE_STEPS.length, save$.value.ftue.step);
    const to = FTUE_STEPS[nextIndex]?.id ?? 'done';
    track('ftue_step', { from, to });

    if (from === 'squad') navigate('squad');
    else if (from === 'battle') {
      battleFloor$.value = save$.value.tower.maxFloor;
      navigate('battle');
    } else if (from === 'result') {
      const heroId = save$.value.squad.find((id) => Boolean(save$.value.heroes[id]));
      if (heroId) openHero(heroId);
      else navigate('heroes');
    } else if (from === 'upgrade') {
      summonBanner$.value = 'beginner';
      navigate('summon');
    }
  };

  return (
    <div class={s.root}>
      <div class={s.card} role="dialog" aria-label={t('tutorial.title')}>
        <div class={s.head}>
          <span class={s.guideRow}>
            <GuideAvatar size={30} />
            <span class={s.kicker}>
              {guideName(save.player.locale)} · {t('tutorial.step', { n: save.ftue.step + 1, total: FTUE_STEPS.length })}
            </span>
          </span>
          <button class={s.skip} onClick={skip}>
            {t('tutorial.skip')}
          </button>
        </div>

        <div class={s.title}>{t(step.titleKey)}</div>
        <p class={s.body}>{t(step.bodyKey)}</p>

        <div class={s.dots} aria-hidden="true">
          {FTUE_STEPS.map((item, index) => (
            <span key={item.id} class={`${s.dot}${index <= save.ftue.step ? ` ${s.dotOn}` : ''}`} />
          ))}
        </div>

        <button class="btn btn--primary btn--wide" onClick={next}>
          {t(step.actionKey)}
          <Icon name="play" size={16} />
        </button>
      </div>
    </div>
  );
}
