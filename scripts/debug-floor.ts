import { allyFromHero, buildWave } from '../src/game/battle/factory';
import { simulateFloor } from '../src/game/battle/floor';
import { levelCap } from '../src/game/config';
import { FLOORS } from '../src/data/floors';
import { HEROES_BY_ID } from '../src/data/heroes';

const floorNumber = Number(process.argv[2] ?? 100);
const floor = FLOORS.find((item) => item.floor === floorNumber);
if (!floor) throw new Error(`no floor ${floorNumber}`);

const squad = ['belquist', 'iria', 'morvain', 'cassian', 'sylvana'];
const star = floorNumber < 25 ? 3 : floorNumber < 55 ? 4 : floorNumber < 85 ? 5 : 6;
const level = Math.min(levelCap(star), floorNumber + 1);

const allies = squad.map((id, slot) => {
  const hero = HEROES_BY_ID[id];
  if (!hero) throw new Error(`no hero ${id}`);
  return allyFromHero(hero, { slot, star, level });
});

const enemies = buildWave(floor, 0);
const sumHp = enemies.reduce((sum, unit) => sum + (unit.base.hp * 1), 0);

console.log(`floor ${floorNumber} | star ${star} level ${level}`);
console.log('allies', allies.map((unit) => `${unit.defId}: atk ${Math.round(unit.base.atk * (1 + 0.06 * (level - 1)) * (1 + (star - 1) * 0.25))}`).join(' | '));
console.log('wave1 enemies', enemies.map((unit) => `${unit.defId}: hp ${Math.round(unit.base.hp)} atk ${Math.round(unit.base.atk)}`).join(' | '));
console.log('wave1 total hp', Math.round(sumHp));

const result = simulateFloor(floor, allies, 1000 + floorNumber * 100_000);
console.log('outcome', result.outcome, 'waves', result.wavesCleared, 'time', (result.timeMs / 1000).toFixed(1));
console.log('damage dealt', result.damageDealt, 'taken', result.damageTaken);
console.log('allies left', result.allies.map((unit) => `${unit.uid.split('_')[1]}: ${Math.round(unit.hp)}/${unit.maxHp}`).join(' | '));

const firstWave = result.waves[0];
if (firstWave) {
  console.log('wave1 events:');
  for (const event of firstWave.log.slice(0, 24)) {
    console.log(` ${event.t.toFixed(2)} ${event.type} ${event.unitId ?? ''} -> ${event.targetId ?? ''} ${event.value ?? ''} ${event.note ?? ''}`);
  }
}
