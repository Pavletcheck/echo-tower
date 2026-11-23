import { hashString, Rng } from '../core/rng';
import { RIFT_BOONS, RIFT_BOONS_BY_ID } from '../data/rift';
import type { GearDef, RiftBoonDef } from '../data/types';
import type { BattleSetup } from './battle/types';
import { GEAR_DROP_RIFT } from './config';
import { rollGearDrop } from './equipment';
import type { SaveV1 } from './save';

export type RiftRoomType = 'battle' | 'elite' | 'boon' | 'rest' | 'shop' | 'boss';

export const RIFT_SEQUENCE: readonly RiftRoomType[] = ['battle', 'boon', 'battle', 'rest', 'elite', 'boss'];

export interface RiftRoom {
  type: RiftRoomType;
  cleared: boolean;
}

export interface RiftRun {
  rooms: RiftRoom[];
  index: number;
  boons: string[];
  startedAt: number;
}

export function createRiftRun(at = Date.now()): RiftRun {
  return {
    rooms: RIFT_SEQUENCE.map((type) => ({ type, cleared: false })),
    index: 0,
    boons: [],
    startedAt: at,
  };
}

export function rollBoons(run: RiftRun): RiftBoonDef[] {
  const rng = new Rng(hashString(`rift|${run.startedAt}|${run.index}|${run.boons.join(',')}`));
  const pool = [...RIFT_BOONS];
  const result: RiftBoonDef[] = [];
  while (result.length < 3 && pool.length > 0) {
    const picked = pool.splice(rng.int(0, pool.length - 1), 1)[0];
    if (picked) result.push(picked);
  }
  return result;
}

export function riftModifiers(boonIds: readonly string[]): NonNullable<BattleSetup['modifiers']> {
  const mods: NonNullable<BattleSetup['modifiers']> = {};

  for (const id of boonIds) {
    const boon = RIFT_BOONS_BY_ID[id];
    if (!boon) continue;

    if (boon.stat && typeof boon.value === 'number') {
      const ratio = boon.value / 100;
      switch (boon.stat) {
        case 'atk':
        case 'elem':
          mods.atk = (mods.atk ?? 0) + ratio;
          break;
        case 'hp':
        case 'heal':
        case 'shield':
          mods.hp = (mods.hp ?? 0) + ratio;
          break;
        case 'crit':
          mods.crit = (mods.crit ?? 0) + ratio;
          break;
        case 'cdmg':
          mods.cdmg = (mods.cdmg ?? 0) + ratio;
          break;
        case 'spd':
        case 'er':
          mods.spd = (mods.spd ?? 0) + ratio * 0.5;
          break;
        case 'lifesteal':
          mods.lifesteal = (mods.lifesteal ?? 0) + ratio;
          break;
        case 'dr':
          mods.dr = (mods.dr ?? 0) + ratio;
          break;
        default:
          break;
      }
    } else if (boon.special) {
      // Особые буны дают небольшой общий прирост, чтобы не усложнять симуляцию.
      mods.atk = (mods.atk ?? 0) + 0.04;
    }
  }

  return mods;
}

export function ensureRiftDay(save: SaveV1, date = new Date()): void {
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  if (save.rift.date !== day) {
    save.rift.date = day;
    save.rift.runsToday = 0;
  }
}

export function riftRunsLeft(save: SaveV1): number {
  return Math.max(0, 2 - save.rift.runsToday);
}

export function riftReward(): { crystals: number; essence: number; shards: number } {
  return { crystals: 150, essence: 80, shards: 2 };
}

/** Детерминированный дроп снаряжения за завершённый забег. */
export function riftGearDrop(run: RiftRun): GearDef | null {
  return rollGearDrop(hashString(`rift|${run.startedAt}|gear`), GEAR_DROP_RIFT);
}
