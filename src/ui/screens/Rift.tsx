import { useEffect, useRef, useState } from 'preact/hooks';
import { asset } from '../../core/asset';
import { playSfx } from '../../core/audio';
import { locale$, t } from '../../core/i18n';
import { hashString } from '../../core/rng';
import { navigate } from '../../core/router';
import { BOSSES_BY_ID } from '../../data/enemies';
import { CHAPTERS_BY_INDEX, getFloor } from '../../data/floors';
import { GEAR_BY_ID } from '../../data/gear';
import type { RiftBoonDef } from '../../data/types';
import { RIFT_BOONS_BY_ID } from '../../data/rift';
import { bossUnits, buildWave } from '../../game/battle/factory';
import { simulate } from '../../game/battle/sim';
import type { UnitBattleStats } from '../../game/battle/types';
import {
  createRiftRun,
  ensureRiftDay,
  riftGearDrop,
  riftModifiers,
  riftReward,
  rollBoons,
  type RiftRun,
} from '../../game/rift';
import { buildSquad } from '../../game/squad';
import { addMasterXp } from '../../game/base';
import { applyHeroDeaths, fallenFromResult } from '../../game/hero-loss';
import { firstSquadHero } from '../../game/rewards';
import { commit, save$ } from '../../game/state';
import { trackQuest } from '../../game/quests';
import { platform } from '../../platform';
import { BattleResultModal } from '../components/BattleResultModal';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { toast } from '../components/toast';
import s from './Mode.module.css';

type ChoiceMode = 'boon' | 'rest' | 'shop';

export function Rift() {
  const [run, setRun] = useState<RiftRun | null>(null);
  const [choices, setChoices] = useState<RiftBoonDef[] | null>(null);
  const [choiceMode, setChoiceMode] = useState<ChoiceMode>('boon');
  const [result, setResult] = useState<{ win: boolean; dealt: number; taken: number; stats: UnitBattleStats[] } | null>(
    null,
  );
  const [finished, setFinished] = useState<'win' | 'lose' | null>(null);
  const [finishedGear, setFinishedGear] = useState<string | null>(null);
  const completedRoomRef = useRef(-1);
  const startingRef = useRef(false);
  const save = save$.value;

  useEffect(() => {
    commit((draft) => {
      ensureRiftDay(draft);
    }, 'rift-day');
  }, []);

  const startRun = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      const state = save$.value;
      if (state.rift.runsToday >= 2) {
        toast(t('rift.noRuns'), 'error');
        return;
      }

      if (state.rift.runsToday >= 1) {
        const ad = await platform().ads.rewarded('rift_run');
        if (ad !== 'rewarded') return;
      }

      commit((draft) => {
        ensureRiftDay(draft);
        draft.rift.runsToday += 1;
        trackQuest(draft, 'rift', 1);
      }, 'rift-start');
      setFinished(null);
      setFinishedGear(null);
      completedRoomRef.current = -1;
      setRun(createRiftRun(Date.now()));
    } finally {
      startingRef.current = false;
    }
  };

  const enterRoom = () => {
    if (!run) return;
    const room = run.rooms[run.index];
    if (!room) return;

    if (room.type === 'boon' || room.type === 'rest' || room.type === 'shop') {
      setChoices(rollBoons(run));
      setChoiceMode(room.type);
      return;
    }

    const state = save$.value;
    const offset = room.type === 'elite' ? 2 : room.type === 'boss' ? 3 : 0;
    const floorNumber = Math.min(100, Math.max(1, state.tower.maxFloor + offset));
    const floorDef = getFloor(floorNumber);
    const chapter = CHAPTERS_BY_INDEX[Math.ceil(floorNumber / 10)];
    if (!floorDef || !chapter) return;

    const boss = BOSSES_BY_ID[chapter.bossId];
    const enemies = room.type === 'boss' && boss ? bossUnits(boss, floorNumber) : buildWave(floorDef, 1);

    const battle = simulate({
      seed: hashString(`${run.startedAt}|${run.index}|${run.boons.join(',')}`),
      mode: 'rift',
      allies: buildSquad(state),
      enemies,
      masterCharges: 3,
      modifiers: riftModifiers(run.boons),
      maxTime: 45,
    });

    setResult({ win: battle.outcome === 'win', dealt: battle.damageDealt, taken: battle.damageTaken, stats: battle.stats });
    commit((draft) => {
      applyHeroDeaths(draft, fallenFromResult(battle));
    }, 'rift-fallen');
  };

  const completeRoom = (extra: string[] = []) => {
    if (!run) return;
    if (completedRoomRef.current === run.index) return;
    completedRoomRef.current = run.index;
    const nextIndex = run.index + 1;
    const boons = [...run.boons, ...extra];
    setChoices(null);
    setChoiceMode('boon');

    if (nextIndex >= run.rooms.length) {
      const reward = riftReward();
      const gear = riftGearDrop(run);
      commit((draft) => {
        draft.currencies.crystals += reward.crystals;
        draft.currencies.essence += reward.essence;
        const heroId = firstSquadHero(draft);
        if (heroId) {
          draft.currencies.starShards[heroId] = (draft.currencies.starShards[heroId] ?? 0) + reward.shards;
        }
        if (gear) draft.inventory.gear.push(gear.id);
        draft.rift.best = Math.max(draft.rift.best, 6);
        trackQuest(draft, 'riftWins', 1);
        addMasterXp(draft, 20);
      }, 'rift-finish');
      setRun(null);
      setFinishedGear(gear?.id ?? null);
      setFinished('win');
      playSfx('starUp');
      return;
    }

    setRun({
      ...run,
      index: nextIndex,
      boons,
      rooms: run.rooms.map((room, index) => (index === run.index ? { ...room, cleared: true } : room)),
    });
  };

  const closeResult = () => {
    if (!result) return;
    const win = result.win;
    setResult(null);
    if (!win) {
      setRun(null);
      setFinished('lose');
      playSfx('error');
      return;
    }
    completeRoom();
  };

  const pickBoon = (boon: RiftBoonDef) => {
    if (!run || completedRoomRef.current === run.index) return;
    if (choiceMode === 'shop') {
      if (save$.value.currencies.crystals < 100) {
        toast(t('shop.insufficient'), 'error');
        return;
      }
      commit((draft) => {
        draft.currencies.crystals -= 100;
      }, 'rift-shop');
    }
    completeRoom([boon.id]);
  };

  const runsLeft = Math.max(0, 2 - save.rift.runsToday);
  const startLabel = save.rift.runsToday >= 2 ? t('rift.limit') : save.rift.runsToday >= 1 ? t('rift.startAd') : t('rift.start');

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/rift-map.webp')})` }} />
      <div class={s.scrim} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('modes')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.heading}>
          <span class={s.title}>{t('rift.title')}</span>
          <span class={s.sub}>
            {t('rift.runs', { n: save.rift.runsToday })} · {t('rift.best', { n: save.rift.best })}
          </span>
        </div>
      </header>

      <div class={s.scroll}>
        {!run ? (
          <div class={s.panel}>
            <div class={s.panelHead}>
              <span>{t('rift.title')}</span>
              <span>{runsLeft}/2</span>
            </div>
            <p class={s.row}>{t('modes.rift.desc')}</p>
            <button class="btn btn--primary btn--wide" disabled={save.rift.runsToday >= 2} onClick={startRun}>
              {startLabel}
            </button>
          </div>
        ) : (
          <>
            <div class={s.panel}>
              <div class={s.panelHead}>
                <span>{t('rift.roomOf', { n: run.index + 1 })}</span>
                <span>{t('rift.boons')}: {run.boons.length}</span>
              </div>
              <div class={s.rooms}>
                {run.rooms.map((room, index) => (
                  <div
                    key={index}
                    class={`${s.room}${room.cleared ? ` ${s.roomCleared}` : index === run.index ? ` ${s.roomCurrent}` : ''}`}
                  >
                    <span>{index + 1}</span>
                    <span>{t(`rift.room.${room.type}`)}</span>
                  </div>
                ))}
              </div>
              <button class="btn btn--primary btn--wide" onClick={enterRoom}>
                {t('rift.enter')} · {t(`rift.room.${run.rooms[run.index]?.type ?? 'battle'}`)}
              </button>
            </div>

            {run.boons.length > 0 ? (
              <div class={s.panel}>
                <div class={s.panelHead}>
                  <span>{t('rift.boons')}</span>
                </div>
                <div class={s.chips}>
                  {run.boons.map((id) => {
                    const boon = RIFT_BOONS_BY_ID[id];
                    return (
                      <span key={id} class={s.chip}>
                        {boon ? (locale$.value === 'ru' ? boon.nameRu : boon.nameEn) : id}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {choices ? (
        <Modal
          title={choiceMode === 'shop' ? t('rift.room.shop') : choiceMode === 'rest' ? t('rift.room.rest') : t('rift.chooseBoon')}
          onClose={() => {
            setChoices(null);
            setChoiceMode('boon');
          }}
        >
          {choiceMode === 'rest' ? <p class={s.row}>{t('rift.restText')}</p> : null}
          {choiceMode === 'shop' ? <p class={s.row}>{t('rift.shopText')}</p> : null}
          <div class={s.panel}>
            {choices.map((boon) => (
              <div key={boon.id} class={s.row}>
                <span>
                  <b>{locale$.value === 'ru' ? boon.nameRu : boon.nameEn}</b>
                  <br />
                  <span class={s.sub}>{locale$.value === 'ru' ? boon.descRu : boon.descEn}</span>
                </span>
                <button class="btn btn--sm" onClick={() => pickBoon(boon)}>
                  {choiceMode === 'shop' ? `${t('rift.buy')} · 100` : t('common.continue')}
                </button>
              </div>
            ))}
          </div>
          {choiceMode === 'shop' ? (
            <button class="btn btn--ghost btn--wide" onClick={() => completeRoom()}>
              {t('rift.skip')}
            </button>
          ) : null}
        </Modal>
      ) : null}

      {result ? (
        <BattleResultModal
          win={result.win}
          damageDealt={result.dealt}
          damageTaken={result.taken}
          stats={result.stats}
          title={result.win ? t('common.win') : t('rift.defeat')}
          onClose={closeResult}
        />
      ) : null}

      {finished ? (
        <Modal title={finished === 'win' ? t('rift.victory') : t('rift.defeat')} onClose={() => setFinished(null)}>
          {finished === 'win' ? (
            <>
              <div class={s.row}>
                <span>{t('rift.reward')}</span>
                <b class={s.gold}>150 ◆ · 80 ✦ · 2 ★</b>
              </div>
              {finishedGear ? (
                <div class={s.row}>
                  <span>{t('battle.gearDrop')}</span>
                  <b>{locale$.value === 'ru' ? GEAR_BY_ID[finishedGear]?.nameRu : GEAR_BY_ID[finishedGear]?.nameEn}</b>
                </div>
              ) : null}
            </>
          ) : (
            <p class={s.row}>{t('modes.rift.desc')}</p>
          )}
          <button class="btn btn--primary btn--wide" onClick={() => setFinished(null)}>
            {t('common.continue')}
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
