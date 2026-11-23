import { createStub } from './stub';
import type { PlatformSDK } from './types';

/** TODO(prompt 09): CrazyGames.SDK init, ad.requestAd, gameplayStart/Stop. */
export async function createCrazy(): Promise<PlatformSDK> {
  return createStub('crazy');
}
