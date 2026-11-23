import { save$ } from '../game/state';
import { platform } from '../platform';

let lastShown = 0;

/**
 * Межстраничная реклама в естественных паузах (перед новым боем).
 * Уважает покупку «убрать рекламу» и троттлинг площадки.
 * Rewarded-реклама сюда не входит — она всегда по желанию игрока.
 */
export async function maybeInterstitial(): Promise<void> {
  try {
    if (save$.value.flags.noAds) return;
    if (Date.now() - lastShown < 120_000) return;
    const sdk = platform();
    if (!sdk.ads.canShowInterstitial()) return;
    lastShown = Date.now();
    // Если SDK не пришлёт callback, бой не должен зависнуть навсегда.
    await Promise.race([
      sdk.ads.interstitial(),
      new Promise<void>((resolve) => window.setTimeout(resolve, 15_000)),
    ]);
  } catch {
    /* реклама не должна ломать запуск боя */
  }
}
