import { simulateFloor } from '../src/game/battle/floor';
import { allyFromHero } from '../src/game/battle/factory';
import { FLOORS } from '../src/data/floors';
import { HEROES_BY_ID } from '../src/data/heroes';
import type { UnitInit } from '../src/game/battle/types';

const SQUAD = ['thorn', 'neya', 'grom', 'lissa', 'zip'] as const;
const BATTLES = Number(process.env.BATTLES ?? 30);
const LEVEL = Number(process.env.LEVEL ?? 8);

function squad(): UnitInit[] {
  return SQUAD.map((id, slot) => {
    const hero = HEROES_BY_ID[id];
    if (!hero) throw new Error(`missing ${id}`);
    return allyFromHero(hero, { slot, star: 3, level: LEVEL });
  });
}

const MAX_FLOOR = Number(process.env.MAX_FLOOR ?? 15);

for (const floor of FLOORS.filter((entry) => entry.floor <= MAX_FLOOR)) {
  let wins = 0;
  let hp = 0;
  for (let attempt = 0; attempt < BATTLES; attempt += 1) {
    const result = simulateFloor(floor, squad(), 5000 + floor.floor * 1000 + attempt);
    if (result.outcome === 'win') wins += 1;
    hp += result.allies.reduce((sum, ally) => sum + ally.hp, 0) /
      Math.max(1, result.allies.reduce((sum, ally) => sum + ally.maxHp, 0));
  }
  console.log(
    `${String(floor.floor).padStart(5)}  ${String(Math.round((wins / BATTLES) * 100)).padStart(3)}%  hp ${Math.round((hp / BATTLES) * 100)}%`,
  );
}
