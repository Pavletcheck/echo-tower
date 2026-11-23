import { useEffect, useState } from 'preact/hooks';
import { asset } from '../../core/asset';
import { playSfx } from '../../core/audio';
import { locale$, t } from '../../core/i18n';
import { formatNumber } from '../../core/time';
import { navigate } from '../../core/router';
import { CALENDAR_DAYS, CALENDAR_REWARDS, GLASS_RAIN, PASS_LEVELS, PASS_MAX_LEVEL, PASS_XP_PER_LEVEL } from '../../data/live';
import { calendarClaimedToday, calendarNextDay, claimCalendar } from '../../game/calendar';
import { buyEventItem, eventBattleCleared, eventBattleUnlocked, eventShopClaimed, fightEventBattle, isEventActive } from '../../game/event';
import { claimAllPass, claimPass, ensurePass, passClaimed, passLevel } from '../../game/pass';
import { ensureMail } from '../../game/mail';
import { commit, save$ } from '../../game/state';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import { rewardLines } from '../reward';
import { liveTab$, type LiveTab } from '../nav';
import s from './Live.module.css';

const TABS: ReadonlyArray<{ id: LiveTab; label: string }> = [
  { id: 'calendar', label: 'live.tab.calendar' },
  { id: 'pass', label: 'live.tab.pass' },
  { id: 'event', label: 'live.tab.event' },
];

export function Live() {
  const [tab, setTab] = useState<LiveTab>(liveTab$.value);
  const save = save$.value;

  useEffect(() => {
    commit((draft) => {
      ensurePass(draft);
      ensureMail(draft);
    }, 'live-ensure');
  }, []);

  const chooseTab = (next: LiveTab) => {
    setTab(next);
    liveTab$.value = next;
  };

  const claimCalendarDay = () => {
    let result: ReturnType<typeof claimCalendar> | undefined;
    commit((draft) => {
      result = claimCalendar(draft);
    }, 'calendar-claim');
    if (result) {
      playSfx('coin');
      toast(t('live.calendar.claimed', { day: result.day }), 'success');
    } else {
      toast(t('live.calendar.already'), 'error');
    }
  };

  const claimPassBranch = (branch: 'free' | 'premium') => {
    let count = 0;
    commit((draft) => {
      count = claimAllPass(draft, branch);
    }, 'pass-claim');
    toast(count > 0 ? t('live.pass.claimed', { n: count }) : t('live.pass.nothing'), count > 0 ? 'success' : 'error');
  };

  const fightEvent = (index: number) => {
    let report: ReturnType<typeof fightEventBattle> | undefined;
    commit((draft) => {
      report = fightEventBattle(draft, index, Date.now());
    }, 'event-battle');
    if (!report) {
      toast(t('live.event.locked'), 'error');
      return;
    }
    if (!report.reward) {
      toast(t('live.event.lost'), 'error');
      return;
    }
    playSfx('coin');
    toast(t('live.event.won', { glass: report.reward.glass ?? 0 }), 'success');
  };

  const buyShop = (id: string) => {
    let report: ReturnType<typeof buyEventItem> | undefined;
    commit((draft) => {
      report = buyEventItem(draft, id);
    }, 'event-buy');
    toast(report ? t('live.event.bought') : t('live.event.noGlass'), report ? 'success' : 'error');
  };

  const day = calendarNextDay(save);
  const canCalendar = !calendarClaimedToday(save);
  const level = passLevel(save);
  const passXp = save.live.pass.xp;
  const passProgress = level >= PASS_MAX_LEVEL ? 1 : (passXp % PASS_XP_PER_LEVEL) / PASS_XP_PER_LEVEL;
  const eventActive = isEventActive();

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/archive.webp')})` }} />
      <div class={s.scrim} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('lobby')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.heading}>
          <span class={s.title}>{t('live.title')}</span>
          <span class={s.sub}>{t(`live.tab.${tab}`)}</span>
        </div>
      </header>

      <div class={s.tabs}>
        {TABS.map((item) => (
          <button
            key={item.id}
            class={`${s.tab}${tab === item.id ? ` ${s.tabActive}` : ''}`}
            onClick={() => chooseTab(item.id)}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      <div class={s.scroll}>
        {tab === 'calendar' ? (
          <>
            <div class={s.headRow}>
              <span>{t('live.calendar.title')}</span>
              <span class={s.gold}>{t('live.calendar.day', { n: Math.min(CALENDAR_DAYS, day) })}</span>
            </div>
            <p class={s.desc}>{t('live.calendar.desc')}</p>
            <div class={s.calendarGrid}>
              {CALENDAR_REWARDS.map((reward, index) => {
                const dayNumber = index + 1;
                const claimed = save.live.calendar.claimedDays.includes(dayNumber);
                const current = dayNumber === day && canCalendar;
                return (
                  <div
                    key={dayNumber}
                    class={`${s.calendarCell}${claimed ? ` ${s.calendarDone}` : ''}${current ? ` ${s.calendarCurrent}` : ''}`}
                  >
                    <b>{dayNumber}</b>
                    <span>{rewardLines(reward).join(' · ')}</span>
                  </div>
                );
              })}
            </div>
            <button class="btn btn--primary btn--wide" disabled={!canCalendar} onClick={claimCalendarDay}>
              {canCalendar ? t('live.calendar.claim') : t('live.calendar.already')}
            </button>
          </>
        ) : null}

        {tab === 'pass' ? (
          <>
            <div class={s.headRow}>
              <span>{t('live.pass.title')}</span>
              <span class={s.gold}>{t('live.pass.level', { n: level, max: PASS_MAX_LEVEL })}</span>
            </div>
            <p class={s.desc}>{t('live.pass.desc')}</p>
            <div class={s.bar}>
              <div class={s.fill} style={{ width: `${Math.round(passProgress * 100)}%` }} />
            </div>
            <div class={s.passActions}>
              <button class="btn btn--sm btn--gold" onClick={() => claimPassBranch('free')}>
                {t('live.pass.claimFree')}
              </button>
              <button
                class="btn btn--sm btn--ghost"
                disabled={!save.flags.pass}
                onClick={() => claimPassBranch('premium')}
              >
                {save.flags.pass ? t('live.pass.claimPremium') : t('live.pass.premiumLocked')}
              </button>
            </div>
            <div class={s.passList}>
              {PASS_LEVELS.map((entry) => {
                const reached = entry.level <= level;
                const freeClaimed = passClaimed(save, entry.level, 'free');
                const paidClaimed = passClaimed(save, entry.level, 'premium');
                return (
                  <div key={entry.level} class={`${s.passRow}${reached ? ` ${s.passReached}` : ''}`}>
                    <span class={s.passLevel}>{entry.level}</span>
                    <div class={s.passReward}>
                      <span>{rewardLines(entry.free).join(' · ')}</span>
                      <span class={s.premium}>{rewardLines(entry.premium).join(' · ')}</span>
                    </div>
                    <div class={s.passButtons}>
                      <button
                        class="btn btn--sm btn--ghost"
                        disabled={!reached || freeClaimed}
                        onClick={() => {
                          let reward: ReturnType<typeof claimPass> | undefined;
                          commit((draft) => {
                            reward = claimPass(draft, entry.level, 'free');
                          }, 'pass-claim-one');
                          if (reward) toast(t('live.pass.claimed', { n: 1 }), 'success');
                        }}
                      >
                        {freeClaimed ? t('shop.owned') : t('quests.claim')}
                      </button>
                      <button
                        class="btn btn--sm btn--ghost"
                        disabled={!reached || paidClaimed || !save.flags.pass}
                        onClick={() => {
                          let reward: ReturnType<typeof claimPass> | undefined;
                          commit((draft) => {
                            reward = claimPass(draft, entry.level, 'premium');
                          }, 'pass-claim-one');
                          if (reward) toast(t('live.pass.claimed', { n: 1 }), 'success');
                        }}
                      >
                        {paidClaimed ? t('shop.owned') : t('live.pass.premium')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        {tab === 'event' ? (
          <>
            <div class={s.headRow}>
              <span>{t('live.event.title')}</span>
              <span class={s.gold}>{t('event.glassValue', { n: formatNumber(save.live.event.currency, locale$.value) })}</span>
            </div>
            <p class={s.desc}>
              {locale$.value === 'ru' ? GLASS_RAIN.descRu : GLASS_RAIN.descEn}
            </p>
            <p class={s.note}>{eventActive ? t('live.event.active') : t('live.event.ended')}</p>

            <div class={s.rows}>
              {GLASS_RAIN.battles.map((battle) => {
                const cleared = eventBattleCleared(save, battle.index);
                const unlocked = eventBattleUnlocked(save, battle.index);
                return (
                  <div key={battle.index} class={s.row}>
                    <div class={s.rowInfo}>
                      <b>{t(battle.titleKey)}</b>
                      <span>{t(battle.bodyKey)}</span>
                      <span class={s.reward}>+{battle.glass} {t('event.glass')}</span>
                    </div>
                    <button
                      class="btn btn--sm"
                      disabled={!eventActive || cleared || !unlocked}
                      onClick={() => fightEvent(battle.index)}
                    >
                      {cleared ? t('endgame.done') : unlocked ? t('endgame.fight') : t('endgame.locked')}
                    </button>
                  </div>
                );
              })}
            </div>

            <div class={s.headRow}>{t('live.event.shop')}</div>
            <div class={s.rows}>
              {GLASS_RAIN.shop.map((item) => {
                const claimed = eventShopClaimed(save, item.id);
                return (
                  <div key={item.id} class={s.row}>
                    <div class={s.rowInfo}>
                      <b>{locale$.value === 'ru' ? item.nameRu : item.nameEn}</b>
                      <span>{rewardLines(item.reward).join(' · ')}</span>
                      <span class={s.reward}>{t('event.price', { n: item.price })}</span>
                    </div>
                    <button
                      class="btn btn--sm btn--gold"
                      disabled={!eventActive || claimed || save.live.event.currency < item.price}
                      onClick={() => buyShop(item.id)}
                    >
                      {claimed ? t('shop.owned') : t('shop.buy')}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
