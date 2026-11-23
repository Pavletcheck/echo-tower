import type {
  Element,
  HeroDef,
  Role,
  SkillDef,
  SkillEffect,
  SkillKind,
  TargetKind,
} from '../types';

export const ELEMENT_COLOR: Record<Element, string> = {
  echo: 'var(--echo)',
  ash: 'var(--ash)',
  frost: 'var(--frost)',
  rot: 'var(--rot)',
  light: 'var(--light)',
};

export const ELEMENT_RU: Record<Element, string> = {
  echo: 'Эхо',
  ash: 'Пепел',
  frost: 'Иней',
  rot: 'Гниль',
  light: 'Свет',
};

export const ELEMENT_EN: Record<Element, string> = {
  echo: 'Echo',
  ash: 'Ash',
  frost: 'Frost',
  rot: 'Rot',
  light: 'Light',
};

export const ROLE_RU: Record<Role, string> = {
  vanguard: 'Страж',
  blade: 'Клинок',
  ranger: 'Стрелок',
  arcanist: 'Маг',
  oracle: 'Оракул',
  support: 'Поддержка',
};

export const ROLE_EN: Record<Role, string> = {
  vanguard: 'Vanguard',
  blade: 'Blade',
  ranger: 'Ranger',
  arcanist: 'Arcanist',
  oracle: 'Oracle',
  support: 'Support',
};

export const ROLE_ORDER: readonly Role[] = ['vanguard', 'blade', 'ranger', 'arcanist', 'oracle', 'support'];

export function elementName(element: Element, locale: 'ru' | 'en'): string {
  return locale === 'ru' ? ELEMENT_RU[element] : ELEMENT_EN[element];
}

export function roleName(role: Role, locale: 'ru' | 'en'): string {
  return locale === 'ru' ? ROLE_RU[role] : ROLE_EN[role];
}

/** Спецификация скилла до присвоения id. */
export type SkillSpec = Omit<SkillDef, 'id'>;

export interface SkillOptions {
  target?: TargetKind;
  mult?: number;
  cooldown?: number;
  cost?: number;
  effects?: SkillEffect[];
  descRu: string;
  descEn: string;
}

/** Компактный конструктор скилла: defaults под авто-атаку. */
export function S(kind: SkillKind, nameRu: string, nameEn: string, options: SkillOptions): SkillSpec {
  const isBasic = kind === 'basic';
  const isPassive = kind === 'passive';
  return {
    kind,
    nameRu,
    nameEn,
    target: options.target ?? 'enemy',
    mult: options.mult ?? (isBasic ? 1 : isPassive ? 0 : 1),
    cooldown: options.cooldown ?? (isBasic || isPassive ? 0 : kind === 'ultimate' ? 8 : 6),
    cost: options.cost ?? (isBasic || isPassive ? 0 : kind === 'ultimate' ? 100 : 50),
    effects: options.effects ?? [{ kind: 'damage', value: options.mult ?? 1 }],
    descriptionRu: options.descRu,
    descriptionEn: options.descEn,
  };
}

export interface HeroInput {
  id: string;
  nameRu: string;
  nameEn: string;
  rarity: 3 | 4 | 5;
  role: Role;
  element: Element;
  base: HeroDef['base'];
  storyRu: string;
  storyEn: string;
  quotes: HeroDef['quotes'];
  codex: [string, string];
  skills: SkillSpec[];
}

/** Конструктор героя: ids скиллов = `${heroId}_${kind}`. */
export function H(input: HeroInput): HeroDef {
  const skills = input.skills.map((skill) => ({ ...skill, id: `${input.id}_${skill.kind}` }));

  if (skills.length !== 4) {
    throw new Error(`Hero ${input.id}: expected 4 skills, got ${skills.length}`);
  }

  return {
    id: input.id,
    nameRu: input.nameRu,
    nameEn: input.nameEn,
    rarity: input.rarity,
    role: input.role,
    element: input.element,
    base: input.base,
    skills: skills as [SkillDef, SkillDef, SkillDef, SkillDef],
    storyRu: input.storyRu,
    storyEn: input.storyEn,
    quotes: input.quotes,
    codex: input.codex,
    asset: {
      card: `assets/heroes/${input.id}/card.webp`,
      portrait: `assets/heroes/${input.id}/portrait.webp`,
      sprite: `assets/heroes/${input.id}/sprite.webp`,
    },
  };
}
