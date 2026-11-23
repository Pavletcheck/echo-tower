import { useEffect, useRef, useState } from 'preact/hooks';
import { asset } from '../../core/asset';
import { playSfx } from '../../core/audio';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { BOSSES_BY_ID } from '../../data/enemies';
import { CHAPTERS, getFloor } from '../../data/floors';
import { elementName } from '../../data/heroes';
import type { FloorDef } from '../../data/types';
import { buildWave } from '../../game/battle/factory';
import { unitCombatStats } from '../../game/battle/stats';
import { floorCounterPreview } from '../../game/elements';
import { formatNumber } from '../../core/time';
import { teamPower } from '../../game/state';
import { sweepFloor } from '../../game/farming';
import { squadElements } from '../../game/squad-element';
import { squadSize } from '../../game/squad';
import { commit, save$ } from '../../game/state';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { toast } from '../components/toast';
import { battleFloor$ } from '../nav';
import s from './Tower.module.css';

function recommendedPower(floor: FloorDef): number {
  const wave = buildWave(floor, Math.max(0, floor.waves.length - 1));
  const score = wave.reduce((sum, unit) => {
    const stats = unitCombatStats(unit);
    return sum + stats.hp * 0.12 + stats.atk * 1.4 + stats.def * 0.8;
  }, 0);
  return Math.round(score * 9);
}

export function Tower() {
  const save = save$.value;
  const maxFloor = Math.min(100, Math.max(1, save.tower.maxFloor));
  const cleared = Math.max(0, maxFloor - 1);
  const [preview, setPreview] = useState<FloorDef | null>(null);
  const [mode, setMode] = useState<'fight' | 'sweep' | 'info'>('fight');
  const currentRef = useRef<HTMLButtonElement>(null);
  const ownElements = squadElements(save);
  const counter = preview ? floorCounterPreview(preview, ownElements) : null;
  const elementList = (elements: readonly string[]): string =>
    elements.length > 0 ? elements.join(', ') : t('common.none');

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  const openFloor = (floorNumber: number) => {
    if (floorNumber > maxFloor) {
      toast(t('tower.locked'), 'error');
      return;
    }
    if (mode === 'fight') {
      fight(floorNumber);
      return;
    }
    if (mode === 'sweep') {
      sweep(floorNumber);
      return;
    }
    const floor = getFloor(floorNumber);
    if (floor) setPreview(floor);
  };

  const fight = (floor: number) => {
    if (squadSize(save) === 0) {
      toast(t('squad.emptyWarning'), 'error');
      navigate('squad');
      return;
    }
    battleFloor$.value = floor;
    navigate('battle');
  };

  const sweep = (floorNumber: number) => {
    let result = null as ReturnType<typeof sweepFloor>;
    commit((draft) => {
      result = sweepFloor(draft, floorNumber);
    }, 'sweep');
    if (result) {
      playSfx('coin');
      toast(t('tower.sweepDone', { gold: result.gold }), 'success');
      setPreview(null);
    } else {
      toast(t('tower.sweepUnavailable'), 'error');
    }
  };

  const chapterName = (ru: string, en: string) => (locale$.value === 'ru' ? ru : en);

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/lobby-tower.webp')})` }} />
      <div class={s.scrim} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('lobby')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.heading}>
          <span class={s.title}>{t('tower.title')}</span>
          <span class={s.sub}>{t('tower.cleared', { n: cleared })}</span>
        </div>
      </header>

      <div class={s.modeRow}>
        {(['fight', 'sweep', 'info'] as const).map((item) => (
          <button
            key={item}
            class={`${s.modeChip}${mode === item ? ` ${s.modeChipActive}` : ''}`}
            onClick={() => setMode(item)}
          >
            {t(`tower.mode.${item}`)}
          </button>
        ))}
      </div>
      <p class={s.modeHint}>{t(`tower.hint.${mode}`)}</p>

      <div class={s.scroll}>
        {CHAPTERS.map((chapter) => {
          const boss = BOSSES_BY_ID[chapter.bossId];
          const active = Math.ceil(maxFloor / 10) === chapter.index;
          const chapterStart = chapter.index * 10 - 9;
          const clearedInChapter = Math.max(0, Math.min(10, maxFloor - chapterStart));
          const bossFloor = getFloor(chapter.index * 10);
          return (
            <section key={chapter.index} class={`${s.chapter}${active ? ` ${s.chapterActive}` : ''}`}>
              <div class={s.chapterHead}>
                <span class={s.chapterIndex}>{String(chapter.index).padStart(2, '0')}</span>
                <div class={s.chapterMeta}>
                  <span class={s.chapterName}>{chapterName(chapter.nameRu, chapter.nameEn)}</span>
                  <span class={s.chapterSub}>
                    {t('tower.chapter', { n: chapter.index })} · {chapter.biome} · {clearedInChapter}/10
                  </span>
                </div>
                <span class={s.chapterBoss}>{boss ? chapterName(boss.nameRu, boss.nameEn) : ''}</span>
              </div>

              <div class={s.chapterBar}>
                <div class={s.chapterFill} style={{ width: `${clearedInChapter * 10}%` }} />
              </div>

              <div class={s.nodes}>
                {Array.from({ length: 10 }, (_, offset) => {
                  const floorNumber = chapter.index * 10 - 9 + offset;
                  const isBoss = offset === 4 || offset === 9;
                  const alreadyCleared = Boolean(save.tower.clears[String(floorNumber)]);
                  const isCleared = alreadyCleared || floorNumber < maxFloor;
                  const isCurrent = !alreadyCleared && floorNumber === maxFloor;
                  const stateClass = isCurrent ? s.nodeCurrent : isCleared ? s.nodeCleared : s.nodeLocked;
                  const stars = save.tower.clears[String(floorNumber)]?.stars ?? 0;

                  return (
                    <button
                      key={floorNumber}
                      ref={isCurrent ? currentRef : undefined}
                      class={`${s.node} ${stateClass}${isBoss ? ` ${s.nodeBoss}` : ''}`}
                      onClick={() => openFloor(floorNumber)}
                      title={
                        isBoss
                          ? `${t('tower.boss')}: ${boss ? chapterName(boss.nameRu, boss.nameEn) : ''}`
                          : `${t('tower.rewards')}: +${getFloor(floorNumber)?.reward.gold ?? 0}`
                      }
                    >
                      {floorNumber}
                      {isBoss ? <span class={s.nodeMark}>◆</span> : null}
                      {alreadyCleared && stars >= 3 ? <span class={s.nodeStars}>★</span> : null}
                    </button>
                  );
                })}
              </div>

              {bossFloor ? (
                <div class={s.chapterReward}>
                  {t('tower.firstClear')}: +{bossFloor.firstClear.crystals} ◆ · {t('tower.boss')} {chapterName(boss?.nameRu ?? '', boss?.nameEn ?? '')}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <footer class={s.bottom}>
        <button class="btn btn--primary btn--lg btn--wide" onClick={() => fight(maxFloor)}>
          {t('tower.fight')} · {t('lobby.floor', { n: maxFloor })}
        </button>
      </footer>

      {preview ? (
        <Modal title={t('lobby.floor', { n: preview.floor })} onClose={() => setPreview(null)}>
          <div class={s.previewRow}>
            <span>{t('tower.rewards')}</span>
            <b class={s.gold}>+{preview.reward.gold}</b>
          </div>
          {!save.tower.clears[String(preview.floor)] ? (
            <div class={s.previewRow}>
              <span>{t('tower.firstClear')}</span>
              <b class={s.gold}>+{preview.firstClear.crystals} ◆</b>
            </div>
          ) : (
            <div class={s.previewNote}>{t('tower.repeatNote')}</div>
          )}
          {counter ? (
            <div class={s.counter}>
              {t('counter.line', {
                element: counter.dominant ? elementName(counter.dominant, locale$.value) : t('common.none'),
                strong: elementList(counter.strong.map((element) => elementName(element, locale$.value))),
                weak: elementList(counter.weak.map((element) => elementName(element, locale$.value))),
              })}
            </div>
          ) : null}
          <div class={s.previewRow}>
            <span>{t('tower.recommend')}</span>
            <b>{formatNumber(recommendedPower(preview), locale$.value)}</b>
          </div>
          {teamPower() < recommendedPower(preview) * 0.85 ? (
            <div class={s.previewNote}>{t('tower.recommendLow')}</div>
          ) : null}
          {preview.bossId ? (
            <div class={s.previewNote}>
              {t('tower.boss')}: {bossName(preview.bossId)}
            </div>
          ) : null}
          <button
            class="btn btn--primary btn--wide"
            onClick={() => {
              const floor = preview.floor;
              setPreview(null);
              fight(floor);
            }}
          >
            {save.tower.clears[String(preview.floor)] ? t('tower.repeat') : t('tower.fight')}
          </button>
          {save.tower.clears[String(preview.floor)] ? (
            <button class="btn btn--gold btn--wide" onClick={() => sweep(preview.floor)}>
              {t('tower.sweep')}
            </button>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}

function bossName(id: string): string {
  const boss = BOSSES_BY_ID[id];
  if (!boss) return id;
  return locale$.value === 'ru' ? boss.nameRu : boss.nameEn;
}
