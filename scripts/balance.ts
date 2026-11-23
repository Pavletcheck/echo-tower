import { simulateFloor } from '../src/game/battle/floor';
import { allyFromHero } from '../src/game/battle/factory';
import { levelCap } from '../src/game/config';
import { FLOORS } from '../src/data/floors';
import { HEROES_BY_ID } from '../src/data/heroes';
import type { UnitInit } from '../src/game/battle/types';
import { defaultSave, type SaveV1 } from '../src/game/save';
import { buildSquad } from '../src/game/squad';

const SQUAD = ['belquist', 'iria', 'morvain', 'cassian', 'sylvana'] as const;
const STARTER_SQUAD = ['thorn', 'neya', 'grom', 'lissa', 'zip'] as const;
const BATTLES = Number(process.env.BATTLES ?? 20);
const WITH_GEAR = process.env.GEAR === '1';
/** Проверка стартового игрока: 3★, 8-й уровень, без гира и гравировок. */
const STARTER = process.env.STARTER === '1';

/** Базовый билд для проверки силы сетов: 2/2/2 камня D+C и 4 предмета «Клинка Рассвета». */
const ENGRAVING_LOADOUT = [
  'guard_hp_d',
  'guard_hp_c',
  'blade_atk_d',
  'blade_atk_c',
  'whisper_crit_d',
  'whisper_crit_c',
];

function referenceSave(floor: number): SaveV1 {
  const star = floor < 60 ? 5 : 6;
  const level = Math.max(1, Math.min(levelCap(star), Math.round(floor * 0.9) + 1));
  const save = defaultSave();

  for (const id of SQUAD) {
    save.heroes[id] = {
      id,
      star,
      level,
      xp: 0,
      engravingSlots: [...ENGRAVING_LOADOUT],
      gear: {
        weapon: 'dawn-blade_weapon',
        armor: 'dawn-blade_armor',
        relic: 'dawn-blade_relic',
        boots: 'dawn-blade_boots',
      },
      memorySeen: false,
    };
  }

  return save;
}

function referenceSquad(floor: number): UnitInit[] {
  if (STARTER) {
    return STARTER_SQUAD.map((id, slot) => {
      const hero = HEROES_BY_ID[id];
      if (!hero) throw new Error(`missing hero ${id}`);
      return allyFromHero(hero, { slot, star: 3, level: 8 });
    });
  }

  const star = floor < 60 ? 5 : 6;
  const level = Math.max(1, Math.min(levelCap(star), Math.round(floor * 0.9) + 1));

  if (WITH_GEAR) return buildSquad(referenceSave(floor));

  return SQUAD.map((id, slot) => {
    const hero = HEROES_BY_ID[id];
    if (!hero) throw new Error(`missing hero ${id}`);
    return allyFromHero(hero, { slot, star, level });
  });
}

interface Row {
  floor: number;
  winRate: number;
  avgTime: number;
  avgWaves: number;
  avgHp: number;
}

const rows: Row[] = [];

for (const floor of FLOORS) {
  const squad = referenceSquad(floor.floor);
  let wins = 0;
  let time = 0;
  let waves = 0;
  let hpPercent = 0;

  for (let attempt = 0; attempt < BATTLES; attempt += 1) {
    const result = simulateFloor(floor, squad, 1000 + floor.floor * 100_000 + attempt);
    if (result.outcome === 'win') wins += 1;
    time += result.timeMs;
    waves += result.wavesCleared;
    const totalMax = result.allies.reduce((sum, ally) => sum + ally.maxHp, 0);
    const totalHp = result.allies.reduce((sum, ally) => sum + Math.max(0, ally.hp), 0);
    hpPercent += totalMax > 0 ? totalHp / totalMax : 0;
  }

  rows.push({
    floor: floor.floor,
    winRate: wins / BATTLES,
    avgTime: time / BATTLES / 1000,
    avgWaves: waves / BATTLES,
    avgHp: hpPercent / BATTLES,
  });
}

const pct = (value: number) => `${(value * 100).toFixed(0)}%`.padStart(4);
const num = (value: number, digits = 1) => value.toFixed(digits).padStart(5);

console.log(
  `\nECHO TOWER — balance report (${BATTLES} battles/floor, ${FLOORS.length} floors, ${
    WITH_GEAR ? 'with reference gear' : 'base squad'
  })\n`,
);
console.log('floor  win   time  waves   hp left');
console.log('-----  ----  -----  -----   -------');

for (const row of rows) {
  if (row.floor % 5 !== 0 && row.floor !== 1) continue;
  console.log(
    `${String(row.floor).padStart(5)}  ${pct(row.winRate)}  ${num(row.avgTime)}  ${num(row.avgWaves)}   ${pct(row.avgHp)}`,
  );
}

const overall = rows.reduce((sum, row) => sum + row.winRate, 0) / rows.length;
const mid = rows.filter((row) => row.floor >= 10 && row.floor <= 95);
const clearable = mid.filter((row) => row.winRate >= 0.6).length;

const stuck = rows.filter((row) => row.winRate < 0.25);
const tooEasy = rows.filter((row) => row.winRate > 0.98);

console.log(`\noverall winrate       ${(overall * 100).toFixed(1)}%`);
console.log(`floors 10-95 clearable ${clearable}/${mid.length} (target ≥60%)`);
console.log(`stuck floors (<25%)   ${stuck.map((row) => row.floor).join(', ') || 'none'}`);
console.log(`trivial floors (>98%) ${tooEasy.map((row) => row.floor).join(', ') || 'none'}`);

const avgTime = rows.reduce((sum, row) => sum + row.avgTime, 0) / rows.length;
console.log(`average floor time    ${avgTime.toFixed(1)} s`);

// ---------- element synergy check ----------
const monoIds = ['belquist', 'tess', 'orpheus', 'thorn', 'zip'];
const mono = defaultSave();
mono.squad = [...monoIds];
for (const id of monoIds) {
  const hero = HEROES_BY_ID[id];
  if (!hero) continue;
  mono.heroes[id] = {
    id,
    star: 5,
    level: 20,
    xp: 0,
    engravingSlots: [null, null, null, null, null, null],
    gear: {},
    memorySeen: false,
  };
}

const monoFloor = FLOORS.find((floor) => floor.floor === 20);
if (monoFloor) {
  const boosted = buildSquad(mono);
  const plain = boosted.map((unit) => ({
    ...unit,
    bonus: unit.bonus ? { ...unit.bonus, atk: Math.max(0, unit.bonus.atk - 0.18) } : unit.bonus,
  }));
  const measure = (squad: typeof boosted) => {
    let damage = 0;
    for (let attempt = 0; attempt < Math.min(5, BATTLES); attempt += 1) {
      damage += simulateFloor(monoFloor, squad, 9000 + attempt).damageDealt;
    }
    return Math.round(damage / Math.min(5, BATTLES));
  };
  const withBonus = measure(boosted);
  const withoutBonus = measure(plain);
  const gain = withoutBonus > 0 ? ((withBonus / withoutBonus - 1) * 100).toFixed(0) : '0';
  console.log(`element 5×echo floor 20 damage ${withBonus} vs ${withoutBonus} (+${gain}%)`);
}

console.log('');
