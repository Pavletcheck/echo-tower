import { useState } from 'preact/hooks';
import { asset } from '../../core/asset';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import type { QuestDef, QuestReward, QuestType } from '../../data/types';
import { claimQuest, isQuestClaimed, questProgress, questsOfType } from '../../game/quests';
import { commit, save$ } from '../../game/state';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import { rewardLines } from '../reward';
import s from './Quests.module.css';

const TABS: ReadonlyArray<{ id: QuestType; label: string }> = [
  { id: 'daily', label: 'quests.tab.daily' },
  { id: 'weekly', label: 'quests.tab.weekly' },
  { id: 'achievement', label: 'quests.tab.achievements' },
];

export function Quests() {
  const [tab, setTab] = useState<QuestType>('daily');
  const save = save$.value;
  const quests = questsOfType(tab);
  const claimable = quests.filter((quest) => questProgress(save, quest) >= quest.target && !isQuestClaimed(save, quest)).length;

  const claim = (quest: QuestDef) => {
    let reward: QuestReward | null = null;
    commit((draft) => {
      reward = claimQuest(draft, quest);
    }, 'quest-claim');
    if (reward) {
      const lines = rewardLines(reward);
      toast(lines.join(' · '), 'success');
    }
  };

  const claimAll = () => {
    let claimed = 0;
    commit((draft) => {
      for (const quest of quests) {
        if (questProgress(draft, quest) >= quest.target && !isQuestClaimed(draft, quest)) {
          if (claimQuest(draft, quest)) claimed += 1;
        }
      }
    }, 'quest-claim-all');
    if (claimed > 0) toast(t('quests.claimAllDone', { n: claimed }), 'success');
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
          <span class={s.title}>{t('quests.title')}</span>
          <span class={s.sub}>{t('quests.claimable', { n: claimable })}</span>
        </div>
        {claimable > 0 ? (
          <button class="btn btn--sm btn--gold" onClick={claimAll}>
            {t('quests.claimAll')} · {claimable}
          </button>
        ) : null}
      </header>

      <div class={s.tabs}>
        {TABS.map((item) => (
          <button
            key={item.id}
            class={`${s.tab}${tab === item.id ? ` ${s.tabActive}` : ''}`}
            onClick={() => setTab(item.id)}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      <div class={s.scroll}>
        {quests.map((quest) => {
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
        {quests.length === 0 ? <p class={s.empty}>{t('quests.empty')}</p> : null}
      </div>
    </div>
  );
}
