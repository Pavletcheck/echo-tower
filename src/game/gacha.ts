import { Rng } from '../core/rng';
import { now } from '../core/time';
import { HEROES, HEROES_BY_ID, heroPower } from '../data/heroes';
import type { HeroDef, Rarity } from '../data/types';
import { GACHA_COST_SINGLE, GACHA_COST_TEN, PITY_HARD, PITY_RATE_4, PITY_RATE_5, PITY_SOFT } from './config';
import { summonDiscount, addMasterXp } from './base';
import type { HeroSave, SaveV1 } from './save';

export type BannerId = 'standard' | 'featured' | 'beginner';

export interface PullResult {
  hero: HeroDef;
  rarity: Rarity;
  isNew: boolean;
  shards: number;
}

export interface PullOptions {
  free?: boolean;
  useSeal?: boolean;
}

export interface PullAvailability {
  ok: boolean;
  reason?: 'crystals' | 'seals' | 'beginner-used' | 'free-unavailable' | 'count';
}

const SUMMONABLE = HEROES.filter((hero) => hero.id !== 'nira');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const SHARDS_BY_RARITY: Record<Rarity, number> = { 3: 10, 4: 20, 5: 40 };

export function featuredHero(date = new Date()): HeroDef {
  const pool = SUMMONABLE.filter((hero) => hero.rarity === 5);
  const week = Math.floor(date.getTime() / WEEK_MS);
  return pool[week % pool.length] as HeroDef;
}

export function freePullAvailable(save: SaveV1, at = now()): boolean {
  return at - save.gacha.freeAt >= 24 * 60 * 60 * 1000;
}

export function pullCost(
  banner: BannerId,
  count: 1 | 10,
  useSeal = false,
  save?: SaveV1,
): { currency: 'crystals' | 'seals'; amount: number } {
  if (banner === 'beginner') return { currency: 'crystals', amount: 0 };
  if (useSeal) return { currency: 'seals', amount: count };
  const base = count === 1 ? GACHA_COST_SINGLE : GACHA_COST_TEN;
  const amount = save ? Math.max(0, Math.round(base * (1 - summonDiscount(save)))) : base;
  return { currency: 'crystals', amount };
}

export function pullAvailability(save: SaveV1, banner: BannerId, count: 1 | 10, options: PullOptions = {}): PullAvailability {
  // «Первый шаг» — бесплатная десятка ровно один раз на сейв, без кулдауна свободного призыва.
  if (banner === 'beginner') {
    if (count !== 10) return { ok: false, reason: 'count' };
    return save.gacha.beginnerUsed ? { ok: false, reason: 'beginner-used' } : { ok: true };
  }

  if (options.free) {
    return freePullAvailable(save) ? { ok: true } : { ok: false, reason: 'free-unavailable' };
  }

  const cost = pullCost(banner, count, options.useSeal, save);
  if (cost.currency === 'seals') {
    return save.currencies.seals >= cost.amount ? { ok: true } : { ok: false, reason: 'seals' };
  }
  return save.currencies.crystals >= cost.amount ? { ok: true } : { ok: false, reason: 'crystals' };
}

function rollRarity(save: SaveV1, rng: Rng): Rarity {
  save.gacha.pity5 += 1;
  const pity = save.gacha.pity5;

  // Мягкий pity: с 45-го пула шанс растёт, на 70-м — гарант.
  const softBonus = Math.max(0, pity - (PITY_SOFT - 1)) * 0.035;
  const rate5 = pity >= PITY_HARD ? 1 : Math.min(1, PITY_RATE_5 + softBonus);

  const roll = rng.next();
  if (roll < rate5) return 5;
  if (roll < rate5 + PITY_RATE_4) return 4;
  return 3;
}

function heroOfRarity(rarity: Rarity, rng: Rng): HeroDef {
  const pool = SUMMONABLE.filter((hero) => hero.rarity === rarity);
  return rng.pick(pool);
}

/** Только для гаранта стартовой десятки: 5★ должен быть персонажем, а не осколками. */
function heroOfRarityPreferNew(rarity: Rarity, rng: Rng, save: SaveV1): HeroDef {
  const pool = SUMMONABLE.filter((hero) => hero.rarity === rarity);
  const fresh = pool.filter((hero) => !save.heroes[hero.id]);
  return rng.pick(fresh.length > 0 ? fresh : pool);
}

export function heroSave(hero: HeroDef): HeroSave {
  return {
    id: hero.id,
    star: hero.rarity,
    level: 1,
    xp: 0,
    engravingSlots: [null, null, null, null, null, null],
    gear: {},
    memorySeen: false,
    skillLevels: [1, 1, 1, 1],
    artifactLevel: 0,
    ascensionShardsSpent: 0,
    levelGoldSpent: 0,
  };
}

export function squadAverageLevel(save: SaveV1): number {
  const levels = save.squad
    .map((id) => save.heroes[id]?.level)
    .filter((level): level is number => typeof level === 'number' && level > 0);
  if (levels.length === 0) return 1;
  return Math.max(1, Math.round(levels.reduce((sum, level) => sum + level, 0) / levels.length));
}

/** Первый 5★ должен сразу играть: поднимаем до среднего уровня и ставим в отряд. */
function makeBeginnerHeroPlayable(save: SaveV1, hero: HeroDef, level: number, star: number): void {
  const empty = save.squad.findIndex((id) => !id || !save.heroes[id]);
  if (empty >= 0) {
    const next = [...save.squad];
    next[empty] = hero.id;
    save.squad = next;
    return;
  }

  const candidatePower = heroPower(hero, level, star);
  let weakestSlot = -1;
  let weakestPower = Number.POSITIVE_INFINITY;
  for (let slot = 0; slot < save.squad.length; slot += 1) {
    const id = save.squad[slot];
    const owned = id ? save.heroes[id] : undefined;
    const def = id ? HEROES_BY_ID[id] : undefined;
    if (!owned || !def) continue;
    const power = heroPower(def, owned.level, owned.star);
    if (power < weakestPower) {
      weakestPower = power;
      weakestSlot = slot;
    }
  }
  if (weakestSlot >= 0 && candidatePower > weakestPower) {
    const next = [...save.squad];
    next[weakestSlot] = hero.id;
    save.squad = next;
  }
}

/**
 * Мутирует сейв: списывает валюту, обновляет pity и коллекцию.
 * Возвращает список выпавших героев для экрана призыва.
 */
export function performPull(
  save: SaveV1,
  banner: BannerId,
  count: 1 | 10,
  rng: Rng,
  options: PullOptions = {},
): PullResult[] {
  const availability = pullAvailability(save, banner, count, options);
  if (!availability.ok) return [];

  const cost = pullCost(banner, count, options.useSeal, save);
  if (!options.free) {
    if (cost.currency === 'seals') save.currencies.seals -= cost.amount;
    else save.currencies.crystals -= cost.amount;
  }

  if (banner === 'beginner') save.gacha.beginnerUsed = true;
  if (options.free) save.gacha.freeAt = now();

  const featured = featuredHero();
  const results: PullResult[] = [];
  let has4 = false;

  for (let index = 0; index < count; index += 1) {
    save.gacha.totalPulls += 1;
    let rarity = rollRarity(save, rng);

    const isLast = index === count - 1;
    // «Первый шаг»: ровно один 5★ — гарантированный последний слот. Остальные могут быть дублями.
    if (banner === 'beginner' && !isLast && rarity === 5) rarity = 4;
    if (isLast) {
      if (banner === 'beginner') rarity = 5;
      else if (count === 10 && !has4 && rarity < 4) rarity = 4;
    }

    let hero: HeroDef;
    if (rarity === 5) {
      save.gacha.pity5 = 0;
      if (banner === 'featured') {
        if (save.gacha.featuredGuaranteed) {
          hero = featured;
          save.gacha.featuredGuaranteed = false;
        } else if (rng.chance(0.5)) {
          hero = featured;
          save.gacha.featuredGuaranteed = false;
        } else {
          hero = heroOfRarity(5, rng);
          save.gacha.featuredGuaranteed = true;
        }
      } else if (banner === 'beginner') {
        hero = heroOfRarityPreferNew(5, rng, save);
      } else {
        // Стандартный баннер — равный пул всех 5★. Featured-бонус только у «Зова».
        hero = heroOfRarity(5, rng);
      }
    } else {
      hero = heroOfRarity(rarity, rng);
    }

    if (rarity >= 4) has4 = true;

    const existing = save.heroes[hero.id];
    if (existing) {
      const shards = SHARDS_BY_RARITY[rarity];
      save.currencies.starShards[hero.id] = (save.currencies.starShards[hero.id] ?? 0) + shards;
      results.push({ hero, rarity, isNew: false, shards });
    } else {
      const created = heroSave(hero);
      if (banner === 'beginner') created.level = squadAverageLevel(save);
      save.heroes[hero.id] = created;
      results.push({ hero, rarity, isNew: true, shards: 0 });
      if (banner === 'beginner' && isLast) {
        makeBeginnerHeroPlayable(save, hero, created.level, created.star);
      }
    }
  }

  addMasterXp(save, count * 2);
  return results;
}
