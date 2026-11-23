import { hashString, Rng } from '../core/rng';
import { HEROES, HEROES_BY_ID, heroPower } from '../data/heroes';
import { FRIEND_NAMES, FRIEND_POWER_FACTORS, MERCENARY_POWER_FACTOR } from '../data/social';
import { allyFromHero } from './battle/factory';
import type { UnitInit } from './battle/types';
import { levelCap } from './config';
import { effectiveLevel } from './resonance';
import type { FriendSave, SaveV1 } from './save';

function weekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

export function mercenaryCap(save: SaveV1): number {
  const powers = Object.keys(save.heroes)
    .map((heroId) => {
      const hero = HEROES_BY_ID[heroId];
      const owned = save.heroes[heroId];
      if (!hero || !owned) return 0;
      return heroPower(hero, effectiveLevel(save, heroId), owned.star);
    })
    .filter((power) => power > 0)
    .sort((a, b) => b - a)
    .slice(0, 5);

  const average =
    powers.length > 0 ? powers.reduce((total, power) => total + power, 0) / powers.length : 1;
  return Math.max(1, Math.round(average * MERCENARY_POWER_FACTOR));
}

/**
 * Друзья детерминированы от сейва: сервер не нужен, оффлайн-игра не страдает.
 * Один и тот же сейв всегда показывает один и тот же список.
 */
export function ensureFriends(save: SaveV1): FriendSave[] {
  if (save.social.friendsSeeded && save.social.friends.length > 0) return save.social.friends;
  if (save.social.friends.length > 0) {
    save.social.friendsSeeded = true;
    return save.social.friends;
  }

  const seed = hashString(`friends|${save.player.name}`);
  const rng = new Rng(seed);
  const pool = HEROES.filter(
    (hero) => hero.rarity >= 4 && hero.id !== 'nira' && !save.heroes[hero.id],
  );
  if (pool.length === 0) {
    save.social.friendsSeeded = true;
    return save.social.friends;
  }

  const ownedLevels = Object.keys(save.heroes).map((heroId) => effectiveLevel(save, heroId));
  const baseLevel = Math.max(1, save.tower.maxFloor, ...ownedLevels);
  const used = new Set<string>();

  for (let index = 0; index < FRIEND_NAMES.length; index += 1) {
    let hero = pool[rng.int(0, pool.length - 1)];
    let guard = 0;
    while (hero && used.has(hero.id) && guard < pool.length) {
      hero = pool[rng.int(0, pool.length - 1)];
      guard += 1;
    }
    if (!hero || used.has(hero.id)) continue;
    used.add(hero.id);

    const star = Math.min(6, Math.max(3, hero.rarity));
    const factor = FRIEND_POWER_FACTORS[index] ?? 1;
    const level = Math.min(levelCap(star), Math.max(1, Math.round(baseLevel * factor)));
    save.social.friends.push({
      id: `friend-${index}`,
      name: FRIEND_NAMES[index] ?? `Friend ${index + 1}`,
      heroId: hero.id,
      level,
      star,
      power: heroPower(hero, level, star),
    });
  }

  save.social.friendsSeeded = true;

  // Гарантируем хотя бы одного доступного друга: первый герой подгоняется под лимит.
  const cap = mercenaryCap(save);
  const first = save.social.friends[0];
  const firstHero = first ? HEROES_BY_ID[first.heroId] : undefined;
  if (first && firstHero && cap > 1) {
    while (first.level > 1 && first.power > cap) {
      first.level -= 1;
      first.power = heroPower(firstHero, first.level, first.star);
    }
  }

  return save.social.friends;
}

export function friendById(save: SaveV1, friendId: string): FriendSave | null {
  return save.social.friends.find((friend) => friend.id === friendId) ?? null;
}

/** Сила наёмника ограничена средней силой отряда и не дублирует коллекцию. */
export function canHireMercenary(save: SaveV1, friendId: string): boolean {
  const friend = friendById(save, friendId);
  if (!friend) return false;
  if (!HEROES_BY_ID[friend.heroId]) return false;
  if (save.heroes[friend.heroId]) return false;
  if (save.squad.includes(friend.heroId)) return false;
  if (save.social.mercenary?.friendId === friendId && save.social.mercenary.heroId === friend.heroId) {
    return false;
  }
  return friend.power <= mercenaryCap(save);
}

/** Наём одного героя друга. Повторный вызов не создаёт второго наёмника. */
export function hireMercenary(save: SaveV1, friendId: string, date = new Date()): boolean {
  if (!canHireMercenary(save, friendId)) return false;
  const friend = friendById(save, friendId);
  if (!friend) return false;

  save.social.mercenary = {
    friendId: friend.id,
    friendName: friend.name,
    heroId: friend.heroId,
    level: friend.level,
    star: friend.star,
    power: friend.power,
    hiredAt: date.getTime(),
    week: weekKey(date),
  };
  return true;
}

export function dismissMercenary(save: SaveV1): boolean {
  if (!save.social.mercenary) return false;
  save.social.mercenary = null;
  return true;
}

export function mercenaryIsActive(save: SaveV1): boolean {
  const mercenary = save.social.mercenary;
  if (!mercenary) return false;
  if (!HEROES_BY_ID[mercenary.heroId]) return false;
  if (save.heroes[mercenary.heroId]) return false;
  if (save.squad.includes(mercenary.heroId)) return false;
  return true;
}

/** Убирает наёмника, если герой появился в коллекции или отряде. */
export function syncMercenary(save: SaveV1): void {
  const mercenary = save.social.mercenary;
  if (!mercenary) return;
  if (!HEROES_BY_ID[mercenary.heroId] || save.heroes[mercenary.heroId] || save.squad.includes(mercenary.heroId)) {
    save.social.mercenary = null;
  }
}

export function mercenaryPower(save: SaveV1): number {
  return mercenaryIsActive(save) ? (save.social.mercenary?.power ?? 0) : 0;
}

/** Боевой юнит наёмника; добавляется шестым, не занимая слот отряда. */
export function mercenaryUnit(save: SaveV1, slot: number): UnitInit | null {
  if (!mercenaryIsActive(save)) return null;
  const mercenary = save.social.mercenary;
  const hero = mercenary ? HEROES_BY_ID[mercenary.heroId] : undefined;
  if (!mercenary || !hero) return null;

  const unit = allyFromHero(hero, { slot, star: mercenary.star, level: mercenary.level });
  return { ...unit, uid: `friend_${unit.uid}` };
}
