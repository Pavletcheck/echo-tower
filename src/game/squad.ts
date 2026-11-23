import { HEROES_BY_ID } from '../data/heroes';
import { allyFromHero } from './battle/factory';
import type { UnitInit } from './battle/types';
import { equipmentStats } from './equipment';
import { mercenaryUnit } from './mercenary';
import { effectiveLevel } from './resonance';
import type { SaveV1 } from './save';
import { squadElementBonus, withElementAtk } from './squad-element';

/** Собирает боевого юнита героя с учётом гравировок, снаряжения и резонанса. */
export function buildHeroUnit(save: SaveV1, heroId: string, slot: number): UnitInit | null {
  const hero = HEROES_BY_ID[heroId];
  const owned = save.heroes[heroId];
  if (!hero || !owned) return null;

  return allyFromHero(hero, {
    slot,
    star: owned.star,
    level: effectiveLevel(save, heroId),
    bonus: equipmentStats(save, heroId),
    skillLevels: owned.skillLevels,
  });
}

/**
 * Собирает боевые юниты из отряда сейва, пропуская пустые слоты.
 * Бонус стихий применяется здесь, чтобы Башня, Разлом и Арена видели один и тот же отряд.
 */
export function buildSquad(save: SaveV1): UnitInit[] {
  const element = squadElementBonus(save);
  const atkFraction = element.bonus / 100;

  const units = save.squad
    .map((id, slot) => {
      const unit = buildHeroUnit(save, id, slot);
      if (!unit) return null;
      if (atkFraction <= 0 || !unit.bonus) return unit;
      return { ...unit, bonus: withElementAtk(unit.bonus, atkFraction) };
    })
    .filter((unit): unit is UnitInit => unit !== null);

  // Наёмник — один герой друга, шестой боевой юнит. Дубликаты запрещены.
  if (!units.some((unit) => unit.defId === save.social?.mercenary?.heroId)) {
    const mercenary = mercenaryUnit(save, units.length);
    if (mercenary && !units.some((unit) => unit.defId === mercenary.defId && unit.uid === mercenary.uid)) {
      units.push(mercenary);
    }
  }

  return units;
}

/** Сколько героев реально стоят в отряде (живые и принадлежащие игроку). */
export function squadSize(save: SaveV1): number {
  return save.squad.filter((id) => Boolean(id && save.heroes[id])).length;
}
