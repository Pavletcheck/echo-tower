import { useState } from 'preact/hooks';
import { track } from '../../analytics/events';
import { asset } from '../../core/asset';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { Icon } from '../components/Icon';
import { SettingsModal } from '../components/SettingsModal';
import s from './Title.module.css';

export function Title() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const play = () => {
    track('title_play', { locale: locale$.value });
    navigate('lobby');
  };

  return (
    <div class={s.root} style={{ backgroundImage: `url(${asset('assets/bg/title.webp')})` }}>
      <div class={s.scrim} />

      <button class={s.gear} onClick={() => setSettingsOpen(true)} aria-label={t('title.settings')}>
        <Icon name="gear" size={20} />
      </button>

      <div class={s.content}>
        <div class={s.logoBlock}>
          <div class={s.emblem}>
            <Icon name="star" size={16} />
          </div>
          <h1 class={s.logo}>{t('app.title')}</h1>
          <div class={s.sub}>{t('app.subtitle')}</div>
          <p class={s.tagline}>{t('app.tagline')}</p>
        </div>

        <div class={s.actions}>
          <button class="btn btn--primary btn--lg btn--wide" onClick={play}>
            <Icon name="play" size={18} />
            {t('title.play')}
          </button>
          <button class="btn btn--ghost btn--wide" onClick={() => setSettingsOpen(true)}>
            <Icon name="gear" size={16} />
            {t('title.settings')}
          </button>
        </div>

        <div class={s.footer}>v0.1.0 · {locale$.value.toUpperCase()}</div>
      </div>

      {settingsOpen ? <SettingsModal onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  );
}
