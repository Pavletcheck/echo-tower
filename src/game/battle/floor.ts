import type { FloorDef } from '../../data/types';
import { BOSSES_BY_ID } from '../../data/enemies';
import { MASTER_CHARGES } from '../config';
import { buildWave } from './factory';
import { mergeBattleStats } from './metrics';
import { simulate } from './sim';
import type {
  BattleResult,
  BattleSetup,
  FloorBattleResult,
  MasterAction,
  UnitBattleStats,
  UnitInit,
} from './types';

const WAVE_TIME = 45;

export interface FloorSimulateOptions {
  modifiers?: BattleSetup['modifiers'];
  enemyModifiers?: BattleSetup['enemyModifiers'];
  masterCharges?: number;
  maxTime?: number;
}

/**
 * Этаж = 3 волны с переносом HP. Энергия и кулдауны сбрасываются между волнами,
 * чтобы волны не были «одним длинным боем».
 */
export function simulateFloor(
  floor: FloorDef,
  squad: readonly UnitInit[],
  seed: number,
  masterActions: readonly MasterAction[] = [],
  options: FloorSimulateOptions = {},
): FloorBattleResult {
  let carriedHp = new Map<string, number>();
  const waves: BattleResult[] = [];
  const echoes: string[] = [];
  let damageDealt = 0;
  let damageTaken = 0;
  let timeMs = 0;
  let stats: UnitBattleStats[] = [];

  for (let waveIndex = 0; waveIndex < floor.waves.length; waveIndex += 1) {
    const enemies = buildWave(floor, waveIndex);
    const allies: UnitInit[] = squad.map((unit) => ({
      ...unit,
      ...(carriedHp.has(unit.uid) ? { startHp: carriedHp.get(unit.uid) ?? 0 } : {}),
    }));

    const result = simulate({
      seed: seed + waveIndex * 7919,
      mode: 'tower',
      allies,
      enemies,
      masterCharges: options.masterCharges ?? MASTER_CHARGES,
      masterActions: [...masterActions],
      maxTime: options.maxTime ?? WAVE_TIME,
      ...(options.modifiers ? { modifiers: options.modifiers } : {}),
      ...(options.enemyModifiers ? { enemyModifiers: options.enemyModifiers } : {}),
    });

    waves.push(result);
    damageDealt += result.damageDealt;
    damageTaken += result.damageTaken;
    timeMs += result.timeMs;
    echoes.push(...result.echoes);
    stats = mergeBattleStats(stats, result.stats);
    // Отдых между волнами: даже упавший герой возвращается с 25% HP —
    // на этом держится текущий баланс трёхволновых этажей.
    carriedHp = new Map(
      result.allies.map((ally) => [ally.uid, Math.min(ally.maxHp, ally.hp + ally.maxHp * 0.25)]),
    );

    if (result.outcome !== 'win') {
      return {
        outcome: result.outcome,
        wavesCleared: waveIndex,
        timeMs,
        damageDealt,
        damageTaken,
        allies: result.allies,
        echoes,
        stats,
        waves,
      };
    }
  }

  return {
    outcome: 'win',
    wavesCleared: waves.length,
    timeMs,
    damageDealt,
    damageTaken,
    allies: waves[waves.length - 1]?.allies ?? [],
    echoes,
    stats,
    waves,
  };
}

export function floorBossName(floor: FloorDef): string | null {
  if (!floor.bossId) return null;
  return BOSSES_BY_ID[floor.bossId]?.nameRu ?? null;
}
