import { describe, expect, it } from 'vitest';
import { defaultSave } from './save';
import { boughtFor, buyItem } from './shop';
import { SHOP_BY_ID } from '../data/shop';

const MONDAY = new Date(2026, 10, 16, 12);
const TUESDAY = new Date(2026, 10, 17, 12);
const NEXT_MONDAY = new Date(2026, 10, 23, 12);

describe('shop limits', () => {
  it('resets daily stock every day', () => {
    const save = defaultSave();
    save.currencies.gold = 20_000;

    expect(buyItem(save, 'shop_seal', MONDAY)).toBe(true);
    expect(buyItem(save, 'shop_seal', MONDAY)).toBe(false);
    expect(buyItem(save, 'shop_seal', TUESDAY)).toBe(true);
  });

  it('keeps weekly stock for the whole ISO week', () => {
    const save = defaultSave();
    save.currencies.arenaTokens = 5_000;
    const frame = SHOP_BY_ID.arena_frame!;

    expect(buyItem(save, 'arena_frame', MONDAY)).toBe(true);
    expect(boughtFor(save, frame)).toBe(1);
    expect(buyItem(save, 'arena_frame', MONDAY)).toBe(false);
    expect(buyItem(save, 'arena_frame', TUESDAY)).toBe(false);
    expect(buyItem(save, 'arena_frame', NEXT_MONDAY)).toBe(true);
  });
});
