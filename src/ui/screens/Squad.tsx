import { useState } from 'preact/hooks';
import { asset } from '../../core/asset';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { ELEMENT_COLOR, HEROES_BY_ID, elementName, heroPower, roleName } from '../../data/heroes';
import type { HeroDef } from '../../data/types';
import { recommendedSquad, squadAdvice } from '../../game/recommended';
import { mercenaryIsActive } from '../../game/mercenary';
import { squadSize } from '../../game/squad';
import { effectiveLevel } from '../../game/resonance';
import { squadElementBonus } from '../../game/squad-element';
import { loadSquadPreset, presetHeroes, PRESET_SLOTS, saveSquadPreset } from '../../game/squad-presets';
import { commit, save$, teamPower } from '../../game/state';
import { HeroAvatar } from '../components/HeroAvatar';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { toast } from '../components/toast';
import { battleFloor$ } from '../nav';
import s from './Squad.module.css';

function ownedHeroes(): HeroDef[] {
  const save = save$.value;
  return Object.keys(save.heroes)
    .map((id) => HEROES_BY_ID[id])
    .filter((hero): hero is HeroDef => Boolean(hero));
}

function sortedByPower(heroes: HeroDef[]): HeroDef[] {
  const save = save$.value;
  return [...heroes].sort((a, b) => {
    const left = heroPower(b, effectiveLevel(save, b.id), save.heroes[b.id]?.star ?? 3);
    const right = heroPower(a, effectiveLevel(save, a.id), save.heroes[a.id]?.star ?? 3);
    return left - right;
  });
}

export function Squad() {
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [dragSlot, setDragSlot] = useState<number | null>(null);
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const save = save$.value;
  const squad = Array.from({ length: 5 }, (_, index) => save.squad[index] ?? '');
  const heroes = squad.map((id) => (id ? HEROES_BY_ID[id] : undefined));
  const owned = sortedByPower(ownedHeroes());

  const roles = heroes.filter((hero): hero is HeroDef => Boolean(hero)).map((hero) => hero.role);
  const hasTank = roles.includes('vanguard');

  const elementInfo = squadElementBonus(save);
  const topCount = elementInfo.count;
  const bonus = elementInfo.bonus;
  const advice = squadAdvice(save);
  const recommended = recommendedSquad(save);
  const mercenary = save.social.mercenary;
  const mercenaryActive = mercenaryIsActive(save);
  const mercenaryHero = mercenary ? HEROES_BY_ID[mercenary.heroId] : undefined;

  const autoSquad = () => {
    const best = sortedByPower(ownedHeroes()).slice(0, 5).map((hero) => hero.id);
    while (best.length < 5) best.push('');
    commit((draft) => {
      draft.squad = best;
    }, 'squad-auto');
  };

  const applyRecommended = () => {
    if (recommended.length === 0) return;
    const next = Array.from({ length: 5 }, (_, index) => recommended[index] ?? '');
    commit((draft) => {
      draft.squad = next;
    }, 'squad-recommended');
    toast(t('squad.recommendApplied'), 'success');
  };

  const savePreset = (slot: number) => {
    let ok = false;
    commit((draft) => {
      ok = saveSquadPreset(draft, slot);
    }, 'squad-preset-save');
    if (ok) toast(t('squad.presetSaved', { n: slot + 1 }), 'success');
  };

  const loadPreset = (slot: number) => {
    let ok = false;
    commit((draft) => {
      ok = loadSquadPreset(draft, slot);
    }, 'squad-preset-load');
    if (ok) {
      toast(t('squad.presetLoaded', { n: slot + 1 }), 'success');
      setPresetsOpen(false);
    } else {
      toast(t('squad.presetInvalid'), 'error');
    }
  };

  const assign = (slot: number, heroId: string) => {
    commit((draft) => {
      const next = Array.from({ length: 5 }, (_, index) => draft.squad[index] ?? '');
      const from = next.indexOf(heroId);
      const previous = next[slot] ?? '';
      next[slot] = heroId;
      if (from >= 0 && from !== slot) next[from] = previous;
      draft.squad = next;
    }, 'squad-assign');
    setPickerSlot(null);
  };

  const swapSlots = (from: number, to: number) => {
    if (from === to) return;
    commit((draft) => {
      const next = Array.from({ length: 5 }, (_, index) => draft.squad[index] ?? '');
      const previous = next[from] ?? '';
      next[from] = next[to] ?? '';
      next[to] = previous;
      draft.squad = next;
    }, 'squad-swap');
  };

  const goBattle = () => {
    if (squadSize(save$.value) === 0) {
      toast(t('squad.emptyWarning'), 'error');
      return;
    }
    battleFloor$.value = save$.value.tower.maxFloor;
    navigate('battle');
  };

  const renderSlot = (index: number) => {
    const hero = heroes[index];
    const ownedHero = hero ? save.heroes[hero.id] : undefined;
    return (
      <button
        key={index}
        class={`${s.slot}${hero ? '' : ` ${s.slotEmpty}`}${dragSlot === index ? ` ${s.slotDragging}` : ''}${
          overSlot === index ? ` ${s.slotDragOver}` : ''
        }`}
        draggable={Boolean(hero)}
        onDragStart={(event) => {
          if (!hero) return;
          setDragSlot(index);
          event.dataTransfer?.setData('text/plain', String(index));
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => {
          setDragSlot(null);
          setOverSlot(null);
        }}
        onDragOver={(event) => {
          if (dragSlot === null || dragSlot === index) return;
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
          setOverSlot(index);
        }}
        onDragLeave={() => {
          setOverSlot((current) => (current === index ? null : current));
        }}
        onDrop={(event) => {
          event.preventDefault();
          const raw = dragSlot ?? Number(event.dataTransfer?.getData('text/plain'));
          setDragSlot(null);
          setOverSlot(null);
          if (Number.isInteger(raw) && raw !== index) swapSlots(raw, index);
        }}
        onClick={() => setPickerSlot(index)}
      >
        {hero ? (
          <>
            <HeroAvatar heroId={hero.id} size={72} star={ownedHero?.star} />
            <span class={s.slotName}>{locale$.value === 'ru' ? hero.nameRu : hero.nameEn}</span>
            <span class={s.slotMeta}>
              {roleName(hero.role, locale$.value)} · {t('hero.level')} {effectiveLevel(save, hero.id)}
            </span>
            <span class={s.slotElement} style={{ background: ELEMENT_COLOR[hero.element] }} />
          </>
        ) : (
          <>
            <span class={s.plus}>
              <Icon name="star" size={22} />
            </span>
            <span class={s.slotMeta}>{t('squad.empty')}</span>
          </>
        )}
      </button>
    );
  };

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/barracks.webp')})` }} />
      <div class={s.scrim} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('lobby')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.heading}>
          <span class={s.title}>{t('squad.title')}</span>
          <span class={s.power}>
            {t('lobby.power')} <b>{teamPower()}</b>
          </span>
        </div>
        <button class="btn btn--sm btn--ghost" onClick={() => setPresetsOpen(true)}>
          {t('squad.presets')}
        </button>
      </header>

      <div class={s.field}>
        <div class={s.rowLabel}>{t('squad.back')}</div>
        <div class={s.rowBack}>{[2, 3, 4].map(renderSlot)}</div>

        <div class={s.rowDivider} />

        <div class={s.rowFront}>{[0, 1].map(renderSlot)}</div>
        <div class={s.rowLabel}>{t('squad.front')}</div>
      </div>

      {mercenaryActive && mercenary && mercenaryHero ? (
        <button class={s.mercenary} onClick={() => navigate('social')}>
          <HeroAvatar heroId={mercenary.heroId} size={34} star={mercenary.star} />
          <span class={s.mercInfo}>
            <b>{t('social.friends.mercenary')}</b>
            <span>
              {locale$.value === 'ru' ? mercenaryHero.nameRu : mercenaryHero.nameEn} ·{' '}
              {t('social.friends.level', { n: mercenary.level })}
            </span>
          </span>
          <span class={s.mercBadge}>{t('social.friends.extraSlot')}</span>
        </button>
      ) : null}

      <div class={s.hints}>
        {!hasTank ? <span class={s.hintWarn}>{t('squad.hint.tank')}</span> : null}
        {!advice.hasHealer ? <span class={s.hintWarn}>{t('squad.hint.roles')}</span> : null}
        {elementInfo.element && bonus > 0 ? (
          <span class={s.hintGood}>
            {t('squad.hint.element', {
              element: elementName(elementInfo.element, locale$.value),
              count: topCount,
              bonus,
            })}
          </span>
        ) : elementInfo.element ? (
          <span class={s.hintNeutral}>
            {t('squad.hint.elementMain', {
              element: elementName(elementInfo.element, locale$.value),
              count: topCount,
            })}
          </span>
        ) : null}
        <span class={s.hintNeutral}>{t('squad.dragHint')}</span>
        {recommended.length > 0 ? (
          <button class={s.recommend} onClick={applyRecommended} aria-label={t('squad.recommend')}>
            <span class={s.recommendAvatars}>
              {recommended.map((heroId) => (
                <HeroAvatar key={heroId} heroId={heroId} size={22} star={save.heroes[heroId]?.star} />
              ))}
            </span>
            <span class={s.recommendText}>{t('squad.recommend')}</span>
            <b class={s.recommendAction}>{t('squad.recommendApply')}</b>
          </button>
        ) : null}
      </div>

      <footer class={s.bottom}>
        <button class="btn btn--ghost btn--wide" onClick={autoSquad}>
          {t('squad.auto')}
        </button>
        <button class="btn btn--primary btn--lg btn--wide" data-ftue="battle" onClick={goBattle}>
          {t('squad.inBattle')}
        </button>
      </footer>

      {pickerSlot !== null ? (
        <Modal title={t('squad.assign')} onClose={() => setPickerSlot(null)}>
          <div class={s.grid}>
            {owned.map((hero) => {
              const ownedHero = save.heroes[hero.id];
              const inSquad = save.squad.includes(hero.id);
              const isCurrent = save.squad[pickerSlot] === hero.id;
              return (
                <button
                  key={hero.id}
                  class={`${s.pickCard}${inSquad ? ` ${s.pickInSquad}` : ''}${isCurrent ? ` ${s.pickCurrent}` : ''}`}
                  onClick={() => assign(pickerSlot, hero.id)}
                >
                  {inSquad ? <span class={s.pickBadge}>{t('hero.inSquad')}</span> : null}
                  <HeroAvatar heroId={hero.id} size={64} star={ownedHero?.star} />
                  <span class={s.pickName}>{locale$.value === 'ru' ? hero.nameRu : hero.nameEn}</span>
                  <span class={s.pickMeta}>
                    {roleName(hero.role, locale$.value)} · {t('hero.level')}{' '}
                    {effectiveLevel(save, hero.id)}
                  </span>
                </button>
              );
            })}
          </div>
        </Modal>
      ) : null}

      {presetsOpen ? (
        <Modal title={t('squad.presets')} onClose={() => setPresetsOpen(false)}>
          <div class={s.presetList}>
            {Array.from({ length: PRESET_SLOTS }, (_, slot) => {
              const heroes = presetHeroes(save, slot);
              const names = heroes
                .map((id) => HEROES_BY_ID[id])
                .filter((hero): hero is HeroDef => Boolean(hero))
                .map((hero) => (locale$.value === 'ru' ? hero.nameRu : hero.nameEn));
              return (
                <div key={slot} class={s.presetRow}>
                  <div class={s.presetInfo}>
                    <b>{t('squad.preset', { n: slot + 1 })}</b>
                    <span>{names.length > 0 ? names.join(' · ') : t('squad.presetEmpty')}</span>
                  </div>
                  <div class={s.presetActions}>
                    <button class="btn btn--sm btn--ghost" onClick={() => savePreset(slot)}>
                      {t('squad.presetSave')}
                    </button>
                    <button class="btn btn--sm" disabled={names.length === 0} onClick={() => loadPreset(slot)}>
                      {t('squad.presetLoad')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p class="muted">{t('squad.presetHint')}</p>
          <button class="btn btn--wide" onClick={() => setPresetsOpen(false)}>
            {t('common.close')}
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
