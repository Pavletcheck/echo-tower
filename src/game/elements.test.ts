import { describe, expect, it } from 'vitest';
import { getFloor } from '../data/floors';
import { counterPreview, dominantElement, floorEnemyElements, floorCounterPreview } from './elements';

describe('element counters', () => {
  it('finds the dominant element deterministically', () => {
    expect(dominantElement(['echo', 'frost', 'frost', 'ash'])).toBe('frost');
    expect(dominantElement([])).toBeNull();
  });

  it('marks strong and weak squad elements against the enemy element', () => {
    const preview = counterPreview(['ash', 'echo', 'light'], ['frost']);
    expect(preview.dominant).toBe('frost');
    expect(preview.strong).toEqual(['ash']);
    expect(preview.weak).toEqual([]);

    const againstRot = counterPreview(['frost', 'light', 'echo'], ['rot']);
    expect(againstRot.strong).toEqual(['frost']);
    expect(againstRot.weak).toEqual(['light']);
  });

  it('reads floor enemy elements and matches the wave preview', () => {
    const floor = getFloor(1);
    if (!floor) throw new Error('floor 1 missing');

    const elements = floorEnemyElements(floor);
    expect(elements.length).toBeGreaterThan(0);

    const preview = floorCounterPreview(floor, elements);
    expect(preview.dominant).toBe(dominantElement(elements));
    expect([...preview.strong, ...preview.weak].every((element) => elements.includes(element))).toBe(true);
  });
});
