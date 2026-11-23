import { useEffect, useState } from 'preact/hooks';
import { asset } from '../../core/asset';
import { playSfx } from '../../core/audio';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { formatDuration } from '../../core/time';
import { HEROES_BY_ID } from '../../data/heroes';
import type { HeroDef } from '../../data/types';
import {
  EXPEDITION_CONFIG,
  busyHeroes,
  claimExpedition,
  expeditionOf,
  expeditionReady,
  expeditionReward,
  speedUpExpedition,
  startExpedition,
  type ExpeditionType,
} from '../../game/expeditions';
import { commit, save$ } from '../../game/state';
import { trackQuest } from '../../game/quests';
import { platform } from '../../platform';
import { HeroAvatar } from '../components/HeroAvatar';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { toast } from '../components/toast';
import s from './Expeditions.module.css';

const TYPES: readonly ExpeditionType[] = ['2h', '4h', '8h'];

export function Expeditions() {
  const [, setTick] = useState(0);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [type, setType] = useState<ExpeditionType>('2h');
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const save = save$.value;
  const at = Date.now();
  const busy = busyHeroes(save);
  const owned: HeroDef[] = Object.keys(save.heroes)
    .map((id) => HEROES_BY_ID[id])
    .filter((hero): hero is HeroDef => Boolean(hero));

  const config = EXPEDITION_CONFIG[type];

  const openSlot = (slot: number) => {
    setActiveSlot(slot);
    setType('2h');
    setSelected([]);
  };

  const toggleHero = (heroId: string) => {
    setSelected((previous) => {
      if (previous.includes(heroId)) return previous.filter((id) => id !== heroId);
      if (previous.length >= config.heroes) return previous;
      return [...previous, heroId];
    });
  };

  const changeType = (next: ExpeditionType) => {
    setType(next);
    setSelected((previous) => previous.slice(0, EXPEDITION_CONFIG[next].heroes));
  };

  const start = () => {
    if (activeSlot === null) return;
    const slot = activeSlot;
    let ok = false;
    commit((draft) => {
      ok = startExpedition(draft, slot, type, selected);
      if (ok) trackQuest(draft, 'expeditions', 1);
    }, 'expedition-start');
    if (ok) {
      setActiveSlot(null);
      toast(t('expeditions.start'), 'success');
    } else {
      toast(t('expeditions.busy'), 'error');
    }
  };

  const claim = (slot: number) => {
    let gold = 0;
    commit((draft) => {
      const reward = claimExpedition(draft, slot);
      gold = reward?.gold ?? 0;
    }, 'expedition-claim');
    if (gold > 0) {
      playSfx('coin');
      toast(`${t('expeditions.done')} · +${gold}`, 'success');
    }
  };

  const speedUp = async (slot: number) => {
    const result = await platform().ads.rewarded('expedition_speed');
    if (result === 'rewarded') {
      commit((draft) => {
        speedUpExpedition(draft, slot);
      }, 'expedition-speed');
    }
  };

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/rift-map.webp')})` }} />
      <div class={s.scrim} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('modes')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.heading}>
          <span class={s.title}>{t('expeditions.title')}</span>
          <span class={s.sub}>{t('modes.expeditions.desc')}</span>
        </div>
      </header>

      <div class={s.list}>
        {[0, 1, 2].map((slot) => {
          const entry = expeditionOf(save, slot);
          if (!entry) {
            return (
              <div key={slot} class={s.slotEmpty}>
                <div class={s.slotHead}>
                  <span>{t('expeditions.slot', { n: slot + 1 })}</span>
                  <span class={s.dim}>{t('expeditions.empty')}</span>
                </div>
                <button class="btn btn--ghost btn--wide" onClick={() => openSlot(slot)}>
                  {t('expeditions.send')}
                </button>
              </div>
            );
          }

          const ready = expeditionReady(save, slot, at);
          const reward = expeditionReward(save, slot);
          return (
            <div key={slot} class={s.slot}>
              <div class={s.slotHead}>
                <span>{t('expeditions.slot', { n: slot + 1 })}</span>
                <span class={s.dim}>{t('expeditions.hours', { n: EXPEDITION_CONFIG[entry.type].hours })}</span>
              </div>
              <div class={s.heroes}>
                {entry.heroes.map((heroId) => (
                  <HeroAvatar key={heroId} heroId={heroId} size={36} />
                ))}
              </div>
              <div class={s.slotInfo}>
                {ready ? (
                  <span class={s.ready}>{t('expeditions.ready')}</span>
                ) : (
                  <span>{t('expeditions.readyIn', { time: formatDuration(entry.endsAt - at, locale$.value) })}</span>
                )}
                {reward ? (
                  <span class={s.reward}>
                    {reward.gold} · {reward.essence} ✦
                  </span>
                ) : null}
              </div>
              <div class={s.slotActions}>
                <button class="btn btn--sm btn--ghost" onClick={() => speedUp(slot)}>
                  {t('expeditions.speedUp')}
                </button>
                <button class="btn btn--sm btn--gold" disabled={!ready} onClick={() => claim(slot)}>
                  {t('expeditions.claim')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {activeSlot !== null ? (
        <Modal title={t('expeditions.send')} onClose={() => setActiveSlot(null)}>
          <div class={s.typeRow}>
            {TYPES.map((item) => (
              <button
                key={item}
                class={`${s.typeBtn}${type === item ? ` ${s.typeActive}` : ''}`}
                onClick={() => changeType(item)}
              >
                {t('expeditions.hours', { n: EXPEDITION_CONFIG[item].hours })}
              </button>
            ))}
          </div>

          <div class={s.selectedLine}>
            {t('expeditions.selected', { n: selected.length, m: config.heroes })}
          </div>

          <div class={s.grid}>
            {owned.map((hero) => {
              const isBusy = busy.has(hero.id);
              const isSelected = selected.includes(hero.id);
              return (
                <button
                  key={hero.id}
                  class={`${s.pick}${isSelected ? ` ${s.pickActive}` : ''}`}
                  disabled={isBusy}
                  onClick={() => toggleHero(hero.id)}
                  title={isBusy ? t('expeditions.busy') : undefined}
                >
                  <HeroAvatar heroId={hero.id} size={42} />
                  <span class={s.pickName}>{locale$.value === 'ru' ? hero.nameRu : hero.nameEn}</span>
                </button>
              );
            })}
          </div>

          <button
            class="btn btn--primary btn--wide"
            disabled={selected.length !== config.heroes}
            onClick={start}
          >
            {selected.length === config.heroes ? t('expeditions.start') : t('expeditions.needHeroes', { n: config.heroes })}
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
