import { createStub } from './stub';
import type { AdResult, PlatformSDK, PlatformUser, PurchaseResult } from './types';

/**
 * Адаптер Yandex Games SDK v2.
 *
 * Всё общение с площадкой живёт здесь: игровой код видит только PlatformSDK.
 * Если SDK не загрузился (локальная разработка, другой домен, блокировщик) —
 * молча откатываемся на заглушку, чтобы игра оставалась играбельной.
 */

const SDK_URL = 'https://yandex.ru/games/sdk/v2';
const CLOUD_KEY = 'echo-save';
const LEADERBOARD_NAME = 'maxFloor';

interface YaPlayer {
  getMode(): string;
  getUniqueID(): string;
  getName(): string;
  getPhoto(size: 'small' | 'medium' | 'large'): string;
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>): Promise<void>;
}

interface YaLeaderboardEntry {
  rank: number;
  score: number;
  player: { publicName?: string };
}

interface YaSDK {
  environment: { i18n: { lang: string } };
  getPlayer(options: { scopes: boolean }): Promise<YaPlayer>;
  getLeaderboards(): Promise<{
    setLeaderboardScore(name: string, score: number): Promise<void>;
    getLeaderboardEntries(
      name: string,
      options?: { quantityTop?: number; includeUser?: boolean; quantityAround?: number },
    ): Promise<{ entries: YaLeaderboardEntry[] }>;
  }>;
  adv: {
    showFullscreenAdv(options: { callbacks: { onClose?: (wasShown: boolean) => void; onError?: (error: unknown) => void } }): void;
    showRewardedVideo(options: {
      callbacks: { onRewarded?: () => void; onClose?: () => void; onError?: (error: unknown) => void };
    }): void;
  };
  getPayments(options: { signed: boolean }): Promise<{
    purchase(options: { id: string }): Promise<void>;
    getPurchases(): Promise<Array<{ productID: string }>>;
  }>;
  on(event: string, callback: () => void): void;
  features?: { LoadingAPI?: { ready(): void } };
}

declare global {
  interface Window {
    YaGames?: { init(): Promise<YaSDK> };
  }
}

function loadScript(src: string, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('no document'));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    const timer = window.setTimeout(() => reject(new Error('sdk timeout')), timeoutMs);
    script.onload = () => {
      window.clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('sdk failed'));
    };
    document.head.appendChild(script);
  });
}

export async function createYandex(): Promise<PlatformSDK> {
  const stub = createStub('yandex');
  let sdk: YaSDK | null = null;
  let player: YaPlayer | null = null;
  let adInProgress = false;

  try {
    // Если SDK уже подключён тегом площадки, повторный remote-скрипт не нужен.
    if (!window.YaGames) await loadScript(SDK_URL);
    sdk = (await window.YaGames?.init()) ?? null;
  } catch (error) {
    console.warn('[echo] Yandex SDK unavailable, using stub', error);
    return stub;
  }

  if (!sdk) return stub;
  const ya = sdk;

  const pauseCallbacks: Array<() => void> = [];
  const resumeCallbacks: Array<() => void> = [];
  let lastInterstitial = 0;

  ya.on('game_api_pause', () => pauseCallbacks.forEach((fn) => fn()));
  ya.on('game_api_resume', () => resumeCallbacks.forEach((fn) => fn()));

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseCallbacks.forEach((fn) => fn());
      else resumeCallbacks.forEach((fn) => fn());
    });
  }

  const getPlayer = async (scopes: boolean): Promise<YaPlayer | null> => {
    if (player && !scopes) return player;
    try {
      const value = await ya.getPlayer({ scopes });
      if (!scopes) player = value;
      return value;
    } catch {
      return null;
    }
  };

  const localLoad = (): string | null => {
    try {
      return window.localStorage.getItem(CLOUD_KEY);
    } catch {
      return null;
    }
  };

  const localPut = (data: string): void => {
    try {
      window.localStorage.setItem(CLOUD_KEY, data);
    } catch {
      /* noop */
    }
  };

  return {
    id: 'yandex',

    async init() {
      // LoadingAPI.ready сообщает площадке, что игра готова принимать ввод.
      try {
        ya.features?.LoadingAPI?.ready();
      } catch {
        /* noop */
      }
      void getPlayer(false);
    },

    getLanguage() {
      const lang = ya.environment?.i18n?.lang ?? 'ru';
      return lang.startsWith('ru') ? 'ru' : 'en';
    },

    async getUser(): Promise<PlatformUser | null> {
      const value = await getPlayer(false);
      if (!value) return null;
      try {
        return {
          id: value.getUniqueID(),
          name: value.getName(),
          avatar: value.getPhoto('medium'),
        };
      } catch {
        return null;
      }
    },

    cloudSave: {
      async load() {
        localPutOrSkip();
        const value = await getPlayer(true);
        if (value) {
          try {
            const data = await value.getData([CLOUD_KEY]);
            const cloud = data?.[CLOUD_KEY];
            if (typeof cloud === 'string' && cloud.length > 0) return cloud;
          } catch {
            /* lite mode or no auth */
          }
        }
        return localLoad();
      },
      async put(data: string) {
        localPut(data);
        const value = await getPlayer(true);
        if (!value) return;
        try {
          await value.setData({ [CLOUD_KEY]: data });
        } catch {
          /* quota or lite mode — local copy already saved */
        }
      },
    },

    ads: {
      rewarded(placement: string): Promise<AdResult> {
        if (adInProgress) return Promise.resolve('error');
        adInProgress = true;
        return new Promise<AdResult>((resolve) => {
          const finish = (result: AdResult) => {
            adInProgress = false;
            resolve(result);
          };
          try {
            ya.adv.showRewardedVideo({
              callbacks: {
                onRewarded: () => finish('rewarded'),
                onClose: () => finish('closed'),
                onError: (error) => {
                  console.warn('[echo] rewarded ad error', placement, error);
                  finish('error');
                },
              },
            });
          } catch (error) {
            console.warn('[echo] rewarded ad threw', error);
            finish('error');
          }
        });
      },

      interstitial(): Promise<void> {
        if (adInProgress) return Promise.resolve();
        adInProgress = true;
        lastInterstitial = Date.now();
        return new Promise<void>((resolve) => {
          const done = () => {
            adInProgress = false;
            resolve();
          };
          try {
            ya.adv.showFullscreenAdv({ callbacks: { onClose: done, onError: done } });
          } catch {
            done();
          }
        });
      },

      canShowInterstitial() {
        // Не чаще раза в 3 минуты: площадка не любит спам и режет показы.
        return !adInProgress && Date.now() - lastInterstitial > 180_000;
      },
    },

    payments: {
      available: true,
      async buy(sku: string): Promise<PurchaseResult> {
        try {
          const payments = await ya.getPayments({ signed: false });
          await payments.purchase({ id: sku });
          return 'success';
        } catch (error) {
          const message = String((error as { message?: string })?.message ?? error).toLowerCase();
          if (message.includes('cancel') || message.includes('otmen')) return 'cancel';
          console.warn('[echo] purchase failed', sku, error);
          return 'error';
        }
      },
      async restore() {
        try {
          const payments = await ya.getPayments({ signed: false });
          const purchases = await payments.getPurchases();
          return purchases.map((item) => item.productID);
        } catch {
          return [];
        }
      },
      async catalog() {
        try {
          const payments = (await ya.getPayments({ signed: false })) as unknown as {
            getCatalog?: () => Promise<Array<{ id: string; price: string; priceValue?: string }>>;
          };
          const products = (await payments.getCatalog?.()) ?? [];
          return products.map((product) => ({
            sku: product.id,
            price: product.price ?? '',
          }));
        } catch {
          return [];
        }
      },
    },

    leaderboard: {
      async submit(score: number) {
        try {
          const boards = await ya.getLeaderboards();
          await boards.setLeaderboardScore(LEADERBOARD_NAME, Math.max(0, Math.round(score)));
        } catch (error) {
          console.warn('[echo] leaderboard submit failed', error);
        }
      },
      async get() {
        try {
          const boards = await ya.getLeaderboards();
          const result = await boards.getLeaderboardEntries(LEADERBOARD_NAME, {
            quantityTop: 20,
            includeUser: true,
            quantityAround: 3,
          });
          return result.entries
            .map((entry) => ({
              name: entry.player?.publicName ?? '—',
              score: entry.score,
            }))
            .sort((a, b) => b.score - a.score);
        } catch {
          return [];
        }
      },
    },

    haptics(type) {
      if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
      const pattern = type === 'heavy' ? 40 : type === 'medium' ? 24 : 12;
      try {
        navigator.vibrate(pattern);
      } catch {
        /* noop */
      }
    },

    async share(text: string) {
      try {
        await (ya as unknown as { share?: (opts: { text: string }) => Promise<void> }).share?.({ text });
      } catch {
        /* noop */
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

/** Явный no-op, чтобы линтер не ругался на пустой блок в cloudSave.load. */
function localPutOrSkip(): void {
  /* noop */
}
