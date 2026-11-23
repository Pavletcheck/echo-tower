import { useState } from 'preact/hooks';
import { asset } from '../../core/asset';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { ENGRAVINGS_BY_ID, ENGRAVING_SETS_BY_ID } from '../../data/engravings';
import { GEAR_BY_ID } from '../../data/gear';
import { heroName } from '../../data/heroes';
import type { EngravingGrade, GearRarity, GearSlot, StatKey } from '../../data/types';
import { GEAR_SLOTS, gearLevel } from '../../game/equipment';
import type { SaveV1 } from '../../game/save';
import { save$ } from '../../game/state';
import { Icon } from '../components/Icon';
import s from './Storage.module.css';

const STAT_LABEL: Record<StatKey, string> = {
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  spd: 'SPD',
  crit: 'CRIT',
  cdmg: 'CDMG',
  er: 'ER',
  lifesteal: 'LS',
  elem: 'ELEM',
  dr: 'DR',
  heal: 'HEAL',
  shield: 'SHIELD',
};

const GRADE_COLOR: Record<EngravingGrade, string> = {
  D: '#9a8fb8',
  C: '#8fcf4a',
  B: '#6fb6ff',
  A: '#9b7bff',
  S: '#e9c46a',
  SS: '#f5f1ff',
};

const RARITY_COLOR: Record<GearRarity, string> = {
  common: '#9a8fb8',
  rare: '#8fcf4a',
  epic: '#9b7bff',
  legendary: '#e9c46a',
};

const RARITY_KEY: Record<GearRarity, string> = {
  common: 'hero.gear.rarity.common',
  rare: 'hero.gear.rarity.rare',
  epic: 'hero.gear.rarity.epic',
  legendary: 'hero.gear.rarity.legendary',
};

interface EngravingRow {
  id: string;
  heroId: string | null;
  slot: number;
}

interface GearRow {
  id: string;
  heroId: string | null;
  slot: GearSlot | null;
}

function engravingStat(stat: StatKey, value: number): string {
  return stat === 'spd' ? `+${value} ${STAT_LABEL.spd}` : `+${value}% ${STAT_LABEL[stat]}`;
}

function engravingRows(save: SaveV1): EngravingRow[] {
  const rows: EngravingRow[] = [];
  for (const [heroId, hero] of Object.entries(save.heroes)) {
    (hero.engravingSlots ?? []).forEach((id, index) => {
      if (id && ENGRAVINGS_BY_ID[id]) rows.push({ id, heroId, slot: index + 1 });
    });
  }
  for (const id of save.inventory.engravings ?? []) {
    if (ENGRAVINGS_BY_ID[id]) rows.push({ id, heroId: null, slot: 0 });
  }
  return rows.sort(
    (a, b) => Number(Boolean(b.heroId)) - Number(Boolean(a.heroId)) || a.id.localeCompare(b.id),
  );
}

function gearRows(save: SaveV1): GearRow[] {
  const rows: GearRow[] = [];
  for (const [heroId, hero] of Object.entries(save.heroes)) {
    for (const slot of GEAR_SLOTS) {
      const id = hero.gear?.[slot];
      if (id && GEAR_BY_ID[id]) rows.push({ id, heroId, slot });
    }
  }
  for (const id of save.inventory.gear ?? []) {
    if (GEAR_BY_ID[id]) rows.push({ id, heroId: null, slot: null });
  }
  return rows.sort(
    (a, b) => Number(Boolean(b.heroId)) - Number(Boolean(a.heroId)) || a.id.localeCompare(b.id),
  );
}

export function Storage() {
  const [tab, setTab] = useState<'engravings' | 'gear'>('engravings');
  const save = save$.value;
  const locale = locale$.value;

  const engravings = engravingRows(save);
  const gear = gearRows(save);
  const freeEngravings = (save.inventory.engravings ?? []).length;
  const freeGear = (save.inventory.gear ?? []).length;
  const rows = tab === 'engravings' ? engravings : gear;

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/barracks.webp')})` }} />
      <div class={s.scrim} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('lobby')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.heading}>
          <span class={s.title}>{t('storage.title')}</span>
          <span class={s.sub}>
            {t('storage.summary', { engravings: freeEngravings, gear: freeGear })}
          </span>
        </div>
      </header>

      <div class={s.tabs}>
        <button
          class={`${s.tab}${tab === 'engravings' ? ` ${s.tabActive}` : ''}`}
          onClick={() => setTab('engravings')}
        >
          {t('storage.engravings')} · {engravings.length}
        </button>
        <button
          class={`${s.tab}${tab === 'gear' ? ` ${s.tabActive}` : ''}`}
          onClick={() => setTab('gear')}
        >
          {t('storage.gear')} · {gear.length}
        </button>
      </div>

      <div class={s.scroll}>
        {rows.length === 0 ? <div class={s.empty}>{t('storage.empty')}</div> : null}

        {tab === 'engravings'
          ? engravings.map((row, index) => {
              const item = ENGRAVINGS_BY_ID[row.id];
              if (!item) return null;
              const set = ENGRAVING_SETS_BY_ID[item.set];
              const owner =
                row.heroId !== null
                  ? t('storage.ownerEngraving', { name: heroName(row.heroId, locale), n: row.slot })
                  : t('storage.free');
              return (
                <div class={s.card} key={`${row.heroId ?? 'free'}-${row.slot}-${row.id}-${index}`}>
                  <span
                    class={s.grade}
                    style={{ color: GRADE_COLOR[item.grade], borderColor: GRADE_COLOR[item.grade] }}
                  >
                    {item.grade}
                  </span>
                  <div class={s.info}>
                    <span class={s.name}>{locale === 'ru' ? item.nameRu : item.nameEn}</span>
                    <span class={s.meta}>
                      {locale === 'ru' ? set?.nameRu : set?.nameEn} · {engravingStat(item.stat, item.value)}
                    </span>
                  </div>
                  <span class={row.heroId ? s.owner : s.free}>{owner}</span>
                </div>
              );
            })
          : gear.map((row, index) => {
              const item = GEAR_BY_ID[row.id];
              if (!item) return null;
              const level = gearLevel(save, row.id);
              const owner =
                row.heroId !== null && row.slot
                  ? t('storage.ownerGear', {
                      name: heroName(row.heroId, locale),
                      slot: t(`gear.${row.slot}`),
                    })
                  : t('storage.free');
              return (
                <div class={s.card} key={`${row.heroId ?? 'free'}-${row.slot ?? row.id}-${row.id}-${index}`}>
                  <span
                    class={s.grade}
                    style={{ color: RARITY_COLOR[item.rarity], borderColor: RARITY_COLOR[item.rarity] }}
                  >
                    +{level}
                  </span>
                  <div class={s.info}>
                    <span class={s.name}>{locale === 'ru' ? item.nameRu : item.nameEn}</span>
                    <span class={s.meta}>
                      {t(RARITY_KEY[item.rarity])} · {t(`gear.${item.slot}`)}
                    </span>
                  </div>
                  <span class={row.heroId ? s.owner : s.free}>{owner}</span>
                </div>
              );
            })}
      </div>
    </div>
  );
}
