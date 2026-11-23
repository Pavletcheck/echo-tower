import type { PlatformSDK } from './types';

/** Заглушка площадки: всё работает мгновенно, платежи «успешны». */
export function createMock(): PlatformSDK {
  const pauseCallbacks: Array<() => void> = [];
  const resumeCallbacks: Array<() => void> = [];

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseCallbacks.forEach((fn) => fn());
      else resumeCallbacks.forEach((fn) => fn());
    });
  }

  return {
    id: 'mock',
    async init() {
      if (__DEV__) console.info('[echo] platform: mock');
    },
    getLanguage: () => (typeof navigator !== 'undefined' && navigator.language.startsWith('ru') ? 'ru' : 'en'),
    async getUser() {
      return { id: 'local-player', name: 'Мастер' };
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
      async rewarded(placement) {
        if (__DEV__) console.info('[echo] rewarded ad:', placement);
        await new Promise((resolve) => setTimeout(resolve, 350));
        return 'rewarded';
      },
      async interstitial() {
        await new Promise((resolve) => setTimeout(resolve, 200));
      },
      canShowInterstitial: () => true,
    },
    payments: {
      available: true,
      async buy(sku) {
        if (__DEV__) console.info('[echo] purchase:', sku);
        return 'success';
      },
      async restore() {
        return [];
      },
    },
    haptics(type) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(type === 'heavy' ? 40 : type === 'medium' ? 20 : 10);
      }
    },
    onPause(callback) {
      pauseCallbacks.push(callback);
    },
    onResume(callback) {
      resumeCallbacks.push(callback);
    },
  };
}
