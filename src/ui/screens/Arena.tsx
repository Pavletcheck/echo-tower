import { useEffect, useRef, useState } from 'preact/hooks';
import { asset } from '../../core/asset';
import { playSfx } from '../../core/audio';
import { locale$, t } from '../../core/i18n';
import { hashString } from '../../core/rng';
import { navigate } from '../../core/router';
import { formatDuration, formatNumber } from '../../core/time';
import {
  arenaOpponents,
  attacksLeft,
  canRevenge,
  ensureArenaSeason,
  ensureGhosts,
  fightArena,
  fightRevenge,
  leagueName,
  leagueOf,
  seasonEndsAt,
  weekKey,
  type ArenaFightOutcome,
  type ArenaLeaderboardRow,
  type ArenaOpponent,
  type ArenaSeasonReset,
} from '../../game/arena';
import { GEAR_BY_ID } from '../../data/gear';
import { HEROES_BY_ID, elementName } from '../../data/heroes';
import type { Element } from '../../data/types';
import type { ArenaHistoryEntrySave } from '../../game/save';
import type { UnitBattleStats } from '../../game/battle/types';
import { counterPreview } from '../../game/elements';
import { ensureSocial } from '../../game/social';
import { squadElements } from '../../game/squad-element';
import { commit, save$ } from '../../game/state';
import { trackQuest } from '../../game/quests';
import { socialAPI } from '../../social';
import { BattleResultModal } from '../components/BattleResultModal';
import { HeroAvatar } from '../components/HeroAvatar';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import s from './Mode.module.css';

interface ArenaResult {
  win: boolean;
  dealt: number;
  taken: number;
  stats: UnitBattleStats[];
  tokens: number;
  rating: number;
  delta: number;
  name: string;
  revenge: boolean;
  gear?: string;
}

export function Arena() {
  const [result, setResult] = useState<ArenaResult | null>(null);
  const [board, setBoard] = useState<ArenaLeaderboardRow[]>([]);
  const [history, setHistory] = useState<ArenaHistoryEntrySave[]>([]);
  const fightingRef = useRef(false);
  const save = save$.value;
  const opponents = arenaOpponents(save);
  const left = attacksLeft(save);
  const league = leagueOf(save.arena.rating);
  const ownElements = squadElements(save);
  const seasonEnd = Math.max(0, seasonEndsAt() - Date.now());

  useEffect(() => {
    let seasonReset: ArenaSeasonReset | null = null;
    commit((draft) => {
      seasonReset = ensureArenaSeason(draft);
      ensureGhosts(draft);
      ensureSocial(draft);
    }, 'arena-day');
    if (seasonReset) {
      toast(
        t('arena.newSeason', {
          league: leagueName((seasonReset as ArenaSeasonReset).league, locale$.value),
        }),
        'success',
      );
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void socialAPI()
      .leaderboard(save)
      .then((rows) => {
        if (alive) setBoard(rows);
      });
    void socialAPI()
      .history(save)
      .then((view) => {
        if (alive) setHistory(view.entries);
      });
    return () => {
      alive = false;
    };
  }, [save]);

  const counterLine = (opponent: ArenaOpponent): string => {
    const defenderElements = opponent.heroes
      .map((entry) => HEROES_BY_ID[entry.heroId]?.element)
      .filter((element): element is Element => Boolean(element));
    const preview = counterPreview(ownElements, defenderElements);
    const list = (elements: string[]): string =>
      elements.length > 0 ? elements.join(', ') : t('common.none');
    return t('counter.line', {
      element: preview.dominant ? elementName(preview.dominant, locale$.value) : t('common.none'),
      strong: list(preview.strong.map((element) => elementName(element, locale$.value))),
      weak: list(preview.weak.map((element) => elementName(element, locale$.value))),
    });
  };

  const applyOutcome = (outcome: ArenaFightOutcome, revenge: boolean) => {
    setResult({
      win: outcome.win,
      dealt: outcome.result.damageDealt,
      taken: outcome.result.damageTaken,
      stats: outcome.result.stats,
      tokens: outcome.tokens,
      rating: outcome.ratingAfter,
      delta: outcome.ratingAfter - outcome.ratingBefore,
      name: outcome.opponent.name,
      revenge,
      ...(outcome.gearId ? { gear: outcome.gearId } : {}),
    });
    playSfx(outcome.win ? 'coin' : 'error');
  };

  const guard = (): boolean => {
    if (fightingRef.current) return false;
    fightingRef.current = true;
    window.setTimeout(() => {
      fightingRef.current = false;
    }, 700);
    return true;
  };

  const fight = (opponent: ArenaOpponent) => {
    if (!guard()) return;
    const state = save$.value;
    if (attacksLeft(state) <= 0) {
      toast(t('arena.noAttacks'), 'error');
      return;
    }

    let outcome: ArenaFightOutcome | null = null;
    commit((draft) => {
      outcome = fightArena(
        draft,
        opponent,
        hashString(`${draft.arena.season}|${draft.arena.attacksToday}|${opponent.id}|${draft.arena.rating}`),
      );
      if (outcome) {
        trackQuest(draft, 'arena', 1);
        if (outcome.win) trackQuest(draft, 'arenaWins', 1);
      }
    }, 'arena-result');

    if (!outcome) {
      toast(t('arena.noAttacks'), 'error');
      return;
    }
    applyOutcome(outcome, false);
  };

  const revenge = (entry: ArenaHistoryEntrySave) => {
    if (!guard()) return;
    const state = save$.value;
    if (attacksLeft(state) <= 0) {
      toast(t('arena.noAttacks'), 'error');
      return;
    }

    let outcome: ArenaFightOutcome | null = null;
    commit((draft) => {
      outcome = fightRevenge(
        draft,
        entry.id,
        hashString(`revenge|${entry.ghostId}|${draft.arena.attacksToday}|${draft.arena.rating}`),
      );
      if (outcome) {
        trackQuest(draft, 'arena', 1);
        if (outcome.win) trackQuest(draft, 'arenaWins', 1);
      }
    }, 'arena-revenge');

    if (!outcome) {
      toast(t('arena.noGhost'), 'error');
      return;
    }
    applyOutcome(outcome, true);
  };

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/arena.webp')})` }} />
      <div class={s.scrim} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('modes')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.heading}>
          <span class={s.title}>{t('arena.title')}</span>
          <span class={s.sub}>
            {t('arena.season', { season: save.arena.season || weekKey(new Date()) })} ·{' '}
            {t('arena.league')} {leagueName(league, locale$.value)} · {t('arena.attacks', { n: left })}
          </span>
          <span class={s.sub}>
            {t('arena.seasonEnds', { time: formatDuration(seasonEnd, locale$.value) })} ·{' '}
            {t('arena.record', { wins: save.arena.wins, losses: save.arena.losses })}
          </span>
        </div>
      </header>

      <div class={s.scroll}>
        <div class={s.sectionRow}>
          <span class={s.sectionTitle}>{t('arena.leaderboard')}</span>
          <span class={s.sectionHint}>{t('arena.leaderboardHint')}</span>
        </div>
        <div class={s.board}>
          {board.map((row) => (
            <div
              key={row.id}
              class={`${s.boardRow}${row.you ? ` ${s.boardYou}` : ''}`}
            >
              <span class={s.rank}>{row.rank}</span>
              <span class={s.boardName}>{row.you ? t('arena.you') : row.name}</span>
              <span class={s.gold}>{formatNumber(row.score, locale$.value)}</span>
            </div>
          ))}
        </div>

        <div class={s.sectionRow}>
          <span class={s.sectionTitle}>{t('arena.history')}</span>
          <span class={s.sectionHint}>{t('arena.seasonReward')}</span>
        </div>
        {history.length === 0 ? (
          <div class={s.empty}>{t('arena.historyEmpty')}</div>
        ) : (
          <div class={s.history}>
            {history.slice(0, 10).map((entry) => {
              const delta = entry.ratingAfter - entry.ratingBefore;
              return (
                <div key={entry.id} class={s.historyRow}>
                  <span class={`${s.tag}${entry.win ? ` ${s.tagWin}` : ` ${s.tagLoss}`}`}>
                    {entry.win ? t('arena.historyWin') : t('arena.historyLoss')}
                  </span>
                  <div class={s.historyInfo}>
                    <b>{entry.opponentName}</b>
                    <span>
                      {t('arena.points', { n: `${delta > 0 ? '+' : ''}${delta}` })} ·{' '}
                      {t('arena.rating')} {entry.ratingAfter}
                    </span>
                  </div>
                  {canRevenge(save, entry) ? (
                    <button class="btn btn--sm btn--ghost" onClick={() => revenge(entry)}>
                      {t('arena.revenge')}
                    </button>
                  ) : entry.revenged ? (
                    <span class={s.muted}>{t('arena.revenged')}</span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <div class={s.sectionRow}>
          <span class={s.sectionTitle}>{t('arena.ghost')}</span>
          <span class={s.sectionHint}>{t('arena.ghostHint')}</span>
        </div>

        {opponents.map((opponent) => (
          <div key={opponent.id} class={s.opponent}>
            <div class={s.opponentHead}>
              <span class={s.opponentName}>{opponent.name}</span>
              <span class={s.chip}>{t('arena.ghost')}</span>
              <span class={s.gold}>{t('arena.power', { n: opponent.power })}</span>
            </div>
            <div class={s.avatars}>
              {opponent.heroes.map((entry) => (
                <HeroAvatar key={entry.heroId} heroId={entry.heroId} size={34} star={entry.star} />
              ))}
            </div>
            <div class={s.counter}>{counterLine(opponent)}</div>
            <div class={s.actions}>
              <button class="btn btn--sm btn--ghost" onClick={() => navigate('squad')}>
                {t('squad.title')}
              </button>
              <button class="btn btn--sm btn--primary" disabled={left <= 0} onClick={() => fight(opponent)}>
                {t('arena.fight')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {result ? (
        <BattleResultModal
          win={result.win}
          damageDealt={result.dealt}
          damageTaken={result.taken}
          stats={result.stats}
          title={
            result.revenge
              ? t('arena.revenge')
              : result.win
                ? t('arena.resultWin')
                : t('arena.resultLose')
          }
          extra={[
            t('arena.tokens', { n: result.tokens }),
            t('arena.ratingDelta', { n: result.rating }),
            t('arena.points', { n: `${result.delta > 0 ? '+' : ''}${result.delta}` }),
            result.gear
              ? `${t('battle.gearDrop')}: ${
                  locale$.value === 'ru' ? GEAR_BY_ID[result.gear]?.nameRu : GEAR_BY_ID[result.gear]?.nameEn
                }`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          onClose={() => setResult(null)}
        />
      ) : null}
    </div>
  );
}
