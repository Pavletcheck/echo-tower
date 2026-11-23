import { useEffect, useState } from 'preact/hooks';
import { asset } from '../../core/asset';
import { playSfx } from '../../core/audio';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import {
  ENDGAME_SHOP_ITEMS,
  HARD_CHAPTERS,
  TOWER_ELEMENTS,
  WORLD_TIERS,
  CHALLENGE_DEFS,
  type ChallengeType,
} from '../../data/endgame';
import { elementName } from '../../data/heroes';
import type { Element } from '../../data/types';
import {
  buyEndgameItem,
  canBuyEndgame,
  challengeClaimed,
  challengeSquadValid,
  challengeUnlocked,
  claimWorldTier,
  endlessRunsLeft,
  endlessUnlocked,
  ensureEndgame,
  fightChallenge,
  fightEndless,
  fightHard,
  fightTower,
  fightWorld,
  hardCleared,
  hardUnlocked,
  recommendedTowerSquad,
  towerProgress,
  towerSquadCount,
  towerSquadValid,
  worldAttemptsLeft,
  worldLeaderboard,
  worldTierId,
} from '../../game/endgame';
import { commit, save$ } from '../../game/state';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import s from './Endgame.module.css';

export function Endgame() {
  const save = save$.value;
  const [challengeChapter, setChallengeChapter] = useState(() =>
    Math.min(10, Math.max(1, Math.ceil(save.tower.maxFloor / 10))),
  );

  useEffect(() => {
    commit((draft) => {
      ensureEndgame(draft);
    }, 'endgame-day');
  }, []);

  const worldLeft = worldAttemptsLeft(save);
  const marks = save.currencies.echoMarks;
  const tiers = WORLD_TIERS;
  const board = worldLeaderboard(save);
  const endlessLeft = endlessRunsLeft(save);

  const commitAction = (mutate: (draft: typeof save) => void, reason: string): void => {
    commit(mutate, reason);
  };

  const worldFight = () => {
    let report: ReturnType<typeof fightWorld> | undefined;
    commitAction((draft) => {
      report = fightWorld(draft, Date.now());
    }, 'endgame-world');
    if (!report) {
      toast(t('endgame.noAttempts'), 'error');
      return;
    }
    playSfx(report.result.outcome === 'win' ? 'coin' : 'hit');
    toast(
      t('endgame.worldResult', {
        damage: report.result.damageDealt,
        total: report.total,
      }),
      'success',
    );
  };

  const claimTier = (id: string) => {
    if (!worldTierId(id)) return;
    let reward: ReturnType<typeof claimWorldTier> | undefined;
    commitAction((draft) => {
      reward = claimWorldTier(draft, id);
    }, 'endgame-world-claim');
    if (reward) toast(t('endgame.tierClaimed', { marks: reward.marks, crystals: reward.crystals }), 'success');
  };

  const towerCompose = (element: Element) => {
    commitAction((draft) => {
      const ids = recommendedTowerSquad(draft, element);
      draft.squad = Array.from({ length: 5 }, (_, index) => ids[index] ?? '');
    }, 'endgame-tower-squad');
    toast(t('endgame.towerComposed'), 'success');
  };

  const towerFight = (element: Element) => {
    let report: ReturnType<typeof fightTower> | undefined;
    commitAction((draft) => {
      report = fightTower(draft, element, Date.now());
    }, 'endgame-tower');
    if (!report) {
      toast(t('endgame.towerInvalid'), 'error');
      return;
    }
    if (!report.reward) {
      toast(t('endgame.towerLost'), 'error');
      return;
    }
    playSfx('coin');
    toast(
      t('endgame.towerWon', {
        floor: report.progress,
        marks: report.reward.marks,
        crystals: report.reward.crystals,
      }),
      'success',
    );
  };

  const endlessFight = () => {
    let report: ReturnType<typeof fightEndless> | undefined;
    commitAction((draft) => {
      report = fightEndless(draft, Date.now());
    }, 'endgame-endless');
    if (!report) {
      toast(t('endgame.endlessLocked'), 'error');
      return;
    }
    if (!report.reward) {
      toast(t('endgame.endlessLost', { floor: report.floor }), 'error');
      return;
    }
    playSfx('coin');
    toast(t('endgame.endlessWon', { floor: report.floor, marks: report.reward.marks }), 'success');
  };

  const hardFight = (chapter: number) => {
    let report: ReturnType<typeof fightHard> | undefined;
    commitAction((draft) => {
      report = fightHard(draft, chapter, Date.now());
    }, 'endgame-hard');
    if (!report) {
      toast(t('endgame.hardLocked'), 'error');
      return;
    }
    if (!report.reward) {
      toast(t('endgame.hardLost'), 'error');
      return;
    }
    playSfx('coin');
    toast(t('endgame.hardWon', { chapter, marks: report.reward.marks }), 'success');
  };

  const challengeFight = (type: ChallengeType) => {
    let report: ReturnType<typeof fightChallenge> | undefined;
    commitAction((draft) => {
      report = fightChallenge(draft, challengeChapter, type, Date.now());
    }, 'endgame-challenge');
    if (!report) {
      toast(t('endgame.challengeInvalid'), 'error');
      return;
    }
    if (!report.reward) {
      toast(t('endgame.challengeLost'), 'error');
      return;
    }
    playSfx('coin');
    toast(t('endgame.challengeWon', { marks: report.reward.marks, shards: report.reward.shards }), 'success');
  };

  const buy = (id: string) => {
    let ok = false;
    commitAction((draft) => {
      ok = Boolean(buyEndgameItem(draft, id));
    }, 'endgame-shop');
    toast(ok ? t('endgame.shopBought') : t('shop.insufficient'), ok ? 'success' : 'error');
  };

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/rift-map.webp')})` }} />
      <div class={s.scrim} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('modes')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.heading}>
          <span class={s.title}>{t('endgame.title')}</span>
          <span class={s.sub}>{t('endgame.marks', { n: marks })}</span>
        </div>
      </header>

      <div class={s.scroll}>
        <section class={s.card}>
          <div class={s.cardHead}>
            <span class={s.cardTitle}>{t('endgame.world')}</span>
            <span class={s.badge}>{t('endgame.attempts', { n: worldLeft })}</span>
          </div>
          <p class={s.desc}>{t('endgame.world.desc')}</p>
          <div class={s.stats}>
            <span>{t('endgame.world.total', { n: save.endgame.world.total })}</span>
            <span>{t('endgame.world.best', { n: save.endgame.world.best })}</span>
          </div>
          <button class="btn btn--primary btn--wide" disabled={worldLeft <= 0} onClick={worldFight}>
            {t('endgame.fight')}
          </button>

          <div class={s.tiers}>
            {tiers.map((tier) => (
              <button
                key={tier.id}
                class={`${s.tier}${save.endgame.world.claimed.includes(tier.id) ? ` ${s.tierDone}` : ''}`}
                disabled={
                  save.endgame.world.claimed.includes(tier.id) || save.endgame.world.total < tier.threshold
                }
                onClick={() => claimTier(tier.id)}
              >
                {t('endgame.world.tier', { n: tier.threshold, marks: tier.marks })}
              </button>
            ))}
          </div>

          <div class={s.board}>
            {board.slice(0, 5).map((row, index) => (
              <div key={`${row.name}-${index}`} class={`${s.boardRow}${row.you ? ` ${s.boardYou}` : ''}`}>
                <span>{index + 1}</span>
                <span>{row.you ? t('endgame.world.you') : row.name}</span>
                <b>{row.damage}</b>
              </div>
            ))}
          </div>
        </section>

        <section class={s.card}>
          <div class={s.cardHead}>
            <span class={s.cardTitle}>{t('endgame.towers')}</span>
          </div>
          <p class={s.desc}>{t('endgame.towers.desc')}</p>
          <div class={s.rows}>
            {TOWER_ELEMENTS.map((element) => {
              const progress = towerProgress(save, element);
              const count = towerSquadCount(save, element);
              const valid = towerSquadValid(save, element);
              return (
                <div key={element} class={s.row}>
                  <div class={s.rowInfo}>
                    <b>{elementName(element, locale$.value)}</b>
                    <span>{t('endgame.towers.progress', { n: progress })}</span>
                    <span>{t('endgame.towers.match', { n: count, min: 3 })}</span>
                  </div>
                  <div class={s.rowActions}>
                    <button class="btn btn--sm btn--ghost" onClick={() => towerCompose(element)}>
                      {t('endgame.towers.compose')}
                    </button>
                    <button class="btn btn--sm" disabled={!valid || progress >= 30} onClick={() => towerFight(element)}>
                      {progress >= 30 ? t('endgame.done') : t('endgame.fight')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section class={s.card}>
          <div class={s.cardHead}>
            <span class={s.cardTitle}>{t('endgame.endless')}</span>
            <span class={s.badge}>{t('endgame.endless.runs', { n: endlessLeft })}</span>
          </div>
          <p class={s.desc}>{t('endgame.endless.desc', { n: save.endgame.endless.best })}</p>
          <button class="btn btn--primary btn--wide" disabled={!endlessUnlocked(save) || endlessLeft <= 0} onClick={endlessFight}>
            {endlessUnlocked(save) ? t('endgame.fight') : t('endgame.endless.locked')}
          </button>
        </section>

        <section class={s.card}>
          <div class={s.cardHead}>
            <span class={s.cardTitle}>{t('endgame.hard')}</span>
          </div>
          <p class={s.desc}>{t('endgame.hard.desc')}</p>
          <div class={s.rows}>
            {HARD_CHAPTERS.map((chapter) => {
              const unlocked = hardUnlocked(save, chapter.chapter);
              const cleared = hardCleared(save, chapter.chapter);
              return (
                <div key={chapter.chapter} class={s.row}>
                  <div class={s.rowInfo}>
                    <b>{t('endgame.hard.chapter', { n: chapter.chapter })}</b>
                    <span>
                      {t('endgame.hard.modifiers', {
                        hp: Math.round(chapter.hp * 100),
                        atk: Math.round(chapter.atk * 100),
                      })}
                    </span>
                  </div>
                  <button
                    class={`btn btn--sm ${cleared ? 'btn--ghost' : ''}`}
                    disabled={!unlocked || cleared}
                    onClick={() => hardFight(chapter.chapter)}
                  >
                    {cleared ? t('endgame.done') : unlocked ? t('endgame.fight') : t('endgame.locked')}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section class={s.card}>
          <div class={s.cardHead}>
            <span class={s.cardTitle}>{t('endgame.challenges')}</span>
            <span class={s.chapterNav}>
              <button class="btn btn--sm btn--ghost" onClick={() => setChallengeChapter(Math.max(1, challengeChapter - 1))}>
                −
              </button>
              <span>{challengeChapter}</span>
              <button class="btn btn--sm btn--ghost" onClick={() => setChallengeChapter(Math.min(10, challengeChapter + 1))}>
                +
              </button>
            </span>
          </div>
          <p class={s.desc}>{t('endgame.challenges.desc')}</p>
          <div class={s.rows}>
            {CHALLENGE_DEFS.map((challenge) => {
              const claimed = challengeClaimed(save, challengeChapter, challenge.type);
              const valid = challengeSquadValid(save, challenge.type);
              const unlocked = challengeUnlocked(save, challengeChapter);
              return (
                <div key={challenge.type} class={s.row}>
                  <div class={s.rowInfo}>
                    <b>{locale$.value === 'ru' ? challenge.nameRu : challenge.nameEn}</b>
                    <span>{locale$.value === 'ru' ? challenge.descRu : challenge.descEn}</span>
                  </div>
                  <button
                    class="btn btn--sm"
                    disabled={claimed || !unlocked || !valid}
                    onClick={() => challengeFight(challenge.type)}
                  >
                    {claimed ? t('endgame.done') : unlocked ? t('endgame.fight') : t('endgame.locked')}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section class={s.card}>
          <div class={s.cardHead}>
            <span class={s.cardTitle}>{t('endgame.shop')}</span>
            <span class={s.badge}>{marks}</span>
          </div>
          <div class={s.rows}>
            {ENDGAME_SHOP_ITEMS.map((item) => {
              const canBuy = canBuyEndgame(save, item.id);
              return (
                <div key={item.id} class={s.row}>
                  <div class={s.rowInfo}>
                    <b>{locale$.value === 'ru' ? item.nameRu : item.nameEn}</b>
                    <span>{t('endgame.shop.price', { n: item.price })}</span>
                  </div>
                  <button class="btn btn--sm btn--gold" disabled={!canBuy} onClick={() => buy(item.id)}>
                    {t('shop.buy')}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
