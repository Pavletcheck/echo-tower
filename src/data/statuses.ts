import type { StatusKind } from './types';

/** Все статусы боя в порядке отображения в справочнике. */
export const STATUS_KINDS: readonly StatusKind[] = [
  'bleed',
  'burn',
  'freeze',
  'stun',
  'slow',
  'haste',
  'taunt',
  'mark',
  'shield',
  'regen',
  'curse',
  'blessing',
];
