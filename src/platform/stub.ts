import type { PlatformId, PlatformSDK } from './types';

/**
 * Временная заглушка для реальных площадок.
 * Заменяется на настоящий адаптер в промпте 09 (см. Prompt/15_BUILD_PROMPTS.md).
 */
export function createStub(id: PlatformId): PlatformSDK {
  const pauseCallbacks: Array<() => void> = [];
  const resumeCallbacks: Array<() => void> = [];

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseCallbacks.forEach((fn) => fn());
      else resumeCallbacks.forEach((fn) => fn());
    });
  }

  return {
    id,
    async init() {
      console.warn(`[echo] platform "${id}" is a stub — see build prompt 09`);
    },
    getLanguage: () => (typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en'),
    async getUser() {
      return null;
    },
    cloudSave: {
      async load() {
        return null;
      },
      async put() {
        /* noop */
      },
    },
    ads: {
      // Пока SDK площадки не подключён, награду за рекламу не выдаём:
      // иначе игрок получает бесплатные кристаллы и сборка не пройдёт сертификацию.
      async rewarded() {
        return 'error';
      },
      async interstitial() {
        /* без SDK рекламы нет */
      },
      canShowInterstitial: () => false,
    },
    payments: {
      available: false,
      async buy() {
        return 'error';
      },
      async restore() {
        return [];
      },
    },
    haptics() {
      /* noop */
    },
    onPause(callback) {
      pauseCallbacks.push(callback);
    },
    onResume(callback) {
      resumeCallbacks.push(callback);
    },
  };
}
