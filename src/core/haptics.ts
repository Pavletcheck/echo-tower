import { platform } from '../platform';
import { save$ } from '../game/state';

export type HapticStrength = 'light' | 'medium' | 'heavy';

let lastHapticAt = 0;

/** Вибрация только если игрок её не отключил в настройках. */
export function haptic(strength: HapticStrength = 'light'): void {
  if (!save$.value.settings.haptics) return;
  if (typeof document !== 'undefined' && document.hidden) return;

  // Частые криты в быстром бою не должны превращаться в непрерывную вибрацию.
  const now = Date.now();
  if (now - lastHapticAt < 80) return;
  lastHapticAt = now;

  try {
    platform().haptics(strength);
  } catch {
    // платформа может не поддерживать вибрацию — это не ошибка
  }
}
