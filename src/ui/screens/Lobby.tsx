import { useEffect, useState } from 'preact/hooks';
import { track } from '../../analytics/events';
import { asset } from '../../core/asset';
import { playSfx } from '../../core/audio';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { formatDuration, formatNumber } from '../../core/time';
import type { BuildingId } from '../../data/base';
import { DINING_BUFFS, type DiningBuffDef } from '../../data/dining';
import {
  activeDiningBuff,
  canClaimDining,
  claimDining,
  diningGoldMultiplier,
  diningGoldRemaining,
  ensureDiningDay,
} from '../../game/dining';
import { claimIdle, idleCapHours, idleGold } from '../../game/idle';
import { buildingLevel, masterLevel } from '../../game/base';
import { mercenaryIsActive } from '../../game/mercenary';
import { calendarClaimedToday } from '../../game/calendar';
import { ensureEvent } from '../../game/event';
import { ensureMail, mailCount } from '../../game/mail';
import { ensurePass } from '../../game/pass';
import { nextSteps } from '../../game/next-steps';
import { claimableCount, ensureQuestCycles, trackQuest } from '../../game/quests';
import { platform } from '../../platform';
import { battleFloor$, liveTab$, openHero, summonBanner$ } from '../nav';
import { commit, crystals$, gold$, maxFloor$, offlineReport$, save$, teamPower } from '../../game/state';
import { squadSize } from '../../game/squad';
import type { OfflineReport } from '../../game/offline';
import { HexButton } from '../components/HexButton';
import { GuideAvatar, GuideBubble } from '../components/GuideBubble';
import { guideName, guideTitle } from '../../data/guide';
import { HeroAvatar } from '../components/HeroAvatar';
import { Icon, type IconName } from '../components/Icon';
import { ArtModal } from '../components/ArtModal';
import { Modal } from '../components/Modal';
import { NextSteps, nextStepParams } from '../components/NextSteps';
import { OfflineReportModal } from '../components/OfflineReportModal';
import { ResourcePill } from '../components/ResourcePill';
import { SettingsModal } from '../components/SettingsModal';
import { toast } from '../components/toast';
import s from './Lobby.module.css';

interface Building {
  key: string;
  labelKey: string;
  icon: IconName;
  left: string;
  top: string;
  screen?: 'squad' | 'heroes' | 'summon' | 'shop' | 'trials' | 'storage' | 'modes';
  art?: string;
  descKey?: string;
}

const BUILDINGS: readonly Building[] = [
  { key: 'altar', labelKey: 'buildings.altar', icon: 'altar', left: '50%', top: '31%', screen: 'summon', art: 'assets/buildings/altar.webp' },
  { key: 'barracks', labelKey: 'buildings.barracks', icon: 'shield', left: '13%', top: '44%', screen: 'storage', art: 'assets/buildings/barracks.webp' },
  { key: 'forge', labelKey: 'buildings.forge', icon: 'hammer', left: '87%', top: '44%', screen: 'shop', art: 'assets/buildings/forge.webp' },
  { key: 'dining', labelKey: 'buildings.dining', icon: 'bowl', left: '24%', top: '61%', descKey: 'buildings.dining.desc', art: 'assets/buildings/dining.webp' },
  { key: 'training', labelKey: 'buildings.training', icon: 'swords', left: '76%', top: '61%', screen: 'modes', art: 'assets/buildings/training.webp' },
  { key: 'archive', labelKey: 'buildings.archive', icon: 'book', left: '50%', top: '61%', screen: 'heroes', art: 'assets/buildings/archive.webp' },
];

const TABS: ReadonlyArray<{ key: string; labelKey: string; icon: IconName }> = [
  { key: 'tower', labelKey: 'tabs.tower', icon: 'altar' },
  { key: 'squad', labelKey: 'tabs.squad', icon: 'shield' },
  { key: 'summon', labelKey: 'tabs.summon', icon: 'crystal' },
  { key: 'modes', labelKey: 'tabs.modes', icon: 'swords' },
  { key: 'heroes', labelKey: 'tabs.heroes', icon: 'book' },
];

export function Lobby() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [artBuilding, setArtBuilding] = useState<Building | null>(null);
  const [diningOpen, setDiningOpen] = useState(false);
  const [nextOpen, setNextOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  // Ним больше не открывается сам: на первом лобби и без него четыре CTA.
  const [guideOpen, setGuideOpen] = useState(false);
  const [offline, setOffline] = useState<OfflineReport | null>(null);
  const [, setTick] = useState(0);
  const squad = save$.value.squad;
  const floor = maxFloor$.value;
  const idleAmount = idleGold(save$.value);
  const claimable = claimableCount(save$.value);
  const steps = nextSteps(save$.value);
  const firstStep = steps[0];
  const mailUnread = mailCount(save$.value);
  const calendarReady = !calendarClaimedToday(save$.value);
  const modesUnlocked = floor > 10;
  const ftue = save$.value.ftue;
  const nextReason =
    ftue.firstWin && !ftue.winPanelSeen ? 'win' : ftue.firstLoss && !ftue.lossPanelSeen ? 'lose' : null;

  useEffect(() => {
    const report = offlineReport$.value;
    if (report) {
      setOffline(report);
      offlineReport$.value = null;
    }
  }, []);

  useEffect(() => {
    commit((draft) => {
      ensureQuestCycles(draft);
      ensureDiningDay(draft);
      ensureMail(draft);
      ensurePass(draft);
      ensureEvent(draft);
      if ((draft.quests.daily.login ?? 0) === 0) trackQuest(draft, 'login', 1);
    }, 'daily-login');
  }, []);

  useEffect(() => {
    if (!save$.value.flags.saveRecovered) return;
    toast(t('save.recovered'), 'info');
    commit((draft) => {
      delete draft.flags.saveRecovered;
    }, 'save-recovered');
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const claim = (multiplier = 1) => {
    let amount = 0;
    const goldBuff = diningGoldMultiplier(save$.value);
    commit((draft) => {
      amount = claimIdle(draft, multiplier * goldBuff);
    }, 'idle-claim');
    if (amount > 0) {
      playSfx('coin');
      toast(`+${formatNumber(amount, locale$.value)}`, 'success');
    }
  };

  const doubleIdle = async () => {
    if (idleAmount < 1) return;
    const result = await platform().ads.rewarded('idle_double');
    if (result === 'rewarded') claim(2);
  };

  const activeMeal = activeDiningBuff(save$.value);
  const mealAvailable = canClaimDining(save$.value);
  const goldBuffLeft = diningGoldRemaining(save$.value);

  const runNextStep = () => {
    if (!firstStep) return;
    switch (firstStep.id) {
      case 'free-ten':
        summonBanner$.value = 'beginner';
        navigate('summon');
        break;
      case 'starter':
        navigate('starter');
        break;
      case 'squad':
      case 'roles':
        navigate('squad');
        break;
      case 'reassemble':
        navigate('heroes');
        break;
      case 'upgrade':
        if (firstStep.heroId) openHero(firstStep.heroId);
        else navigate('heroes');
        break;
      case 'battle':
      default:
        battleFloor$.value = firstStep.floor ?? save$.value.tower.maxFloor;
        navigate('battle');
        break;
    }
  };

  const chooseMeal = (buff: DiningBuffDef) => {
    let ok = false;
    commit((draft) => {
      ok = claimDining(draft, buff.id);
    }, 'dining');
    if (ok) {
      playSfx('coin');
      toast(t('dining.claimed'), 'success');
    }
  };

  const onBuilding = (building: Building) => {
    if (building.key === 'training' && !modesUnlocked) {
      toast(t('toast.afterFloor'));
      return;
    }
    track('building_click', { building: building.key });
    if (building.screen) {
      navigate(building.screen);
      return;
    }
    if (building.key === 'dining') {
      setDiningOpen(true);
      return;
    }
    setArtBuilding(building);
  };

  const onBattle = () => {
    track('battle_click', { floor });
    if (squadSize(save$.value) === 0) {
      toast(t('squad.emptyWarning'), 'error');
      navigate('squad');
      return;
    }
    navigate('tower');
  };

  const onTab = (tab: { key: string; labelKey: string }) => {
    if (tab.key === 'tower') {
      navigate('tower');
      return;
    }
    if (tab.key === 'squad') {
      navigate('squad');
      return;
    }
    if (tab.key === 'heroes') {
      navigate('heroes');
      return;
    }
    if (tab.key === 'summon') {
      navigate('summon');
      return;
    }
    if (tab.key === 'modes') {
      if (!modesUnlocked) {
        toast(t('toast.afterFloor'));
        return;
      }
      navigate('modes');
      return;
    }
    track('tab_click', { tab: tab.key });
    toast(t('toast.locked', { name: t(tab.labelKey), step: 5 }));
  };

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/lobby-tower.webp')})` }} />
      <div class={s.overlay} />

      <header class={s.top}>
        <div class={s.topRow}>
          <button class={s.master} onClick={() => setSettingsOpen(true)}>
            <span class={s.masterLevel}>{masterLevel(save$.value)}</span>
            <span class={s.masterMeta}>
              <span class={s.masterName}>{t('lobby.master')}</span>
              <span class={s.masterPower}>{t('lobby.masterRole')}</span>
            </span>
          </button>

          <button class={s.gear} onClick={() => setSettingsOpen(true)} aria-label={t('title.settings')}>
            <Icon name="gear" size={18} />
          </button>
        </div>

        <div class={s.resRow}>
          <ResourcePill
            kind="gold"
            value={gold$.value}
            title={t('resource.gold')}
            onClick={() => navigate('shop')}
          />
          <ResourcePill
            kind="crystal"
            value={crystals$.value}
            title={t('resource.crystals')}
            onClick={() => navigate('shop')}
          />

          <button
            class={s.idleChip}
            disabled={idleAmount < 1}
            onClick={() => claim(1)}
            title={`${t('idle.title')} · ${t('idle.cap', {
              time: formatDuration(idleCapHours(save$.value) * 3_600_000, locale$.value),
            })}`}
          >
            <Icon name="coin" size={13} />
            <span>{idleAmount > 0 ? formatNumber(idleAmount, locale$.value) : t('idle.empty')}</span>
          </button>
          <button
            class={s.idleDouble}
            disabled={idleAmount < 1}
            onClick={doubleIdle}
            title={t('idle.doubleAd')}
          >
            ×2 <span class={s.adBadge}>AD</span>
          </button>

          <div class={s.spacer} />

          <button class={s.square} onClick={() => setMoreOpen(true)} aria-label={t('lobby.more')}>
            <Icon name="book" size={17} />
            {claimable > 0 ? <span class={s.dot} /> : null}
          </button>
          <button class={s.square} onClick={() => navigate('mail')} aria-label={t('mail.title')}>
            <Icon name="mail" size={17} />
            {mailUnread > 0 ? <span class={s.dot} /> : null}
          </button>
        </div>

        <div class={s.tasks}>
          {firstStep ? (
            <button class={s.taskRow} onClick={runNextStep}>
              <span class={s.taskIcon}>
                <Icon name="book" size={15} />
              </span>
              <span class={s.taskBody}>
                <span class={s.taskKicker}>{t('lobby.next')}</span>
                <span class={s.taskTitle}>{t(`next.${firstStep.id}.title`, nextStepParams(firstStep))}</span>
              </span>
              <span class={s.taskGo}>→</span>
            </button>
          ) : null}

        </div>
      </header>

      <button class={s.guideFab} onClick={() => setGuideOpen((open) => !open)} aria-label={t('lobby.guide')}>
        <GuideAvatar size={44} />
      </button>
      {guideOpen ? (
        <div class={s.guidePop}>
          <GuideBubble
            name={guideName(locale$.value)}
            role={guideTitle(locale$.value)}
            text={t('guide.greeting')}
            onClose={() => {
              setGuideOpen(false);
              commit((draft) => {
                draft.flags.guideGreeted = true;
              }, 'guide-greeting');
            }}
          />
        </div>
      ) : null}

      <div class={s.buildings}>
        {BUILDINGS.map((building) => (
          <HexButton
            key={building.key}
            icon={building.icon}
            art={building.art}
            label={t(building.labelKey)}
            locked={building.key === 'training' && !modesUnlocked}
            badge={
              building.key === 'forge'
                ? undefined
                : t('throne.levelShort', { n: buildingLevel(save$.value, building.key as BuildingId) })
            }
            onClick={() => onBuilding(building)}
            style={{ left: building.left, top: building.top }}
          />
        ))}
      </div>

      <footer class={s.bottom}>
        <div class={s.liveRow}>
          <button
            class={`${s.liveChip}${calendarReady ? ` ${s.liveChipReady}` : ''}`}
            onClick={() => setEventsOpen(true)}
          >
            <Icon name="star" size={12} />
            <span>{t('lobby.events')}</span>
            {calendarReady ? <span class={s.liveDot} /> : null}
          </button>
        </div>

        <div class={s.bottomMain}>
          <div class={s.teamRow}>
            <div class={s.squad} role="group" data-ftue="squad" aria-label={t('squad.title')}>
            {squad.map((heroId, index) => (
              <button
                key={`${heroId || 'empty'}-${index}`}
                class={s.squadSlot}
                onClick={() => (heroId ? openHero(heroId) : navigate('squad'))}
                aria-label={heroId ? undefined : t('squad.slotFree')}
              >
                <HeroAvatar
                  heroId={heroId}
                  star={save$.value.heroes[heroId]?.star}
                  size={52}
                  shape="square"
                />
              </button>
            ))}
          </div>
          <div class={s.teamMeta}>
            <span class={s.teamPower}>
              {t('lobby.power')} <b>{teamPower()}</b>
            </span>
            <span class={s.teamHint}>
              {t('squad.title')} · {squadSize(save$.value)}/5
            </span>
            {mercenaryIsActive(save$.value) ? (
              <span class={s.mercHint}>{t('social.friends.mercenary')}</span>
            ) : null}
          </div>
        </div>

        <button class={`btn btn--primary btn--lg btn--wide ${s.battle}`} data-ftue="battle" onClick={onBattle}>
          <span class={s.battleLabel}>{t('lobby.battle')}</span>
          <span class={s.floorChip}>{t('lobby.floor', { n: floor })}</span>
          <Icon name="play" size={18} />
        </button>
        </div>

        <nav class={s.tabs}>
          {TABS.map((tab, index) => (
            <button
              key={tab.key}
              class={`${s.tab}${index === 0 ? ` ${s.tabActive}` : ''}${
                tab.key === 'modes' && !modesUnlocked ? ` ${s.tabLocked}` : ''
              }`}
              onClick={() => onTab(tab)}
            >
              <Icon name={tab.icon} size={19} />
              <span>{t(tab.labelKey)}</span>
            </button>
          ))}
        </nav>
      </footer>

      {settingsOpen ? <SettingsModal onClose={() => setSettingsOpen(false)} /> : null}

      {moreOpen ? (
        <Modal title={t('lobby.more')} onClose={() => setMoreOpen(false)}>
          <div class={s.moreList}>
            <button class="btn btn--wide" onClick={() => { setMoreOpen(false); navigate('quests'); }}>
              {t('lobby.daily')}
            </button>
            <button
              class="btn btn--wide"
              onClick={() => {
                if (!modesUnlocked) {
                  toast(t('toast.afterFloor'));
                  return;
                }
                setMoreOpen(false);
                navigate('achievements');
              }}
            >
              {t('achievements.title')}
            </button>
            <button
              class="btn btn--wide"
              onClick={() => {
                if (!modesUnlocked) {
                  toast(t('toast.afterFloor'));
                  return;
                }
                setMoreOpen(false);
                navigate('social');
              }}
            >
              {t('social.title')}
            </button>
            <button class="btn btn--wide" onClick={() => { setMoreOpen(false); navigate('starter'); }}>
              {t('lobby.starter')}
            </button>
          </div>
        </Modal>
      ) : null}

      {eventsOpen ? (
        <Modal title={t('lobby.events')} onClose={() => setEventsOpen(false)}>
          <div class={s.moreList}>
            <button class="btn btn--wide" onClick={() => { setEventsOpen(false); liveTab$.value = 'calendar'; navigate('live'); }}>
              {t('live.tab.calendar')}
            </button>
            <button class="btn btn--wide" onClick={() => { setEventsOpen(false); liveTab$.value = 'pass'; navigate('live'); }}>
              {t('live.tab.pass')}
            </button>
            <button class="btn btn--wide" onClick={() => { setEventsOpen(false); liveTab$.value = 'event'; navigate('live'); }}>
              {t('live.tab.event')}
            </button>
            <button
              class="btn btn--wide"
              onClick={() => {
                if (!modesUnlocked) {
                  toast(t('toast.afterFloor'));
                  return;
                }
                setEventsOpen(false);
                navigate('throne');
              }}
            >
              {t('throne.open')}
            </button>
          </div>
        </Modal>
      ) : null}

      {nextOpen ? <NextSteps reason={nextReason} onClose={() => setNextOpen(false)} /> : null}

      {offline ? <OfflineReportModal report={offline} onClose={() => setOffline(null)} /> : null}

      {artBuilding ? (
        <ArtModal
          title={t(artBuilding.labelKey)}
          text={t(artBuilding.descKey ?? 'common.comingSoon')}
          image={artBuilding.art}
          onClose={() => setArtBuilding(null)}
        />
      ) : null}

      {diningOpen ? (
        <Modal title={t('buildings.dining')} onClose={() => setDiningOpen(false)}>
          <p class="muted">{t('buildings.dining.desc')}</p>

          {activeMeal ? (
            <div class={s.diningActive}>
              <div class="row row--between">
                <span>{t('dining.active')}</span>
                <b>{locale$.value === 'ru' ? activeMeal.nameRu : activeMeal.nameEn}</b>
              </div>
              <div class="muted">
                {activeMeal.kind === 'battle'
                  ? t('dining.battlesLeft', { n: save$.value.dining.battles })
                  : activeMeal.kind === 'gold'
                    ? t('dining.goldLeft', { time: formatDuration(goldBuffLeft, locale$.value) })
                    : null}
              </div>
            </div>
          ) : null}

          {mealAvailable ? (
            <div class={s.diningList}>
              {DINING_BUFFS.map((buff) => (
                <div key={buff.id} class={s.diningRow}>
                  <div class={s.diningInfo}>
                    <b>{locale$.value === 'ru' ? buff.nameRu : buff.nameEn}</b>
                    <span class={s.diningDesc}>{locale$.value === 'ru' ? buff.descRu : buff.descEn}</span>
                  </div>
                  <button class="btn btn--sm btn--gold" onClick={() => chooseMeal(buff)}>
                    {t('dining.choose')}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div class={s.diningActive}>{t('dining.claimedToday')}</div>
          )}

          <button class="btn btn--wide" onClick={() => setDiningOpen(false)}>
            {t('common.close')}
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
