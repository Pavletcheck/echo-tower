import type { RiftBoonDef } from './types';

function b(
  id: string,
  nameRu: string,
  nameEn: string,
  rarity: RiftBoonDef['rarity'],
  descRu: string,
  descEn: string,
  extra: Pick<RiftBoonDef, 'stat' | 'value' | 'special'> = {},
): RiftBoonDef {
  return { id, nameRu, nameEn, rarity, descRu, descEn, ...extra };
}

/** 40 бунов Разлома: статы, стихии, роли и особые правила. */
export const RIFT_BOONS: readonly RiftBoonDef[] = [
  b('b01', 'Грань ярости', 'Facet of Fury', 'common', '+15% ATK', '+15% ATK', { stat: 'atk', value: 15 }),
  b('b02', 'Грань стойкости', 'Facet of Endurance', 'common', '+20% HP', '+20% HP', { stat: 'hp', value: 20 }),
  b('b03', 'Грань скорости', 'Facet of Speed', 'common', '+10 скорости', '+10 SPD', { stat: 'spd', value: 10 }),
  b('b04', 'Грань крита', 'Facet of Precision', 'common', '+8% крит. шанса', '+8% CRIT', { stat: 'crit', value: 8 }),
  b('b05', 'Грань боли', 'Facet of Pain', 'common', '+20% крит. урона', '+20% CDMG', { stat: 'cdmg', value: 20 }),
  b('b06', 'Эхо-вампиризм', 'Echo Leech', 'common', '+8% вампиризма', '+8% lifesteal', { stat: 'lifesteal', value: 8 }),
  b('b07', 'Щит эха', 'Echo Shield', 'common', 'В начале боя щит 15% HP', 'Start each battle with a 15% HP shield', { special: 'shield_start' }),
  b('b08', 'Первый удар', 'First Strike', 'rare', 'Первый удар в бою наносит +100% урона', 'The first hit deals +100% damage', { special: 'first_strike' }),
  b('b09', 'Двойное эхо', 'Double Echo', 'rare', '15% шанс повторить скилл', '15% chance to repeat a skill', { special: 'double_cast' }),
  b('b10', 'Тихая ярость', 'Quiet Fury', 'common', '+25% ATK, −10% HP', '+25% ATK, −10% HP', { stat: 'atk', value: 25 }),
  b('b11', 'Стеклянная кожа', 'Glass Skin', 'common', '+30% DEF, −10% скорости', '+30% DEF, −10% SPD', { stat: 'def', value: 30 }),
  b('b12', 'Холодный расчёт', 'Cold Calculation', 'rare', '+10% крита, +20% крит. урона', '+10% CRIT, +20% CDMG', { stat: 'crit', value: 10 }),
  b('b13', 'Жертва', 'Sacrifice', 'rare', 'При Расколе союзника отряд получает +30% ATK', 'When an ally shatters, the squad gains +30% ATK', { special: 'shatter_atk' }),
  b('b14', 'Память', 'Memory', 'rare', 'При Расколе союзника отряд лечится на 20%', 'When an ally shatters, heal the squad for 20%', { special: 'shatter_heal' }),
  b('b15', 'Гнев павших', 'Wrath of the Fallen', 'epic', 'Каждое эхо даёт +5% ATK отряду', 'Each echo grants +5% ATK to the squad', { special: 'echo_atk' }),
  b('b16', 'Хор', 'Choir', 'rare', 'Ульта союзника даёт +10 энергии всем', 'An ally ultimate grants +10 energy to all', { special: 'ult_energy' }),
  b('b17', 'Эхо-щит', 'Echo Ward', 'rare', '10% шанс отразить урон', '10% chance to reflect damage', { special: 'reflect' }),
  b('b18', 'Яд', 'Poison', 'common', 'Атаки накладывают гниль', 'Attacks apply rot', { special: 'poison' }),
  b('b19', 'Пепел', 'Ash', 'common', 'Атаки накладывают горение', 'Attacks apply burn', { special: 'burn' }),
  b('b20', 'Иней', 'Frost', 'common', 'Атаки замедляют', 'Attacks slow', { special: 'slow' }),
  b('b21', 'Свет', 'Light', 'common', '+15% лечения', '+15% healing', { stat: 'heal', value: 15 }),
  b('b22', 'Тьма', 'Darkness', 'rare', '+20% урона по целям ниже 50% HP', '+20% damage to targets below 50% HP', { special: 'execute' }),
  b('b23', 'Точность', 'Precision', 'common', '+10% урона по одной цели', '+10% damage to a single target', { special: 'single_target' }),
  b('b24', 'Размах', 'Sweep', 'common', '+15% урона по 3+ целям', '+15% damage to 3+ targets', { special: 'aoe' }),
  b('b25', 'Стойкость', 'Resilience', 'common', '−15% длительности контроля', '−15% control duration', { special: 'tenacity' }),
  b('b26', 'Второе дыхание', 'Second Wind', 'epic', 'Раз в бой при смерти — 30% HP', 'Once per battle, survive death at 30% HP', { special: 'second_wind' }),
  b('b27', 'Клятва', 'Oath', 'epic', 'Нира получает +50% силы', 'Nira gains +50% power', { special: 'nira' }),
  b('b28', 'Клинок', 'Blade', 'common', '+20% урона Blade', '+20% damage for Blades', { special: 'role_blade' }),
  b('b29', 'Стена', 'Wall', 'common', '+20% HP Vanguard', '+20% HP for Vanguards', { special: 'role_vanguard' }),
  b('b30', 'Залп', 'Volley', 'common', '+20% урона Ranger', '+20% damage for Rangers', { special: 'role_ranger' }),
  b('b31', 'Чародейство', 'Sorcery', 'common', '+20% урона Arcanist', '+20% damage for Arcanists', { special: 'role_arcanist' }),
  b('b32', 'Молитва', 'Prayer', 'common', '+20% лечения Oracle', '+20% healing for Oracles', { special: 'role_oracle' }),
  b('b33', 'Вдохновение', 'Inspiration', 'common', '+20% силы Support', '+20% power for Supports', { special: 'role_support' }),
  b('b34', 'Один стихийный', 'Monoelement', 'rare', '+25% урона одной стихии', '+25% damage of one element', { special: 'mono_element' }),
  b('b35', 'Радуга', 'Rainbow', 'rare', '+10% урона за каждую стихию в отряде', '+10% damage for each element in the squad', { special: 'rainbow' }),
  b('b36', 'Экономия', 'Economy', 'rare', '−20% стоимости ульты', '−20% ultimate cost', { special: 'ult_cost' }),
  b('b37', 'Ярость крови', 'Blood Fury', 'rare', '+10% ATK за каждого раненого союзника', '+10% ATK for each wounded ally', { special: 'bloodlust' }),
  b('b38', 'Последний рубеж', 'Last Stand', 'rare', '+50% DEF при HP ниже 30%', '+50% DEF below 30% HP', { special: 'last_stand' }),
  b('b39', 'Эхо-взрыв', 'Echo Burst', 'epic', 'При Расколе — 200% ATK по всем', 'On shatter — 200% ATK to all', { special: 'echo_burst' }),
  b('b40', 'Выбор Мастера', 'Master’s Choice', 'epic', '+1 заряд «Руки Мастера»', '+1 Master’s Hand charge', { special: 'master_charge' }),
];

export const RIFT_BOONS_BY_ID: Record<string, RiftBoonDef> = Object.fromEntries(
  RIFT_BOONS.map((boon) => [boon.id, boon]),
);
