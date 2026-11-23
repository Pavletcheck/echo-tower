import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ARTIFACTS, ARTIFACT_MAX_LEVEL } from '../src/data/artifacts';
import { BATTLE_BACKGROUND_COUNT, battleBackground } from '../src/data/backgrounds';
import { DINING_BUFFS } from '../src/data/dining';
import { ENDGAME_SHOP_ITEMS, HARD_CHAPTERS, TOWER_FLOORS, WORLD_TIERS } from '../src/data/endgame';
import { CALENDAR_DAYS, CALENDAR_REWARDS, GLASS_RAIN, PASS_LEVELS, PASS_MAX_LEVEL, RETURN_TIERS } from '../src/data/live';import { BOSSES, BOSSES_BY_ID, ENEMIES } from '../src/data/enemies';
import { ENGRAVINGS, ENGRAVING_SETS } from '../src/data/engravings';
import { FLOORS } from '../src/data/floors';
import { FTUE_STEPS } from '../src/data/ftue';
import { GEAR, GEAR_SETS } from '../src/data/gear';
import { HEROES } from '../src/data/heroes';
import { QUESTS } from '../src/data/quests';
import { RIFT_BOONS } from '../src/data/rift';
import { IAP_ITEMS, SHOP_ITEMS } from '../src/data/shop';
import {
  ARENA_LEAGUES,
  FRIEND_NAMES,
  FRIEND_POWER_FACTORS,
  GUILD_CANDIDATES,
  GUILD_MILESTONES,
  MERCENARY_POWER_FACTOR,
} from '../src/data/social';
import {
  BUILDINGS,
  BUILDING_MAX_LEVEL,
  EXCHANGE_OFFERS,
  MASTER_LEVEL_MAX,
  masterReward,
  masterXpToNext,
} from '../src/data/base';
import { STARTER_DAY_COUNT, STARTER_MISSIONS } from '../src/data/starter';
import { STATUS_KINDS } from '../src/data/statuses';
import { defaultSave } from '../src/game/save';

const errors: string[] = [];
const warnings: string[] = [];

function check(condition: boolean, message: string): void {
  if (!condition) errors.push(message);
}

function unique(values: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) errors.push(`${label}: duplicate id "${value}"`);
    seen.add(value);
  }
}

// ---------- heroes ----------
check(HEROES.length === 32, `heroes: expected 32, got ${HEROES.length}`);
unique(HEROES.map((hero) => hero.id), 'heroes');
check(new Set(HEROES.map((hero) => hero.asset.card)).size === HEROES.length, 'heroes: duplicate card paths');

for (const hero of HEROES) {
  check(hero.skills.length === 4, `hero ${hero.id}: expected 4 skills`);
  check(
    hero.skills.map((skill) => skill.kind).join(',') === 'basic,skill,ultimate,passive',
    `hero ${hero.id}: skill order must be basic,skill,ultimate,passive`,
  );
  check(hero.base.hp > 0 && hero.base.atk > 0 && hero.base.def > 0 && hero.base.spd > 0, `hero ${hero.id}: bad base stats`);
  check(hero.nameRu.length > 1 && hero.nameEn.length > 1, `hero ${hero.id}: missing localized name`);
  check(hero.quotes.battle.length > 0 && hero.quotes.shatter.length > 0, `hero ${hero.id}: missing quotes`);
  check(hero.codex.length === 2, `hero ${hero.id}: codex must have 2 entries`);
  for (const skill of hero.skills) {
    check(skill.nameRu.length > 1 && skill.nameEn.length > 1, `skill ${skill.id}: missing name`);
    check(skill.mult >= 0, `skill ${skill.id}: negative multiplier`);
    check(skill.cost >= 0 && skill.cooldown >= 0, `skill ${skill.id}: negative cost/cooldown`);
  }
}

check(new Set(HEROES.filter((hero) => hero.rarity === 5)).size === 8, 'heroes: 5в… tier must have 8');
check(HEROES.filter((hero) => hero.rarity === 4).length === 12, 'heroes: 4в… tier must have 12');
check(HEROES.filter((hero) => hero.rarity === 3).length === 12, 'heroes: 3в… tier must have 12');

// ---------- enemies & bosses ----------
check(ENEMIES.length === 24, `enemies: expected 24, got ${ENEMIES.length}`);
unique(ENEMIES.map((enemy) => enemy.id), 'enemies');
check(new Set(ENEMIES.map((enemy) => enemy.family)).size === 8, 'enemies: expected 8 families');

check(BOSSES.length === 12, `bosses: expected 12, got ${BOSSES.length}`);
unique(BOSSES.map((boss) => boss.id), 'bosses');
for (const boss of BOSSES) {
  check(boss.patterns.length >= 2, `boss ${boss.id}: expected 2+ patterns`);
  check(boss.dropRu.length > 0, `boss ${boss.id}: missing drop text`);
  if (boss.mode === 'tower') check(boss.floor >= 10 && boss.floor <= 100, `boss ${boss.id}: bad floor`);
}

// ---------- floors ----------
check(FLOORS.length === 100, `floors: expected 100, got ${FLOORS.length}`);
for (const floor of FLOORS) {
  check(floor.floor >= 1 && floor.floor <= 100, `floor ${floor.floor}: out of range`);
  check(floor.chapter === Math.ceil(floor.floor / 10), `floor ${floor.floor}: wrong chapter`);
  check(floor.waves.length === 3, `floor ${floor.floor}: expected 3 waves`);
  check(floor.reward.gold > 0 && floor.reward.xp > 0, `floor ${floor.floor}: bad reward`);
  check(floor.firstClear.gold >= floor.reward.gold, `floor ${floor.floor}: first clear is not better`);
  for (const wave of floor.waves) {
    check(wave.enemies.length > 0, `floor ${floor.floor}: empty wave`);
    for (const stack of wave.enemies) {
      check(BOSSES_BY_ID[stack.enemyId] !== undefined || ENEMIES.some((e) => e.id === stack.enemyId), `floor ${floor.floor}: unknown enemy ${stack.enemyId}`);
      check(stack.count > 0, `floor ${floor.floor}: zero count for ${stack.enemyId}`);
    }
  }
  if (floor.floor % 5 === 0) check(Boolean(floor.bossId), `floor ${floor.floor}: boss floor without boss`);
}
check(FLOORS[99]?.firstClear.crystals === 120, 'floor 100: expected 120 crystals');

// ---------- engravings & gear ----------
check(ENGRAVINGS.length === 40, `engravings: expected 40, got ${ENGRAVINGS.length}`);
unique(ENGRAVINGS.map((item) => item.id), 'engravings');
check(ENGRAVING_SETS.length === 6, 'engravings: expected 6 sets');
for (const item of ENGRAVINGS) {
  check(ENGRAVING_SETS.some((set) => set.id === item.set), `engraving ${item.id}: unknown set`);
  check(item.value > 0, `engraving ${item.id}: non-positive value`);
}

check(DINING_BUFFS.length === 5, `dining: expected 5 buffs, got ${DINING_BUFFS.length}`);
unique(DINING_BUFFS.map((buff) => buff.id), 'dining');
for (const buff of DINING_BUFFS) {
  check(buff.value !== undefined || buff.essence !== undefined, `dining ${buff.id}: no effect value`);
}

check(GEAR_SETS.length === 6, `gear: expected 6 sets, got ${GEAR_SETS.length}`);
check(GEAR.length === 24, `gear: expected 24 items, got ${GEAR.length}`);
unique(GEAR.map((item) => item.id), 'gear');
for (const set of GEAR_SETS) {
  const items = GEAR.filter((item) => item.setId === set.id);
  check(items.length === 4, `gear set ${set.id}: expected 4 items`);
  check(new Set(items.map((item) => item.slot)).size === 4, `gear set ${set.id}: slots must be unique`);
}

// ---------- quests, shop, rift ----------
check(QUESTS.length === 60, `quests: expected 60, got ${QUESTS.length}`);
unique(QUESTS.map((quest) => quest.id), 'quests');
const countByType = (type: string) => QUESTS.filter((quest) => quest.type === type).length;
check(countByType('daily') === 20, 'quests: expected 20 daily');
check(countByType('weekly') === 15, 'quests: expected 15 weekly');
check(countByType('achievement') === 15, 'quests: expected 15 achievements');
check(countByType('event') === 10, 'quests: expected 10 event');
for (const quest of QUESTS) {
  check(quest.target > 0, `quest ${quest.id}: target must be positive`);
  const rewardTotal = Object.values(quest.reward).filter((value) => typeof value === 'number').reduce<number>((sum, value) => sum + Number(value), 0);
  check(rewardTotal > 0 || Boolean(quest.reward.item), `quest ${quest.id}: empty reward`);
}

unique(SHOP_ITEMS.map((item) => item.id), 'shop');
unique(IAP_ITEMS.map((item) => item.sku), 'iap');
check(IAP_ITEMS.every((item) => item.platforms.length > 0), 'iap: every item needs a platform');

check(RIFT_BOONS.length === 40, `rift: expected 40 boons, got ${RIFT_BOONS.length}`);
unique(RIFT_BOONS.map((boon) => boon.id), 'rift');

// ---------- ftue & starter ----------
check(FTUE_STEPS.length === 3, `ftue: expected 3 steps, got ${FTUE_STEPS.length}`);
unique(FTUE_STEPS.map((step) => step.id), 'ftue');
unique(FTUE_STEPS.map((step) => step.target), 'ftue targets');

check(STARTER_MISSIONS.length === STARTER_DAY_COUNT, `starter: expected ${STARTER_DAY_COUNT} missions`);
unique(STARTER_MISSIONS.map((mission) => mission.id), 'starter');
unique(STARTER_MISSIONS.map((mission) => String(mission.day)), 'starter days');
for (const mission of STARTER_MISSIONS) {
  check(mission.day >= 1 && mission.day <= STARTER_DAY_COUNT, `starter ${mission.id}: bad day`);
  check(mission.target > 0, `starter ${mission.id}: target must be positive`);
  const total = Object.values(mission.reward).reduce<number>((sum, value) => sum + Number(value), 0);
  check(total > 0, `starter ${mission.id}: empty reward`);
}

check(STATUS_KINDS.length === 12, `statuses: expected 12, got ${STATUS_KINDS.length}`);
unique(STATUS_KINDS, 'statuses');

// ---------- artifacts ----------
check(ARTIFACTS.length === 6, `artifacts: expected 6, got ${ARTIFACTS.length}`);
unique(ARTIFACTS.map((artifact) => artifact.id), 'artifacts');
unique(ARTIFACTS.map((artifact) => artifact.role), 'artifact roles');
check(ARTIFACT_MAX_LEVEL >= 3 && ARTIFACT_MAX_LEVEL <= 5, 'artifacts: level cap must be 3..5');
for (const artifact of ARTIFACTS) {
  check(artifact.nameRu.length > 1 && artifact.nameEn.length > 1, `artifact ${artifact.id}: missing name`);
  check(Object.keys(artifact.perLevel).length > 0, `artifact ${artifact.id}: empty bonus`);
  for (const value of Object.values(artifact.perLevel)) check(Number(value) > 0, `artifact ${artifact.id}: bad bonus`);
}

// ---------- endgame ----------
check(WORLD_TIERS.length >= 3, 'endgame: expected at least 3 world tiers');
unique(WORLD_TIERS.map((tier) => tier.id), 'world tiers');
for (let index = 1; index < WORLD_TIERS.length; index += 1) {
  check(WORLD_TIERS[index]!.threshold > WORLD_TIERS[index - 1]!.threshold, 'world tiers: thresholds must grow');
}
check(HARD_CHAPTERS.length === 10, `endgame: expected 10 hard chapters, got ${HARD_CHAPTERS.length}`);
unique(HARD_CHAPTERS.map((chapter) => String(chapter.chapter)), 'hard chapters');
check(TOWER_FLOORS === 30, 'endgame: element towers must have 30 floors');
check(ENDGAME_SHOP_ITEMS.length >= 3, 'endgame: expected at least 3 shop items');
unique(ENDGAME_SHOP_ITEMS.map((item) => item.id), 'endgame shop');
for (const item of ENDGAME_SHOP_ITEMS) {
  check(item.price > 0 && item.amount > 0, `endgame shop ${item.id}: bad price/amount`);
}

// ---------- live-ops ----------
check(CALENDAR_REWARDS.length === CALENDAR_DAYS, `live: expected ${CALENDAR_DAYS} calendar rewards`);
check(PASS_LEVELS.length === PASS_MAX_LEVEL, `live: expected ${PASS_MAX_LEVEL} pass levels`);
unique(PASS_LEVELS.map((level) => String(level.level)), 'pass levels');
check(GLASS_RAIN.battles.length === 5, 'event: expected 5 story battles');
check(GLASS_RAIN.shop.length >= 3, 'event: expected at least 3 shop items');
unique(GLASS_RAIN.shop.map((item) => item.id), 'event shop');
check(Date.parse(GLASS_RAIN.start) < Date.parse(GLASS_RAIN.end), 'event: start must be before end');
check(RETURN_TIERS.length === 3, 'live: expected return tiers 3/7/14');
check(RETURN_TIERS.map((tier) => tier.days).join(',') === '3,7,14', 'live: return tiers must be 3/7/14');

// ---------- save ----------
const save = defaultSave();
check(save.squad.every((heroId) => HEROES.some((hero) => hero.id === heroId)), 'save: squad references unknown hero');
check(Object.keys(save.heroes).every((heroId) => HEROES.some((hero) => hero.id === heroId)), 'save: heroes reference unknown ids');
check(Object.keys(save.heroes).length === 5, 'save: starter collection must have 5 heroes');
check(Object.values(save.heroes).every((hero) => hero.star === 3), 'save: starter heroes must be 3в…');
check(save.squadPresets.length === 3, 'save: expected 3 squad presets');
check(save.settings.battleSpeed === 1, 'save: default battle speed must be 1');
check(Object.keys(save.gearPresets).length === 0, 'save: default gear presets must be empty');
check(save.currencies.echoMarks === 0, 'save: default echo marks must be 0');
check(save.endgame.world.total === 0, 'save: default world damage must be 0');
check(save.live.calendar.claimedDays.length === 0, 'save: default calendar must be empty');
check(save.live.pass.xp === 0, 'save: default pass xp must be 0');
check(save.live.event.currency === 0, 'save: default event currency must be 0');
check(Object.keys(save.heroEssences).length === 0, 'save: default hero essences must be empty');
check(Array.isArray(save.resonance) && save.resonance.length === 0, 'save: default resonance must be empty');
check(Object.values(save.heroes).every((hero) => hero.skillLevels.length === 4), 'save: every hero needs 4 skill levels');
check(Object.values(save.heroes).every((hero) => hero.artifactLevel === 0), 'save: starter artifacts must be dormant');

// ---------- i18n ----------
const root = resolve(import.meta.dirname, '..');
const ru = JSON.parse(readFileSync(resolve(root, 'src/data/i18n/ru.json'), 'utf8')) as Record<string, string>;
const en = JSON.parse(readFileSync(resolve(root, 'src/data/i18n/en.json'), 'utf8')) as Record<string, string>;
const ruKeys = Object.keys(ru);
const enKeys = Object.keys(en);
const missingEn = ruKeys.filter((key) => !(key in en));
const missingRu = enKeys.filter((key) => !(key in ru));
check(missingEn.length === 0, `i18n: missing EN keys: ${missingEn.join(', ')}`);
check(missingRu.length === 0, `i18n: missing RU keys: ${missingRu.join(', ')}`);
for (const [key, value] of Object.entries(ru)) if (!value.trim()) errors.push(`i18n: empty RU value for ${key}`);
for (const [key, value] of Object.entries(en)) if (!value.trim()) errors.push(`i18n: empty EN value for ${key}`);

for (const step of FTUE_STEPS) {
  for (const key of [step.titleKey, step.bodyKey, step.actionKey]) {
    check(key in ru && key in en, `i18n: tutorial key missing: ${key}`);
  }
}
for (const mission of STARTER_MISSIONS) {
  for (const key of [mission.titleKey, mission.bodyKey]) {
    check(key in ru && key in en, `i18n: starter key missing: ${key}`);
  }
}
for (const status of STATUS_KINDS) {
  for (const key of [`status.${status}.name`, `status.${status}.hint`]) {
    check(key in ru && key in en, `i18n: status key missing: ${key}`);
  }
}

// ---------- social ----------
check(ARENA_LEAGUES.length === 10, `social: expected 10 arena leagues, got ${ARENA_LEAGUES.length}`);
unique(ARENA_LEAGUES.map((league) => league.id), 'social: arena leagues');
check(ARENA_LEAGUES[0]?.minRating === 0, 'social: first league must start at 0 rating');
for (let index = 1; index < ARENA_LEAGUES.length; index += 1) {
  const previous = ARENA_LEAGUES[index - 1];
  const current = ARENA_LEAGUES[index];
  check(
    Boolean(previous && current && current.minRating > previous.minRating),
    `social: league ${current?.id ?? index} thresholds must grow`,
  );
}
for (const league of ARENA_LEAGUES) {
  check(league.nameRu.length > 1 && league.nameEn.length > 1, `social: league ${league.id} missing name`);
  check(league.crystals > 0 && league.tokens > 0, `social: league ${league.id} has empty reward`);
}

check(GUILD_MILESTONES.length >= 3, 'social: guild needs at least 3 milestones');
unique(GUILD_MILESTONES.map((milestone) => milestone.id), 'social: guild milestones');
for (let index = 1; index < GUILD_MILESTONES.length; index += 1) {
  const previous = GUILD_MILESTONES[index - 1];
  const current = GUILD_MILESTONES[index];
  check(
    Boolean(previous && current && current.damage > previous.damage),
    `social: guild milestone ${current?.id ?? index} must grow`,
  );
}
for (const milestone of GUILD_MILESTONES) {
  check(
    milestone.crystals > 0 && milestone.tokens > 0 && milestone.essence > 0,
    `social: guild milestone ${milestone.id} has empty reward`,
  );
}

check(GUILD_CANDIDATES.length >= 3, 'social: expected at least 3 guild candidates');
unique(GUILD_CANDIDATES.map((guild) => guild.id), 'social: guild candidates');
for (const guild of GUILD_CANDIDATES) {
  check(guild.nameRu.length > 1 && guild.nameEn.length > 1, `social: guild ${guild.id} missing name`);
  check(guild.mottoRu.length > 1 && guild.mottoEn.length > 1, `social: guild ${guild.id} missing motto`);
  check(guild.powerBase > 0, `social: guild ${guild.id} has bad power base`);
}

check(
  FRIEND_NAMES.length === FRIEND_POWER_FACTORS.length,
  'social: friend names and power factors must match',
);
unique(FRIEND_NAMES, 'social: friend names');
check(MERCENARY_POWER_FACTOR > 1, 'social: mercenary cap must allow a useful friend hero');

const freshSocial = defaultSave().social;
check(freshSocial.guild === null, 'social: fresh save must start without a guild');
check(freshSocial.mercenary === null, 'social: fresh save must start without a mercenary');
check(freshSocial.ghosts.length === 0, 'social: fresh save must start without ghosts');

const socialKeys = [
  'arena.season',
  'arena.leaderboard',
  'arena.history',
  'arena.revenge',
  'social.title',
  'social.tab.guild',
  'social.tab.friends',
  'social.guild.boss',
  'social.guild.milestones',
  'social.friends.mercenary',
  'social.friends.hire',
];
for (const key of socialKeys) {
  check(key in ru && key in en, `i18n: social key missing: ${key}`);
}

// ---------- base ----------
check(BUILDINGS.length === 5, `base: expected 5 buildings, got ${BUILDINGS.length}`);
unique(BUILDINGS.map((building) => building.id), 'base: buildings');
check(BUILDING_MAX_LEVEL === 5, 'base: building max level must be 5');
for (const building of BUILDINGS) {
  check(
    building.costs.length === BUILDING_MAX_LEVEL - 1,
    `base: ${building.id} must define costs for levels 2..${BUILDING_MAX_LEVEL}`,
  );
  check(building.perLevel > 0, `base: ${building.id} has no effect`);
  check(building.nameKey in ru && building.nameKey in en, `i18n: ${building.nameKey} missing`);
  check(building.descKey in ru && building.descKey in en, `i18n: ${building.descKey} missing`);
  for (const cost of building.costs) {
    check(
      (cost.gold ?? 0) + (cost.crystals ?? 0) + (cost.essence ?? 0) + (cost.dust ?? 0) > 0,
      `base: ${building.id} has an empty upgrade cost`,
    );
  }
}

check(EXCHANGE_OFFERS.length >= 3, 'base: expected at least 3 exchange offers');
unique(EXCHANGE_OFFERS.map((offer) => offer.id), 'base: exchange offers');
for (const offer of EXCHANGE_OFFERS) {
  check(offer.cost.amount > 0 && offer.give.amount > 0, `base: exchange ${offer.id} has zero amount`);
  check(offer.dailyLimit > 0, `base: exchange ${offer.id} has no daily limit`);
}

check(MASTER_LEVEL_MAX > 1, 'base: master level cap must be above 1');
for (let level = 1; level < MASTER_LEVEL_MAX; level += 1) {
  check(masterXpToNext(level) > 0, `base: master level ${level} needs no xp`);
}
const masterTwo = masterReward(2);
check(
  masterTwo.gold > 0 && masterTwo.crystals > 0 && masterTwo.essence > 0,
  'base: master level 2 reward is empty',
);
check(masterReward(5).seals > 0, 'base: master milestone 5 must grant a seal');

const throneKeys = [
  'throne.title',
  'throne.buildings',
  'throne.upgrade',
  'throne.exchange',
  'throne.masterLevel',
  'throne.rewardLine',
];
for (const key of throneKeys) {
  check(key in ru && key in en, `i18n: throne key missing: ${key}`);
}

// ---------- asset hints ----------
const belquist = resolve(root, 'public/assets/heroes/belquist/card.webp');
try {
  readFileSync(belquist);
} catch {
  warnings.push('asset: belquist card is missing (fallback placeholder will be used)');
}

const audioAssets = [
  'audio/sfx/ui-click.ogg',
  'audio/sfx/ui-error.ogg',
  'audio/sfx/coin.ogg',
  'audio/sfx/hit.ogg',
  'audio/sfx/crit.ogg',
  'audio/sfx/ult.ogg',
  'audio/sfx/heal.ogg',
  'audio/sfx/shatter.ogg',
  'audio/sfx/star-up.ogg',
  'audio/sfx/summon.ogg',
  'audio/music/lobby.ogg',
  'audio/music/battle.ogg',
  'audio/music/boss.ogg',
];
for (const file of audioAssets) {
  try {
    readFileSync(resolve(root, 'public/assets', file));
  } catch {
    warnings.push(`audio: ${file} is missing (python scripts/generate_audio.py)`);
  }
}

// ---------- backgrounds and marketing ----------
for (let chapter = 1; chapter <= BATTLE_BACKGROUND_COUNT; chapter += 1) {
  const file = resolve(root, 'public', battleBackground(chapter));
  try {
    readFileSync(file);
  } catch {
    errors.push(`asset: battle background for chapter ${chapter} is missing (${battleBackground(chapter)})`);
  }
}

for (const file of ['marketing/keyart-portrait.webp', 'marketing/cover-yandex.webp']) {
  try {
    readFileSync(resolve(root, 'public/assets', file));
  } catch {
    warnings.push(`asset: ${file} is missing (P1 marketing)`);
  }
}

// ---------- report ----------
const line = (label: string, value: string | number) => `${label.padEnd(26)} ${value}`;
console.log('\nECHO TOWER вЂ” content validation\n');
console.log(line('Heroes', `${HEROES.length} (5в… ${HEROES.filter((h) => h.rarity === 5).length}, 4в… 12, 3в… 12)`));
console.log(line('Enemies', `${ENEMIES.length} (8 families Г— 3)`));
console.log(line('Bosses', BOSSES.length));
console.log(line('Floors', `${FLOORS.length} (10 chapters)`));
console.log(line('Engravings', `${ENGRAVINGS.length} / ${ENGRAVING_SETS.length} sets`));
console.log(line('Gear', `${GEAR.length} / ${GEAR_SETS.length} sets`));
console.log(line('Dining buffs', DINING_BUFFS.length));
console.log(line('Quests', `${QUESTS.length} (20/15/15/10)`));
console.log(line('Rift boons', RIFT_BOONS.length));
console.log(line('FTUE / starter', `${FTUE_STEPS.length} steps / ${STARTER_MISSIONS.length} days`));
console.log(line('Artifacts', `${ARTIFACTS.length} / ${ARTIFACT_MAX_LEVEL} levels`));
console.log(line('Endgame', `${WORLD_TIERS.length} world tiers / ${HARD_CHAPTERS.length} hard chapters / ${TOWER_FLOORS} tower floors`));
console.log(line('Live-ops', `${CALENDAR_DAYS} calendar days / ${PASS_MAX_LEVEL} pass levels / ${GLASS_RAIN.battles.length} event battles`));
console.log(line('Social', `${ARENA_LEAGUES.length} leagues / ${GUILD_MILESTONES.length} guild tiers / ${FRIEND_NAMES.length} friends`));
console.log(line('Base', `${BUILDINGS.length} buildings / ${EXCHANGE_OFFERS.length} exchanges / master lvl ${MASTER_LEVEL_MAX}`));
console.log(line('Shop / IAP', `${SHOP_ITEMS.length} / ${IAP_ITEMS.length}`));
console.log(line('i18n keys', `${ruKeys.length} RU / ${enKeys.length} EN`));

if (warnings.length > 0) {
  console.log('\nWarnings:');
  for (const warning of warnings) console.log(`  ! ${warning}`);
}

if (errors.length > 0) {
  console.error(`\nвњ— ${errors.length} error(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log('\nвњ“ content is valid\n');

