import type { BossDef, EnemyDef } from './types';

/** 8 семейств × 3 варианта. id = `${family}_${variant}`. */
export const ENEMIES: readonly EnemyDef[] = [
  { id: 'shards_a', family: 'shards', variant: 'a', nameRu: 'Осколок', nameEn: 'Shard', role: 'blade', element: 'echo', hpMult: 0.9, atkMult: 1.1, asset: 'assets/enemies/shards/a.webp' },
  { id: 'shards_b', family: 'shards', variant: 'b', nameRu: 'Гранёный', nameEn: 'Faceted', role: 'vanguard', element: 'echo', hpMult: 1.3, atkMult: 0.85, asset: 'assets/enemies/shards/b.webp' },
  { id: 'shards_c', family: 'shards', variant: 'c', nameRu: 'Кристальный', nameEn: 'Crystal', role: 'arcanist', element: 'echo', hpMult: 0.85, atkMult: 1.25, asset: 'assets/enemies/shards/c.webp' },

  { id: 'hounds_a', family: 'hounds', variant: 'a', nameRu: 'Щенок', nameEn: 'Pup', role: 'ranger', element: 'echo', hpMult: 0.8, atkMult: 1.0, asset: 'assets/enemies/hounds/a.webp' },
  { id: 'hounds_b', family: 'hounds', variant: 'b', nameRu: 'Гончая', nameEn: 'Hound', role: 'blade', element: 'echo', hpMult: 1.0, atkMult: 1.15, asset: 'assets/enemies/hounds/b.webp' },
  { id: 'hounds_c', family: 'hounds', variant: 'c', nameRu: 'Матриарх', nameEn: 'Matriarch', role: 'support', element: 'echo', hpMult: 1.15, atkMult: 1.0, asset: 'assets/enemies/hounds/c.webp' },

  { id: 'frost-priests_a', family: 'frost-priests', variant: 'a', nameRu: 'Послушник', nameEn: 'Acolyte', role: 'oracle', element: 'frost', hpMult: 0.9, atkMult: 0.9, asset: 'assets/enemies/frost-priests/a.webp' },
  { id: 'frost-priests_b', family: 'frost-priests', variant: 'b', nameRu: 'Жрец', nameEn: 'Priest', role: 'arcanist', element: 'frost', hpMult: 0.9, atkMult: 1.2, asset: 'assets/enemies/frost-priests/b.webp' },
  { id: 'frost-priests_c', family: 'frost-priests', variant: 'c', nameRu: 'Иерарх', nameEn: 'Hierarch', role: 'support', element: 'frost', hpMult: 1.2, atkMult: 1.05, asset: 'assets/enemies/frost-priests/c.webp' },

  { id: 'ash-legion_a', family: 'ash-legion', variant: 'a', nameRu: 'Легионер', nameEn: 'Legionary', role: 'blade', element: 'ash', hpMult: 1.0, atkMult: 1.1, asset: 'assets/enemies/ash-legion/a.webp' },
  { id: 'ash-legion_b', family: 'ash-legion', variant: 'b', nameRu: 'Центурион', nameEn: 'Centurion', role: 'vanguard', element: 'ash', hpMult: 1.35, atkMult: 0.9, asset: 'assets/enemies/ash-legion/b.webp' },
  { id: 'ash-legion_c', family: 'ash-legion', variant: 'c', nameRu: 'Знаменосец', nameEn: 'Standard Bearer', role: 'support', element: 'ash', hpMult: 1.1, atkMult: 1.0, asset: 'assets/enemies/ash-legion/c.webp' },

  { id: 'rot-gardeners_a', family: 'rot-gardeners', variant: 'a', nameRu: 'Садовник', nameEn: 'Gardener', role: 'support', element: 'rot', hpMult: 1.0, atkMult: 0.95, asset: 'assets/enemies/rot-gardeners/a.webp' },
  { id: 'rot-gardeners_b', family: 'rot-gardeners', variant: 'b', nameRu: 'Древень', nameEn: 'Elder Tree', role: 'vanguard', element: 'rot', hpMult: 1.45, atkMult: 0.85, asset: 'assets/enemies/rot-gardeners/b.webp' },
  { id: 'rot-gardeners_c', family: 'rot-gardeners', variant: 'c', nameRu: 'Плодоносец', nameEn: 'Fruitbearer', role: 'arcanist', element: 'rot', hpMult: 0.95, atkMult: 1.2, asset: 'assets/enemies/rot-gardeners/c.webp' },

  { id: 'lightbearers_a', family: 'lightbearers', variant: 'a', nameRu: 'Искра', nameEn: 'Spark', role: 'ranger', element: 'light', hpMult: 0.85, atkMult: 1.2, asset: 'assets/enemies/lightbearers/a.webp' },
  { id: 'lightbearers_b', family: 'lightbearers', variant: 'b', nameRu: 'Служитель', nameEn: 'Server', role: 'oracle', element: 'light', hpMult: 1.0, atkMult: 0.95, asset: 'assets/enemies/lightbearers/b.webp' },
  { id: 'lightbearers_c', family: 'lightbearers', variant: 'c', nameRu: 'Хранитель', nameEn: 'Keeper', role: 'vanguard', element: 'light', hpMult: 1.4, atkMult: 0.9, asset: 'assets/enemies/lightbearers/c.webp' },

  { id: 'echo-doubles_a', family: 'echo-doubles', variant: 'a', nameRu: 'Тень', nameEn: 'Shade', role: 'blade', element: 'echo', hpMult: 0.95, atkMult: 1.15, asset: 'assets/enemies/echo-doubles/a.webp' },
  { id: 'echo-doubles_b', family: 'echo-doubles', variant: 'b', nameRu: 'Отголосок', nameEn: 'Afterecho', role: 'arcanist', element: 'echo', hpMult: 0.9, atkMult: 1.2, asset: 'assets/enemies/echo-doubles/b.webp' },
  { id: 'echo-doubles_c', family: 'echo-doubles', variant: 'c', nameRu: 'Безмолвный', nameEn: 'Silent', role: 'support', element: 'echo', hpMult: 1.15, atkMult: 1.0, asset: 'assets/enemies/echo-doubles/c.webp' },

  { id: 'tower-machines_a', family: 'tower-machines', variant: 'a', nameRu: 'Шестерня', nameEn: 'Gear', role: 'vanguard', element: 'echo', hpMult: 1.5, atkMult: 0.85, asset: 'assets/enemies/tower-machines/a.webp' },
  { id: 'tower-machines_b', family: 'tower-machines', variant: 'b', nameRu: 'Поршень', nameEn: 'Piston', role: 'blade', element: 'echo', hpMult: 1.1, atkMult: 1.15, asset: 'assets/enemies/tower-machines/b.webp' },
  { id: 'tower-machines_c', family: 'tower-machines', variant: 'c', nameRu: 'Ядро', nameEn: 'Core', role: 'arcanist', element: 'echo', hpMult: 0.9, atkMult: 1.3, asset: 'assets/enemies/tower-machines/c.webp' },
];

export const ENEMIES_BY_ID: Record<string, EnemyDef> = Object.fromEntries(
  ENEMIES.map((enemy) => [enemy.id, enemy]),
);

export const BOSSES: readonly BossDef[] = [
  {
    id: 'warden', nameRu: 'Смотритель Первого Эха', nameEn: 'Warden of the First Echo',
    mode: 'tower', floor: 10, role: 'vanguard', element: 'echo', hpMult: 2.2, atkMult: 1.1,
    patterns: ['telegraph', 'summon'],
    descRu: 'Бьёт ряд, каждые 12 секунд зовёт два осколка.', descEn: 'Hits a row and summons two shards every 12 s.',
    dropRu: '30 кристаллов, 2 осколка, эпик-гир, Слеза Эха', dropEn: '30 crystals, 2 shards, epic gear, Echo Tear',
    asset: 'assets/enemies/boss/warden.webp',
  },
  {
    id: 'glass-choir', nameRu: 'Хор Стеклянных Псов', nameEn: 'Glass Hound Choir',
    mode: 'tower', floor: 20, role: 'ranger', element: 'echo', hpMult: 1.4, atkMult: 1.0, units: 3,
    patterns: ['reflect', 'enrage'],
    descRu: 'Три тела, урон делится; убитые воскресают один раз.', descEn: 'Three bodies share damage; slain ones revive once.',
    dropRu: '40 кристаллов, 2 осколка, Слеза Эха', dropEn: '40 crystals, 2 shards, Echo Tear',
    asset: 'assets/enemies/boss/glass-choir.webp',
  },
  {
    id: 'frost-mother', nameRu: 'Мать Инея', nameEn: 'Frost Mother',
    mode: 'tower', floor: 30, role: 'arcanist', element: 'frost', hpMult: 2.2, atkMult: 1.1,
    patterns: ['telegraph', 'summon'],
    descRu: 'Замораживает тыл; на 50% HP поднимает метель.', descEn: 'Freezes the back row; at 50% HP calls a blizzard.',
    dropRu: '50 кристаллов, 3 осколка, Слеза Эха', dropEn: '50 crystals, 3 shards, Echo Tear',
    asset: 'assets/enemies/boss/frost-mother.webp',
  },
  {
    id: 'ash-knight', nameRu: 'Пепельный Рыцарь', nameEn: 'Ash Knight',
    mode: 'tower', floor: 40, role: 'blade', element: 'ash', hpMult: 2.2, atkMult: 1.15,
    patterns: ['reflect', 'enrage'],
    descRu: 'Возвращает 20% урона; после 90 секунд получает +50% ATK.', descEn: 'Reflects 20% damage; after 90 s gains +50% ATK.',
    dropRu: '60 кристаллов, 3 осколка, Слеза Эха', dropEn: '60 crystals, 3 shards, Echo Tear',
    asset: 'assets/enemies/boss/ash-knight.webp',
  },
  {
    id: 'rot-smith', nameRu: 'Кузнец Гнили', nameEn: 'Rot Smith',
    mode: 'tower', floor: 50, role: 'vanguard', element: 'rot', hpMult: 2.4, atkMult: 1.0,
    patterns: ['layers', 'summon'],
    descRu: 'Три слоя щита, зовёт садовников.', descEn: 'Three shield layers, summons gardeners.',
    dropRu: '70 кристаллов, 3 осколка, Слеза Эха', dropEn: '70 crystals, 3 shards, Echo Tear',
    asset: 'assets/enemies/boss/rot-smith.webp',
  },
  {
    id: 'master-double', nameRu: 'Двойник Мастера', nameEn: 'Master’s Double',
    mode: 'tower', floor: 60, role: 'blade', element: 'echo', hpMult: 1.0, atkMult: 1.0,
    patterns: ['telegraph', 'reflect', 'enrage'],
    descRu: 'Копирует ваш отряд и его скиллы. Показывает игроку его собственную сборку.', descEn: 'Copies your squad and its skills, holding a mirror to your build.',
    dropRu: '80 кристаллов, 4 осколка, Слеза Эха', dropEn: '80 crystals, 4 shards, Echo Tear',
    asset: 'assets/enemies/boss/master-double.webp',
  },
  {
    id: 'light-keeper', nameRu: 'Хранительница Света', nameEn: 'Light Keeper',
    mode: 'tower', floor: 70, role: 'oracle', element: 'light', hpMult: 2.2, atkMult: 1.0,
    patterns: ['element-immunity', 'summon'],
    descRu: 'Иммунна к Свету, лечит себя на 5% каждые 3 секунды.', descEn: 'Immune to Light; heals herself for 5% every 3 s.',
    dropRu: '90 кристаллов, 4 осколка, Слеза Эха', dropEn: '90 crystals, 4 shards, Echo Tear',
    asset: 'assets/enemies/boss/light-keeper.webp',
  },
  {
    id: 'silent-master', nameRu: 'Тихий Мастер', nameEn: 'Silent Master',
    mode: 'tower', floor: 80, role: 'support', element: 'echo', hpMult: 2.6, atkMult: 1.1,
    patterns: ['layers', 'summon'],
    descRu: 'Забирает энергию и оглушает тыл.', descEn: 'Drains energy and stuns the back row.',
    dropRu: '100 кристаллов, 4 осколка, Слеза Эха', dropEn: '100 crystals, 4 shards, Echo Tear',
    asset: 'assets/enemies/boss/silent-master.webp',
  },
  {
    id: 'archivist', nameRu: 'Архивариус Эха', nameEn: 'Echo Archivist',
    mode: 'tower', floor: 90, role: 'arcanist', element: 'echo', hpMult: 2.6, atkMult: 1.15,
    patterns: ['reflect', 'summon'],
    descRu: 'Копирует ваши ульты и зовёт записи героев.', descEn: 'Copies your ultimates and summons records of heroes.',
    dropRu: '110 кристаллов, 5 осколков, Слеза Эха', dropEn: '110 crystals, 5 shards, Echo Tear',
    asset: 'assets/enemies/boss/archivist.webp',
  },
  {
    id: 'tower-heart', nameRu: 'Сердце Башни', nameEn: 'Heart of the Tower',
    mode: 'tower', floor: 100, role: 'arcanist', element: 'echo', hpMult: 3.0, atkMult: 1.2,
    patterns: ['telegraph', 'layers', 'summon', 'enrage'],
    descRu: 'Три фазы: щит, призыв, ярость. Меняет стихию каждые 20 секунд.', descEn: 'Three phases: shield, summon, enrage. Changes element every 20 s.',
    dropRu: '120 кристаллов, 5 осколков, 3 Слезы, титул', dropEn: '120 crystals, 5 shards, 3 Tears, title',
    asset: 'assets/enemies/boss/tower-heart.webp',
  },
  {
    id: 'oblivion-tree', nameRu: 'Древень Забвения', nameEn: 'Tree of Oblivion',
    mode: 'world', floor: 0, role: 'vanguard', element: 'rot', hpMult: 8.0, atkMult: 1.3,
    patterns: ['layers', 'summon'],
    descRu: 'Общий босс недели: пять слоёв, урон суммируется по всем игрокам.', descEn: 'Weekly shared boss: five layers, damage is summed across players.',
    dropRu: '60 кристаллов, эссенция, титул', dropEn: '60 crystals, essence, title',
    asset: 'assets/enemies/boss/oblivion-tree.webp',
  },
  {
    id: 'nira-reflection', nameRu: 'Отражение Ниры', nameEn: 'Nira’s Reflection',
    mode: 'rift', floor: 0, role: 'support', element: 'light', hpMult: 1.8, atkMult: 1.1,
    patterns: ['telegraph', 'reflect'],
    descRu: 'Злая копия Ниры с вашими статами.', descEn: 'A dark copy of Nira with your stats.',
    dropRu: '150 кристаллов, 80 эссенции, облик', dropEn: '150 crystals, 80 essence, a skin',
    asset: 'assets/enemies/boss/nira-reflection.webp',
  },
];

export const BOSSES_BY_ID: Record<string, BossDef> = Object.fromEntries(
  BOSSES.map((boss) => [boss.id, boss]),
);
