import type { Element, HeroBaseStats, Role, SkillDef, StatusKind } from '../../data/types';
import type { StatBonus } from './stats';

export type Side = 'ally' | 'enemy';
export type BattleMode = 'tower' | 'rift' | 'arena' | 'trial' | 'world' | 'guild';
export type BattleOutcome = 'win' | 'lose' | 'timeout';

export interface CombatStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  crit: number;
  cdmg: number;
  er: number;
}

export interface UnitInit {
  uid: string;
  defId: string;
  name: string;
  nameEn?: string;
  side: Side;
  slot: number;
  role: Role;
  element: Element;
  base: HeroBaseStats;
  star: number;
  level: number;
  skills: [SkillDef, SkillDef, SkillDef, SkillDef];
  /** Бонусы гравировок и снаряжения. */
  bonus?: StatBonus;
  /** Множители для боссов и элитных волн. */
  hpMult?: number;
  atkMult?: number;
  /** Для переноса HP между волнами. */
  startHp?: number;
  isBoss?: boolean;
}

export interface ActiveStatus {
  kind: StatusKind;
  remaining: number;
  value: number;
  stacks: number;
  sourceId?: string;
}

export interface Unit extends CombatStats {
  uid: string;
  defId: string;
  name: string;
  nameEn?: string;
  side: Side;
  slot: number;
  role: Role;
  element: Element;
  skills: [SkillDef, SkillDef, SkillDef, SkillDef];
  isBoss: boolean;

  maxHp: number;
  hp: number;
  energy: number;
  actionGauge: number;
  cooldowns: Record<string, number>;
  statuses: ActiveStatus[];
  alive: boolean;

  shield: number;
  shieldUntil: number;
  controlImmuneUntil: number;

  hitCount: number;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  lastDotLogAt: number;
  revived: boolean;
  /** Снижение урона (Кассиан) и время действия. */
  dr: number;
  drUntil: number;
  nextTrapAt: number;

  /** Бонусы экипировки, участвующие в бою. */
  lifesteal: number;
  elem: number;
  passiveDr: number;
  healBonus: number;
  shieldBonus: number;
  specials: string[];
  firstUltimateUsed: boolean;
  gearGuardUsed: boolean;
  firstHitTaken: boolean;
  gearHitCount: number;
}

export type MasterActionType = 'command' | 'seal' | 'sacrifice';

export interface MasterAction {
  at: number;
  type: MasterActionType;
  targetUid?: string;
}

export interface BattleSetup {
  seed: number;
  mode: BattleMode;
  allies: UnitInit[];
  enemies: UnitInit[];
  masterCharges: number;
  masterActions?: MasterAction[];
  maxTime?: number;
  /** Постоянные модификаторы союзников (Разлом, столовая, ивенты). */
  modifiers?: {
    atk?: number;
    hp?: number;
    crit?: number;
    cdmg?: number;
    spd?: number;
    lifesteal?: number;
    dr?: number;
  };
  /** Модификаторы врагов (hard mode, башни стихий, испытания глав). */
  enemyModifiers?: {
    atk?: number;
    hp?: number;
    crit?: number;
    cdmg?: number;
    spd?: number;
    lifesteal?: number;
    dr?: number;
  };
}

export type BattleEventType =
  | 'battle_start'
  | 'action'
  | 'damage'
  | 'heal'
  | 'shield'
  | 'status'
  | 'energy'
  | 'master'
  | 'shatter'
  | 'echo'
  | 'death'
  | 'battle_end';

export interface BattleEvent {
  t: number;
  type: BattleEventType;
  unitId?: string;
  targetId?: string;
  skillId?: string;
  value?: number;
  status?: StatusKind;
  note?: string;
}

export interface UnitSnapshot {
  uid: string;
  defId: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  energy: number;
}

/** Строка графика боя: вклад каждого юнита. */
export interface UnitBattleStats {
  uid: string;
  defId: string;
  name: string;
  nameEn?: string;
  side: Side;
  damageDealt: number;
  damageTaken: number;
  healing: number;
}

export interface BattleResult {
  seed: number;
  outcome: BattleOutcome;
  timeMs: number;
  damageDealt: number;
  damageTaken: number;
  echoes: string[];
  allies: UnitSnapshot[];
  enemies: UnitSnapshot[];
  stats: UnitBattleStats[];
  log: BattleEvent[];
}

export interface FloorBattleResult {
  outcome: BattleOutcome;
  wavesCleared: number;
  timeMs: number;
  damageDealt: number;
  damageTaken: number;
  allies: UnitSnapshot[];
  echoes: string[];
  stats: UnitBattleStats[];
  waves: BattleResult[];
}
