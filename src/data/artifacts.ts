import type { Role, StatKey } from './types';

export interface ArtifactDef {
  id: string;
  role: Role;
  nameRu: string;
  nameEn: string;
  descRu: string;
  descEn: string;
  /** Бонус за каждый уровень. SPD — абсолютное значение, остальное — доли. */
  perLevel: Partial<Record<StatKey, number>>;
}

export const ARTIFACT_MAX_LEVEL = 5;

/** Один signature-артефакт на роль: 6 артефактов, по 5 уровней. */
export const ARTIFACTS: readonly ArtifactDef[] = [
  {
    id: 'artifact-bastion',
    role: 'vanguard',
    nameRu: 'Бастион Эха',
    nameEn: 'Echo Bastion',
    descRu: 'Щит, выкованный из первого падения. Каждый уровень укрепляет HP и DEF.',
    descEn: 'A shield forged from the first fall. Each level strengthens HP and DEF.',
    perLevel: { hp: 0.02, def: 0.02 },
  },
  {
    id: 'artifact-edge',
    role: 'blade',
    nameRu: 'Грань Забвения',
    nameEn: 'Edge of Oblivion',
    descRu: 'Клинок, который помнит имена. Каждый уровень повышает ATK и CRIT.',
    descEn: 'A blade that remembers names. Each level raises ATK and CRIT.',
    perLevel: { atk: 0.025, crit: 0.008 },
  },
  {
    id: 'artifact-hunt',
    role: 'ranger',
    nameRu: 'Охота Ветров',
    nameEn: 'Wind Hunt',
    descRu: 'Лук, ловящий эхо шагов. Каждый уровень повышает ATK и SPD.',
    descEn: 'A bow that catches the echo of steps. Each level raises ATK and SPD.',
    perLevel: { atk: 0.02, spd: 0.8 },
  },
  {
    id: 'artifact-choir',
    role: 'arcanist',
    nameRu: 'Хор Пепла',
    nameEn: 'Choir of Ash',
    descRu: 'Пламя, поющее чужими голосами. Каждый уровень повышает ATK и CDMG.',
    descEn: 'A flame singing with borrowed voices. Each level raises ATK and CDMG.',
    perLevel: { atk: 0.025, cdmg: 0.03 },
  },
  {
    id: 'artifact-mercy',
    role: 'oracle',
    nameRu: 'Милосердие',
    nameEn: 'Mercy',
    descRu: 'Свет, который не спрашивает имени. Каждый уровень повышает HP и лечение.',
    descEn: 'A light that asks no name. Each level raises HP and healing.',
    perLevel: { hp: 0.02, heal: 0.03 },
  },
  {
    id: 'artifact-oath',
    role: 'support',
    nameRu: 'Клятва Хора',
    nameEn: 'Choir Oath',
    descRu: 'Обет, связывающий отряд. Каждый уровень повышает HP и ER.',
    descEn: 'An oath that binds the squad. Each level raises HP and ER.',
    perLevel: { hp: 0.02, er: 0.02 },
  },
];

export const ARTIFACTS_BY_ROLE: Record<Role, ArtifactDef> = Object.fromEntries(
  ARTIFACTS.map((artifact) => [artifact.role, artifact]),
) as Record<Role, ArtifactDef>;

export const ARTIFACTS_BY_ID: Record<string, ArtifactDef> = Object.fromEntries(
  ARTIFACTS.map((artifact) => [artifact.id, artifact]),
);

export function artifactForRole(role: Role): ArtifactDef {
  return ARTIFACTS_BY_ROLE[role];
}
