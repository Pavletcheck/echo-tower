import type { GearDef, GearRarity, GearSetDef, GearSlot, StatKey } from './types';

export const GEAR_SETS: readonly GearSetDef[] = [
  { id: 'echo-guard', nameRu: 'Эхо-стража', nameEn: 'Echo Guard', two: '+10% HP', four: 'при HP ниже 30% — щит 20% на 5 с (раз в бой)' },
  { id: 'dawn-blade', nameRu: 'Клинок Рассвета', nameEn: 'Dawn Blade', two: '+10% ATK', four: 'каждый 4-й удар наносит +40% урона' },
  { id: 'quiet-whisper', nameRu: 'Тихий Шёпот', nameEn: 'Quiet Whisper', two: '+5% CRIT', four: 'крит даёт +10 энергии' },
  { id: 'choir', nameRu: 'Хор', nameEn: 'Choir', two: '+8% ER', four: 'ульта лечит отряд на 5% HP' },
  { id: 'weep', nameRu: 'Плач', nameEn: 'Weep', two: '+5% вампиризма', four: 'избыточное лечение превращается в щит' },
  { id: 'glass', nameRu: 'Стекло', nameEn: 'Glass', two: '+8% DEF', four: 'первый получаемый удар в бою на 50% слабее' },
];

export const GEAR_SETS_BY_ID: Record<string, GearSetDef> = Object.fromEntries(
  GEAR_SETS.map((set) => [set.id, set]),
);

const SET_NAMES: Record<string, { ru: string; en: string }> = {
  'echo-guard': { ru: 'Эхо-стража', en: 'Echo Guard' },
  'dawn-blade': { ru: 'Клинок Рассвета', en: 'Dawn Blade' },
  'quiet-whisper': { ru: 'Тихий Шёпот', en: 'Quiet Whisper' },
  choir: { ru: 'Хор', en: 'Choir' },
  weep: { ru: 'Плач', en: 'Weep' },
  glass: { ru: 'Стекло', en: 'Glass' },
};

const SLOT_NAMES: Record<GearSlot, { ru: string; en: string }> = {
  weapon: { ru: 'оружие', en: 'Weapon' },
  armor: { ru: 'броня', en: 'Armor' },
  relic: { ru: 'реликвия', en: 'Relic' },
  boots: { ru: 'обувь', en: 'Boots' },
};

const SLOT_STATS: Record<GearSlot, Partial<Record<StatKey, number>>> = {
  weapon: { atk: 0.18, crit: 0.05 },
  armor: { hp: 0.22, def: 0.12 },
  relic: { atk: 0.1, hp: 0.1, er: 0.08 },
  boots: { spd: 6, def: 0.06 },
};

function gear(setId: string, slot: GearSlot, rarity: GearRarity): GearDef {
  const set = SET_NAMES[setId];
  const slotName = SLOT_NAMES[slot];
  const stats = { ...SLOT_STATS[slot] };
  if (rarity === 'legendary') {
    for (const key of Object.keys(stats) as StatKey[]) {
      stats[key] = Math.round((stats[key] ?? 0) * 1.25 * 100) / 100;
    }
  }
  return {
    id: `${setId}_${slot}`,
    setId,
    slot,
    rarity,
    nameRu: `${slotName.ru} «${set?.ru ?? setId}»`,
    nameEn: `${slotName.en} of ${set?.en ?? setId}`,
    stats,
  };
}

const RARITY_BY_SET: Record<string, GearRarity> = {
  'echo-guard': 'epic',
  'dawn-blade': 'legendary',
  'quiet-whisper': 'legendary',
  choir: 'epic',
  weep: 'epic',
  glass: 'common',
};

/** 6 сетов × 4 слота = 24 предмета. */
export const GEAR: readonly GearDef[] = GEAR_SETS.flatMap((set) => {
  const rarity = RARITY_BY_SET[set.id] ?? 'epic';
  return (['weapon', 'armor', 'relic', 'boots'] as const).map((slot) => gear(set.id, slot, rarity));
});

export const GEAR_BY_ID: Record<string, GearDef> = Object.fromEntries(
  GEAR.map((item) => [item.id, item]),
);

export function gearBySet(setId: string): readonly GearDef[] {
  return GEAR.filter((item) => item.setId === setId);
}

/** Стартовый набор: 4 common-предмета сета «Стекло». */
export const STARTER_GEAR_IDS = [
  'glass_weapon',
  'glass_armor',
  'glass_relic',
  'glass_boots',
] as const;
