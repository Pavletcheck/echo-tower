/**
 * Ним — хранительница Эха. Голос игры: приветствие, обучение, подсказки.
 * Все обращения к игроку идут от её лица, чтобы у игры было «лицо».
 */
export interface GuideDef {
  id: string;
  nameRu: string;
  nameEn: string;
  titleRu: string;
  titleEn: string;
  portrait: string;
  sprite: string;
}

export const GUIDE: GuideDef = {
  id: 'nim',
  nameRu: 'Ним',
  nameEn: 'Nim',
  titleRu: 'Хранительница Эха',
  titleEn: 'Keeper of the Echo',
  portrait: 'assets/guide/portrait.webp',
  sprite: 'assets/guide/sprite.webp',
};

export function guideName(locale: 'ru' | 'en'): string {
  return locale === 'ru' ? GUIDE.nameRu : GUIDE.nameEn;
}

export function guideTitle(locale: 'ru' | 'en'): string {
  return locale === 'ru' ? GUIDE.titleRu : GUIDE.titleEn;
}
