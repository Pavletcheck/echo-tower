import { asset } from '../../core/asset';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { ACHIEVEMENTS } from '../../data/quests';
import type { QuestDef } from '../../data/types';
import { claimQuest, isQuestClaimed, questProgress } from '../../game/quests';
import { commit, save$ } from '../../game/state';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import { rewardLines } from '../reward';
import s from './Quests.module.css';

export function Achievements() {
  const save = save$.value;
  const claimable = ACHIEVEMENTS.filter(
    (quest) => questProgress(save, quest) >= quest.target && !isQuestClaimed(save, quest),
  ).length;

  const claim = (quest: QuestDef) => {
    let reward = null as ReturnType<typeof claimQuest>;
    commit((draft) => {
      reward = claimQuest(draft, quest);
    }, 'achievement-claim');
    if (reward) toast(rewardLines(reward).join(' · '), 'success');
  };

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/archive.webp')})` }} />
      <div class={s.scrim} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('lobby')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.heading}>
          <span class={s.title}>{t('achievements.title')}</span>
          <span class={s.sub}>{t('quests.claimable', { n: claimable })}</span>
        </div>
      </header>

      <div class={s.scroll}>
        {ACHIEVEMENTS.map((quest) => {
          const progress = Math.min(quest.target, questProgress(save, quest));
          const claimed = isQuestClaimed(save, quest);
          const complete = progress >= quest.target;
          return (
            <div key={quest.id} class={`${s.card}${complete && !claimed ? ` ${s.cardReady}` : ''}`}>
              <div class={s.cardHead}>
                <span class={s.cardTitle}>{locale$.value === 'ru' ? quest.titleRu : quest.titleEn}</span>
                <span class={s.counter}>{t('quests.progress', { n: progress, m: quest.target })}</span>
              </div>
              <div class={s.bar}>
                <div class={s.fill} style={{ width: `${Math.round((progress / quest.target) * 100)}%` }} />
              </div>
              <div class={s.cardFoot}>
                <span class={s.reward}>{rewardLines(quest.reward).join(' · ')}</span>
                <button
                  class={`btn btn--sm ${complete && !claimed ? 'btn--gold' : 'btn--ghost'}`}
                  disabled={!complete || claimed}
                  onClick={() => claim(quest)}
                >
                  {claimed ? t('quests.claimed') : t('quests.claim')}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
