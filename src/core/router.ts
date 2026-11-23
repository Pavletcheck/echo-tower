import { signal } from '@preact/signals';

export type ScreenName =
  | 'boot'
  | 'title'
  | 'lobby'
  | 'battle'
  | 'squad'
  | 'heroes'
  | 'hero'
  | 'storage'
  | 'summon'
  | 'shop'
  | 'tower'
  | 'modes'
  | 'expeditions'
  | 'rift'
  | 'arena'
  | 'trials'
  | 'quests'
  | 'starter'
  | 'endgame'
  | 'live'
  | 'mail'
  | 'achievements'
  | 'social'
  | 'throne';

const SCREENS: readonly ScreenName[] = [
  'boot',
  'title',
  'lobby',
  'battle',
  'squad',
  'heroes',
  'hero',
  'storage',
  'summon',
  'shop',
  'tower',
  'modes',
  'expeditions',
  'rift',
  'arena',
  'trials',
  'quests',
  'starter',
  'endgame',
  'live',
  'mail',
  'achievements',
  'social',
  'throne',
];

export const screen$ = signal<ScreenName>('boot');
const backStack: ScreenName[] = [];

function isScreen(value: string): value is ScreenName {
  return (SCREENS as readonly string[]).includes(value);
}

export function navigate(next: ScreenName, options: { replace?: boolean } = {}): void {
  const previous = screen$.value;
  if (previous === next) return;

  if (!options.replace) backStack.push(previous);
  screen$.value = next;

  if (typeof window === 'undefined') return;
  const state = { screen: next };
  if (options.replace) window.history.replaceState(state, '', `#${next}`);
  else window.history.pushState(state, '', `#${next}`);
}

export function back(): boolean {
  const previous = backStack.pop();
  if (!previous) return false;

  screen$.value = previous;
  if (typeof window !== 'undefined') window.history.back();
  return true;
}

export function initRouter(): void {
  if (typeof window === 'undefined') return;

  const fromHash = window.location.hash.replace('#', '');

  // Прямой заход на #battle не должен стоить ключей — возвращаем в лобби.
  if (fromHash === 'battle') {
    screen$.value = 'lobby';
    window.history.replaceState({ screen: 'lobby' }, '', '#lobby');
    return;
  }

  if (isScreen(fromHash)) screen$.value = fromHash;

  window.addEventListener('popstate', (event) => {
    const state = event.state as { screen?: string } | null;
    if (state?.screen && isScreen(state.screen)) screen$.value = state.screen;
  });

  // Ручное изменение hash (deep link) тоже должно переключать экран.
  window.addEventListener('hashchange', () => {
    const next = window.location.hash.replace('#', '');
    if (isScreen(next) && next !== screen$.value) screen$.value = next;
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (screen$.value === 'lobby' || screen$.value === 'battle') {
        navigate('lobby');
        return;
      }
      back();
    }
  });
}
