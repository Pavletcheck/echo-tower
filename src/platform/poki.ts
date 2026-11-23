import { createStub } from './stub';
import type { PlatformSDK } from './types';

/** TODO(prompt 09): PokiSDK.init, gameLoadingFinished, commercialBreak, rewardedBreak. */
export async function createPoki(): Promise<PlatformSDK> {
  return createStub('poki');
}
