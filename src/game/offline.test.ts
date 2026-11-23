import { describe, expect, it } from 'vitest';
import { OFFLINE_MIN_MS, offlineReport } from './offline';
import { defaultSave } from './save';

describe('offline report', () => {
  it('is hidden for short absences', () => {
    const save = defaultSave();
    save.tower.maxFloor = 20;
    save.idle.lastClaim = 0;
    save.lastSeen = 10_000;
    expect(offlineReport(save, 10_000 + OFFLINE_MIN_MS - 1)).toBeNull();
  });

  it('reports gold and essence after a longer absence', () => {
    const save = defaultSave();
    save.tower.maxFloor = 20;
    save.idle.lastClaim = 0;
    save.lastSeen = 0;

    const at = 3 * 60 * 60 * 1000;
    const report = offlineReport(save, at);
    expect(report).not.toBeNull();
    expect(report?.awayMs).toBe(at);
    expect(report?.gold).toBeGreaterThan(0);
    expect(report?.essence).toBeGreaterThan(0);
  });
});
