import { Rng } from '../../core/rng';
import type { SkillDef, SkillEffect } from '../../data/types';
import { MASTER_CHARGES } from '../config';
import { selectEnemyTarget, selectLowestAlly, selectSkill } from './ai';
import {
  addStatus,
  attackMultiplier,
  clearExpiredShield,
  incomingMultiplier,
  isControlled,
  isShieldActive,
  speedMultiplier,
  tickStatuses,
} from './effects';
import { clampDamage, critMultiplier, elementMultiplier, mitigation } from './formulas';
import { DR_CAP, unitCombatStats } from './stats';
import type {
  BattleEvent,
  BattleResult,
  BattleSetup,
  MasterAction,
  Unit,
  UnitInit,
  UnitSnapshot,
} from './types';

const DT = 1 / 30;
const DEFAULT_MAX_TIME = 60;
const MAX_LOG = 3000;

const ENERGY_START = 20;
const ENERGY_PER_ATTACK = 10;
const ENERGY_PER_HIT = 5;
const ENERGY_PER_KILL = 15;

interface SimState {
  allies: Unit[];
  enemies: Unit[];
  echoes: string[];
  echoBuff: number;
  charges: number;
  focusUid: string | null;
  focusUntil: number;
  damageDealt: number;
  damageTaken: number;
  log: BattleEvent[];
  lifesteal: number;
}

function logEvent(state: SimState, event: BattleEvent): void {
  if (state.log.length < MAX_LOG) state.log.push(event);
}

function createUnit(init: UnitInit, modifiers: NonNullable<BattleSetup['modifiers']> = {}): Unit {
  const stats = unitCombatStats(init);
  const bonus = init.bonus;
  const maxHp = Math.round(stats.hp * (init.hpMult ?? 1) * (1 + (modifiers.hp ?? 0)));
  const startHp = init.startHp;

  return {
    uid: init.uid,
    defId: init.defId,
    name: init.name,
    ...(init.nameEn ? { nameEn: init.nameEn } : {}),
    side: init.side,
    slot: init.slot,
    role: init.role,
    element: init.element,
    skills: init.skills,
    isBoss: Boolean(init.isBoss),
    maxHp,
    hp: startHp === undefined ? maxHp : Math.max(0, Math.min(maxHp, startHp)),
    atk: stats.atk * (init.atkMult ?? 1) * (1 + (modifiers.atk ?? 0)),
    def: stats.def,
    spd: stats.spd * (1 + (modifiers.spd ?? 0)),
    crit: Math.min(1, Math.max(0, stats.crit + (modifiers.crit ?? 0))),
    cdmg: Math.max(0, stats.cdmg + (modifiers.cdmg ?? 0)),
    er: stats.er,
    energy: ENERGY_START,
    actionGauge: 0,
    cooldowns: {},
    statuses: [],
    alive: startHp === undefined || startHp > 0,
    shield: 0,
    shieldUntil: 0,
    controlImmuneUntil: 0,
    hitCount: 0,
    damageDealt: 0,
    damageTaken: 0,
    healingDone: 0,
    lastDotLogAt: 0,
    revived: false,
    dr: (init.defId === 'cassian' ? 0.6 : 0) + (modifiers.dr ?? 0),
    drUntil: init.defId === 'cassian' ? 8 : modifiers.dr ? 999 : 0,
    nextTrapAt: init.defId === 'sylvana' ? 10 : -1,
    lifesteal: bonus?.lifesteal ?? 0,
    elem: bonus?.elem ?? 0,
    passiveDr: Math.min(DR_CAP, Math.max(0, bonus?.dr ?? 0)),
    healBonus: bonus?.heal ?? 0,
    shieldBonus: bonus?.shield ?? 0,
    specials: bonus?.specials ? [...bonus.specials] : [],
    firstUltimateUsed: false,
    gearGuardUsed: false,
    firstHitTaken: false,
    gearHitCount: 0,
  };
}

function snapshot(units: readonly Unit[]): UnitSnapshot[] {
  return units.map((unit) => ({
    uid: unit.uid,
    defId: unit.defId,
    hp: Math.max(0, Math.round(unit.hp)),
    maxHp: unit.maxHp,
    alive: unit.alive,
    energy: Math.round(unit.energy),
  }));
}

function alive(units: readonly Unit[]): Unit[] {
  return units.filter((unit) => unit.alive && unit.hp > 0);
}

function healUnit(
  caster: Unit,
  target: Unit,
  amount: number,
  time: number,
  state: SimState,
  overflowShield = false,
): void {
  if (!target.alive || amount <= 0) return;
  const boosted = amount * (1 + Math.max(0, caster.healBonus));
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + boosted);
  const healed = Math.round(target.hp - before);
  if (healed > 0) {
    caster.healingDone += healed;
    logEvent(state, { t: time, type: 'heal', unitId: caster.uid, targetId: target.uid, value: healed });
  }

  // «Плач» (снаряжение, 4 предмета): избыточное лечение становится щитом.
  const overflow = boosted - (target.hp - before);
  if (overflowShield && overflow > 0.5 && caster.specials.includes('gear:weep:4')) {
    target.shield += overflow;
    target.shieldUntil = Math.max(target.shieldUntil, time + 5);
    logEvent(state, { t: time, type: 'shield', unitId: caster.uid, targetId: target.uid, value: Math.round(overflow) });
  }
}

function killUnit(unit: Unit, time: number, state: SimState): void {
  if (!unit.alive) return;
  unit.alive = false;
  unit.hp = 0;

  if (unit.side === 'ally') {
    state.echoes.push(unit.uid);
    state.echoBuff += 0.03;
    logEvent(state, { t: time, type: 'shatter', targetId: unit.uid, note: unit.name });

    const iria = state.allies.find((ally) => ally.alive && ally.defId === 'iria');
    if (iria) {
      for (const ally of alive(state.allies)) healUnit(iria, ally, ally.maxHp * 0.15, time, state);
    }

    const nira = state.allies.find((ally) => ally.alive && ally.defId === 'nira' && ally.uid !== unit.uid);
    if (nira) {
      nira.energy = Math.min(100, nira.energy + 100);
      for (const ally of alive(state.allies)) healUnit(nira, ally, ally.maxHp * 0.15, time, state);
    }

    // «Стража»: 6 камней — при Расколе союзники получают щит 30% HP.
    if (unit.specials.includes('engraving:guard:6')) {
      for (const ally of alive(state.allies)) {
        ally.shield += ally.maxHp * 0.3;
        ally.shieldUntil = Math.max(ally.shieldUntil, time + 6);
        logEvent(state, { t: time, type: 'shield', unitId: unit.uid, targetId: ally.uid, value: Math.round(ally.maxHp * 0.3) });
      }
    }

    // «Плач»: 6 камней — при Расколе героя отряд лечится на 25%.
    if (unit.specials.includes('engraving:weep:6')) {
      for (const ally of alive(state.allies)) healUnit(unit, ally, ally.maxHp * 0.25, time, state);
    }
  } else {
    logEvent(state, { t: time, type: 'death', targetId: unit.uid, note: unit.name });
  }
}

function applyDamage(
  source: Unit,
  target: Unit,
  raw: number,
  time: number,
  state: SimState,
  rng: Rng,
  note?: string,
): void {
  if (!target.alive || raw <= 0) return;

  let amount = raw;

  if (source.side === 'ally' && state.focusUid === target.uid && time < state.focusUntil) {
    amount *= 1.35;
  }
  if (source.side === 'ally') {
    amount *= 1 + state.echoBuff;
  }
  amount *= attackMultiplier(source);
  amount *= incomingMultiplier(target);
  amount *= elementMultiplier(source.element, target.element);
  amount *= 1 + Math.max(0, source.elem);
  amount *= 1 - target.passiveDr;

  // «Стекло» (снаряжение, 4 предмета): первый получаемый удар на 50% слабее.
  if (target.specials.includes('gear:glass:4') && !target.firstHitTaken) {
    target.firstHitTaken = true;
    amount *= 0.5;
  }

  if (time < target.drUntil) amount *= 1 - target.dr;

  // «Стекло»: 6 камней — 25% шанс отразить 30% урона обратно в атакующего.
  if (target.specials.includes('engraving:glass:6') && rng.chance(0.25)) {
    const reflected = Math.min(source.hp, amount * 0.3);
    source.hp -= reflected;
    source.damageTaken += reflected;
    logEvent(state, { t: time, type: 'damage', unitId: target.uid, targetId: source.uid, value: Math.round(reflected), note: 'reflect' });
    if (source.hp <= 0) killUnit(source, time, state);
  }

  let remaining = amount;
  if (isShieldActive(target, time)) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
  }

  const dealt = Math.min(target.hp, remaining);
  target.hp -= dealt;
  target.damageTaken += dealt;
  source.damageDealt += dealt;
  if (source.side === 'ally') state.damageDealt += dealt;
  else state.damageTaken += dealt;

  const lifesteal = state.lifesteal + source.lifesteal;
  if (source.side === 'ally' && lifesteal > 0 && dealt > 0) {
    healUnit(source, source, dealt * lifesteal, time, state);
  }

  target.energy = Math.min(100, target.energy + ENERGY_PER_HIT * target.er);
  if (target.defId === 'rock' && target.alive) target.energy = Math.min(100, target.energy + 5);

  logEvent(state, {
    t: time,
    type: 'damage',
    unitId: source.uid,
    targetId: target.uid,
    value: Math.round(amount),
    note,
  });

  if (target.hp <= 0) {
    killUnit(target, time, state);
    if (source.alive) source.energy = Math.min(100, source.energy + ENERGY_PER_KILL);
  }
}

function applyStatus(target: Unit, effect: SkillEffect, sourceUid: string, time: number, state: SimState): void {
  if (!effect.status) return;
  const applied = addStatus(
    target,
    {
      kind: effect.status,
      remaining: effect.duration ?? 3,
      value: effect.value ?? 0,
      stacks: effect.stacks ?? 1,
      sourceId: sourceUid,
    },
    time,
  );
  if (applied) {
    logEvent(state, { t: time, type: 'status', targetId: target.uid, status: effect.status, value: effect.value });
  }
}

function resolveEnemyTargets(caster: Unit, skill: SkillDef, enemies: readonly Unit[], rng: Rng): Unit[] {
  const pool = alive(enemies);
  if (pool.length === 0) return [];

  switch (skill.target) {
    case 'all-enemies':
      return pool;
    case 'self':
    case 'all-allies':
      // Смешанные скиллы: урон по всем, если цель — союзник/сам.
      return pool;
    default: {
      const target = selectEnemyTarget(caster, pool, rng);
      return target ? [target] : [];
    }
  }
}

function resolveAllyTargets(caster: Unit, skill: SkillDef, allies: readonly Unit[]): Unit[] {
  switch (skill.target) {
    case 'all-allies':
      return alive(allies);
    case 'ally':
    case 'ally-lowest': {
      const target = selectLowestAlly(allies);
      return target ? [target] : [];
    }
    case 'self':
      return [caster];
    default:
      return [caster];
  }
}

function castSkill(caster: Unit, skill: SkillDef, time: number, state: SimState, rng: Rng): void {
  const allies = caster.side === 'ally' ? state.allies : state.enemies;
  const foes = caster.side === 'ally' ? state.enemies : state.allies;

  caster.energy = Math.max(0, caster.energy - skill.cost);
  if (skill.cooldown > 0) caster.cooldowns[skill.id] = skill.cooldown;

  logEvent(state, { t: time, type: 'action', unitId: caster.uid, skillId: skill.id, note: skill.nameRu });

  const enemyTargets = resolveEnemyTargets(caster, skill, foes, rng);
  const allyTargets = resolveAllyTargets(caster, skill, allies);
  const firstUltimate =
    skill.kind === 'ultimate' && caster.specials.includes('engraving:blade:6') && !caster.firstUltimateUsed;
  if (firstUltimate) caster.firstUltimateUsed = true;

  for (const effect of skill.effects) {
    switch (effect.kind) {
      case 'damage': {
        for (const target of enemyTargets) {
          let raw = caster.atk * skill.mult;

          if (caster.defId === 'belquist') {
            caster.hitCount += 1;
            if (caster.hitCount % 3 === 0) raw *= 1.5;
          }
          if (firstUltimate) raw *= 1.3;
          if (caster.specials.includes('gear:dawn-blade:4')) {
            caster.gearHitCount += 1;
            if (caster.gearHitCount % 4 === 0) raw *= 1.4;
          }

          const roll = rng.next();
          const marked = target.statuses.some((status) => status.kind === 'mark');
          const cdmg = caster.cdmg + (marked && caster.specials.includes('engraving:whisper:6') ? 0.4 : 0);
          const crit = critMultiplier(roll, caster.crit, cdmg);
          const mitigated = raw * mitigation(target.def) * crit;

          if (crit > 1 && caster.specials.includes('gear:quiet-whisper:4')) {
            caster.energy = Math.min(100, caster.energy + 10);
          }

          if (crit > 1 && caster.defId === 'morvain' && (caster.cooldowns.morvain_freeze ?? 0) <= 0) {
            caster.cooldowns.morvain_freeze = 4;
            applyStatus(target, { kind: 'control', status: 'freeze', duration: 1.2 }, caster.uid, time, state);
          }

          applyDamage(caster, target, clampDamage(mitigated), time, state, rng, crit > 1 ? 'crit' : undefined);
        }
        break;
      }
      case 'heal': {
        const healTargets = skill.target === 'all-allies' || skill.target === 'ally' || skill.target === 'ally-lowest' ? allyTargets : [caster];
        for (const target of healTargets) {
          healUnit(caster, target, caster.atk * (effect.value ?? skill.mult), time, state, true);
        }
        break;
      }
      case 'shield': {
        const shieldTargets = skill.target === 'all-allies' ? allyTargets : [caster];
        for (const target of shieldTargets) {
          const amount = caster.atk * (effect.value ?? 0.15) * (1 + Math.max(0, caster.shieldBonus));
          target.shield += amount;
          target.shieldUntil = Math.max(target.shieldUntil, time + (effect.duration ?? 5));
          logEvent(state, { t: time, type: 'shield', unitId: caster.uid, targetId: target.uid, value: Math.round(target.shield) });
        }
        break;
      }
      case 'buff': {
        const buffTargets = skill.target === 'all-allies' ? allyTargets : [caster];
        for (const target of buffTargets) applyStatus(target, effect, caster.uid, time, state);
        break;
      }
      case 'dot':
      case 'control':
      case 'debuff': {
        for (const target of enemyTargets) applyStatus(target, effect, caster.uid, time, state);
        break;
      }
      case 'energy': {
        const energyTargets = skill.target === 'all-allies' ? allyTargets : [caster];
        for (const target of energyTargets) target.energy = Math.min(100, target.energy + (effect.value ?? 10));
        break;
      }
      case 'revive': {
        const fallen = state.allies.find((unit) => !unit.alive && !unit.revived);
        if (fallen) {
          fallen.alive = true;
          fallen.revived = true;
          fallen.hp = fallen.maxHp * 0.5;
          state.echoes = state.echoes.filter((uid) => uid !== fallen.uid);
          logEvent(state, { t: time, type: 'echo', targetId: fallen.uid, note: 'revive' });
        }
        break;
      }
      default:
        break;
    }
  }

  if (skill.kind === 'ultimate' && caster.side === 'ally') {
    const tess = state.allies.find((ally) => ally.alive && ally.defId === 'tess' && ally.uid !== caster.uid);
    if (tess) {
      for (const ally of alive(state.allies)) ally.energy = Math.min(100, ally.energy + 10);
    }

    // «Хор»: 6 камней — ульта союзника даёт +10 энергии всем.
    if (state.allies.some((ally) => ally.alive && ally.specials.includes('engraving:choir:6'))) {
      for (const ally of alive(state.allies)) ally.energy = Math.min(100, ally.energy + 10);
    }

    // «Хор» (снаряжение, 4 предмета): ульта лечит отряд на 5% HP.
    if (caster.specials.includes('gear:choir:4')) {
      for (const ally of alive(state.allies)) healUnit(caster, ally, ally.maxHp * 0.05, time, state);
    }
  }

  if (caster.defId === 'orpheus' && (skill.kind === 'skill' || skill.kind === 'ultimate') && rng.chance(0.2)) {
    applyDamage(caster, enemyTargets[0] ?? foes[0] ?? caster, caster.atk * skill.mult * 0.5, time, state, rng, 'repeat');
  }
}

function basicAttack(caster: Unit, time: number, state: SimState, rng: Rng): void {
  const foes = caster.side === 'ally' ? state.enemies : state.allies;
  const target = selectEnemyTarget(caster, foes, rng);
  if (!target) return;

  logEvent(state, { t: time, type: 'action', unitId: caster.uid, skillId: caster.skills[0].id });

  let raw = caster.atk * caster.skills[0].mult;
  if (caster.specials.includes('gear:dawn-blade:4')) {
    caster.gearHitCount += 1;
    if (caster.gearHitCount % 4 === 0) raw *= 1.4;
  }

  const marked = target.statuses.some((status) => status.kind === 'mark');
  const cdmg = caster.cdmg + (marked && caster.specials.includes('engraving:whisper:6') ? 0.4 : 0);
  const crit = critMultiplier(rng.next(), caster.crit, cdmg);
  applyDamage(caster, target, clampDamage(raw * mitigation(target.def) * crit), time, state, rng, crit > 1 ? 'crit' : undefined);
  if (crit > 1 && caster.specials.includes('gear:quiet-whisper:4')) caster.energy = Math.min(100, caster.energy + 10);
  caster.energy = Math.min(100, caster.energy + ENERGY_PER_ATTACK * caster.er);
}

function act(unit: Unit, time: number, state: SimState, rng: Rng): void {
  const skill = selectSkill(unit);
  if (skill.kind === 'basic') basicAttack(unit, time, state, rng);
  else castSkill(unit, skill, time, state, rng);
}

function masterAttackPower(state: SimState): number {
  const allies = alive(state.allies);
  if (allies.length === 0) return 100;
  const average = allies.reduce((sum, ally) => sum + ally.atk, 0) / allies.length;
  return average * 0.6;
}

function applyMasterAction(action: MasterAction, time: number, state: SimState, rng: Rng): void {
  if (state.charges <= 0) return;

  const power = masterAttackPower(state);
  const foes = alive(state.enemies);
  if (foes.length === 0) return;

  state.charges -= 1;
  logEvent(state, { t: time, type: 'master', skillId: action.type, note: action.type });

  if (action.type === 'command') {
    const target = foes.find((enemy) => enemy.uid === action.targetUid) ?? selectEnemyTarget(state.allies[0] ?? foes[0], foes, rng);
    if (target) {
      state.focusUid = target.uid;
      state.focusUntil = time + 6;
    }
    return;
  }

  if (action.type === 'seal') {
    const target = foes.find((enemy) => enemy.uid === action.targetUid) ?? foes[0];
    if (!target) return;
    const row = foes.filter((enemy) => (target.slot <= 1 ? enemy.slot <= 1 : enemy.slot > 1));
    for (const enemy of row) {
      applyDamage(state.allies[0] ?? enemy, enemy, power * 2, time, state, rng, 'seal');
      applyStatus(enemy, { kind: 'control', status: 'stun', duration: 1.2 }, 'master', time, state);
    }
    return;
  }

  // sacrifice: эйдолон взрывается
  for (const enemy of foes) applyDamage(state.allies[0] ?? enemy, enemy, power * 1.8, time, state, rng, 'sacrifice');
  for (const ally of alive(state.allies)) {
    ally.shield += ally.maxHp * 0.12;
    ally.shieldUntil = Math.max(ally.shieldUntil, time + 6);
    ally.energy = Math.min(100, ally.energy + 15);
  }
}

export function simulate(setup: BattleSetup): BattleResult {
  const rng = new Rng(setup.seed);
  const modifiers = setup.modifiers ?? {};

  const state: SimState = {
    allies: setup.allies.map((unit) => createUnit(unit, modifiers)),
    enemies: setup.enemies.map((unit) => createUnit(unit, setup.enemyModifiers)),
    echoes: [],
    echoBuff: 0,
    charges: setup.masterCharges ?? MASTER_CHARGES,
    focusUid: null,
    focusUntil: 0,
    damageDealt: 0,
    damageTaken: 0,
    log: [],
    lifesteal: modifiers.lifesteal ?? 0,
  };

  const maxTime = setup.maxTime ?? DEFAULT_MAX_TIME;
  const actions = [...(setup.masterActions ?? [])].sort((a, b) => a.at - b.at);

  logEvent(state, { t: 0, type: 'battle_start' });

  let time = 0;
  const totalTicks = Math.ceil(maxTime / DT);

  for (let tick = 0; tick < totalTicks; tick += 1) {
    time = tick * DT;

    while (actions.length > 0 && (actions[0] as MasterAction).at <= time) {
      const action = actions.shift();
      if (action) applyMasterAction(action, time, state, rng);
    }

    for (const unit of [...state.allies, ...state.enemies]) {
      if (!unit.alive) continue;

      clearExpiredShield(unit, time);

      for (const key of Object.keys(unit.cooldowns)) {
        unit.cooldowns[key] = Math.max(0, (unit.cooldowns[key] ?? 0) - DT);
      }

      const statusTick = tickStatuses(unit, DT, time);

      if (statusTick.damage > 0) {
        const dealt = Math.min(unit.hp, statusTick.damage);
        unit.hp -= dealt;
        unit.damageTaken += dealt;
        // DoT врагов тоже идёт в общий счёт урона (Мировое Эхо, гильдия, график боя).
        if (unit.side === 'ally') state.damageTaken += dealt;
        else state.damageDealt += dealt;
        if (time - unit.lastDotLogAt >= 1) {
          unit.lastDotLogAt = time;
          logEvent(state, { t: time, type: 'damage', targetId: unit.uid, value: Math.round(dealt), note: 'dot' });
        }
        if (unit.hp <= 0) killUnit(unit, time, state);
      }

      if (statusTick.healing > 0 && unit.alive) healUnit(unit, unit, statusTick.healing, time, state);

      if (!unit.alive) continue;

      // «Эхо-стража» (снаряжение, 4 предмета): при HP ниже 30% — щит 20% раз в бой.
      if (
        unit.side === 'ally' &&
        unit.specials.includes('gear:echo-guard:4') &&
        !unit.gearGuardUsed &&
        unit.hp < unit.maxHp * 0.3
      ) {
        unit.gearGuardUsed = true;
        unit.shield += unit.maxHp * 0.2;
        unit.shieldUntil = Math.max(unit.shieldUntil, time + 5);
        logEvent(state, { t: time, type: 'shield', unitId: unit.uid, targetId: unit.uid, value: Math.round(unit.maxHp * 0.2) });
      }

      if (isControlled(unit)) {
        unit.actionGauge = Math.min(unit.actionGauge, 99);
      } else {
        unit.actionGauge += unit.spd * speedMultiplier(unit) * DT;
      }
    }

    // Ловушка Сильваны.
    for (const sylvana of state.allies) {
      if (!sylvana.alive || sylvana.nextTrapAt < 0 || time < sylvana.nextTrapAt) continue;
      sylvana.nextTrapAt = time + 10;
      const target = selectEnemyTarget(sylvana, state.enemies, rng);
      if (target) {
        applyDamage(sylvana, target, sylvana.atk * 0.8, time, state, rng, 'trap');
      }
    }

    const actors = [...state.allies, ...state.enemies]
      .filter((unit) => unit.alive && unit.actionGauge >= 100)
      .sort((a, b) => b.actionGauge - a.actionGauge || a.slot - b.slot || a.uid.localeCompare(b.uid));

    for (const actor of actors) {
      if (!actor.alive) continue;
      actor.actionGauge -= 100;
      act(actor, time, state, rng);

      if (alive(state.allies).length === 0 || alive(state.enemies).length === 0) break;
    }

    if (alive(state.allies).length === 0 || alive(state.enemies).length === 0) break;
  }

  const alliesLeft = alive(state.allies).length;
  const enemiesLeft = alive(state.enemies).length;
  const allAlliesDead = alliesLeft === 0;
  const allEnemiesDead = enemiesLeft === 0;

  let outcome: BattleResult['outcome'];
  if (allEnemiesDead && !allAlliesDead) outcome = 'win';
  else if (allAlliesDead) outcome = 'lose';
  else outcome = 'timeout';

  const finalOutcome = allEnemiesDead && !allAlliesDead ? 'win' : outcome;

  logEvent(state, {
    t: time,
    type: 'battle_end',
    value: allEnemiesDead ? 1 : 0,
    note: finalOutcome,
  });

  return {
    seed: setup.seed,
    outcome: finalOutcome,
    timeMs: Math.round(time * 1000),
    damageDealt: Math.round(state.damageDealt),
    damageTaken: Math.round(state.damageTaken),
    echoes: [...state.echoes],
    allies: snapshot(state.allies),
    enemies: snapshot(state.enemies),
    stats: [...state.allies, ...state.enemies].map((unit) => ({
      uid: unit.uid,
      defId: unit.defId,
      name: unit.name,
      ...(unit.nameEn ? { nameEn: unit.nameEn } : {}),
      side: unit.side,
      damageDealt: Math.round(unit.damageDealt),
      damageTaken: Math.round(unit.damageTaken),
      healing: Math.round(unit.healingDone),
    })),
    log: state.log,
  };
}
