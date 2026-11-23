import { asset } from '../../core/asset';
import { t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { save$ } from '../../game/state';
import { Icon, type IconName } from '../components/Icon';
import { toast } from '../components/toast';
import s from './Modes.module.css';

interface ModeCard {
  id: string;
  title: string;
  description: string;
  art: string;
  icon: IconName;
  screen?: 'expeditions' | 'rift' | 'arena' | 'trials' | 'endgame' | 'social';
}

const MODES: readonly ModeCard[] = [
  {
    id: 'expeditions',
    title: 'modes.expeditions',
    description: 'modes.expeditions.desc',
    art: 'assets/bg/barracks.webp',
    icon: 'users',
    screen: 'expeditions',
  },
  {
    id: 'rift',
    title: 'modes.rift',
    description: 'modes.rift.desc',
    art: 'assets/bg/rift-map.webp',
    icon: 'crystal',
    screen: 'rift',
  },
  {
    id: 'arena',
    title: 'modes.arena',
    description: 'modes.arena.desc',
    art: 'assets/bg/arena.webp',
    icon: 'swords',
    screen: 'arena',
  },
  {
    id: 'trials',
    title: 'modes.trials',
    description: 'modes.trials.desc',
    art: 'assets/bg/barracks.webp',
    icon: 'star',
    screen: 'trials',
  },
  {
    id: 'endgame',
    title: 'modes.endgame',
    description: 'modes.endgame.desc',
    art: 'assets/bg/rift-map.webp',
    icon: 'altar',
    screen: 'endgame',
  },
  {
    id: 'social',
    title: 'social.title',
    description: 'social.desc',
    art: 'assets/bg/barracks.webp',
    icon: 'shield',
    screen: 'social',
  },
];

export function Modes() {
  const cleared = Math.min(10, Math.max(0, save$.value.tower.maxFloor - 1));
  const unlocked = save$.value.tower.maxFloor > 10;

  const open = (mode: ModeCard) => {
    if (mode.screen) {
      navigate(mode.screen);
      return;
    }
    toast(t('modes.soon'));
  };

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/rift-map.webp')})` }} />
      <div class={s.scrim} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('lobby')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <span class={s.title}>{t('modes.title')}</span>
      </header>

      {!unlocked ? (
        <div class={s.locked}>
          <span class={s.lockIcon}>
            <Icon name="lock" size={28} />
          </span>
          <b>{t('modes.locked.title')}</b>
          <span>{t('modes.locked.body', { n: cleared })}</span>
        </div>
      ) : (
        <div class={s.list}>
          {MODES.map((mode) => (
            <button
              key={mode.id}
              class={s.card}
              style={{ backgroundImage: `url(${asset(mode.art)})` }}
              onClick={() => open(mode)}
            >
              <div class={s.cardScrim} />
              <div class={s.cardBody}>
                <span class={s.cardHead}>
                  <span class={s.cardIcon}>
                    <Icon name={mode.icon} size={15} />
                  </span>
                  <span class={s.cardTitle}>{t(mode.title)}</span>
                </span>
                <span class={s.cardDesc}>{t(mode.description)}</span>
                <span class={s.cardAction}>
                  {mode.screen ? t('modes.open') : t('modes.soon')}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
