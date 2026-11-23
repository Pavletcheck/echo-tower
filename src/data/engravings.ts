import type { EngravingDef, EngravingGrade, EngravingSet, EngravingSetDef, StatKey } from './types';

function e(
  id: string,
  nameRu: string,
  nameEn: string,
  grade: EngravingGrade,
  set: EngravingSet,
  stat: StatKey,
  value: number,
): EngravingDef {
  return { id, nameRu, nameEn, grade, set, stat, value };
}

/** 40 гравировок: 6 грейдов × 6 сетов, с уникальными SS-камнями. */
export const ENGRAVINGS: readonly EngravingDef[] = [
  e('guard_hp_d', 'Осколок Стража D', 'Guard Shard D', 'D', 'guard', 'hp', 3),
  e('guard_hp_c', 'Осколок Стража C', 'Guard Shard C', 'C', 'guard', 'hp', 5),
  e('guard_hp_b', 'Осколок Стража B', 'Guard Shard B', 'B', 'guard', 'hp', 8),
  e('guard_hp_a', 'Осколок Стража A', 'Guard Shard A', 'A', 'guard', 'hp', 12),
  e('guard_hp_s', 'Осколок Стража S', 'Guard Shard S', 'S', 'guard', 'hp', 17),
  e('guard_hp_ss', 'Сердце Стража SS', 'Guard Heart SS', 'SS', 'guard', 'hp', 24),

  e('blade_atk_d', 'Клинок D', 'Blade D', 'D', 'blade', 'atk', 3),
  e('blade_atk_c', 'Клинок C', 'Blade C', 'C', 'blade', 'atk', 5),
  e('blade_atk_b', 'Клинок B', 'Blade B', 'B', 'blade', 'atk', 8),
  e('blade_atk_a', 'Клинок A', 'Blade A', 'A', 'blade', 'atk', 12),
  e('blade_atk_s', 'Клинок S', 'Blade S', 'S', 'blade', 'atk', 17),
  e('blade_atk_ss', 'Клинок Рассвета SS', 'Dawn Blade SS', 'SS', 'blade', 'atk', 24),

  e('glass_def_d', 'Грань D', 'Facet D', 'D', 'glass', 'def', 4),
  e('glass_def_b', 'Грань B', 'Facet B', 'B', 'glass', 'def', 9),
  e('glass_def_s', 'Грань S', 'Facet S', 'S', 'glass', 'def', 18),
  e('glass_def_ss', 'Призма SS', 'Prism SS', 'SS', 'glass', 'def', 26),

  e('whisper_crit_d', 'Искра D', 'Spark D', 'D', 'whisper', 'crit', 2),
  e('whisper_crit_c', 'Искра C', 'Spark C', 'C', 'whisper', 'crit', 3),
  e('whisper_crit_b', 'Искра B', 'Spark B', 'B', 'whisper', 'crit', 4),
  e('whisper_crit_a', 'Искра A', 'Spark A', 'A', 'whisper', 'crit', 6),
  e('whisper_crit_s', 'Искра S', 'Spark S', 'S', 'whisper', 'crit', 8),
  e('whisper_crit_ss', 'Тихий Шёпот SS', 'Quiet Whisper SS', 'SS', 'whisper', 'crit', 11),

  e('weep_cdmg_d', 'Роса D', 'Dew D', 'D', 'weep', 'cdmg', 4),
  e('weep_cdmg_b', 'Роса B', 'Dew B', 'B', 'weep', 'cdmg', 8),
  e('weep_cdmg_s', 'Роса S', 'Dew S', 'S', 'weep', 'cdmg', 14),
  e('weep_cdmg_ss', 'Плач SS', 'Weep SS', 'SS', 'weep', 'cdmg', 20),

  e('choir_spd_d', 'Ветер D', 'Wind D', 'D', 'choir', 'spd', 3),
  e('choir_spd_a', 'Ветер A', 'Wind A', 'A', 'choir', 'spd', 5),
  e('choir_spd_s', 'Хор S', 'Choir S', 'S', 'choir', 'spd', 8),
  e('choir_spd_ss', 'Голос Хора SS', 'Choir Voice SS', 'SS', 'choir', 'spd', 12),

  e('choir_er_c', 'Капля C', 'Drop C', 'C', 'choir', 'er', 6),
  e('choir_er_s', 'Капля S', 'Drop S', 'S', 'choir', 'er', 10),

  e('weep_ls_b', 'Эхо-жила B', 'Echo Vein B', 'B', 'weep', 'lifesteal', 3),
  e('weep_ls_s', 'Эхо-жила S', 'Echo Vein S', 'S', 'weep', 'lifesteal', 6),

  e('blade_elem_c', 'Печать C', 'Seal C', 'C', 'blade', 'elem', 4),
  e('blade_elem_a', 'Печать A', 'Seal A', 'A', 'blade', 'elem', 7),
  e('blade_elem_ss', 'Печать SS', 'Seal SS', 'SS', 'blade', 'elem', 12),

  e('guard_dr_c', 'Броня C', 'Armor C', 'C', 'guard', 'dr', 4),
  e('guard_dr_a', 'Броня A', 'Armor A', 'A', 'guard', 'dr', 7),
  e('guard_dr_ss', 'Броня SS', 'Armor SS', 'SS', 'guard', 'dr', 11),
];

export const ENGRAVINGS_BY_ID: Record<string, EngravingDef> = Object.fromEntries(
  ENGRAVINGS.map((engraving) => [engraving.id, engraving]),
);

export const ENGRAVING_SETS: readonly EngravingSetDef[] = [
  {
    id: 'guard', nameRu: 'Стража', nameEn: 'Guard',
    two: '+8% HP', four: '+12% HP, +10% к щитам', six: '+20% HP; при Расколе союзника отряд получает щит 30%',
  },
  {
    id: 'blade', nameRu: 'Клинок', nameEn: 'Blade',
    two: '+8% ATK', four: '+12% ATK, +8% CRIT', six: '+20% ATK; первая ульта бьёт на 30% сильнее',
  },
  {
    id: 'glass', nameRu: 'Стекло', nameEn: 'Glass',
    two: '+8% DEF', four: '+12% DEF, −10% урона по тылу', six: '25% шанс отразить 30% урона',
  },
  {
    id: 'whisper', nameRu: 'Шёпот', nameEn: 'Whisper',
    two: '+3% CRIT', four: '+6% CRIT, +25% CDMG', six: '+40% CDMG по целям с меткой',
  },
  {
    id: 'weep', nameRu: 'Плач', nameEn: 'Weep',
    two: '+5% вампиризма', four: '+15% вампиризма, +10% лечения', six: 'при Расколе героя отряд лечится на 25%',
  },
  {
    id: 'choir', nameRu: 'Хор', nameEn: 'Choir',
    two: '+3 SPD', four: '+5 SPD, +15% ER', six: 'ульта союзника даёт +10 энергии всем',
  },
];

export const ENGRAVING_SETS_BY_ID: Record<string, EngravingSetDef> = Object.fromEntries(
  ENGRAVING_SETS.map((set) => [set.id, set]),
);
