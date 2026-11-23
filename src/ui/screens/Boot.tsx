import { useEffect, useState } from 'preact/hooks';
import { preloadImage } from '../../core/asset';
import { t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { Icon } from '../components/Icon';
import s from './Boot.module.css';

// Только то, что реально нужно на первом экране. Ключевой арт и карточка
// героя раньше качались зря и раздували первый экран до ~1.9 МБ.
const PRELOAD = ['assets/bg/lobby-tower.webp'];

export function Boot() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loaded = 0;
    const startedAt = Date.now();

    const step = () => {
      loaded += 1;
      if (!cancelled) setProgress(Math.round((loaded / PRELOAD.length) * 100));
    };

    void Promise.all(PRELOAD.map((path) => preloadImage(path).then(step))).then(() => {
      const wait = Math.max(0, 900 - (Date.now() - startedAt));
      window.setTimeout(() => {
        if (!cancelled) navigate('title', { replace: true });
      }, wait);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div class={s.root}>
      <div class={s.emblem}>
        <div class={s.emblemInner}>
          <Icon name="star" size={22} />
        </div>
      </div>

      <div class={s.wordmark}>
        <div class={s.title}>{t('app.title')}</div>
        <div class={s.subtitle}>{t('app.subtitle')}</div>
      </div>

      <div class={s.bar} aria-hidden="true">
        <div class={s.barFill} style={{ width: `${Math.max(6, progress)}%` }} />
      </div>

      <div class={s.status}>{t('boot.loading')}</div>
    </div>
  );
}
