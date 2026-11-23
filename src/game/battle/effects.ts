import type { StatusKind } from '../../data/types';
import type { ActiveStatus, Unit } from './types';

const MAX_STACKS: Partial<Record<StatusKind, number>> = { bleed: 3, burn: 2 };
const CONTROL_KINDS: readonly StatusKind[] = ['freeze', 'stun', 'taunt'];
const DOT_KINDS: readonly StatusKind[] = ['bleed', 'burn'];

export function isControl(kind: StatusKind): boolean {
  return CONTROL_KINDS.includes(kind);
}

export function hasStatus(unit: Unit, kind: StatusKind): boolean {
  return unit.statuses.some((status) => status.kind === kind);
}

export function statusStacks(unit: Unit, kind: StatusKind): number {
  return unit.statuses
    .filter((status) => status.kind === kind)
    .reduce((total, status) => total + status.stacks, 0);
}

/**
 * Наложение статуса с капом стаков и анти-цепочкой контроля:
 * не больше 2 контролей одновременно, после выхода — иммунитет 2 с.
 */
export function addStatus(unit: Unit, status: ActiveStatus, time: number): boolean {
  if (!unit.alive) return false;

  if (isControl(status.kind)) {
    if (time < unit.controlImmuneUntil) return false;
    const activeControls = unit.statuses.filter((item) => isControl(item.kind)).length;
    if (activeControls >= 2) return false;
  }

  const limit = MAX_STACKS[status.kind] ?? 1;
  const existing = unit.statuses.find((item) => item.kind === status.kind);

  if (existing) {
    existing.stacks = Math.min(limit, existing.stacks + (status.stacks ?? 1));
    existing.remaining = Math.max(existing.remaining, status.remaining);
    existing.value = Math.max(existing.value, status.value);
    return true;
  }

  unit.statuses.push({ ...status, stacks: Math.min(limit, status.stacks ?? 1) });
  return true;
}

export interface StatusTickResult {
  damage: number;
  healing: number;
}

/** Тик статусов: DoT, регенерация, истечение и иммунитет к контролю. */
export function tickStatuses(unit: Unit, dt: number, time: number): StatusTickResult {
  let damage = 0;
  let healing = 0;

  for (const status of unit.statuses) {
    status.remaining -= dt;

    if (DOT_KINDS.includes(status.kind)) {
      damage += unit.atk * status.value * status.stacks * dt;
    } else if (status.kind === 'regen') {
      healing += unit.atk * status.value * status.stacks * dt;
    }
  }

  const expired = unit.statuses.filter((status) => status.remaining <= 0);
  for (const status of expired) {
    if (isControl(status.kind)) unit.controlImmuneUntil = time + 2;
  }
  unit.statuses = unit.statuses.filter((status) => status.remaining > 0);

  return { damage, healing };
}

export function isControlled(unit: Unit): boolean {
  return hasStatus(unit, 'stun') || hasStatus(unit, 'freeze');
}

export function attackMultiplier(unit: Unit): number {
  let multiplier = 1;
  if (hasStatus(unit, 'blessing')) multiplier += 0.2;
  if (hasStatus(unit, 'curse')) multiplier -= 0.25;
  return Math.max(0.3, multiplier);
}

export function speedMultiplier(unit: Unit): number {
  let multiplier = 1;
  if (hasStatus(unit, 'haste')) multiplier += 0.3;
  if (hasStatus(unit, 'slow')) multiplier -= 0.3;
  return Math.max(0.4, multiplier);
}

export function incomingMultiplier(unit: Unit): number {
  return hasStatus(unit, 'mark') ? 1.15 : 1;
}

export function isShieldActive(unit: Unit, time: number): boolean {
  return unit.shield > 0 && time < unit.shieldUntil;
}

export function clearExpiredShield(unit: Unit, time: number): void {
  if (time >= unit.shieldUntil) unit.shield = 0;
}
