import type { SaveV1 } from './save';

export const PRESET_SLOTS = 3;
const SQUAD_SIZE = 5;

export function presetHeroes(save: SaveV1, slot: number): string[] {
  return save.squadPresets[slot] ?? [];
}

/** Сохраняет текущий отряд в слот 0..2, убирая пустые слоты и дубли. */
export function saveSquadPreset(save: SaveV1, slot: number): boolean {
  if (!Number.isInteger(slot) || slot < 0 || slot >= PRESET_SLOTS) return false;

  const heroes: string[] = [];
  for (const id of save.squad) {
    if (!id || !save.heroes[id] || heroes.includes(id) || heroes.length >= SQUAD_SIZE) continue;
    heroes.push(id);
  }
  if (heroes.length === 0) return false;

  save.squadPresets[slot] = heroes;
  return true;
}

/** Загружает пресет: только owned-герои, без дублей, пустые слоты остаются пустыми. */
export function loadSquadPreset(save: SaveV1, slot: number): boolean {
  if (!Number.isInteger(slot) || slot < 0 || slot >= PRESET_SLOTS) return false;

  const heroes: string[] = [];
  for (const id of presetHeroes(save, slot)) {
    if (!save.heroes[id] || heroes.includes(id) || heroes.length >= SQUAD_SIZE) continue;
    heroes.push(id);
  }
  if (heroes.length === 0) return false;

  while (heroes.length < SQUAD_SIZE) heroes.push('');
  save.squad = heroes;
  return true;
}
