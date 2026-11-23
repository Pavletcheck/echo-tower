import type { BattleEvent, UnitInit } from '../../game/battle/types';

/**
 * Общий контракт боевой сцены.
 * Реализации: Pixi (BattleStage) и DOM (BattleDomStage) — вторая нужна
 * устройствам без WebGL, где WebGPU/канвас недоступны.
 */
export interface BattleStageLike {
  onTick: ((dt: number) => void) | null;
  init(): Promise<void>;
  setChapter(chapter: number, element: string): void;
  loadWave(allies: readonly UnitInit[], enemies: readonly UnitInit[], startHp: Map<string, number>): void;
  setHp(uid: string, hp: number, maxHp?: number): void;
  getHp(uid: string): number;
  applyEvent(event: BattleEvent): void;
  flashMaster(): void;
  /** Останавливает анимационный цикл на экране результата. */
  setPaused(paused: boolean): void;
  hasBackgroundArt(): boolean;
  destroy(): void;
}

export function supportsWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}
