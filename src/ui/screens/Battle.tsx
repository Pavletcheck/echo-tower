import { useEffect, useRef, useState } from 'preact/hooks';
import { track } from '../../analytics/events';
import { asset } from '../../core/asset';
import { playMusic, playSfx } from '../../core/audio';
import { maybeInterstitial } from '../../core/ads';
import { haptic } from '../../core/haptics';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { formatNumber } from '../../core/time';
import { getFloor, CHAPTERS_BY_INDEX } from '../../data/floors';
import { GEAR_BY_ID } from '../../data/gear';
import { elementName } from '../../data/heroes';
import { buildWave } from '../../game/battle/factory';
import { BOSSES_BY_ID, ENEMIES_BY_ID } from '../../data/enemies';import { addMasterXp, crystalFloorMultiplier } from '../../game/base';
import { unitCombatStats } from '../../game/battle/stats';
import { simulate } from '../../game/battle/sim';
import type { BattleResult, BattleSetup, MasterAction, MasterActionType, UnitBattleStats, UnitInit } from '../../game/battle/types';
import { MASTER_CHARGES } from '../../game/config';
import { consumeDiningBattle, diningBattleModifiers, diningGoldMultiplier } from '../../game/dining';
import { gearDropForFloor } from '../../game/equipment';
import { advanceFtueFrom, ftueStepDef, noteBattleResult, shouldShowNextPanel } from '../../game/ftue';
import { autoNextFloor, grantSquadXp, repeatReward } from '../../game/farming';
import { applyHeroDeaths, fallenFromResult } from '../../game/hero-loss';
import { firstSquadHero } from '../../game/rewards';
import { nextSteps } from '../../game/next-steps';
import { addPassXp } from '../../game/pass';
import { buildSquad } from '../../game/squad';
import { squadElementBonus } from '../../game/squad-element';
import { trackQuest } from '../../game/quests';
import { commit, save$, submitLeaderboard } from '../../game/state';
import { mergeBattleStats } from '../../game/battle/metrics';
import { DamageChart } from '../components/DamageChart';
import { NextSteps, nextStepParams } from '../components/NextSteps';
import { StatusHelp } from '../components/StatusHelp';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import { BattleStage } from '../battle-view/BattleStage';
import { BattleDomStage } from '../battle-view/BattleDomStage';
import { supportsWebGL, type BattleStageLike } from '../battle-view/stage-types';
import { battleFloor$, openHero } from '../nav';
import s from './Battle.module.css';

interface Playback {
  floorNumber: number;
  waveIndex: number;
  seed: number;
  time: number;
  cursor: number;
  result: BattleResult;
  allies: UnitInit[];
  enemies: UnitInit[];
  startHp: Map<string, number>;
  actions: MasterAction[];
  chargesAtWaveStart: number;
  phase: 'playing' | 'done';
  /** Короткое замедление на ульте, сек. */
  slowUntil: number;
  modifiers: BattleSetup['modifiers'];
}

interface Rewards {
  gold: number;
  crystals: number;
  shards: number;
  first: boolean;
  /** Бонус за веху кампании (5 000 золота за 5-й этаж). */
  bonus: number;
  /** id предмета снаряжения. */
  gear?: string;
}

interface DefeatInfo {
  wave: number;
  enemies: number;
  hpPct: number;
  topNameRu: string;
  topNameEn: string;
  topDamage: number;
  handUsed: number;
  handTotal: number;
}

const REDUCED_MOTION =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function maxHpOf(unit: UnitInit): number {
  return Math.round(unitCombatStats(unit).hp * (unit.hpMult ?? 1));
}

const HAND_ACTIONS: ReadonlyArray<{
  type: MasterActionType;
  labelKey: string;
  hintKey: string;
  icon: 'swords' | 'star' | 'shield';
}> = [
  { type: 'command', labelKey: 'battle.command', hintKey: 'battle.commandHint', icon: 'swords' },
  { type: 'seal', labelKey: 'battle.seal', hintKey: 'battle.sealHint', icon: 'star' },
  { type: 'sacrifice', labelKey: 'battle.sacrifice', hintKey: 'battle.sacrificeHint', icon: 'shield' },
];

export function Battle() {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<BattleStageLike | null>(null);
  const playRef = useRef<Playback | null>(null);
  const initialSpeed = save$.value.settings.battleSpeed;
  const speedRef = useRef(initialSpeed);
  const attemptRef = useRef(1);
  const settledRef = useRef(false);
  const startingRef = useRef(false);
  const statsRef = useRef<UnitBattleStats[]>([]);

  const [floorNumber, setFloorNumber] = useState(() =>
    Math.min(100, Math.max(1, battleFloor$.value ?? save$.value.tower.maxFloor)),
  );
  const [wave, setWave] = useState(0);
  const [charges, setCharges] = useState(MASTER_CHARGES);
  const [speed, setSpeed] = useState(initialSpeed);
  const [phase, setPhase] = useState<'playing' | 'win' | 'lose'>('playing');
  const [rewards, setRewards] = useState<Rewards | null>(null);
  const [nextOpen, setNextOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [autoNext, setAutoNext] = useState(false);
  const [battleStats, setBattleStats] = useState<UnitBattleStats[]>([]);
  const [defeatInfo, setDefeatInfo] = useState<DefeatInfo | null>(null);
  const [echoStacks, setEchoStacks] = useState(0);
  const [targetUid, setTargetUid] = useState<string | null>(null);

  const startWave = (
    index: number,
    carried: Map<string, number>,
    base: UnitInit[],
    chargesLeft: number,
    floor: number,
    modifiers: BattleSetup['modifiers'],
  ) => {
    const stage = stageRef.current;
    const floorDef = getFloor(floor);
    if (!stage || !floorDef) return;

    const allies: UnitInit[] = base.map((unit) => ({
      ...unit,
      ...(carried.has(unit.uid) ? { startHp: carried.get(unit.uid) ?? 0 } : {}),
    }));
    const enemies = buildWave(floorDef, index);
    const seed = floor * 100_000 + attemptRef.current * 9_973 + index * 7_919;

    const result = simulate({
      seed,
      mode: 'tower',
      allies,
      enemies,
      masterCharges: chargesLeft,
      masterActions: [],
      maxTime: 45,
      ...(modifiers ? { modifiers } : {}),
    });

    const startHp = new Map<string, number>();
    for (const unit of allies) if (unit.startHp !== undefined) startHp.set(unit.uid, unit.startHp);

    stage.loadWave(allies, enemies, startHp);
    playRef.current = {
      floorNumber: floor,
      waveIndex: index,
      seed,
      time: 0,
      cursor: 0,
      result,
      allies,
      enemies,
      startHp,
      actions: [],
      chargesAtWaveStart: chargesLeft,
      phase: 'playing',
      slowUntil: 0,
      modifiers,
    };
    stage.setPaused(false);
    setTargetUid(null);
    setWave(index);
    setCharges(chargesLeft);
    setPhase('playing');
  };

  const startFloor = async (number: number) => {
    if (startingRef.current) return;
    startingRef.current = true;

    const floorDef = getFloor(number);
    if (!floorDef) {
      startingRef.current = false;
      navigate('lobby');
      return;
    }

    // Реклама только до боя: иначе оверлей площадки накрывает первую волну.
    await maybeInterstitial();
    playMusic(number % 5 === 0 ? 'boss' : 'battle');
    attemptRef.current += 1;
    settledRef.current = false;
    setRewards(null);
    setDefeatInfo(null);
    setEchoStacks(0);
    setTargetUid(null);
    setBattleStats([]);
    statsRef.current = [];
    setFloorNumber(number);
    setPhase('playing');

    const chapter = CHAPTERS_BY_INDEX[floorDef.chapter];
    const stage = stageRef.current;
    if (stage && chapter) stage.setChapter(floorDef.chapter, chapter.element);

    const base = buildSquad(save$.value);
    const diningMods = diningBattleModifiers(save$.value);
    startWave(0, new Map(), base, MASTER_CHARGES, number, diningMods);
    track('battle_start', { floor: number, squad: base.length });
    startingRef.current = false;
  };

  const finish = (outcome: 'win' | 'lose', result: BattleResult) => {
    const play = playRef.current;
    if (!play || settledRef.current) return;

    settledRef.current = true;
    stageRef.current?.setPaused(true);
    play.phase = 'done';
    statsRef.current = mergeBattleStats(statsRef.current, result.stats);
    setBattleStats(statsRef.current);

    if (outcome === 'lose') {
      const totalHp = result.enemies.reduce((sum, enemy) => sum + Math.max(0, enemy.hp), 0);
      const totalMax = result.enemies.reduce((sum, enemy) => sum + enemy.maxHp, 0);
      const top = [...result.stats]
        .filter((unit) => unit.side === 'enemy')
        .sort((a, b) => b.damageDealt - a.damageDealt)[0];
      setDefeatInfo({
        wave: play.waveIndex + 1,
        enemies: result.enemies.filter((enemy) => enemy.alive).length,
        hpPct: totalMax > 0 ? Math.round((totalHp / totalMax) * 100) : 0,
        topNameRu: top?.name ?? '',
        topNameEn: top?.nameEn ?? top?.name ?? '',
        topDamage: top?.damageDealt ?? 0,
        handUsed: play.actions.length,
        handTotal: play.chargesAtWaveStart,
      });
      setPhase('lose');
      setAutoNext(false);
      playSfx('error');
      haptic('heavy');
      const fallen = fallenFromResult(result);
      let ftueAdvanced = false;
      commit((draft) => {
        // До 10-го этажа герои не погибают насовсем: новичок не должен терять состав.
        if (play.floorNumber >= 10) applyHeroDeaths(draft, fallen);
        // На поражении не тащим игрока в «Итог боя → усиление»: сначала надо собрать отряд.
        noteBattleResult(draft, 'lose');
        addMasterXp(draft, 2);
      }, 'battle-loss');
      if (fallen.length > 0 && play.floorNumber < 10) {
        toast(t('battle.survived', { n: fallen.length }), 'info');
      } else if (fallen.length > 0) {
        toast(t('battle.fallen', { n: fallen.length }), 'error');
      }
      if (ftueAdvanced) track('ftue_step', { from: 'battle', to: 'result' });
      track('battle_end', { floor: play.floorNumber, outcome: 'lose', timeMs: result.timeMs });
      return;
    }

    const floorDef = getFloor(play.floorNumber);
    if (!floorDef) {
      setPhase('win');
      return;
    }

    const key = String(play.floorNumber);
    const first = !save$.value.tower.clears[key];
    const repeat = first ? null : repeatReward(save$.value, play.floorNumber);
    const milestoneBonus = first && play.floorNumber === 5 ? 5_000 : 0;
    const baseGold = first
      ? Math.round(floorDef.firstClear.gold * diningGoldMultiplier(save$.value))
      : (repeat?.gold ?? 0);
    const gold = baseGold + milestoneBonus;
    const crystals = first
      ? Math.round(floorDef.firstClear.crystals * crystalFloorMultiplier(save$.value))
      : 0;
    const shards = first ? floorDef.reward.shards : 0;
    const gearDrop = first ? gearDropForFloor(play.floorNumber) : null;
    const fallen = fallenFromResult(result);

    let ftueAdvanced = false;
    let levelAdvanced = false;
    commit((draft) => {
      levelAdvanced = play.floorNumber >= draft.tower.maxFloor;
      if (play.floorNumber >= 10) applyHeroDeaths(draft, fallen);
      ftueAdvanced = advanceFtueFrom(draft, 1);
      noteBattleResult(draft, 'win');
      draft.currencies.gold += gold;
      draft.currencies.crystals += crystals;
      if (gearDrop) draft.inventory.gear.push(gearDrop.id);
      consumeDiningBattle(draft);
      const shardHero = firstSquadHero(draft);
      if (shards > 0 && shardHero) {
        draft.currencies.starShards[shardHero] = (draft.currencies.starShards[shardHero] ?? 0) + shards;
      }
      draft.tower.maxFloor = Math.max(draft.tower.maxFloor, Math.min(100, play.floorNumber + 1));
      draft.tower.clears[key] = { stars: 3, first: true };

      if (first) {
        trackQuest(draft, 'floors', 1);
        trackQuest(draft, 'wins', result.enemies.filter((enemy) => !enemy.alive).length);
        if (play.floorNumber % 5 === 0) trackQuest(draft, 'bossKills', 1);
        if (play.floorNumber % 10 === 0) trackQuest(draft, 'clears', 1);
        if (result.echoes.length === 0) trackQuest(draft, 'noShatter', 1);

        addPassXp(draft, 2);
        grantSquadXp(draft, floorDef.reward.xp);
        addMasterXp(draft, 10 + Math.floor(play.floorNumber / 10));
      }
    }, 'battle-win');

    if (ftueAdvanced) track('ftue_step', { from: 'battle', to: 'result' });
    if (levelAdvanced) submitLeaderboard();
    if (fallen.length > 0) toast(t('battle.fallen', { n: fallen.length }), 'error');

    setRewards({
      gold: baseGold,
      crystals,
      shards,
      first,
      bonus: milestoneBonus,
      ...(gearDrop ? { gear: gearDrop.id } : {}),
    });
    setPhase('win');
    playSfx('starUp');
    haptic('medium');
    track('battle_end', { floor: play.floorNumber, outcome: 'win', timeMs: result.timeMs, first });
  };

  useEffect(() => {
    battleFloor$.value = null;
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    // DOM-сцена — основной вариант: работает на любом устройстве и предсказуема.
    // Pixi включается явно через ?pixi=1, если WebGL доступен.
    const pixiRequested =
      typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('pixi');
    const stage: BattleStageLike =
      pixiRequested && supportsWebGL()
        ? new BattleStage(host, save$.value.settings.quality)
        : new BattleDomStage(host, save$.value.settings.quality);
    stageRef.current = stage;

    stage.onTick = (dt) => {
      const play = playRef.current;
      if (!play || play.phase !== 'playing') return;

      const slowScale = !REDUCED_MOTION && play.time < play.slowUntil ? 0.35 : 1;
      play.time += dt * speedRef.current * slowScale;

      while (play.cursor < play.result.log.length) {
        const event = play.result.log[play.cursor];
        if (!event || event.t > play.time) break;
        if (event.type === 'action' && event.skillId?.endsWith('_ultimate')) {
          play.slowUntil = Math.max(play.slowUntil, play.time + 0.18);
        }
        stage.applyEvent(event);
        if (event.type === 'shatter') setEchoStacks((value) => value + 1);
        play.cursor += 1;
      }

      const lastT = play.result.log[play.result.log.length - 1]?.t ?? 0;
      if (play.time < lastT + 0.6) return;

      if (play.result.outcome !== 'win') {
        finish('lose', play.result);
        return;
      }

      if (play.waveIndex < 2) {
        statsRef.current = mergeBattleStats(statsRef.current, play.result.stats);
        const carried = new Map<string, number>();
        for (const ally of play.result.allies) {
          carried.set(ally.uid, Math.min(ally.maxHp, ally.hp + ally.maxHp * 0.25));
        }
        const base = buildSquad(save$.value);
        const chargesLeft = play.chargesAtWaveStart - play.actions.length;
        startWave(play.waveIndex + 1, carried, base, chargesLeft, play.floorNumber, play.modifiers);
        return;
      }

      finish('win', play.result);
    };

    void stage.init().then(() => {
      if (cancelled) return;
      void startFloor(floorNumber);
    });

    return () => {
      cancelled = true;
      stageRef.current = null;
      stage.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === 'playing') return;
    if (autoNext) return;
    // На поражении recap важнее модалки: рекомендации уже есть inline.
    if (phase === 'lose') return;
    if (!shouldShowNextPanel(save$.value)) return;
    // Пока обучение показывает шаг «итог», панель не перекрывает его.
    if (ftueStepDef(save$.value)?.id === 'result') return;
    const id = window.setTimeout(() => setNextOpen(true), 800);
    return () => window.clearTimeout(id);
  }, [phase, autoNext]);

  useEffect(() => {
    if (phase !== 'win' || !autoNext) return;
    const next = autoNextFloor(save$.value, floorNumber);
    if (!next) {
      setAutoNext(false);
      toast(t('battle.autoFinished'), 'info');
      return;
    }
    const id = window.setTimeout(() => {
      advanceResultStep();
      void startFloor(next);
    }, 2200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, autoNext, floorNumber]);

  useEffect(() => {
    if (!__DEV__) return;
    const debugWindow = window as unknown as {
      __battleDebug?: () => unknown;
      __battleFinish?: () => void;
    };
    debugWindow.__battleDebug = () => {
      const play = playRef.current;
      if (!play) return null;
      return {
        time: Number(play.time.toFixed(2)),
        wave: play.waveIndex,
        cursor: play.cursor,
        phase: play.phase,
        log: play.result.log.length,
        outcome: play.result.outcome,
        charges: play.chargesAtWaveStart - play.actions.length,
        art: stageRef.current?.hasBackgroundArt() ?? false,
      };
    };
    debugWindow.__battleFinish = () => {
      const play = playRef.current;
      if (play) finish('win', play.result);
    };
  }, []);

  const useMaster = (type: MasterActionType) => {
    const play = playRef.current;
    const stage = stageRef.current;
    if (!play || !stage || play.phase !== 'playing') return;
    const left = play.chargesAtWaveStart - play.actions.length;
    if (left <= 0) return;

    const aliveEnemies = play.enemies.filter((unit) => stage.getHp(unit.uid) > 0);
    const target = aliveEnemies.find((unit) => unit.uid === targetUid) ?? aliveEnemies[0];

    const action: MasterAction = { at: play.time, type };
    if ((type === 'command' || type === 'seal') && target) action.targetUid = target.uid;
    play.actions.push(action);

    const result = simulate({
      seed: play.seed,
      mode: 'tower',
      allies: play.allies,
      enemies: play.enemies,
      masterCharges: play.chargesAtWaveStart,
      masterActions: [...play.actions],
      maxTime: 45,
      ...(play.modifiers ? { modifiers: play.modifiers } : {}),
    });

    const hp = new Map<string, number>();
    for (const unit of play.allies) hp.set(unit.uid, play.startHp.get(unit.uid) ?? maxHpOf(unit));
    for (const unit of play.enemies) hp.set(unit.uid, maxHpOf(unit));

    for (const event of result.log) {
      if (event.t > play.time) break;
      const uid = event.targetId;
      if (!uid) continue;
      if (event.type === 'damage') hp.set(uid, Math.max(0, (hp.get(uid) ?? 0) - (event.value ?? 0)));
      else if (event.type === 'heal') hp.set(uid, (hp.get(uid) ?? 0) + (event.value ?? 0));
      else if (event.type === 'shatter' || event.type === 'death') hp.set(uid, 0);
    }

    for (const [uid, value] of hp) {
      stage.setHp(uid, value);
    }

    play.result = result;
    play.cursor = result.log.findIndex((event) => event.t > play.time);
    if (play.cursor < 0) play.cursor = result.log.length;

    setCharges(play.chargesAtWaveStart - play.actions.length);
    commit((draft) => {
      trackQuest(draft, 'masterHand', 1);
    }, 'quest-hand');
    stage.flashMaster();
    playSfx(type === 'sacrifice' ? 'ult' : 'crit');
    haptic(type === 'sacrifice' ? 'heavy' : 'medium');
    track('master_hand', { type, floor: play.floorNumber });
  };

  const advanceResultStep = (): void => {
    let changed = false;
    commit((draft) => {
      changed = advanceFtueFrom(draft, 2);
    }, 'ftue-step');
    if (changed) track('ftue_step', { from: 'result', to: 'upgrade' });
  };

  const toUpgrade = (): void => {
    advanceResultStep();
    const heroId = save$.value.squad.find((id) => Boolean(save$.value.heroes[id]));
    if (heroId) openHero(heroId);
    else navigate('heroes');
  };

  const nextFloor = () => {
    const next = Math.min(100, floorNumber + 1);
    if (next === floorNumber) {
      navigate('lobby');
      return;
    }
    void startFloor(next);
  };

  const retry = () => void startFloor(floorNumber);

  const toggleAutoNext = () => {
    const next = !autoNext;
    setAutoNext(next);
    if (next) setNextOpen(false);
  };

  const cycleSpeed = () => {
    const current = speedRef.current;
    const next = (current >= 4 ? 1 : current + 1) as 1 | 2 | 3 | 4;
    speedRef.current = next;
    setSpeed(next);
    commit((draft) => {
      draft.settings.battleSpeed = next;
    }, 'battle-speed');
  };

  const canContinue = floorNumber < 100;
  const tutorialResult = ftueStepDef(save$.value)?.id === 'result';
  const showNextPanel = phase !== 'playing' && shouldShowNextPanel(save$.value);
  const quickSteps = nextSteps(save$.value).slice(0, 2);
  const elementInfo = squadElementBonus(save$.value);

  const waveEnemies = (() => {
    const def = getFloor(floorNumber);
    return def ? buildWave(def, wave) : [];
  })();

  const enemyArt = (defId: string): string | null =>
    ENEMIES_BY_ID[defId]?.asset ?? BOSSES_BY_ID[defId]?.asset ?? null;

  return (
    <div class={s.root}>
      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('lobby')} aria-label={t('common.close')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.titleBlock}>
          <span class={s.floor}>{t('lobby.floor', { n: floorNumber })}</span>
          <span class={s.wave}>{t('battle.wave', { n: wave + 1 })}</span>
          {elementInfo.bonus > 0 && elementInfo.element ? (
            <span class={s.echoBonus}>
              {t('battle.elementBonus', {
                element: elementName(elementInfo.element, locale$.value),
                bonus: elementInfo.bonus,
              })}
            </span>
          ) : null}
          {echoStacks > 0 ? (
            <span class={s.echoBonus}>{t('battle.echoStacks', { n: echoStacks * 3 })}</span>
          ) : null}
        </div>
        <button class={s.speedBtn} onClick={() => setHelpOpen(true)} aria-label={t('battle.statuses')}>
          <Icon name="book" size={16} />
        </button>
        <button class={s.speedBtn} onClick={cycleSpeed} aria-label={t('battle.speed')}>
          {speed}×
        </button>
      </header>

      {waveEnemies.length > 0 ? (
        <div class={s.wavePreview}>
          {waveEnemies.map((unit) => {
            const art = enemyArt(unit.defId);
            return (
              <button
                key={unit.uid}
                type="button"
                class={`${s.waveEnemy}${unit.isBoss ? ` ${s.waveEnemyBoss}` : ''}${
                  unit.uid === targetUid ? ` ${s.waveEnemySelected}` : ''
                }`}
                title={`${locale$.value === 'ru' ? unit.name : unit.nameEn ?? unit.name} — ${t('battle.target')}`}
                aria-label={`${locale$.value === 'ru' ? unit.name : unit.nameEn ?? unit.name}: ${t('battle.target')}`}
                onClick={() => setTargetUid(unit.uid)}
              >
                {art ? <img src={asset(art)} alt="" draggable={false} loading="lazy" /> : unit.name.slice(0, 1)}
              </button>
            );
          })}
        </div>
      ) : null}

      <div class={s.stage} ref={hostRef} />

      <footer class={s.bottom}>
        <div class={s.handHead}>
          <span>{t('battle.masterHand')}</span>
          <span class={s.handMeta} title={t('battle.handHint')}>
            {t('battle.handQuick', { n: charges })}
          </span>
        </div>
        <div class={s.hand}>
          {HAND_ACTIONS.map((action) => (
            <button
              key={action.type}
              class={s.handBtn}
              title={t(action.hintKey)}
              aria-label={`${t(action.labelKey)}. ${t(action.hintKey)}`}
              disabled={charges <= 0 || phase !== 'playing'}
              onClick={() => useMaster(action.type)}
            >
              <span class={s.handIcon}>
                <Icon name={action.icon} size={20} />
              </span>
              <span class={s.handLabel}>{t(action.labelKey)}</span>
            </button>
          ))}
        </div>
      </footer>

      {phase !== 'playing' ? (
        <div class={s.overlay}>
          <div class={s.resultPanel} data-ftue="battle-result">
            <div class={`${s.resultTitle} ${phase === 'win' ? s.win : s.lose}`}>
              {phase === 'win' ? t('battle.victory') : t('battle.defeat')}
            </div>
            <div class={s.resultSub}>
              {t('lobby.floor', { n: floorNumber })} · {phase === 'win' ? t('battle.floorCleared') : t('battle.tryAgain')}
            </div>

            {tutorialResult ? (
              <div class={s.tutorial}>
                <b>{t('tutorial.result.title')}</b>
                <span>{t('tutorial.result.body')}</span>
                <button class="btn btn--sm btn--gold" onClick={toUpgrade}>
                  {t('tutorial.result.action')}
                </button>
              </div>
            ) : null}

            {phase === 'win' && rewards ? (
              <div class={s.rewards}>
                <div class={s.rewardRow}>
                  <span>{t('resource.gold')}</span>
                  <b>+{formatNumber(rewards.gold, locale$.value)}</b>
                </div>
                {rewards.crystals > 0 ? (
                  <div class={s.rewardRow}>
                    <span>{t('resource.crystals')}</span>
                    <b>+{formatNumber(rewards.crystals, locale$.value)}</b>
                  </div>
                ) : null}
                {rewards.shards > 0 ? (
                  <div class={s.rewardRow}>
                    <span>{t('battle.shards')}</span>
                    <b>+{formatNumber(rewards.shards, locale$.value)}</b>
                  </div>
                ) : null}
                {rewards.gear ? (
                  <div class={s.rewardRow}>
                    <span>{t('battle.gearDrop')}</span>
                    <b>
                      {locale$.value === 'ru'
                        ? GEAR_BY_ID[rewards.gear]?.nameRu
                        : GEAR_BY_ID[rewards.gear]?.nameEn}
                    </b>
                  </div>
                ) : null}
                {rewards.bonus > 0 ? (
                  <div class={s.rewardRow}>
                    <span>{t('battle.milestone5')}</span>
                    <b>+{formatNumber(rewards.bonus, locale$.value)}</b>
                  </div>
                ) : null}
                {rewards.first ? <div class={s.firstTag}>{t('battle.firstClear')}</div> : null}
              </div>
            ) : null}

            {phase === 'lose' && defeatInfo ? (
              <div class={s.recap}>
                <div class={s.recapRow}>
                  {t('battle.defeatWave', { n: defeatInfo.wave })} ·{' '}
                  {t('battle.defeatEnemies', { n: defeatInfo.enemies, hp: defeatInfo.hpPct })}
                </div>
                {defeatInfo.topNameRu ? (
                  <div class={s.recapRow}>
                    {t('battle.defeatTop', {
                      name: locale$.value === 'ru' ? defeatInfo.topNameRu : defeatInfo.topNameEn,
                      damage: formatNumber(defeatInfo.topDamage, locale$.value),
                    })}
                  </div>
                ) : null}
                <div class={s.recapRow}>
                  {t('battle.defeatHand', { used: defeatInfo.handUsed, total: defeatInfo.handTotal })}
                </div>
                <div class={s.recapAdvice}>{t('battle.defeatAdvice')}</div>
              </div>
            ) : null}

            <DamageChart stats={battleStats} />

            {showNextPanel ? (
              <div class={s.nextInline}>
                <b>{t(phase === 'win' ? 'next.panel.win' : 'next.panel.loss')}</b>
                <div class={s.nextList}>
                  {quickSteps.map((step) => (
                    <span key={step.id}>{t(`next.${step.id}.title`, nextStepParams(step))}</span>
                  ))}
                </div>
                <button class="btn btn--ghost btn--sm" onClick={() => setNextOpen(true)}>
                  {t('lobby.nextMore')}
                </button>
              </div>
            ) : null}

            {phase === 'win' ? (
              <button
                class={`btn btn--sm ${autoNext ? 'btn--gold' : 'btn--ghost'}`}
                onClick={toggleAutoNext}
              >
                {t('battle.autoNext')} · {autoNext ? t('common.on') : t('common.off')}
              </button>
            ) : null}

            <div class={s.resultActions}>
              {phase === 'win' ? (
                <button class="btn btn--gold btn--wide" onClick={toUpgrade}>
                  {t('battle.upgrade')}
                </button>
              ) : null}
              {phase === 'win' ? (
                <button
                  class="btn btn--primary btn--wide"
                  onClick={() => {
                    advanceResultStep();
                    if (canContinue) nextFloor();
                    else navigate('lobby');
                  }}
                >
                  {canContinue ? t('battle.next') : t('battle.toLobby')}
                </button>
              ) : (
                <button
                  class="btn btn--primary btn--wide"
                  onClick={() => {
                    advanceResultStep();
                    retry();
                  }}
                >
                  {t('battle.retry')}
                </button>
              )}
              <button
                class="btn btn--ghost btn--wide"
                onClick={() => {
                  advanceResultStep();
                  navigate('lobby');
                }}
              >
                {t('battle.toLobby')}
              </button>
              {phase !== 'win' ? (
                <button class="btn btn--ghost btn--wide" onClick={() => setNextOpen(true)}>
                  {t('lobby.next')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {nextOpen ? (
        <NextSteps
          reason={phase === 'playing' ? null : phase === 'win' ? 'win' : 'lose'}
          onClose={() => setNextOpen(false)}
        />
      ) : null}

      {helpOpen ? <StatusHelp onClose={() => setHelpOpen(false)} /> : null}
    </div>
  );
}
