export type DiningBuffId = 'guard-soup' | 'spicy-sauce' | 'ice-tea' | 'honey-bread' | 'black-coffee';
export type DiningBuffKind = 'battle' | 'gold' | 'essence';
export type DiningBuffStat = 'hp' | 'atk' | 'spd';

export interface DiningBuffDef {
  id: DiningBuffId;
  nameRu: string;
  nameEn: string;
  descRu: string;
  descEn: string;
  kind: DiningBuffKind;
  stat?: DiningBuffStat;
  /** Доля: 0.1 = +10%. */
  value?: number;
  battles?: number;
  durationMs?: number;
  essence?: number;
}

/** Один бафф столовой в день. Числа — src/data/dining.ts. */
export const DINING_BUFFS: readonly DiningBuffDef[] = [
  {
    id: 'guard-soup',
    nameRu: 'Похлёбка Стража',
    nameEn: 'Guard Soup',
    descRu: '+10% HP на 3 боя',
    descEn: '+10% HP for 3 battles',
    kind: 'battle',
    stat: 'hp',
    value: 0.1,
    battles: 3,
  },
  {
    id: 'spicy-sauce',
    nameRu: 'Острый соус',
    nameEn: 'Spicy Sauce',
    descRu: '+10% ATK на 3 боя',
    descEn: '+10% ATK for 3 battles',
    kind: 'battle',
    stat: 'atk',
    value: 0.1,
    battles: 3,
  },
  {
    id: 'ice-tea',
    nameRu: 'Ледяной чай',
    nameEn: 'Ice Tea',
    descRu: '+10% SPD на 3 боя',
    descEn: '+10% SPD for 3 battles',
    kind: 'battle',
    stat: 'spd',
    value: 0.1,
    battles: 3,
  },
  {
    id: 'honey-bread',
    nameRu: 'Медовый хлеб',
    nameEn: 'Honey Bread',
    descRu: '+15% золота на 1 час',
    descEn: '+15% gold for 1 hour',
    kind: 'gold',
    value: 0.15,
    durationMs: 60 * 60 * 1000,
  },
  {
    id: 'black-coffee',
    nameRu: 'Чёрный кофе',
    nameEn: 'Black Coffee',
    descRu: '+150 эссенции сразу',
    descEn: '+150 essence instantly',
    kind: 'essence',
    essence: 150,
  },
];

export const DINING_BY_ID: Record<string, DiningBuffDef> = Object.fromEntries(
  DINING_BUFFS.map((buff) => [buff.id, buff]),
);
