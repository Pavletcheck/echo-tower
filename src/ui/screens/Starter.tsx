import { t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { asset } from '../../core/asset';
import { STARTER_BY_ID, STARTER_MISSIONS, type StarterReward } from '../../data/starter';
import {
  canClaimStarter,
  claimStarter,
  isStarterClaimed,
  starterClaimableCount,
  starterClaimedCount,
  starterDay,
  starterMissionUnlocked,
  starterProgress,
} from '../../game/starter';
import { commit, save$ } from '../../game/state';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import { summonBanner$ } from '../nav';
import { rewardLines } from '../reward';
import s from './Starter.module.css';

export function openBeginnerSummon(): void {
  summonBanner$.value = 'beginner';
  navigate('summon');
}

export function Starter() {
  const save = save$.value;
  const day = starterDay(save);
  const claimable = starterClaimableCount(save);
  const claimed = starterClaimedCount(save);
  const freeAvailable = !save.gacha.beginnerUsed;

  const claim = (missionId: string) => {
    const mission = STARTER_BY_ID[missionId];
    if (!mission) return;
    let reward: StarterReward | null = null;
    commit((draft) => {
      reward = claimStarter(draft, mission);
    }, 'starter-claim');
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
          <span class={s.title}>{t('starter.title')}</span>
          <span class={s.sub}>{t('starter.subtitle')}</span>
        </div>
        <span class={s.dayChip}>{t('starter.day', { n: day })}</span>
      </header>

      <div class={s.scroll}>
        <div class={`${s.freeCard}${freeAvailable ? ` ${s.freeCardOn}` : ''}`}>
          <div class={s.freeInfo}>
            <span class={s.freeTitle}>{t('starter.freeTen.title')}</span>
            <span class={s.freeBody}>{freeAvailable ? t('starter.freeTen.body') : t('starter.freeTen.used')}</span>
            {freeAvailable ? <span class={s.freeNote}>{t('summon.oncePerSave')}</span> : null}
          </div>
          <button class="btn btn--gold btn--sm" disabled={!freeAvailable} onClick={openBeginnerSummon}>
            {freeAvailable ? t('starter.freeTen.action') : t('starter.claimed')}
          </button>
        </div>

        <div class={s.sectionHead}>
          <span>{t('starter.missions')}</span>
          <span class={s.count}>
            {t('starter.done', { n: claimed })} · {t('starter.claimable', { n: claimable })}
          </span>
        </div>

        <div class={s.list}>
          {STARTER_MISSIONS.map((mission) => {
            const unlocked = starterMissionUnlocked(save, mission);
            const done = isStarterClaimed(save, mission);
            const progress = Math.min(mission.target, starterProgress(save, mission));
            const ready = canClaimStarter(save, mission);

            return (
              <div key={mission.id} class={`${s.card}${ready ? ` ${s.cardReady}` : ''}${done ? ` ${s.cardDone}` : ''}`}>
                <div class={s.cardHead}>
                  <span class={s.dayBadge}>{t('starter.day', { n: mission.day })}</span>
                  <span class={s.badge}>
                    {done
                      ? t('starter.claimed')
                      : !unlocked
                        ? t('starter.locked', { n: mission.day })
                        : mission.day === day
                          ? t('starter.dayToday')
                          : t('starter.progress', { n: progress, m: mission.target })}
                  </span>
                </div>

                <span class={s.cardTitle}>{t(mission.titleKey)}</span>
                <span class={s.cardBody}>{t(mission.bodyKey)}</span>

                <div class={s.bar}>
                  <div
                    class={s.fill}
                    style={{ width: `${Math.round((progress / mission.target) * 100)}%` }}
                  />
                </div>

                <div class={s.cardFoot}>
                  <span class={s.reward}>
                    {t('starter.reward')}: {rewardLines(mission.reward).join(' · ')}
                  </span>
                  <button class={`btn btn--sm ${ready ? 'btn--gold' : 'btn--ghost'}`} disabled={!ready} onClick={() => claim(mission.id)}>
                    {done ? t('starter.claimed') : t('starter.claim')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
