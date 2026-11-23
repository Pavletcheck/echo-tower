import { useState } from 'preact/hooks';
import { asset } from '../../core/asset';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { HEROES, HEROES_BY_ID, roleName, elementName, ELEMENT_COLOR } from '../../data/heroes';
import type { Element, HeroDef } from '../../data/types';
import { canReassemble, reassembleCost, reassembleHero } from '../../game/hero-loss';
import { effectiveLevel, resonanceLevel, resonanceSlots, setResonanceSlot, clearResonanceSlot } from '../../game/resonance';
import { commit, save$ } from '../../game/state';
import { HeroAvatar } from '../components/HeroAvatar';
import { HeroArt } from '../components/HeroArt';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { toast } from '../components/toast';
import { openHero } from '../nav';
import s from './Heroes.module.css';

type Filter = 'all' | 5 | 4 | 3;
type ElementFilter = 'all' | Element;

const ELEMENTS: readonly Element[] = ['echo', 'ash', 'frost', 'rot', 'light'];

const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: 'all', label: 'common.all' },
  { key: 5, label: '5★' },
  { key: 4, label: '4★' },
  { key: 3, label: '3★' },
];

function sortHeroes(heroes: readonly HeroDef[], ownedIds: Set<string>): HeroDef[] {
  return [...heroes].sort((a, b) => {
    const ownedDiff = Number(ownedIds.has(b.id)) - Number(ownedIds.has(a.id));
    if (ownedDiff !== 0) return ownedDiff;
    if (b.rarity !== a.rarity) return b.rarity - a.rarity;
    return a.nameEn.localeCompare(b.nameEn);
  });
}

export function Heroes() {
  const [filter, setFilter] = useState<Filter>('all');
  const [elementFilter, setElementFilter] = useState<ElementFilter>('all');
  const [resonanceOpen, setResonanceOpen] = useState(false);
  const [resonancePick, setResonancePick] = useState<number | null>(null);
  const [reassemble, setReassemble] = useState<HeroDef | null>(null);
  const save = save$.value;
  const ownedIds = new Set(Object.keys(save.heroes));
  const list = sortHeroes(HEROES, ownedIds).filter(
    (hero) =>
      (filter === 'all' || hero.rarity === filter) &&
      (elementFilter === 'all' || hero.element === elementFilter),
  );
  const resonance = resonanceSlots(save);
  const rLevel = resonanceLevel(save);
  const ownedList = sortHeroes(HEROES, ownedIds).filter((hero) => ownedIds.has(hero.id));

  const assignResonance = (slot: number, heroId: string) => {
    commit((draft) => {
      setResonanceSlot(draft, slot, heroId);
    }, 'resonance-set');
    setResonancePick(null);
  };

  const clearResonance = (slot: number) => {
    commit((draft) => {
      clearResonanceSlot(draft, slot);
    }, 'resonance-clear');
  };

  const doReassemble = () => {
    if (!reassemble) return;
    let ok = false;
    commit((draft) => {
      ok = reassembleHero(draft, reassemble.id);
    }, 'hero-reassemble');
    toast(ok ? t('heroes.reassembled', { name: locale$.value === 'ru' ? reassemble.nameRu : reassemble.nameEn }) : t('heroes.reassembleNoResources'), ok ? 'success' : 'error');
    if (ok) setReassemble(null);
  };

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/archive.webp')})` }} />
      <div class={s.scrim} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('lobby')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.heading}>
          <span class={s.title}>{t('heroes.title')}</span>
          <span class={s.sub}>
            {t('heroes.collection')} · {t('heroes.owned', { n: ownedIds.size })}
          </span>
        </div>
        <div class={s.spacer} />
        <button class="btn btn--sm btn--ghost" onClick={() => setResonanceOpen(true)}>
          {t('heroes.resonance')}
        </button>
      </header>

      <div class={s.filters}>
        {FILTERS.map((item) => (
          <button
            key={String(item.key)}
            class={`${s.filter}${filter === item.key ? ` ${s.filterActive}` : ''}`}
            onClick={() => setFilter(item.key)}
          >
            {item.key === 'all' ? t('common.all') : item.label}
          </button>
        ))}
      </div>

      <div class={s.elementFilters}>
        <button
          class={`${s.elementChip}${elementFilter === 'all' ? ` ${s.elementChipActive}` : ''}`}
          onClick={() => setElementFilter('all')}
        >
          {t('common.all')}
        </button>
        {ELEMENTS.map((element) => (
          <button
            key={element}
            class={`${s.elementChip}${elementFilter === element ? ` ${s.elementChipActive}` : ''}`}
            onClick={() => setElementFilter(element)}
            title={elementName(element, locale$.value)}
          >
            <span class={s.elementDot} style={{ background: ELEMENT_COLOR[element] }} />
            {elementName(element, locale$.value)}
          </button>
        ))}
      </div>

      <div class={s.grid}>
        {list.map((hero) => {
          const owned = save.heroes[hero.id];
          const essence = save.heroEssences[hero.id] ?? 0;
          const lost = !owned && essence > 0;
          return (
            <button
              key={hero.id}
              class={`${s.card}${owned ? '' : ` ${s.locked}`}${lost ? ` ${s.lost}` : ''}`}
              onClick={() => {
                if (owned) openHero(hero.id);
                else if (lost) setReassemble(hero);
                else toast(t('heroes.locked'));
              }}
            >
              <span class={s.cardArt}>
                <HeroArt heroId={hero.id} kind="card" thumb objectPosition="50% 12%" />
              </span>
              <span class={s.cardShade} />
              <span class={s.cardStar}>{owned?.star ?? hero.rarity}★</span>
              <span class={s.cardFoot}>
                <span class={s.cardName}>{locale$.value === 'ru' ? hero.nameRu : hero.nameEn}</span>
                <span class={s.cardMeta}>
                  {roleName(hero.role, locale$.value)}
                  {owned ? ` · ${t('hero.level')} ${effectiveLevel(save, hero.id)}` : lost ? ` · ${t('heroes.essence', { n: essence })}` : ''}
                </span>
              </span>
              {resonance.includes(hero.id) ? <span class={s.resonanceBadge}>R</span> : null}
              {lost ? <span class={s.essenceBadge}>{essence}</span> : null}
              {!owned && !lost ? (
                <span class={s.lock}>
                  <Icon name="lock" size={11} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {resonanceOpen ? (
        <Modal
          title={t('heroes.resonance')}
          onClose={() => {
            setResonanceOpen(false);
            setResonancePick(null);
          }}
        >
          {resonancePick === null ? (
            <>
              <p class="muted">{t('heroes.resonance.hint', { n: rLevel })}</p>
              <div class={s.resonanceList}>
                {Array.from({ length: 5 }, (_, slot) => {
                  const id = resonance[slot];
                  const hero = id ? HEROES_BY_ID[id] : undefined;
                  const owned = id ? save.heroes[id] : undefined;
                  return (
                    <div key={slot} class={s.resonanceRow}>
                      <button class={s.resonanceSlot} onClick={() => setResonancePick(slot)}>
                        {hero ? (
                          <>
                            <HeroAvatar heroId={hero.id} size={34} star={owned?.star} />
                            <span class={s.resonanceInfo}>
                              <b>{locale$.value === 'ru' ? hero.nameRu : hero.nameEn}</b>
                              <span>
                                {t('hero.level')} {owned ? effectiveLevel(save, hero.id) : 1}
                              </span>
                            </span>
                          </>
                        ) : (
                          <span class={s.resonanceEmpty}>{t('heroes.resonance.empty')}</span>
                        )}
                      </button>
                      {id ? (
                        <button class={s.resonanceClear} onClick={() => clearResonance(slot)} aria-label={t('heroes.resonance.clear')}>
                          ×
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <button class="btn btn--wide" onClick={() => setResonanceOpen(false)}>
                {t('common.close')}
              </button>
            </>
          ) : (
            <>
              <p class="muted">{t('heroes.resonance.pick')}</p>
              <div class={s.miniGrid}>
                {ownedList.map((hero) => (
                  <button key={hero.id} class={s.miniCard} onClick={() => assignResonance(resonancePick, hero.id)}>
                    <HeroAvatar heroId={hero.id} size={44} star={save.heroes[hero.id]?.star} />
                    <span class={s.cardName}>{locale$.value === 'ru' ? hero.nameRu : hero.nameEn}</span>
                  </button>
                ))}
              </div>
              <button class="btn btn--wide" onClick={() => setResonancePick(null)}>
                {t('common.back')}
              </button>
            </>
          )}
        </Modal>
      ) : null}
      {reassemble ? (
        <Modal title={t('heroes.reassemble')} onClose={() => setReassemble(null)}>
          <p class="muted">{t('heroes.reassembleHint', { name: locale$.value === 'ru' ? reassemble.nameRu : reassemble.nameEn })}</p>
          <div class={s.resonanceList}>
            <div class={s.resonanceRow}>
              <div class={s.resonanceInfo}>
                <b>{t('heroes.reassembleCost')}</b>
                <span>
                  {reassembleCost(reassemble.id).gold} {t('resource.gold')} · {reassembleCost(reassemble.id).essence}{' '}
                  {t('resource.essence')}
                </span>
              </div>
            </div>
            <div class={s.resonanceRow}>
              <div class={s.resonanceInfo}>
                <b>{t('heroes.essence', { n: save.heroEssences[reassemble.id] ?? 0 })}</b>
                <span>{t('heroes.reassembleKeeps')}</span>
              </div>
            </div>
          </div>
          <button class="btn btn--primary btn--wide" disabled={!canReassemble(save, reassemble.id)} onClick={doReassemble}>
            {t('heroes.reassemble')}
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
