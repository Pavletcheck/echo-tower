import type { PlatformSDK } from './types';

let current: PlatformSDK | null = null;

export function platform(): PlatformSDK {
  if (!current) throw new Error('Platform is not initialized. Call initPlatform() first.');
  return current;
}

/**
 * Выбор адаптера по платформе сборки.
 * Игровой код дальше работает только с интерфейсом PlatformSDK.
 */
export async function initPlatform(): Promise<PlatformSDK> {
  if (current) return current;

  switch (__BUILD_PLATFORM__) {
    case 'yandex': {
      const { createYandex } = await import('./yandex');
      current = await createYandex();
      break;
    }
    case 'crazy': {
      const { createCrazy } = await import('./crazy');
      current = await createCrazy();
      break;
    }
    case 'poki': {
      const { createPoki } = await import('./poki');
      current = await createPoki();
      break;
    }
    case 'telegram': {
      const { createTelegram } = await import('./telegram');
      current = await createTelegram();
      break;
    }
    case 'mock':
    default: {
      const { createMock } = await import('./mock');
      current = await createMock();
      break;
    }
  }

  await current.init();
  return current;
}
