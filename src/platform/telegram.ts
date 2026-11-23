import { createStub } from './stub';
import type { PlatformSDK } from './types';

/** TODO(prompt 09): Telegram.WebApp ready/expand, CloudStorage, BackButton, haptics, Stars. */
export async function createTelegram(): Promise<PlatformSDK> {
  return createStub('telegram');
}
