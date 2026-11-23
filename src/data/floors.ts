import { floorGold, floorXp } from '../game/config';
import type { ChapterDef, EnemyWave, FloorDef } from './types';

export const CHAPTERS: readonly ChapterDef[] = [
  { index: 1, nameRu: 'Стеклянный порог', nameEn: 'Glass Threshold', biome: 'glass', families: ['shards'], bossId: 'warden', element: 'echo' },
  { index: 2, nameRu: 'Шёпот-холл', nameEn: 'Whisper Hall', biome: 'library', families: ['shards', 'hounds'], bossId: 'glass-choir', element: 'echo' },
  { index: 3, nameRu: 'Морозный архив', nameEn: 'Frost Archive', biome: 'ice', families: ['frost-priests', 'shards'], bossId: 'frost-mother', element: 'frost' },
  { index: 4, nameRu: 'Пепельные казармы', nameEn: 'Ash Barracks', biome: 'ash', families: ['ash-legion'], bossId: 'ash-knight', element: 'ash' },
  { index: 5, nameRu: 'Оранжерея гнили', nameEn: 'Rot Greenhouse', biome: 'swamp', families: ['rot-gardeners'], bossId: 'rot-smith', element: 'rot' },
  { index: 6, nameRu: 'Зеркальный ярус', nameEn: 'Mirror Tier', biome: 'mirror', families: ['echo-doubles'], bossId: 'master-double', element: 'echo' },
  { index: 7, nameRu: 'Светлый шпиль', nameEn: 'Luminous Spire', biome: 'temple', families: ['lightbearers'], bossId: 'light-keeper', element: 'light' },
  { index: 8, nameRu: 'Палаты Тишины', nameEn: 'Chambers of Silence', biome: 'void', families: ['echo-doubles', 'tower-machines'], bossId: 'silent-master', element: 'echo' },
  { index: 9, nameRu: 'Архив Эха', nameEn: 'Echo Archive', biome: 'archive', families: ['tower-machines', 'echo-doubles'], bossId: 'archivist', element: 'echo' },
  { index: 10, nameRu: 'Сердце Башни', nameEn: 'Heart of the Tower', biome: 'core', families: ['tower-machines', 'echo-doubles'], bossId: 'tower-heart', element: 'echo' },
];

export const CHAPTERS_BY_INDEX: Record<number, ChapterDef> = Object.fromEntries(
  CHAPTERS.map((chapter) => [chapter.index, chapter]),
);

function composition(chapter: ChapterDef, waveIndex: number, count: number): EnemyWave {
  const variants = ['a', 'b', 'c'] as const;
  const stacks = new Map<string, number>();

  for (let index = 0; index < count; index += 1) {
    const family = chapter.families[(waveIndex + index) % chapter.families.length];
    const variant = variants[(index + waveIndex) % variants.length];
    if (!family) continue;
    const enemyId = `${family}_${variant}`;
    stacks.set(enemyId, (stacks.get(enemyId) ?? 0) + 1);
  }

  return { enemies: [...stacks.entries()].map(([enemyId, amount]) => ({ enemyId, count: amount })) };
}

function buildWaves(chapter: ChapterDef, _floorInChapter: number, bossId?: string): EnemyWave[] {
  const waves: EnemyWave[] = [
    composition(chapter, 0, 2),
    composition(chapter, 1, 3),
    composition(chapter, 2, 3),
  ];

  if (bossId) {
    waves[2] = { enemies: [{ enemyId: bossId, count: 1 }] };
  }

  return waves;
}

function buildFloors(): FloorDef[] {
  const floors: FloorDef[] = [];

  for (let floor = 1; floor <= 100; floor += 1) {
    const chapterIndex = Math.ceil(floor / 10);
    const chapter = CHAPTERS_BY_INDEX[chapterIndex];
    if (!chapter) throw new Error(`Missing chapter ${chapterIndex}`);

    const floorInChapter = ((floor - 1) % 10) + 1;
    const isChapterBoss = floorInChapter === 10;
    const isMidBoss = floorInChapter === 5;
    const bossId = isChapterBoss
      ? chapter.bossId
      : isMidBoss
        ? chapter.bossId
        : undefined;

    floors.push({
      floor,
      chapter: chapterIndex,
      ...(bossId ? { bossId } : {}),
      waves: buildWaves(chapter, floorInChapter, bossId),
      reward: {
        gold: floorGold(floor),
        xp: floorXp(floor),
        crystals: 0,
        shards: bossId ? 1 : 0,
      },
      firstClear: {
        gold: floorGold(floor) * 3,
        crystals: 20 + floor,
      },
    });
  }

  return floors;
}

export const FLOORS: readonly FloorDef[] = buildFloors();

export const FLOORS_BY_NUMBER: Record<number, FloorDef> = Object.fromEntries(
  FLOORS.map((floor) => [floor.floor, floor]),
);

export function getFloor(floor: number): FloorDef | undefined {
  return FLOORS_BY_NUMBER[floor];
}

export function chapterOf(floor: number): ChapterDef | undefined {
  return CHAPTERS_BY_INDEX[Math.max(1, Math.min(10, Math.ceil(floor / 10)))];
}
