import { useEffect, useRef, useState } from 'preact/hooks';
import { asset } from '../../core/asset';
import { playSfx } from '../../core/audio';
import { locale$, t } from '../../core/i18n';
import { hashString } from '../../core/rng';
import { navigate } from '../../core/router';
import { GEAR_BY_ID } from '../../data/gear';
import { HEROES_BY_ID } from '../../data/heroes';
import type { HeroDef } from '../../data/types';
import { simulate } from '../../game/battle/sim';
import type { UnitBattleStats } from '../../game/battle/types';
import { levelCap } from '../../game/config';
import { buildHeroUnit } from '../../game/squad';
import { applyHeroDeaths, fallenFromResult } from '../../game/hero-loss';
import { commit, save$ } from '../../game/state';
import {
  applyTrialWin,
  attemptsLeft,
  canTrial,
  ensureTrialDay,
  grantTrialGear,
  spendTrialAttempt,
  trialEligible,
  trialEnemy,
} from '../../game/trials';
import { BattleResultModal } from '../components/BattleResultModal';
import { HeroAvatar } from '../components/HeroAvatar';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import s from './Mode.module.css';

interface TrialResult {
  win: boolean;
  dealt: number;
  taken: number;
  stats: UnitBattleStats[];
  starUp: boolean;
  name: string;
  gear?: string;
}

export function Trials() {
  const [result, setResult] = useState<TrialResult | null>(null);
  const fightingRef = useRef(false);
  const save = save$.value;

  useEffect(() => {
    commit((draft) => {
      ensureTrialDay(draft);
    }, 'trial-day');
  }, []);

  const heroes = Object.keys(save.heroes)
    .map((id) => save.heroes[id])
    .filter((hero): hero is NonNullable<typeof hero> => Boolean(hero))
    .sort((a, b) => {
      const eligibleDiff = Number(trialEligible(save, b.id)) - Number(trialEligible(save, a.id));
      if (eligibleDiff !== 0) return eligibleDiff;
      return b.level - a.level;
    });

  const fight = (hero: HeroDef) => {
    if (fightingRef.current) return;
    fightingRef.current = true;
    window.setTimeout(() => {
      fightingRef.current = false;
    }, 700);

    const owned = save$.value.heroes[hero.id];
    if (!owned) return;
    if (!canTrial(save$.value, hero.id)) {
      toast(t('trials.noAttempts'), 'error');
      return;
    }

    const ally = buildHeroUnit(save$.value, hero.id, 0);
    if (!ally) return;
    const enemy = trialEnemy(hero, owned.star, owned.level);
    const battle = simulate({
      seed: hashString(`${hero.id}|${owned.star}|${owned.level}|${save$.value.trials.used[hero.id] ?? 0}|${Date.now()}`),
      mode: 'trial',
      allies: [ally],
      enemies: [enemy],
      masterCharges: 0,
      maxTime: 30,
    });

    let starUp = false;
    let gearId: string | null = null;
    commit((draft) => {
      spendTrialAttempt(draft, hero.id);
      applyHeroDeaths(draft, fallenFromResult(battle));
      if (battle.outcome === 'win') {
        starUp = applyTrialWin(draft, hero.id);
        if (starUp) gearId = grantTrialGear(draft, hero.id);
      }
    }, 'trial-result');

    setResult({
      win: battle.outcome === 'win',
      dealt: battle.damageDealt,
      taken: battle.damageTaken,
      stats: battle.stats,
      starUp,
      name: locale$.value === 'ru' ? hero.nameRu : hero.nameEn,
      ...(gearId ? { gear: gearId } : {}),
    });
    if (starUp) playSfx('starUp');
    else playSfx(battle.outcome === 'win' ? 'coin' : 'error');
  };

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/barracks.webp')})` }} />
      <div class={s.scrim} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('modes')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.heading}>
          <span class={s.title}>{t('trials.title')}</span>
          <span class={s.sub}>{t('modes.trials.desc')}</span>
        </div>
      </header>

      <div class={s.scroll}>
        {heroes.map((owned) => {
          const hero = HEROES_BY_ID[owned.id];
          if (!hero) return null;
          const eligible = trialEligible(save, owned.id);
          const attempts = attemptsLeft(save, owned.id);
          const maxStar = owned.star >= 6;
          const levelMax = owned.level >= levelCap(owned.star);

          return (
            <div key={owned.id} class={`${s.trialRow}${eligible ? '' : ` ${s.locked}`}`}>
              <HeroAvatar heroId={owned.id} size={40} star={owned.star} />
              <div class={s.trialInfo}>
                <span class={s.trialName}>{locale$.value === 'ru' ? hero.nameRu : hero.nameEn}</span>
                <span class={s.trialMeta}>
                  {t('hero.level')} {owned.level} / {levelCap(owned.star)} · {'★'.repeat(owned.star)}
                </span>
                <span class={s.trialMeta}>
                  {maxStar ? t('trials.max') : levelMax ? t('trials.eligible') : t('trials.notReady')} ·{' '}
                  {t('trials.attempts', { n: attempts })}
                </span>
              </div>
              <button
                class="btn btn--sm btn--primary"
                disabled={!eligible || attempts <= 0}
                onClick={() => fight(hero)}
              >
                {t('trials.fight')}
              </button>
            </div>
          );
        })}
      </div>

      {result ? (
        <BattleResultModal
          win={result.win}
          damageDealt={result.dealt}
          damageTaken={result.taken}
          stats={result.stats}
          title={result.win ? t('common.win') : t('trials.fail')}
          extra={
            result.win && result.starUp
              ? [
                  `${result.name}: ${t('trials.success')}`,
                  result.gear
                    ? `${t('battle.gearDrop')}: ${
                        locale$.value === 'ru' ? GEAR_BY_ID[result.gear]?.nameRu : GEAR_BY_ID[result.gear]?.nameEn
                      }`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : undefined
          }
          onClose={() => setResult(null)}
        />
      ) : null}
    </div>
  );
}
