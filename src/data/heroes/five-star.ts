import type { HeroDef } from '../types';
import { H, S } from './common';

/** 5★-тир: семь природных легенд + сюжетная Нира. */
export const FIVE_STAR: readonly HeroDef[] = [
  H({
    id: 'belquist',
    nameRu: 'Бельквист',
    nameEn: 'Belquist',
    rarity: 5,
    role: 'blade',
    element: 'echo',
    base: { hp: 1100, atk: 146, def: 55, spd: 105 },
    storyRu:
      'Клинок, который помнит каждое имя, произнесённое перед ударом. Он не служит Башне — он служит тем, кого Башня забрала.',
    storyEn:
      'A blade that remembers every name spoken before a strike. He does not serve the Tower — he serves the ones it took.',
    quotes: {
      battle: 'Не вставай у меня на пути.',
      win: 'Ещё один этаж. Ещё один шанс.',
      shatter: 'Не… записывай меня в список…',
    },
    codex: [
      'Бельквист никогда не называет свой клинок оружием. Только «свидетелем».',
      'Он единственный, кто помнит имя первого павшего героя. И молчит о нём.',
    ],
    skills: [
      S('basic', 'Рассекающий удар', 'Severing Slash', {
        descRu: '100% ATK по одной цели.',
        descEn: '100% ATK to one target.',
      }),
      S('skill', 'Эхо-разрез', 'Echo Slash', {
        mult: 2.2,
        effects: [
          { kind: 'damage', value: 2.2 },
          { kind: 'dot', status: 'bleed', value: 0.08, duration: 4 },
        ],
        descRu: '220% ATK по двум ближайшим целям, накладывает кровотечение на 4 с.',
        descEn: '220% ATK to the two nearest enemies and applies bleed for 4 s.',
      }),
      S('ultimate', 'Разрез мира', 'World Cleave', {
        mult: 3.8,
        effects: [
          { kind: 'damage', value: 3.8 },
          { kind: 'special', value: 0.5 },
        ],
        descRu: '380% ATK по одной цели, игнорирует 50% защиты.',
        descEn: '380% ATK to one target, ignores 50% DEF.',
      }),
      S('passive', 'Третий удар', 'Third Strike', {
        effects: [{ kind: 'special', value: 0.5 }],
        descRu: 'Каждый третий удар игнорирует 50% защиты цели.',
        descEn: 'Every third hit ignores 50% of the target DEF.',
      }),
    ],
  }),

  H({
    id: 'iria',
    nameRu: 'Ирия',
    nameEn: 'Iria',
    rarity: 5,
    role: 'oracle',
    element: 'light',
    base: { hp: 1134, atk: 105, def: 50, spd: 100 },
    storyRu:
      'Жрица, которая лечит не раны, а память. Её свет не спрашивает, достоин ли ты, — и это пугает сильнее тьмы.',
    storyEn:
      'A priestess who heals not wounds but memory. Her light never asks if you deserve it — and that is more frightening than darkness.',
    quotes: {
      battle: 'Свет не спрашивает, достоин ли ты.',
      win: 'Сегодня никто не ушёл.',
      shatter: 'Тепло… остаётся…',
    },
    codex: [
      'Ирия помнит всех, кого вылечила. Их становится слишком много, и она перестаёт спать.',
      'Она считает, что эхо — это не смерть, а просьба остаться.',
    ],
    skills: [
      S('basic', 'Луч света', 'Ray of Light', {
        descRu: '100% ATK по одной цели.',
        descEn: '100% ATK to one target.',
      }),
      S('skill', 'Тёплый свет', 'Warm Light', {
        target: 'ally-lowest',
        mult: 2,
        effects: [
          { kind: 'heal', value: 2 },
          { kind: 'special', value: 1 },
        ],
        descRu: 'Лечит союзника с наименьшим HP на 200% ATK и снимает контроль.',
        descEn: 'Heals the lowest-HP ally for 200% ATK and cleanses control.',
      }),
      S('ultimate', 'Рассвет', 'Dawn', {
        target: 'all-allies',
        mult: 3.2,
        effects: [
          { kind: 'heal', value: 3.2 },
          { kind: 'shield', value: 0.1, duration: 6 },
        ],
        descRu: 'Лечит весь отряд на 320% ATK и даёт щит 10% HP на 6 с.',
        descEn: 'Heals the whole squad for 320% ATK and grants a 10% HP shield for 6 s.',
      }),
      S('passive', 'Память света', 'Memory of Light', {
        effects: [{ kind: 'special', value: 0.15 }],
        descRu: 'Когда союзник рассыпается эхом, отряд лечится на 15% HP.',
        descEn: 'When an ally shatters into an echo, the squad heals for 15% HP.',
      }),
    ],
  }),

  H({
    id: 'morvain',
    nameRu: 'Морвейн',
    nameEn: 'Morvain',
    rarity: 5,
    role: 'arcanist',
    element: 'frost',
    base: { hp: 900, atk: 154, def: 40, spd: 100 },
    storyRu:
      'Маг, который заморозил собственную память, чтобы не чувствовать. Лёд получился красивым — и совершенно пустым.',
    storyEn:
      'A mage who froze his own memory to stop feeling. The ice came out beautiful — and entirely empty.',
    quotes: {
      battle: 'Холодно? Это ненадолго.',
      win: 'Расчёт был верным.',
      shatter: 'Логика… подвела…',
    },
    codex: [
      'Морвейн утверждает, что эмоции — это ошибка округления.',
      'В его архиве есть одна незамёрзшая страница. Он не помнит, чья она.',
    ],
    skills: [
      S('basic', 'Ледяная игла', 'Ice Needle', {
        descRu: '100% ATK по одной цели.',
        descEn: '100% ATK to one target.',
      }),
      S('skill', 'Кристаллизация', 'Crystallize', {
        target: 'all-enemies',
        mult: 1.8,
        effects: [
          { kind: 'damage', value: 1.8 },
          { kind: 'control', status: 'freeze', duration: 1.2 },
        ],
        descRu: '180% ATK по всем врагам, замораживает на 1.2 с.',
        descEn: '180% ATK to all enemies, freezes for 1.2 s.',
      }),
      S('ultimate', 'Абсолютный ноль', 'Absolute Zero', {
        target: 'all-enemies',
        mult: 3.5,
        effects: [
          { kind: 'damage', value: 3.5 },
          { kind: 'control', status: 'slow', duration: 4 },
        ],
        descRu: '350% ATK по всем врагам и замедление на 4 с.',
        descEn: '350% ATK to all enemies and slows them for 4 s.',
      }),
      S('passive', 'Хладнокровие', 'Cold Blood', {
        effects: [{ kind: 'control', status: 'freeze', duration: 1.2, chance: 0.2 }],
        descRu: 'Критический удар замораживает цель на 1.2 с (не чаще раза в 4 с).',
        descEn: 'A critical hit freezes the target for 1.2 s (once per 4 s).',
      }),
    ],
  }),

  H({
    id: 'cassian',
    nameRu: 'Кассиан',
    nameEn: 'Cassian',
    rarity: 5,
    role: 'vanguard',
    element: 'ash',
    base: { hp: 1725, atk: 95, def: 110, spd: 90 },
    storyRu:
      'Стена, которая устала стоять. Он держит удар, потому что больше никто не умеет, — и потому что не знает, что делать с тишиной.',
    storyEn:
      'A wall that is tired of standing. He takes the hit because no one else can — and because he does not know what to do with silence.',
    quotes: {
      battle: 'За мной. Я выдержу.',
      win: 'Стена стоит. Пока я стою.',
      shatter: 'Держите… строй…',
    },
    codex: [
      'Кассиан проиграл триста боёв и не проиграл ни одного, где был нужен.',
      'Его щит выкован из обломков того, что он не смог защитить.',
    ],
    skills: [
      S('basic', 'Удар щитом', 'Shield Bash', {
        descRu: '100% ATK по одной цели.',
        descEn: '100% ATK to one target.',
      }),
      S('skill', 'Пепельная стена', 'Ash Wall', {
        target: 'all-allies',
        mult: 2.5,
        effects: [{ kind: 'shield', value: 0.25, duration: 5 }],
        descRu: 'Даёт всему отряду щит 25% HP на 5 с.',
        descEn: 'Grants the whole squad a 25% HP shield for 5 s.',
      }),
      S('ultimate', 'Обет', 'Oath', {
        mult: 2,
        effects: [
          { kind: 'damage', value: 2 },
          { kind: 'control', status: 'taunt', duration: 4 },
          { kind: 'buff', status: 'blessing', value: 0.4, duration: 4 },
        ],
        descRu: '200% ATK, провокация на 4 с и −40% получаемого урона на это время.',
        descEn: '200% ATK, taunts for 4 s and takes 40% less damage meanwhile.',
      }),
      S('passive', 'Первые восемь секунд', 'First Eight Seconds', {
        effects: [{ kind: 'buff', status: 'blessing', value: 0.6, duration: 8 }],
        descRu: 'Первые 8 секунд боя получает на 60% меньше урона.',
        descEn: 'Takes 60% less damage during the first 8 seconds of a battle.',
      }),
    ],
  }),

  H({
    id: 'sylvana',
    nameRu: 'Сильвана',
    nameEn: 'Sylvana',
    rarity: 5,
    role: 'ranger',
    element: 'rot',
    base: { hp: 950, atk: 151, def: 45, spd: 110 },
    storyRu:
      'Охотница, которая разводит яд как сад. Она верит, что из мёртвого может вырасти живое, — и её стрелы это доказывают.',
    storyEn:
      'A huntress who cultivates poison like a garden. She believes living things can grow from the dead — her arrows prove it.',
    quotes: {
      battle: 'Не дыши. Яд любит спешку.',
      win: 'Сад цветёт. Значит, мы живы.',
      shatter: 'Семена… уже посеяны…',
    },
    codex: [
      'В её колчане всегда на одну стрелу больше, чем нужно.',
      'Сильвана не срезает цветы на могилах. Она их поливает.',
    ],
    skills: [
      S('basic', 'Отравленная стрела', 'Poison Arrow', {
        mult: 1,
        effects: [
          { kind: 'damage', value: 1 },
          { kind: 'dot', status: 'bleed', value: 0.05, duration: 3 },
        ],
        descRu: '100% ATK и яд на 3 с.',
        descEn: '100% ATK and poison for 3 s.',
      }),
      S('skill', 'Залп', 'Volley', {
        mult: 1.5,
        effects: [
          { kind: 'damage', value: 1.5 },
          { kind: 'debuff', status: 'curse', value: 0.15, duration: 4 },
        ],
        descRu: '150% ATK по трём целям, снижает их урон на 15% на 4 с.',
        descEn: '150% ATK to three targets, reducing their damage by 15% for 4 s.',
      }),
      S('ultimate', 'Смертельный цвет', 'Deadly Bloom', {
        mult: 4,
        effects: [
          { kind: 'damage', value: 4 },
          { kind: 'special', value: 0.5 },
        ],
        descRu: '400% ATK по одной цели; +50% урона, если цель под ядом.',
        descEn: '400% ATK to one target; +50% damage if the target is poisoned.',
      }),
      S('passive', 'Сад', 'Garden', {
        effects: [{ kind: 'special', value: 0.8 }],
        descRu: 'Каждые 10 с ставит ловушку, наносящую 80% ATK.',
        descEn: 'Every 10 s places a trap dealing 80% ATK.',
      }),
    ],
  }),

  H({
    id: 'tess',
    nameRu: 'Тэсс',
    nameEn: 'Tess',
    rarity: 5,
    role: 'support',
    element: 'echo',
    base: { hp: 1150, atk: 100, def: 60, spd: 100 },
    storyRu:
      'Бард, которая слышит ритм боя раньше, чем он начинается. Её песни не убивают — они не дают отряду рассыпаться.',
    storyEn:
      'A bard who hears the rhythm of a battle before it starts. Her songs do not kill — they keep the squad from falling apart.',
    quotes: {
      battle: 'Слушай ритм!',
      win: 'Это была хорошая песня.',
      shatter: 'Допой… за меня…',
    },
    codex: [
      'Тэсс настраивает инструменты по биению сердца Ниры. Говорит, так честнее.',
      'Она утверждает, что у Башни тоже есть ритм. И он сбивается.',
    ],
    skills: [
      S('basic', 'Нота', 'Note', {
        descRu: '100% ATK по одной цели.',
        descEn: '100% ATK to one target.',
      }),
      S('skill', 'Хор', 'Choir', {
        target: 'all-allies',
        effects: [{ kind: 'buff', status: 'blessing', value: 0.25, duration: 5 }],
        descRu: '+25% ATK всему отряду на 5 с.',
        descEn: '+25% ATK to the whole squad for 5 s.',
      }),
      S('ultimate', 'Эхо-хор', 'Echo Choir', {
        target: 'all-allies',
        effects: [
          { kind: 'buff', status: 'blessing', value: 0.4, duration: 6 },
          { kind: 'buff', status: 'haste', value: 0.2, duration: 6 },
          { kind: 'energy', value: 10 },
        ],
        descRu: '+40% ATK и +20% SPD отряду на 6 с, каждому +10 энергии.',
        descEn: '+40% ATK and +20% SPD to the squad for 6 s, +10 energy each.',
      }),
      S('passive', 'Резонанс', 'Resonance', {
        effects: [{ kind: 'energy', value: 10 }],
        descRu: 'Каждая ульта союзника даёт Тэсс +10 энергии.',
        descEn: 'Every ally ultimate grants Tess +10 energy.',
      }),
    ],
  }),

  H({
    id: 'orpheus',
    nameRu: 'Орфей',
    nameEn: 'Orpheus',
    rarity: 5,
    role: 'arcanist',
    element: 'echo',
    base: { hp: 900, atk: 151, def: 40, spd: 100 },
    storyRu:
      'Маг в треснувшей маске, который говорит голосами тех, кого уже нет. Иногда они отвечают ему без его ведома.',
    storyEn:
      'A mage in a cracked mask who speaks with the voices of the gone. Sometimes they answer without his knowledge.',
    quotes: {
      battle: 'Эхо повторяет только правду.',
      win: 'Слышишь? Это мы.',
      shatter: 'Я… ещё звучать буду…',
    },
    codex: [
      'Под маской Орфея нет лица. Только ещё одна маска.',
      'Он записывает всё, что говорят эхо. Тетрадь почти закончилась.',
    ],
    skills: [
      S('basic', 'Отголосок', 'Afterecho', {
        descRu: '100% ATK по одной цели.',
        descEn: '100% ATK to one target.',
      }),
      S('skill', 'Двойное эхо', 'Double Echo', {
        mult: 1.6,
        effects: [{ kind: 'damage', value: 1.6, stacks: 2 }],
        descRu: 'Два удара по 160% ATK.',
        descEn: 'Two hits of 160% ATK.',
      }),
      S('ultimate', 'Хор голосов', 'Choir of Voices', {
        target: 'all-enemies',
        mult: 3,
        effects: [
          { kind: 'damage', value: 3 },
          { kind: 'control', status: 'stun', duration: 1, chance: 0.3 },
        ],
        descRu: '300% ATK по всем врагам, 30% шанс оглушить на 1 с.',
        descEn: '300% ATK to all enemies, 30% chance to stun for 1 s.',
      }),
      S('passive', 'Повтор', 'Repetition', {
        effects: [{ kind: 'special', value: 0.2 }],
        descRu: '20% шанс повторить применённый скилл.',
        descEn: '20% chance to repeat a cast skill.',
      }),
    ],
  }),

  H({
    id: 'nira',
    nameRu: 'Нира',
    nameEn: 'Nira',
    rarity: 5,
    role: 'support',
    element: 'light',
    base: { hp: 1208, atk: 100, def: 60, spd: 95 },
    storyRu:
      'Три звезды, которые все считали расходником. Она первая назвала Мастера по имени — и первая вернулась эхом, чтобы напомнить, что имена важны.',
    storyEn:
      'Three stars everyone treated as fodder. She was the first to call the Master by name — and the first to return as an echo, to remind that names matter.',
    quotes: {
      battle: 'Я рядом, Мастер!',
      win: 'Мы справились! Правда справились?',
      shatter: 'Я вернусь. Я обещала.',
    },
    codex: [
      'Нира — единственная, кто добровольно согласился стать эхом. Ради эксперимента. Ради Мастера.',
      'После главы 10 её карточка меняется. Никто не знает, почему.',
    ],
    skills: [
      S('basic', 'Лоскуток света', 'Patch of Light', {
        descRu: '100% ATK по одной цели.',
        descEn: '100% ATK to one target.',
      }),
      S('skill', 'Заплатка', 'Patch', {
        target: 'ally-lowest',
        mult: 1.8,
        effects: [
          { kind: 'heal', value: 1.8 },
          { kind: 'shield', value: 0.15, duration: 5 },
        ],
        descRu: 'Лечит союзника на 180% ATK и даёт щит 15% HP на 5 с.',
        descEn: 'Heals an ally for 180% ATK and grants a 15% HP shield for 5 s.',
      }),
      S('ultimate', 'Не забудь меня', 'Do Not Forget Me', {
        target: 'all-allies',
        mult: 0,
        effects: [
          { kind: 'revive', value: 0.5 },
          { kind: 'heal', value: 1.5 },
        ],
        descRu: 'Возвращает павшего союзника эхом (раз в бой) и лечит отряд на 150% ATK.',
        descEn: 'Returns a fallen ally as an echo (once per battle) and heals the squad for 150% ATK.',
      }),
      S('passive', 'Клятва', 'Oath', {
        effects: [{ kind: 'energy', value: 100 }],
        descRu: 'Когда союзник рассыпается эхом, Нира получает 100 энергии и лечит отряд на 15%.',
        descEn: 'When an ally shatters, Nira gains 100 energy and heals the squad for 15%.',
      }),
    ],
  }),
];
