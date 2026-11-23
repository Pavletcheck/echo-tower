/** Общие типы контента. Источник правды для данных и валидатора. */

export type Element = 'echo' | 'ash' | 'frost' | 'rot' | 'light';
export type Role = 'vanguard' | 'blade' | 'ranger' | 'arcanist' | 'oracle' | 'support';
export type Rarity = 3 | 4 | 5;

export type SkillKind = 'basic' | 'skill' | 'ultimate' | 'passive';

export type TargetKind =
  | 'enemy'
  | 'enemy-lowest'
  | 'enemy-highest'
  | 'enemy-random'
  | 'all-enemies'
  | 'ally'
  | 'ally-lowest'
  | 'all-allies'
  | 'self';

export type StatusKind =
  | 'bleed'
  | 'burn'
  | 'freeze'
  | 'stun'
  | 'slow'
  | 'haste'
  | 'taunt'
  | 'mark'
  | 'shield'
  | 'regen'
  | 'curse'
  | 'blessing';

export type EffectKind =
  | 'damage'
  | 'heal'
  | 'shield'
  | 'buff'
  | 'debuff'
  | 'dot'
  | 'control'
  | 'energy'
  | 'revive'
  | 'special';

export interface SkillEffect {
  kind: EffectKind;
  status?: StatusKind;
  /** Доля от ATK для урона/лечения (0.25 = 25%) или процент для баффов. */
  value?: number;
  /** Секунды. */
  duration?: number;
  /** 0..1. */
  chance?: number;
  stacks?: number;
}

export interface SkillDef {
  id: string;
  kind: SkillKind;
  nameRu: string;
  nameEn: string;
  target: TargetKind;
  /** Множитель ATK: 1 = 100%. */
  mult: number;
  cooldown: number;
  cost: number;
  effects: SkillEffect[];
  descriptionRu: string;
  descriptionEn: string;
}

export interface HeroBaseStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

export interface HeroDef {
  id: string;
  nameRu: string;
  nameEn: string;
  rarity: Rarity;
  role: Role;
  element: Element;
  base: HeroBaseStats;
  skills: [SkillDef, SkillDef, SkillDef, SkillDef];
  storyRu: string;
  storyEn: string;
  quotes: { battle: string; win: string; shatter: string };
  codex: [string, string];
  asset: { card?: string; portrait?: string; sprite?: string };
}

export type EnemyVariant = 'a' | 'b' | 'c';
export type EnemyFamily =
  | 'shards'
  | 'hounds'
  | 'frost-priests'
  | 'ash-legion'
  | 'rot-gardeners'
  | 'lightbearers'
  | 'echo-doubles'
  | 'tower-machines';

export interface EnemyDef {
  id: string;
  family: EnemyFamily;
  variant: EnemyVariant;
  nameRu: string;
  nameEn: string;
  role: Role;
  element: Element;
  hpMult: number;
  atkMult: number;
  asset: string;
}

export type BossPattern = 'telegraph' | 'enrage' | 'layers' | 'summon' | 'reflect' | 'element-immunity';
export type BossMode = 'tower' | 'world' | 'rift';

export interface BossDef {
  id: string;
  nameRu: string;
  nameEn: string;
  mode: BossMode;
  floor: number;
  role: Role;
  element: Element;
  hpMult: number;
  atkMult: number;
  patterns: BossPattern[];
  units?: number;
  descRu: string;
  descEn: string;
  dropRu: string;
  dropEn: string;
  asset: string;
}

export interface EnemyWave {
  enemies: Array<{ enemyId: string; count: number }>;
}

export interface ChapterDef {
  index: number;
  nameRu: string;
  nameEn: string;
  biome: string;
  families: EnemyFamily[];
  bossId: string;
  element: Element;
}

export interface FloorDef {
  floor: number;
  chapter: number;
  bossId?: string;
  waves: EnemyWave[];
  reward: { gold: number; xp: number; crystals: number; shards: number };
  firstClear: { gold: number; crystals: number };
}

export type EngravingGrade = 'D' | 'C' | 'B' | 'A' | 'S' | 'SS';
export type EngravingSet = 'guard' | 'blade' | 'glass' | 'whisper' | 'weep' | 'choir';
export type StatKey =
  | 'hp'
  | 'atk'
  | 'def'
  | 'spd'
  | 'crit'
  | 'cdmg'
  | 'er'
  | 'lifesteal'
  | 'elem'
  | 'dr'
  | 'heal'
  | 'shield';

export interface EngravingDef {
  id: string;
  nameRu: string;
  nameEn: string;
  grade: EngravingGrade;
  set: EngravingSet;
  stat: StatKey;
  /** Процент или абсолютное значение (spd). */
  value: number;
}

export interface EngravingSetDef {
  id: EngravingSet;
  nameRu: string;
  nameEn: string;
  two: string;
  four: string;
  six: string;
}

export type GearSlot = 'weapon' | 'armor' | 'relic' | 'boots';
export type GearRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface GearDef {
  id: string;
  setId: string;
  slot: GearSlot;
  rarity: GearRarity;
  nameRu: string;
  nameEn: string;
  stats: Partial<Record<StatKey, number>>;
}

export interface GearSetDef {
  id: string;
  nameRu: string;
  nameEn: string;
  two: string;
  four: string;
}

export type QuestType = 'daily' | 'weekly' | 'achievement' | 'event';
export type QuestMetric =
  | 'floors'
  | 'wins'
  | 'summons'
  | 'upgrades'
  | 'starups'
  | 'arena'
  | 'arenaWins'
  | 'arenaLeague'
  | 'rift'
  | 'riftWins'
  | 'expeditions'
  | 'ads'
  | 'login'
  | 'spendGold'
  | 'bossKills'
  | 'merges'
  | 'gear'
  | 'masterHand'
  | 'clears'
  | 'heroes'
  | 'levelups'
  | 'collection'
  | 'codex'
  | 'noShatter'
  | 'eventBattles'
  | 'eventCurrency'
  | 'eventShop'
  | 'eventLogin'
  | 'eventHeroUse'
  | 'eventNoShatter'
  | 'arenaWins'
  | 'arenaLeague';

export interface QuestReward {
  gold?: number;
  crystals?: number;
  seals?: number;
  essence?: number;
  dust?: number;
  shards?: number;
  arenaTokens?: number;
  eventMarks?: number;
  item?: string;
}

export interface QuestDef {
  id: string;
  type: QuestType;
  metric: QuestMetric;
  target: number;
  titleRu: string;
  titleEn: string;
  reward: QuestReward;
}

export interface ShopItemDef {
  id: string;
  slot: 'daily' | 'arena' | 'crystals' | 'pass';
  nameRu: string;
  nameEn: string;
  currency: 'gold' | 'crystals' | 'arenaTokens';
  price: number;
  amount: number;
  limit: 'daily' | 'weekly' | 'none';
}

export interface IapItemDef {
  sku: string;
  nameRu: string;
  nameEn: string;
  priceRub: number;
  priceUsd: number;
  priceStars: number;
  contentsRu: string;
  contentsEn: string;
  platforms: Array<'yandex' | 'telegram'>;
}

export type BoonRarity = 'common' | 'rare' | 'epic';

export interface RiftBoonDef {
  id: string;
  nameRu: string;
  nameEn: string;
  descRu: string;
  descEn: string;
  rarity: BoonRarity;
  stat?: StatKey;
  value?: number;
  special?: string;
}
