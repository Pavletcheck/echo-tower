import { useEffect, useRef, useState } from 'preact/hooks';
import { Rng } from '../../core/rng';
import { track } from '../../analytics/events';
import { asset } from '../../core/asset';
import { playSfx } from '../../core/audio';
import { haptic } from '../../core/haptics';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { formatDuration } from '../../core/time';
import { featuredHero, freePullAvailable, performPull, pullAvailability, pullCost, type BannerId, type PullResult } from '../../game/gacha';
import { HEROES, heroName } from '../../data/heroes';
import { PITY_RATE_4, PITY_RATE_5 } from '../../game/config';
import { completeFtue } from '../../game/ftue';
import { commit, save$ } from '../../game/state';
import { trackQuest } from '../../game/quests';
import { HeroAvatar } from '../components/HeroAvatar';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { toast } from '../components/toast';
import { summonBanner$ } from '../nav';
import s from './Summon.module.css';

const RARITY_COLOR: Record<number, string> = {
  5: '#e9c46a',
  4: '#9b7bff',
  3: '#6fb6ff',
};

const BANNERS: ReadonlyArray<{ id: BannerId; label: string }> = [
  { id: 'standard', label: 'summon.banner.standard' },
  { id: 'featured', label: 'summon.banner.featured' },
  { id: 'beginner', label: 'summon.banner.beginner' },
];

export function Summon() {
  const [banner, setBanner] = useState<BannerId>(() => summonBanner$.value ?? 'standard');
  const [results, setResults] = useState<PullResult[] | null>(null);
  const [ratesOpen, setRatesOpen] = useState(false);
  const pullingRef = useRef(false);
  const save = save$.value;
  const featured = featuredHero();
  const free = freePullAvailable(save);
  const beginnerUsed = save.gacha.beginnerUsed;
  const beginnerReady = pullAvailability(save, 'beginner', 10).ok;
  const pity = Math.min(70, save.gacha.pity5);
  const currentRate5 = Math.min(1, PITY_RATE_5 + Math.max(0, save.gacha.pity5 - (45 - 1)) * 0.035);
  const freeIn = Math.max(0, 24 * 60 * 60 * 1000 - (Date.now() - save.gacha.freeAt));

  useEffect(() => {
    summonBanner$.value = null;
  }, []);

  const doPull = (count: 1 | 10, options: { free?: boolean; useSeal?: boolean } = {}) => {
    if (pullingRef.current) return;
    pullingRef.current = true;
    window.setTimeout(() => {
      pullingRef.current = false;
    }, 500);

    const state = save$.value;
    const availability = pullAvailability(state, banner, count, options);
    if (!availability.ok) {
      const message =
        availability.reason === 'seals'
          ? t('summon.noSeals')
          : availability.reason === 'beginner-used'
            ? t('summon.beginnerUsed')
            : availability.reason === 'free-unavailable'
              ? t('summon.freeWait', { time: formatDuration(freeIn, locale$.value) })
              : t('summon.noCurrency');
      toast(message, 'error');
      return;
    }

    let outcome: PullResult[] = [];
    let tutorialDone = false;
    const rng = new Rng((Date.now() ^ ((state.gacha.totalPulls + 1) * 2654435761)) >>> 0);

    commit((draft) => {
      outcome = performPull(draft, banner, count, rng, options);
      if (outcome.length > 0) {
        trackQuest(draft, 'summons', outcome.length);
        trackQuest(draft, 'heroes', outcome.filter((result) => result.isNew).length);
        trackQuest(draft, 'collection', outcome.filter((result) => result.rarity === 5).length);
        if (banner === 'beginner' && draft.ftue.step === 4) tutorialDone = completeFtue(draft);
      }
    }, 'summon');

    if (outcome.length > 0) {
      setResults(outcome);
      playSfx('summon');
      haptic('medium');
      if (outcome.some((result) => result.rarity === 5)) {
        window.setTimeout(() => playSfx('starUp'), 520);
        haptic('heavy');
      }
      if (tutorialDone) {
        track('ftue_complete', { step: 'summon' });
        toast(t('tutorial.complete'), 'success');
      }
    }
  };

  const cost1 = pullCost(banner, 1, false, save);
  const cost10 = pullCost(banner, 10, false, save);

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/altar.webp')})` }} />
      <div class={s.scrim} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('lobby')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.heading}>
          <span class={s.title}>{t('summon.title')}</span>
          <span class={s.sub}>
            {save.currencies.crystals} · {save.currencies.seals}
          </span>
        </div>
        <button class={s.iconBtn} onClick={() => setRatesOpen(true)} aria-label={t('summon.rates')}>
          <Icon name="star" size={16} />
        </button>
      </header>

      <div class={s.tabs}>
        {BANNERS.map((item) => (
          <button
            key={item.id}
            class={`${s.tab}${banner === item.id ? ` ${s.tabActive}` : ''}`}
            onClick={() => setBanner(item.id)}
          >
            {t(item.label)}
            {item.id === 'beginner' && beginnerUsed ? <span class={s.tabDot}>·</span> : null}
          </button>
        ))}
      </div>

      <div class={s.banner}>
        {banner === 'featured' ? (
          <>
            <div class={s.featuredTag}>{t('summon.featured')}</div>
            <HeroAvatar heroId={featured.id} size={108} star={5} />
            <div class={s.bannerName}>{locale$.value === 'ru' ? featured.nameRu : featured.nameEn}</div>
            {save.gacha.featuredGuaranteed ? <div class={s.guarantee}>{t('summon.guaranteeSoon')}</div> : null}
          </>
        ) : banner === 'beginner' ? (
          <>
            <div class={s.bannerName}>{t('summon.banner.beginner')}</div>
            <p class={s.bannerText}>
              {beginnerUsed ? t('summon.beginnerUsed') : t('summon.beginnerText')}
            </p>
            <div class={s.guarantee}>{t('summon.freeTenHint')}</div>
            <div class={s.guarantee}>{t('summon.oncePerSave')}</div>
          </>
        ) : (
          <>
            <div class={s.bannerName}>{t('summon.banner.standard')}</div>
            <p class={s.bannerText}>{t('summon.pitySoft')}</p>
          </>
        )}
      </div>

      <div class={s.pity}>
        <div class={s.pityHead}>
          <span>{t('summon.pity', { n: 70 - pity })}</span>
          <span>{pity} / 70</span>
        </div>
        <div class={s.pityBar}>
          <div class={s.pityFill} style={{ width: `${Math.round((pity / 70) * 100)}%` }} />
        </div>
      </div>

      <div class={s.ratesRow}>
        <span>
          5★ {(PITY_RATE_5 * 100).toFixed(1)}% · 4★ {(PITY_RATE_4 * 100).toFixed(0)}%
        </span>
        <span>{t('summon.currentRate', { rate: (currentRate5 * 100).toFixed(1) })}</span>
      </div>

      <div class={s.poolRow}>
        <span class={s.poolLabel}>{t('summon.pool')}</span>
        {HEROES.filter((hero) => hero.rarity === 5 && hero.id !== 'nira').map((hero) => (
          <span key={hero.id} class={s.poolHero} title={heroName(hero.id, locale$.value)}>
            <HeroAvatar heroId={hero.id} size={38} star={5} />
          </span>
        ))}
      </div>

      <div class={s.actions}>
        {banner === 'beginner' ? (
          <button
            class="btn btn--primary btn--lg btn--wide"
            data-ftue="summon"
            disabled={!beginnerReady}
            onClick={() => doPull(10)}
          >
            {beginnerUsed ? t('summon.beginnerUsed') : t('summon.freeTen')}
          </button>
        ) : (
          <>
            <div class={s.pullRow}>
              <button class="btn btn--primary" onClick={() => doPull(1)}>
                {t('summon.pull1')} · {cost1.amount}
              </button>
              <button class="btn btn--primary" onClick={() => doPull(10)}>
                {t('summon.pull10')} · {cost10.amount}
              </button>
            </div>
            <div class={s.pullRow}>
              <button class="btn btn--ghost" disabled={!free} onClick={() => doPull(1, { free: true })}>
                {free ? t('summon.free') : t('summon.freeWait', { time: formatDuration(freeIn, locale$.value) })}
              </button>
              <button class="btn btn--ghost" disabled={save.currencies.seals < 1} onClick={() => doPull(1, { useSeal: true })}>
                {t('summon.seal')} · {save.currencies.seals}
              </button>
            </div>
          </>
        )}
      </div>

      {results ? (
        <div class={s.overlay}>
          <div class={s.resultPanel}>
            <div class={s.resultTitle}>{t('summon.result')}</div>
            <div class={s.resultGrid}>
              {results.map((result, index) => (
                <div
                  key={`${result.hero.id}-${index}`}
                  class={s.resultCard}
                  data-rarity={result.rarity}
                  style={{ borderColor: RARITY_COLOR[result.rarity], animationDelay: `${index * 55}ms` }}
                >
                  <HeroAvatar heroId={result.hero.id} size={48} star={result.rarity} />
                  <span class={s.resultName}>{locale$.value === 'ru' ? result.hero.nameRu : result.hero.nameEn}</span>
                  <span class={result.isNew ? s.newTag : s.shardTag}>
                    {result.isNew ? t('summon.new') : t('summon.shards', { n: result.shards })}
                  </span>
                </div>
              ))}
            </div>
            <button class="btn btn--primary btn--wide" onClick={() => setResults(null)}>
              {t('common.close')}
            </button>
          </div>
        </div>
      ) : null}

      {ratesOpen ? (
        <Modal title={t('summon.rates.title')} onClose={() => setRatesOpen(false)}>
          <p>{t('summon.rates.body')}</p>
          <button class="btn btn--wide" onClick={() => setRatesOpen(false)}>
            {t('common.close')}
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
