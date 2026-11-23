import { Rng } from '../core/rng';
import { ENGRAVINGS, ENGRAVINGS_BY_ID } from '../data/engravings';
import { GEAR, GEAR_BY_ID, STARTER_GEAR_IDS } from '../data/gear';
import type {
  EngravingDef,
  EngravingGrade,
  EngravingSet,
  GearDef,
  GearSlot,
  StatKey,
} from '../data/types';
import {
  addStatBonus,
  emptyStatBonus,
  normalizeStatBonus,
  type StatBonus,
} from './battle/stats';
import { enhanceCost, GEAR_LEVEL_STEP, GEAR_MAX_LEVEL } from './config';
import { trackQuest } from './quests';
import type { GearLoadout, SaveV1 } from './save';
import { artifactStats } from './artifacts';

export const ENGRAVING_GRADES: readonly EngravingGrade[] = ['D', 'C', 'B', 'A', 'S', 'SS'];

export const NEXT_ENGRAVING_GRADE: Readonly<Record<EngravingGrade, EngravingGrade | null>> = {
  D: 'C',
  C: 'B',
  B: 'A',
  A: 'S',
  S: 'SS',
  SS: null,
};

export const GEAR_SLOTS: readonly GearSlot[] = ['weapon', 'armor', 'relic', 'boots'];

type BonusPart = Partial<Omit<StatBonus, 'specials'>> & { specials?: string[] };

/**
 * Числовые сет-бонусы гравировок. Тир накапливается: 2, затем +4, затем +6.
 * Текстовые спецэффекты передаются флагами specials и обрабатываются в sim.ts.
 */
const ENGRAVING_SET_BONUSES: Readonly<
  Record<EngravingSet, { two: BonusPart; four: BonusPart; six: BonusPart }>
> = {
  guard: {
    two: { hp: 0.08 },
    four: { hp: 0.12, shield: 0.1 },
    six: { hp: 0.2, specials: ['engraving:guard:6'] },
  },
  blade: {
    two: { atk: 0.08 },
    four: { atk: 0.12, crit: 0.08 },
    six: { atk: 0.2, specials: ['engraving:blade:6'] },
  },
  glass: {
    two: { def: 0.08 },
    four: { def: 0.12 },
    six: { specials: ['engraving:glass:6'] },
  },
  whisper: {
    two: { crit: 0.03 },
    four: { crit: 0.06, cdmg: 0.25 },
    six: { specials: ['engraving:whisper:6'] },
  },
  weep: {
    two: { lifesteal: 0.05 },
    four: { lifesteal: 0.15, heal: 0.1 },
    six: { specials: ['engraving:weep:6'] },
  },
  choir: {
    two: { spd: 3 },
    four: { spd: 5, er: 0.15 },
    six: { specials: ['engraving:choir:6'] },
  },
};

/** Сет-бонусы снаряжения: 2 предмета дают стат, 4 — флаг спецэффекта. */
const GEAR_SET_BONUSES: Readonly<Record<string, { two: BonusPart; four: BonusPart }>> = {
  'echo-guard': {
    two: { hp: 0.1 },
    four: { specials: ['gear:echo-guard:4'] },
  },
  'dawn-blade': {
    two: { atk: 0.1 },
    four: { specials: ['gear:dawn-blade:4'] },
  },
  'quiet-whisper': {
    two: { crit: 0.05 },
    four: { specials: ['gear:quiet-whisper:4'] },
  },
  choir: {
    two: { er: 0.08 },
    four: { specials: ['gear:choir:4'] },
  },
  weep: {
    two: { lifesteal: 0.05 },
    four: { specials: ['gear:weep:4'] },
  },
  glass: {
    two: { def: 0.08 },
    four: { specials: ['gear:glass:4'] },
  },
};

/** Гравировка хранит проценты числом (3 = +3%), SPD — абсолютным значением. */
function engravingContribution(engraving: EngravingDef): BonusPart {
  if (engraving.stat === 'spd') return { spd: engraving.value };
  return { [engraving.stat]: engraving.value / 100 } as BonusPart;
}

/** Основной стат предмета, который растёт при усилении. */
const GEAR_MAIN_STAT: Readonly<Record<GearSlot, StatKey>> = {
  weapon: 'atk',
  armor: 'hp',
  relic: 'atk',
  boots: 'spd',
};

/** Значение стата предмета с учётом усиления (основной стат растёт на 5% за уровень). */
export function gearStatValue(item: GearDef, stat: StatKey, level = 0): number {
  const value = item.stats[stat];
  if (value === undefined) return 0;
  if (stat !== GEAR_MAIN_STAT[item.slot]) return value;
  const multiplier = 1 + GEAR_LEVEL_STEP * Math.min(GEAR_MAX_LEVEL, Math.max(0, level));
  return value * multiplier;
}

/** Снаряжение хранит доли (0.18 = +18%), SPD — абсолютным значением. */
function gearContribution(item: GearDef, level = 0): BonusPart {
  const result: BonusPart = {};
  for (const stat of Object.keys(item.stats) as StatKey[]) {
    const scaled = gearStatValue(item, stat, level);
    if (stat === 'spd') result.spd = (result.spd ?? 0) + scaled;
    else result[stat as Exclude<StatKey, 'spd'>] = (result[stat as Exclude<StatKey, 'spd'>] ?? 0) + scaled;
  }
  return result;
}

/** Уровень усиления предмета (0..20). */
export function gearLevel(save: SaveV1, itemId: string): number {
  const raw = save.inventory.gearLevels?.[itemId];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  return Math.min(GEAR_MAX_LEVEL, Math.max(0, Math.floor(raw)));
}

/** Стоимость следующего уровня; 0 — предмет уже максимальный. */
export function gearNextEnhanceCost(save: SaveV1, itemId: string): number {
  if (!GEAR_BY_ID[itemId]) return 0;
  const level = gearLevel(save, itemId);
  if (level >= GEAR_MAX_LEVEL) return 0;
  return enhanceCost(level + 1);
}

function ownsGear(save: SaveV1, itemId: string): boolean {
  if (save.inventory.gear.includes(itemId)) return true;
  return Object.values(save.heroes).some((hero) =>
    Object.values(hero.gear ?? {}).some((id) => id === itemId),
  );
}

/** Усиливает предмет за пыль. Возвращает число полученных уровней. */
export function enhanceGear(save: SaveV1, itemId: string, times = 1): number {
  if (!GEAR_BY_ID[itemId] || !ownsGear(save, itemId)) return 0;
  save.inventory.gearLevels = save.inventory.gearLevels ?? {};

  let level = gearLevel(save, itemId);
  let gained = 0;
  const operations = Math.max(1, Math.floor(times));

  for (let index = 0; index < operations && level < GEAR_MAX_LEVEL; index += 1) {
    const cost = enhanceCost(level + 1);
    if (save.currencies.dust < cost) break;
    save.currencies.dust -= cost;
    level += 1;
    save.inventory.gearLevels[itemId] = level;
    gained += 1;
  }

  return gained;
}

/**
 * Детерминированный ролл предмета. Используется Разломом, Ареной, Испытаниями
 * и магазином; никакого Math.random.
 */
export function rollGearDrop(seed: number, chance: number): GearDef | null {
  const probability = Math.min(1, Math.max(0, chance));
  if (probability <= 0) return null;
  const rng = new Rng(seed);
  if (!rng.chance(probability)) return null;
  return GEAR[rng.int(0, GEAR.length - 1)] ?? null;
}

function slotEngravings(save: SaveV1, heroId: string): EngravingDef[] {
  const hero = save.heroes[heroId];
  if (!hero) return [];
  const slots = Array.isArray(hero.engravingSlots) ? hero.engravingSlots : [];
  return slots
    .map((id) => (id ? ENGRAVINGS_BY_ID[id] : undefined))
    .filter((item): item is EngravingDef => Boolean(item));
}

function slotGear(save: SaveV1, heroId: string): GearDef[] {
  const hero = save.heroes[heroId];
  if (!hero) return [];
  return GEAR_SLOTS.map((slot) => hero.gear?.[slot])
    .map((id) => (id ? GEAR_BY_ID[id] : undefined))
    .filter((item): item is GearDef => Boolean(item));
}

function countEngravingSets(engravings: readonly EngravingDef[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of engravings) counts[item.set] = (counts[item.set] ?? 0) + 1;
  return counts;
}

function countGearSets(items: readonly GearDef[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.setId] = (counts[item.setId] ?? 0) + 1;
  return counts;
}

/** Сколько камней каждого сета надето на героя (для UI). */
export function engravingSetCounts(save: SaveV1, heroId: string): Record<string, number> {
  return countEngravingSets(slotEngravings(save, heroId));
}

/** Сколько предметов каждого сета надето на героя (для UI). */
export function gearSetCounts(save: SaveV1, heroId: string): Record<string, number> {
  return countGearSets(slotGear(save, heroId));
}

/** Только гравировки и их сет-бонусы 2/4/6. */
export function engravingStats(save: SaveV1, heroId: string): StatBonus {
  const bonus = emptyStatBonus();
  const engravings = slotEngravings(save, heroId);
  for (const item of engravings) addStatBonus(bonus, engravingContribution(item));

  const counts = countEngravingSets(engravings);
  for (const [setId, count] of Object.entries(counts)) {
    const tiers = ENGRAVING_SET_BONUSES[setId as EngravingSet];
    if (!tiers) continue;
    if (count >= 2) addStatBonus(bonus, tiers.two);
    if (count >= 4) addStatBonus(bonus, tiers.four);
    if (count >= 6) addStatBonus(bonus, tiers.six);
  }

  return normalizeStatBonus(bonus);
}

/** Только снаряжение и его сет-бонусы 2/4. */
export function gearStats(save: SaveV1, heroId: string): StatBonus {
  const bonus = emptyStatBonus();
  const items = slotGear(save, heroId);
  for (const item of items) addStatBonus(bonus, gearContribution(item, gearLevel(save, item.id)));

  const counts = countGearSets(items);
  for (const [setId, count] of Object.entries(counts)) {
    const tiers = GEAR_SET_BONUSES[setId];
    if (!tiers) continue;
    if (count >= 2) addStatBonus(bonus, tiers.two);
    if (count >= 4) addStatBonus(bonus, tiers.four);
  }

  return normalizeStatBonus(bonus);
}

/** Полный бонус билда: гравировки + снаряжение + артефакт, с капами и без минусов. */
export function equipmentStats(save: SaveV1, heroId: string): StatBonus {
  const combined = emptyStatBonus();
  addStatBonus(combined, engravingStats(save, heroId));
  addStatBonus(combined, gearStats(save, heroId));
  addStatBonus(combined, artifactStats(save, heroId));
  return normalizeStatBonus(combined);
}

/** Надеть камень. Если слот занят, старый камень возвращается в инвентарь. */
export function equipEngraving(save: SaveV1, heroId: string, slot: number, engravingId: string): boolean {
  const hero = save.heroes[heroId];
  const engraving = ENGRAVINGS_BY_ID[engravingId];
  if (!hero || !engraving) return false;
  if (!Number.isInteger(slot) || slot < 0 || slot >= 6) return false;
  if (!Array.isArray(save.inventory.engravings)) save.inventory.engravings = [];

  const index = save.inventory.engravings.indexOf(engravingId);
  if (index < 0) return false;

  if (!Array.isArray(hero.engravingSlots)) hero.engravingSlots = [null, null, null, null, null, null];
  save.inventory.engravings.splice(index, 1);
  const previous = hero.engravingSlots[slot];
  if (previous) save.inventory.engravings.push(previous);
  hero.engravingSlots[slot] = engravingId;
  return true;
}

/** Снять камень в инвентарь. */
export function unequipEngraving(save: SaveV1, heroId: string, slot: number): boolean {
  const hero = save.heroes[heroId];
  if (!hero) return false;
  if (!Number.isInteger(slot) || slot < 0 || slot >= 6) return false;

  if (!Array.isArray(hero.engravingSlots)) return false;
  const current = hero.engravingSlots[slot];
  if (!current) return false;
  hero.engravingSlots[slot] = null;
  save.inventory.engravings.push(current);
  return true;
}

/**
 * 3 камня одного грейда → 1 камень следующего. По умолчанию одна операция,
 * `times` позволяет слить несколько троек за один коммит.
 */
export function mergeEngravings(save: SaveV1, grade: EngravingGrade, times = 1): number {
  const nextGrade = NEXT_ENGRAVING_GRADE[grade];
  if (!nextGrade) return 0;
  if (!Array.isArray(save.inventory.engravings)) return 0;

  let merged = 0;
  const operations = Math.max(1, Math.floor(times));

  for (let operation = 0; operation < operations; operation += 1) {
    const indices: number[] = [];
    save.inventory.engravings.forEach((id, index) => {
      if (ENGRAVINGS_BY_ID[id]?.grade === grade) indices.push(index);
    });
    if (indices.length < 3) break;

    const consumed = indices.slice(0, 3);
    const firstId = consumed[0] !== undefined ? save.inventory.engravings[consumed[0]] : undefined;
    const first = firstId ? ENGRAVINGS_BY_ID[firstId] : undefined;
    const set = first?.set;
    const result =
      (set ? ENGRAVINGS.find((item) => item.grade === nextGrade && item.set === set) : undefined) ??
      ENGRAVINGS.find((item) => item.grade === nextGrade);
    if (!result) break;

    for (const index of consumed.sort((a, b) => b - a)) save.inventory.engravings.splice(index, 1);
    save.inventory.engravings.push(result.id);
    merged += 1;
  }

  if (merged > 0) trackQuest(save, 'merges', merged);
  return merged;
}

/** Надеть предмет. Если слот занят, старый предмет возвращается в инвентарь. */
export function equipGear(save: SaveV1, heroId: string, slot: GearSlot, itemId: string): boolean {
  const hero = save.heroes[heroId];
  const item = GEAR_BY_ID[itemId];
  if (!hero || !item) return false;
  if (item.slot !== slot) return false;
  if (!Array.isArray(save.inventory.gear)) save.inventory.gear = [];

  const index = save.inventory.gear.indexOf(itemId);
  if (index < 0) return false;

  save.inventory.gear.splice(index, 1);
  const previous = hero.gear?.[slot];
  if (previous) save.inventory.gear.push(previous);
  hero.gear = { ...(hero.gear ?? {}), [slot]: itemId };
  trackQuest(save, 'gear', 1);
  return true;
}

/** Снять предмет в инвентарь. */
export function unequipGear(save: SaveV1, heroId: string, slot: GearSlot): boolean {
  const hero = save.heroes[heroId];
  if (!hero) return false;

  const current = hero.gear?.[slot];
  if (!current) return false;
  const next = { ...(hero.gear ?? {}) };
  delete next[slot];
  hero.gear = next;
  if (!Array.isArray(save.inventory.gear)) save.inventory.gear = [];
  save.inventory.gear.push(current);
  return true;
}

/** Оценка силы снаряжения: основной стат, редкость и сет-бонусы. */
export function gearBuildScore(save: SaveV1, heroId: string): number {
  const stats = gearStats(save, heroId);
  const specials = stats.specials.length;
  return (
    stats.hp * 30 +
    stats.atk * 100 +
    stats.def * 50 +
    stats.spd * 3 +
    stats.crit * 100 +
    stats.cdmg * 20 +
    stats.er * 50 +
    stats.lifesteal * 60 +
    stats.dr * 80 +
    stats.heal * 30 +
    stats.shield * 30 +
    specials * 40
  );
}

function previewGear(save: SaveV1, heroId: string, slot: GearSlot, itemId: string): SaveV1 {
  const hero = save.heroes[heroId];
  if (!hero) return save;
  return {
    ...save,
    heroes: {
      ...save.heroes,
      [heroId]: { ...hero, gear: { ...(hero.gear ?? {}), [slot]: itemId } },
    },
  };
}

/**
 * Автоэкипировка: по очереди подбирает лучший предмет для каждого слота.
 * Каждый шаг обязан повышать оценку билда, поэтому текущий билд не ухудшается.
 */
export function autoEquip(save: SaveV1, heroId: string): GearSlot[] {
  if (!save.heroes[heroId]) return [];
  if (!Array.isArray(save.inventory.gear)) save.inventory.gear = [];

  const changed: GearSlot[] = [];

  for (let pass = 0; pass < 2; pass += 1) {
    for (const slot of GEAR_SLOTS) {
      const hero = save.heroes[heroId];
      if (!hero) return changed;
      const current = hero.gear?.[slot];
      const candidates = new Set<string>();
      if (current) candidates.add(current);
      for (const id of save.inventory.gear) {
        if (GEAR_BY_ID[id]?.slot === slot) candidates.add(id);
      }
      if (candidates.size === 0) continue;

      const currentScore = gearBuildScore(save, heroId);
      let bestId = current;
      let bestScore = currentScore;

      for (const id of candidates) {
        const score = gearBuildScore(previewGear(save, heroId, slot, id), heroId);
        if (score > bestScore + 1e-9) {
          bestScore = score;
          bestId = id;
        }
      }

      if (bestId && bestId !== current && equipGear(save, heroId, slot, bestId)) {
        changed.push(slot);
      }
    }
  }

  return changed;
}

export function gearPreset(save: SaveV1, heroId: string, slot: number): GearLoadout | null {
  const list = save.gearPresets?.[heroId];
  if (!Array.isArray(list)) return null;
  const preset = list[slot];
  if (!preset || Object.keys(preset).length === 0) return null;
  return preset;
}

/** Сохраняет текущее снаряжение героя в слот 0..2. */
export function saveGearPreset(save: SaveV1, heroId: string, slot: number): boolean {
  const hero = save.heroes[heroId];
  if (!hero) return false;
  if (!Number.isInteger(slot) || slot < 0 || slot >= 3) return false;
  const gear = hero.gear ?? {};
  if (Object.keys(gear).length === 0) return false;

  if (!save.gearPresets) save.gearPresets = {};
  const list = save.gearPresets[heroId] ?? [{}, {}, {}];
  while (list.length < 3) list.push({});
  list[slot] = { ...gear };
  save.gearPresets[heroId] = list;
  return true;
}

/** Надевает пресет из инвентаря; занятые другими героями предметы пропускаются. */
export function loadGearPreset(save: SaveV1, heroId: string, slot: number): number {
  if (!Number.isInteger(slot) || slot < 0 || slot >= 3) return 0;
  const preset = gearPreset(save, heroId, slot);
  if (!preset) return 0;

  let applied = 0;
  for (const gearSlot of GEAR_SLOTS) {
    const itemId = preset[gearSlot];
    if (!itemId) continue;
    if (save.heroes[heroId]?.gear?.[gearSlot] === itemId) continue;
    if (save.inventory.gear.includes(itemId) && equipGear(save, heroId, gearSlot, itemId)) {
      applied += 1;
    }
  }
  return applied;
}

/** Стартовый набор выдаётся один раз, чтобы систему можно было проверить сразу. */
export function grantStarterGear(save: SaveV1): boolean {
  if (save.flags.starterGear) return false;
  if (!Array.isArray(save.inventory.gear)) save.inventory.gear = [];
  for (const id of STARTER_GEAR_IDS) {
    if (!save.inventory.gear.includes(id)) save.inventory.gear.push(id);
  }
  save.flags.starterGear = true;
  return true;
}

/** Детерминированный дроп: 5-й и 10-й этажи каждой главы. */
export function gearDropForFloor(floor: number): GearDef | null {
  if (!Number.isFinite(floor) || floor < 5 || floor % 5 !== 0) return null;
  const index = (Math.floor(floor / 5) - 1) % GEAR.length;
  return GEAR[index] ?? null;
}
