import { render } from 'preact';
import { setAnalyticsSink, track } from './analytics/events';
import { setLocale } from './core/i18n';
import { initLogger, logError } from './core/logger';
import { initRouter } from './core/router';
import { initState, save$ } from './game/state';
import { initPlatform } from './platform';
import { App } from './ui/App';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/components.css';

async function bootstrap(): Promise<void> {
  initLogger();
  initRouter();

  const sdk = await initPlatform();
  await initState();

  setLocale(save$.value.player.locale);
  setAnalyticsSink((name, params) => {
    if (__DEV__) console.debug('[analytics]', name, params);
    // Если на странице подключена Яндекс.Метрика, события уходят в неё.
    const metrika = (window as unknown as { ym?: (...args: unknown[]) => void }).ym;
    const counter = Number((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_YM_COUNTER ?? 0);
    if (metrika && counter > 0) metrika(counter, 'reachGoal', name, params);
  });
  track('app_start', { platform: sdk.id, locale: save$.value.player.locale });

  const root = document.getElementById('app');
  if (!root) throw new Error('#app not found');

  render(<App />, root);
}

void bootstrap().catch((error: unknown) => {
  logError(error, 'bootstrap');
  const root = document.getElementById('app');
  if (root) {
    root.innerHTML =
      '<div style="padding:24px;font-family:system-ui;color:#f5f1ff;text-align:center">' +
      '<h1 style="font-size:18px">Эхо потерялось</h1>' +
      '<p style="color:#9a8fb8;font-size:13px">Перезагрузите страницу. Если не помогает — очистите кэш.</p>' +
      '</div>';
  }
});
