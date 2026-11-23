import { signal } from '@preact/signals';
import { navigate } from '../core/router';
import type { BannerId } from '../game/gacha';

export const selectedHero$ = signal<string | null>(null);
export const battleFloor$ = signal<number | null>(null);
export const summonBanner$ = signal<BannerId | null>(null);
export type LiveTab = 'calendar' | 'pass' | 'event';
export const liveTab$ = signal<LiveTab>('calendar');

export function openHero(heroId: string): void {
  selectedHero$.value = heroId;
  navigate('hero');
}
