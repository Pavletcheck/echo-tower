import { useEffect, useState } from 'preact/hooks';
import { formatNumber } from '../../core/time';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { ENGRAVINGS_BY_ID, ENGRAVING_SETS_BY_ID } from '../../data/engravings';
import { GEAR_BY_ID, GEAR_SETS_BY_ID } from '../../data/gear';
import { ELEMENT_COLOR, HEROES_BY_ID, elementName, roleName } from '../../data/heroes';
import type { EngravingGrade, EngravingSet, GearDef, GearRarity, GearSlot, StatKey } from '../../data/types';
import { applyStatBonus, combatStats } from '../../game/battle/stats';
import { levelCap, levelGold, levelXp } from '../../game/config';
import { artifactBonusText, artifactDef, artifactLevel, artifactNextCost, artifactUnlockCost, unlockArtifact, upgradeArtifact } from '../../game/artifacts';
import {
  ascendHero,
  ascensionShards,
  canAscend,
  canResetHero,
  heroRefund,
  resetHero,
  skillCost,
  skillLevel,
  upgradeSkill,
} from '../../game/progression';
import { effectiveLevel, isResonating } from '../../game/resonance';
import {
  ENGRAVING_GRADES,
  autoEquip,
  enhanceGear,
  engravingSetCounts,
  equipEngraving,
  equipGear,
  equipmentStats,
  gearLevel,
  gearNextEnhanceCost,
  gearPreset,
  gearSetCounts,
  gearStatValue,
  grantStarterGear,
  loadGearPreset,
  mergeEngravings,
  saveGearPreset,
  unequipEngraving,
  unequipGear,
} from '../../game/equipment';
import { commit, save$ } from '../../game/state';
import { trackQuest } from '../../game/quests';
import { HeroArt } from '../components/HeroArt';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { toast } from '../components/toast';
import { selectedHero$ } from '../nav';
import s from './HeroDetail.module.css';

const GEAR_SLOTS: ReadonlyArray<{ slot: GearSlot; label: string }> = [
  { slot: 'weapon', label: 'gear.weapon' },
  { slot: 'armor', label: 'gear.armor' },
  { slot: 'relic', label: 'gear.relic' },
  { slot: 'boots', label: 'gear.boots' },
];

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

const RARITY_LABEL: Record<GearRarity, string> = {
  common: 'hero.gear.rarity.common',
  rare: 'hero.gear.rarity.rare',
  epic: 'hero.gear.rarity.epic',
  legendary: 'hero.gear.rarity.legendary',
};

function engravingStatText(stat: StatKey, value: number): string {
  return stat === 'spd' ? `+${value} ${STAT_LABEL.spd}` : `+${value}% ${STAT_LABEL[stat]}`;
}

function gearStatText(stat: StatKey, value: number): string {
  return stat === 'spd' ? `+${value} ${STAT_LABEL.spd}` : `+${Math.round(value * 100)}% ${STAT_LABEL[stat]}`;
}

function gearStatsText(item: GearDef, level: number): string {
  return (Object.keys(item.stats) as StatKey[])
    .map((stat) => gearStatText(stat, gearStatValue(item, stat, level)))
    .join(' · ');
}

interface SetSummary {
  id: string;
  name: string;
  count: number;
  tiers: number[];
}

export function HeroDetail() {
  const [engravingSlot, setEngravingSlot] = useState<number | null>(null);
  const [gearSlot, setGearSlot] = useState<GearSlot | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeGrade, setMergeGrade] = useState<EngravingGrade>('D');
  const [mergeTimes, setMergeTimes] = useState(1);
  const [gearPresetsOpen, setGearPresetsOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const save = save$.value;
  const heroId = selectedHero$.value ?? save.squad.find((id) => Boolean(id)) ?? Object.keys(save.heroes)[0] ?? 'thorn';
  const hero = HEROES_BY_ID[heroId];
  const owned = save.heroes[heroId];

  useEffect(() => {
    let granted = false;
    commit((draft) => {
      if (draft.flags.starterGear) return;
      const hasGear =
        draft.inventory.gear.length > 0 ||
        Object.values(draft.heroes).some((entry) => Object.keys(entry.gear ?? {}).length > 0);
      if (hasGear) {
        draft.flags.starterGear = true;
        return;
      }
      granted = grantStarterGear(draft);
    }, 'starter-gear');
    if (granted) toast(t('hero.gear.starter'), 'success');
  }, []);

  if (!hero || !owned) {
    return (
      <div class={s.root}>
        <header class={s.top}>
          <button class={s.iconBtn} onClick={() => navigate('heroes')} aria-label={t('common.back')}>
            <Icon name="back" size={20} />
          </button>
          <div class={s.spacer} />
          <button
            class={s.iconBtn}
            onClick={() => navigate('lobby')}
            aria-label={t('common.close')}
            title={t('common.close')}
          >
            <Icon name="close" size={20} />
          </button>
        </header>
        <div class={s.empty}>{t('heroes.locked')}</div>
      </div>
    );
  }

  const bonus = equipmentStats(save, heroId);
  const level = effectiveLevel(save, heroId);
  const resonating = isResonating(save, heroId);
  const stats = applyStatBonus(combatStats(hero.base, owned.star, level), bonus);
  const cap = levelCap(owned.star);
  const atCap = owned.level >= cap;
  const cost = levelGold(owned.level);
  const xpNeed = levelXp(owned.level);
  const xpRatio = Math.min(1, xpNeed > 0 ? owned.xp / xpNeed : 0);
  const accent = ELEMENT_COLOR[hero.element];
  const inSquad = save.squad.includes(heroId);
  const activeEngravings = owned.engravingSlots.filter(Boolean).length;
  const starShards = save.currencies.starShards[heroId] ?? 0;
  const ascendPrice = ascensionShards(save, heroId);
  const ascendReady = canAscend(save, heroId);
  const artifact = artifactDef(heroId);
  const artLevel = artifactLevel(save, heroId);
  const artifactUnlock = artifactUnlockCost();
  const artifactUpgrade = artifactNextCost(save, heroId);
  const resetAvailable = canResetHero(save, heroId);
  const refund = heroRefund(save, heroId);

  const engravingSummaries: SetSummary[] = Object.entries(engravingSetCounts(save, heroId))
    .filter(([, count]) => count >= 2)
    .map(([setId, count]) => {
      const def = ENGRAVING_SETS_BY_ID[setId as EngravingSet];
      const tiers = [2, 4, 6].filter((tier) => count >= tier);
      return {
        id: setId,
        name: def ? (locale$.value === 'ru' ? def.nameRu : def.nameEn) : setId,
        count,
        tiers,
      };
    });

  const gearSummaries: SetSummary[] = Object.entries(gearSetCounts(save, heroId))
    .filter(([, count]) => count >= 2)
    .map(([setId, count]) => {
      const def = GEAR_SETS_BY_ID[setId];
      const tiers = [2, 4].filter((tier) => count >= tier);
      return {
        id: setId,
        name: def ? (locale$.value === 'ru' ? def.nameRu : def.nameEn) : setId,
        count,
        tiers,
      };
    });

  const gradeCounts = {} as Record<EngravingGrade, number>;
  for (const grade of ENGRAVING_GRADES) gradeCounts[grade] = 0;
  for (const id of save.inventory.engravings) {
    const grade = ENGRAVINGS_BY_ID[id]?.grade;
    if (grade) gradeCounts[grade] += 1;
  }
  const maxMergeTimes = Math.floor((gradeCounts[mergeGrade] ?? 0) / 3);
  const mergeBatch = Math.min(Math.max(1, mergeTimes), Math.max(1, maxMergeTimes));

  const levelUp = () => {
    if (atCap) return;
    if (save.currencies.gold < cost) {
      toast(t('hero.notEnoughGold'), 'error');
      return;
    }
    commit((draft) => {
      const target = draft.heroes[heroId];
      if (!target || target.level >= levelCap(target.star)) return;
      if (draft.currencies.gold < cost) return;
      draft.currencies.gold -= cost;
      target.level += 1;
      target.levelGoldSpent = (target.levelGoldSpent ?? 0) + cost;
      trackQuest(draft, 'upgrades', 1);
      trackQuest(draft, 'levelups', 1);
      trackQuest(draft, 'spendGold', cost);
    }, 'hero-level');
    toast(t('hero.upgraded'), 'success');
  };

  const ascend = () => {
    let ok = false;
    commit((draft) => {
      ok = ascendHero(draft, heroId);
    }, 'hero-ascend');
    toast(ok ? t('hero.ascended') : t('hero.notEnoughShards'), ok ? 'success' : 'error');
  };

  const upgradeHeroSkill = (index: number) => {
    let ok = false;
    commit((draft) => {
      ok = upgradeSkill(draft, heroId, index);
    }, 'hero-skill');
    toast(ok ? t('hero.skill.upgraded') : t('hero.skill.noResources'), ok ? 'success' : 'error');
  };

  const awakenArtifact = () => {
    let ok = false;
    commit((draft) => {
      ok = unlockArtifact(draft, heroId);
    }, 'artifact-unlock');
    toast(ok ? t('hero.artifact.unlocked') : t('hero.artifact.noResources'), ok ? 'success' : 'error');
  };

  const levelArtifact = () => {
    let ok = false;
    commit((draft) => {
      ok = upgradeArtifact(draft, heroId);
    }, 'artifact-upgrade');
    toast(ok ? t('hero.artifact.upgraded') : t('hero.artifact.noResources'), ok ? 'success' : 'error');
  };

  const confirmReset = () => {
    let result = null as ReturnType<typeof resetHero>;
    commit((draft) => {
      result = resetHero(draft, heroId);
    }, 'hero-reset');
    setResetOpen(false);
    if (result) {
      toast(t('hero.reset.done', { gold: result.gold, essence: result.essence, shards: result.shards }), 'success');
    }
  };

  const addToSquad = () => {
    if (inSquad) return;
    commit((draft) => {
      if (draft.squad.includes(heroId)) return;
      const next = Array.from({ length: 5 }, (_, index) => draft.squad[index] ?? '');
      const empty = next.indexOf('');
      if (empty >= 0) next[empty] = heroId;
      else next[4] = heroId;
      draft.squad = next;
    }, 'hero-to-squad');
  };

  const currentEngraving =
    engravingSlot !== null && owned.engravingSlots[engravingSlot]
      ? ENGRAVINGS_BY_ID[owned.engravingSlots[engravingSlot] ?? '']
      : undefined;

  const currentGear = gearSlot && owned.gear?.[gearSlot] ? GEAR_BY_ID[owned.gear[gearSlot] ?? ''] : undefined;
  const currentGearLevel = currentGear ? gearLevel(save, currentGear.id) : 0;
  const currentGearCost = currentGear ? gearNextEnhanceCost(save, currentGear.id) : 0;
  const gearOptions = gearSlot ? save.inventory.gear.filter((id) => GEAR_BY_ID[id]?.slot === gearSlot) : [];

  const equipStone = (engravingId: string) => {
    if (engravingSlot === null) return;
    const def = ENGRAVINGS_BY_ID[engravingId];
    let ok = false;
    commit((draft) => {
      ok = equipEngraving(draft, heroId, engravingSlot, engravingId);
    }, 'engraving-equip');
    if (!ok || !def) return;
    const name = locale$.value === 'ru' ? def.nameRu : def.nameEn;
    toast(t('hero.engravings.equipped', { name }), 'success');
    setEngravingSlot(null);
  };

  const removeStone = () => {
    if (engravingSlot === null) return;
    const def = currentEngraving;
    let ok = false;
    commit((draft) => {
      ok = unequipEngraving(draft, heroId, engravingSlot);
    }, 'engraving-unequip');
    if (!ok) return;
    if (def) {
      toast(t('hero.engravings.removed', { name: locale$.value === 'ru' ? def.nameRu : def.nameEn }), 'success');
    }
    setEngravingSlot(null);
  };

  const autoEquipGear = () => {
    let changed = 0;
    commit((draft) => {
      changed = autoEquip(draft, heroId).length;
    }, 'gear-auto');
    toast(changed > 0 ? t('hero.gear.autoDone', { n: changed }) : t('hero.gear.autoNone'), changed > 0 ? 'success' : 'info');
  };

  const saveGearPresetSlot = (slot: number) => {
    let ok = false;
    commit((draft) => {
      ok = saveGearPreset(draft, heroId, slot);
    }, 'gear-preset-save');
    toast(ok ? t('hero.gear.presetSaved', { n: slot + 1 }) : t('hero.gear.noGear'), ok ? 'success' : 'error');
  };

  const loadGearPresetSlot = (slot: number) => {
    let applied = 0;
    commit((draft) => {
      applied = loadGearPreset(draft, heroId, slot);
    }, 'gear-preset-load');
    if (applied > 0) {
      toast(t('hero.gear.presetLoaded', { n: slot + 1, count: applied }), 'success');
      setGearPresetsOpen(false);
    } else {
      toast(t('hero.gear.presetInvalid'), 'error');
    }
  };

  const doMerge = () => {
    if (maxMergeTimes <= 0) {
      toast(t('hero.engravings.mergeNone'), 'error');
      return;
    }
    let merged = 0;
    commit((draft) => {
      merged = mergeEngravings(draft, mergeGrade, mergeBatch);
    }, 'engraving-merge');
    if (merged > 0) {
      toast(t('hero.engravings.mergeResult', { n: merged }), 'success');
      setMergeTimes(1);
    } else {
      toast(t('hero.engravings.mergeNone'), 'error');
    }
  };

  const equipItem = (itemId: string) => {
    if (!gearSlot) return;
    const item = GEAR_BY_ID[itemId];
    let ok = false;
    commit((draft) => {
      ok = equipGear(draft, heroId, gearSlot, itemId);
    }, 'gear-equip');
    if (!ok || !item) return;
    toast(t('hero.gear.equipped', { name: locale$.value === 'ru' ? item.nameRu : item.nameEn }), 'success');
    setGearSlot(null);
  };

  const removeItem = () => {
    if (!gearSlot) return;
    const item = currentGear;
    let ok = false;
    commit((draft) => {
      ok = unequipGear(draft, heroId, gearSlot);
    }, 'gear-unequip');
    if (!ok) return;
    if (item) {
      toast(t('hero.gear.removed', { name: locale$.value === 'ru' ? item.nameRu : item.nameEn }), 'success');
    }
    setGearSlot(null);
  };

  const enhanceItem = () => {
    if (!currentGear || currentGearCost <= 0) return;
    let gained = 0;
    commit((draft) => {
      gained = enhanceGear(draft, currentGear.id, 1);
    }, 'gear-enhance');
    if (gained > 0) {
      toast(
        t('hero.gear.enhanced', {
          name: locale$.value === 'ru' ? currentGear.nameRu : currentGear.nameEn,
          n: currentGearLevel + gained,
        }),
        'success',
      );
    } else {
      toast(t('hero.gear.noDust'), 'error');
    }
  };

  const statRows: ReadonlyArray<{ label: string; value: string; hintKey?: string }> = [
    { label: 'HP', value: formatNumber(stats.hp, locale$.value) },
    { label: 'ATK', value: formatNumber(stats.atk, locale$.value) },
    { label: 'DEF', value: formatNumber(stats.def, locale$.value) },
    { label: 'SPD', value: formatNumber(stats.spd, locale$.value) },
    {
      label: 'CRIT',
      value: `${Math.round(stats.crit * 100)}%`,
      hintKey: 'stat.crit.hint',
    },
    {
      label: 'CDMG',
      value: `${Math.round(stats.cdmg * 100)}%`,
      hintKey: 'stat.cdmg.hint',
    },
    {
      label: 'ER',
      value: `${Math.round(stats.er * 100)}%`,
      hintKey: 'stat.er.hint',
    },
    {
      label: 'LS',
      value: `${Math.round(bonus.lifesteal * 100)}%`,
      hintKey: 'stat.lifesteal.hint',
    },
    {
      label: 'DR',
      value: `${Math.round(bonus.dr * 100)}%`,
      hintKey: 'stat.dr.hint',
    },
    {
      label: 'SHIELD',
      value: `${Math.round(bonus.shield * 100)}%`,
      hintKey: 'stat.shield.hint',
    },
  ];

  return (
    <div class={s.root} style={{ '--accent': accent }}>
      <div class={s.aura} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('heroes')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.heading}>
          <span class={s.title}>{locale$.value === 'ru' ? hero.nameRu : hero.nameEn}</span>
          <span class={s.sub}>
            {roleName(hero.role, locale$.value)} · {elementName(hero.element, locale$.value)}
          </span>
        </div>
        <div class={s.spacer} />
        <button
          class={s.iconBtn}
          onClick={() => navigate('lobby')}
          aria-label={t('common.close')}
          title={t('common.close')}
        >
          <Icon name="close" size={20} />
        </button>
      </header>

      <div class={s.scroll}>
        <section class={s.heroCard}>
          <div class={s.artFrame}>
            <HeroArt heroId={hero.id} fit="contain" backdrop objectPosition="50% 50%" />
          </div>
          <div class={s.stars}>{'★'.repeat(owned.star)}</div>
          <div class={s.name}>{locale$.value === 'ru' ? hero.nameRu : hero.nameEn}</div>
        </section>

        <section class={s.panel}>
          <div class={s.panelHead}>
            <span>{t('hero.level')}</span>
            <span>
              {level} / {cap}
              {resonating ? ` · ${t('hero.resonance.badge')}` : ''}
            </span>
          </div>
          <div class={s.xpBar}>
            <div class={s.xpFill} style={{ width: `${Math.round(xpRatio * 100)}%` }} />
          </div>
          <div class={s.levelRow}>
            <span class={s.muted}>
              {t('hero.xp')} {Math.round(owned.xp)} / {xpNeed}
            </span>
            {atCap && owned.star < 6 ? (
              <button class="btn btn--sm" onClick={() => navigate('trials')}>
                {t('hero.trial')}
              </button>
            ) : atCap ? null : (
              <button class="btn btn--gold btn--sm" data-ftue="upgrade" onClick={levelUp}>
                {t('hero.levelUp')} · {formatNumber(cost, locale$.value)}
              </button>
            )}
          </div>
          {atCap ? <div class={s.mutedSmall}>{t('hero.maxLevel', { star: owned.star })}</div> : null}
          {resonating ? (
            <div class={s.mutedSmall}>{t('hero.resonance.active', { level, stored: owned.level })}</div>
          ) : null}
          {owned.star < 6 ? (
            <div class={s.levelRow}>
              <span class={s.muted}>{t('hero.shards', { n: starShards })}</span>
              <button class="btn btn--sm" disabled={!ascendReady} onClick={ascend}>
                {t('hero.ascend')} · {ascendPrice}
              </button>
            </div>
          ) : null}
        </section>

        <section class={s.panel}>
          <div class={s.panelHead}>
            <span>{t('hero.stats')}</span>
          </div>
          <div class={s.statsGrid}>
            {statRows.map((row) => (
              <div
                key={row.label}
                class={s.stat}
                title={row.hintKey ? t(row.hintKey) : undefined}
                aria-label={row.hintKey ? `${row.label}: ${t(row.hintKey)}` : row.label}
              >
                <span class={s.statLabel}>{row.label}</span>
                <span class={s.statValue}>{row.value}</span>
              </div>
            ))}
          </div>
          <div class={s.mutedSmall}>{t('hero.stats.bonus')}</div>
        </section>

        <section class={s.panel}>
          <div class={s.panelHead}>
            <span>{t('hero.skills')}</span>
          </div>
          <div class={s.skills}>
            {hero.skills.map((skill, index) => {
              const levelValue = skillLevel(save, heroId, index);
              const price = skillCost(save, heroId, index);
              return (
                <div key={skill.id} class={s.skill}>
                  <div class={s.skillHead}>
                    <span class={s.skillKind}>{t(`skill.${skill.kind}`)}</span>
                    <span class={s.skillName}>{locale$.value === 'ru' ? skill.nameRu : skill.nameEn}</span>
                    <span class={s.skillLevel}>Lv {levelValue}/5</span>
                    {skill.cost > 0 ? <span class={s.skillCost}>{skill.cost}</span> : null}
                  </div>
                  <p class={s.skillText}>{locale$.value === 'ru' ? skill.descriptionRu : skill.descriptionEn}</p>
                  <div class={s.skillFoot}>
                    <span class={s.mutedSmall}>
                      {price
                        ? t('hero.skill.cost', { gold: price.gold, essence: price.essence })
                        : t('hero.skill.max')}
                    </span>
                    {price ? (
                      <button
                        class="btn btn--sm btn--ghost"
                        disabled={save.currencies.gold < price.gold || save.currencies.essence < price.essence}
                        onClick={() => upgradeHeroSkill(index)}
                      >
                        {t('hero.skill.upgrade')}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section class={s.panel}>
          <div class={s.panelHead}>
            <span>{t('hero.engravings')}</span>
            <div class={s.headActions}>
              <span class={s.mutedSmall}>{t('hero.engravings.slots', { n: activeEngravings })}</span>
              <button class="btn btn--sm" onClick={() => setMergeOpen(true)}>
                {t('hero.engravings.merge')}
              </button>
            </div>
          </div>
          <div class={s.hexRow}>
            {Array.from({ length: 6 }, (_, index) => {
              const id = owned.engravingSlots[index];
              const def = id ? ENGRAVINGS_BY_ID[id] : undefined;
              return (
                <button
                  key={index}
                  class={`${s.hexSlot}${def ? ` ${s.hexSlotFilled}` : ''}`}
                  data-grade={def?.grade}
                  onClick={() => setEngravingSlot(index)}
                  aria-label={t('hero.engravings.slotTitle', { n: index + 1 })}
                >
                  {def ? <span class={s.hexGrade}>{def.grade}</span> : <span class={s.hexPlus}>+</span>}
                </button>
              );
            })}
          </div>

          <div class={s.panelHead}>
            <span>{t('hero.engravings.setBonuses')}</span>
          </div>
          {engravingSummaries.length > 0 ? (
            <div class={s.setList}>
              {engravingSummaries.map((set) => (
                <div key={set.id} class={s.setRow}>
                  <div class={s.setHead}>
                    <span class={s.setName}>{set.name}</span>
                    <span class={s.setCount}>{set.count} / 6</span>
                  </div>
                  <div class={s.setTiers}>
                    {set.tiers.map((tier) => (
                      <span key={tier} class={s.setTier}>
                        {t(`set.engraving.${set.id}.${tier}`)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div class={s.mutedSmall}>{t('hero.engravings.noSetBonus')}</div>
          )}
        </section>

        <section class={s.panel}>
          <div class={s.panelHead}>
            <span>{t('hero.gear')}</span>
            <div class={s.headActions}>
              <button class="btn btn--sm" onClick={autoEquipGear}>
                {t('hero.gear.auto')}
              </button>
              <button class="btn btn--sm btn--ghost" onClick={() => setGearPresetsOpen(true)}>
                {t('hero.gear.presets')}
              </button>
            </div>
          </div>
          <div class={s.gearGrid}>
            {GEAR_SLOTS.map((item) => {
              const id = owned.gear?.[item.slot];
              const def = id ? GEAR_BY_ID[id] : undefined;
              return (
                <button
                  key={item.slot}
                  class={`${s.gearSlot}${def ? ` ${s.gearSlotFilled}` : ''}`}
                  onClick={() => setGearSlot(item.slot)}
                >
                  <Icon name="shield" size={16} />
                  <span class={s.gearBody}>
                    <span class={s.gearSlotLabel}>{t(item.label)}</span>
                    <span class={s.gearName}>
                      {def ? (locale$.value === 'ru' ? def.nameRu : def.nameEn) : t('hero.gear.none')}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {gearSummaries.length > 0 ? (
            <div class={s.setList}>
              {gearSummaries.map((set) => (
                <div key={set.id} class={s.setRow}>
                  <div class={s.setHead}>
                    <span class={s.setName}>{set.name}</span>
                    <span class={s.setCount}>{t('hero.gear.setCount', { n: set.count })}</span>
                  </div>
                  <div class={s.setTiers}>
                    {set.tiers.map((tier) => (
                      <span key={tier} class={s.setTier}>
                        {t(`set.gear.${set.id}.${tier}`)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div class={s.mutedSmall}>{t('hero.gear.noSet')}</div>
          )}
        </section>

        <section class={s.panel}>
          <div class={s.panelHead}>
            <span>{t('hero.artifact')}</span>
            {artifact ? <span class={s.mutedSmall}>{artifactLevel(save, heroId)} / 5</span> : null}
          </div>
          {artifact ? (
            <>
              <div class={s.artifactRow}>
                <span class={s.artifactName}>{locale$.value === 'ru' ? artifact.nameRu : artifact.nameEn}</span>
                <span class={s.mutedSmall}>{artifactBonusText(save, heroId) || t('hero.artifact.locked')}</span>
              </div>
              <p class={s.skillText}>{locale$.value === 'ru' ? artifact.descRu : artifact.descEn}</p>
              {artLevel === 0 ? (
                <button
                  class="btn btn--sm btn--gold"
                  disabled={starShards < artifactUnlock.shards || save.currencies.essence < artifactUnlock.essence}
                  onClick={awakenArtifact}
                >
                  {t('hero.artifact.unlock')} · {artifactUnlock.shards} ◆ · {artifactUnlock.essence} ✦
                </button>
              ) : artifactUpgrade ? (
                <button
                  class="btn btn--sm btn--gold"
                  disabled={
                    save.currencies.gold < artifactUpgrade.gold ||
                    save.currencies.essence < artifactUpgrade.essence
                  }
                  onClick={levelArtifact}
                >
                  {t('hero.artifact.upgrade')} · {artifactUpgrade.gold} · {artifactUpgrade.essence} ✦
                </button>
              ) : (
                <div class={s.mutedSmall}>{t('hero.artifact.max')}</div>
              )}
            </>
          ) : null}
        </section>

        <section class={s.panel}>
          <div class={s.panelHead}>
            <span>{t('hero.codex')}</span>
          </div>
          <p class={s.story}>{locale$.value === 'ru' ? hero.storyRu : hero.storyEn}</p>
          <div class={s.quotes}>
            <Quote label={t('hero.quote.battle')} text={hero.quotes.battle} />
            <Quote label={t('hero.quote.win')} text={hero.quotes.win} />
            <Quote label={t('hero.quote.shatter')} text={hero.quotes.shatter} />
          </div>
          <ul class={s.codexList}>
            {hero.codex.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </section>
      </div>

      <footer class={s.bottom}>
        <button
          class={`btn btn--ghost btn--sm ${s.resetBtn}`}
          disabled={!resetAvailable}
          onClick={() => setResetOpen(true)}
        >
          {t('hero.reset')}
        </button>
        <button class="btn btn--primary btn--wide" onClick={addToSquad} disabled={inSquad}>
          {inSquad ? t('hero.inSquad') : t('hero.addToSquad')}
        </button>
      </footer>

      {engravingSlot !== null ? (
        <Modal
          title={t('hero.engravings.slotTitle', { n: engravingSlot + 1 })}
          onClose={() => setEngravingSlot(null)}
        >
          {currentEngraving ? (
            <div class={s.currentBox}>
              <div class={s.currentHead}>
                <span class={s.itemName}>{locale$.value === 'ru' ? currentEngraving.nameRu : currentEngraving.nameEn}</span>
                <span class={s.gradeBadge} data-grade={currentEngraving.grade}>
                  {currentEngraving.grade}
                </span>
              </div>
              <div class={s.itemMeta}>
                {engravingStatText(currentEngraving.stat, currentEngraving.value)} ·{' '}
                {locale$.value === 'ru' ? ENGRAVING_SETS_BY_ID[currentEngraving.set]?.nameRu : ENGRAVING_SETS_BY_ID[currentEngraving.set]?.nameEn}
              </div>
              <button class="btn btn--ghost btn--wide" onClick={removeStone}>
                {t('hero.engravings.unequip')}
              </button>
            </div>
          ) : (
            <div class={s.currentBox}>
              <span class={s.currentLabel}>{t('hero.engravings.current')}</span>
              <span class={s.muted}>{t('hero.engravings.none')}</span>
            </div>
          )}

          <div class={s.panelHead}>
            <span>{t('hero.engravings.inventory')}</span>
            <span class={s.mutedSmall}>{save.inventory.engravings.length}</span>
          </div>

          {save.inventory.engravings.length === 0 ? (
            <div class={s.emptyState}>
              <span class={s.emptyTitle}>{t('hero.engravings.emptyTitle')}</span>
              <p class={s.emptyHint}>{t('hero.engravings.emptyHint')}</p>
            </div>
          ) : (
            <div class={s.list}>
              {save.inventory.engravings.map((id, index) => {
                const def = ENGRAVINGS_BY_ID[id];
                if (!def) return null;
                const set = ENGRAVING_SETS_BY_ID[def.set];
                return (
                  <div key={`${id}_${index}`} class={s.itemRow}>
                    <div class={s.itemInfo}>
                      <div class={s.itemNameRow}>
                        <span class={s.gradeBadge} data-grade={def.grade}>
                          {def.grade}
                        </span>
                        <span class={s.itemName}>{locale$.value === 'ru' ? def.nameRu : def.nameEn}</span>
                      </div>
                      <span class={s.itemMeta}>
                        {engravingStatText(def.stat, def.value)} · {locale$.value === 'ru' ? set?.nameRu : set?.nameEn}
                      </span>
                    </div>
                    <button class="btn btn--sm btn--primary" onClick={() => equipStone(id)}>
                      {t('hero.engravings.equip')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      ) : null}

      {gearSlot ? (
        <Modal
          title={t('hero.gear.slotTitle', { slot: t(GEAR_SLOTS.find((entry) => entry.slot === gearSlot)?.label ?? 'hero.gear') })}
          onClose={() => setGearSlot(null)}
        >
          {currentGear ? (
            <div class={s.currentBox}>
              <div class={s.currentHead}>
                <span class={s.itemName}>{locale$.value === 'ru' ? currentGear.nameRu : currentGear.nameEn}</span>
                <div class={s.itemBadges}>
                  {currentGearLevel > 0 ? (
                    <span class={s.levelBadge}>{t('hero.gear.level', { n: currentGearLevel })}</span>
                  ) : null}
                  <span class={s.rarityBadge} data-rarity={currentGear.rarity}>
                    {t(RARITY_LABEL[currentGear.rarity])}
                  </span>
                </div>
              </div>
              <div class={s.itemMeta}>{gearStatsText(currentGear, currentGearLevel)}</div>
              <div class={s.enhanceRow}>
                <span class={s.muted}>{t('hero.gear.dust', { n: save.currencies.dust })}</span>
                <button
                  class="btn btn--gold btn--sm"
                  disabled={currentGearCost <= 0 || save.currencies.dust < currentGearCost}
                  onClick={enhanceItem}
                >
                  {currentGearCost > 0
                    ? t('hero.gear.enhance', { n: currentGearCost })
                    : t('hero.gear.maxLevel')}
                </button>
              </div>
              <div class={s.mutedSmall}>{t('hero.gear.enhanceHint')}</div>
              <button class="btn btn--ghost btn--wide" onClick={removeItem}>
                {t('hero.gear.unequip')}
              </button>
            </div>
          ) : (
            <div class={s.currentBox}>
              <span class={s.currentLabel}>{t('hero.gear.current')}</span>
              <span class={s.muted}>{t('hero.gear.none')}</span>
            </div>
          )}

          <div class={s.panelHead}>
            <span>{t('hero.gear.inventory')}</span>
            <span class={s.mutedSmall}>{gearOptions.length}</span>
          </div>

          {gearOptions.length === 0 ? (
            <div class={s.emptyState}>
              <span class={s.emptyTitle}>
                {save.inventory.gear.length === 0 ? t('hero.gear.emptyTitle') : t('hero.gear.noItemsForSlot')}
              </span>
              <p class={s.emptyHint}>{t('hero.gear.emptyHint')}</p>
            </div>
          ) : (
            <div class={s.list}>
              {gearOptions.map((id, index) => {
                const def = GEAR_BY_ID[id];
                if (!def) return null;
                const level = gearLevel(save, id);
                return (
                  <div key={`${id}_${index}`} class={s.itemRow}>
                    <div class={s.itemInfo}>
                      <div class={s.itemNameRow}>
                        <span class={s.rarityBadge} data-rarity={def.rarity}>
                          {t(RARITY_LABEL[def.rarity])}
                        </span>
                        {level > 0 ? <span class={s.levelBadge}>{t('hero.gear.level', { n: level })}</span> : null}
                        <span class={s.itemName}>{locale$.value === 'ru' ? def.nameRu : def.nameEn}</span>
                      </div>
                      <span class={s.itemMeta}>{gearStatsText(def, level)}</span>
                    </div>
                    <button class="btn btn--sm btn--primary" onClick={() => equipItem(id)}>
                      {t('hero.gear.equip')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      ) : null}

      {mergeOpen ? (
        <Modal title={t('hero.engravings.mergeTitle')} onClose={() => setMergeOpen(false)}>
          <p class={s.emptyHint}>{t('hero.engravings.mergeHint')}</p>

          <div class={s.gradeTabs}>
            {ENGRAVING_GRADES.map((grade) => (
              <button
                key={grade}
                class={`${s.gradeTab}${mergeGrade === grade ? ` ${s.gradeTabActive}` : ''}`}
                data-grade={grade}
                onClick={() => {
                  setMergeGrade(grade);
                  setMergeTimes(1);
                }}
              >
                <span>{grade}</span>
                <span class={s.gradeCount}>{gradeCounts[grade]}</span>
              </button>
            ))}
          </div>

          {mergeGrade === 'SS' ? (
            <div class={s.muted}>{t('hero.engravings.mergeMax')}</div>
          ) : maxMergeTimes === 0 ? (
            <div class={s.emptyState}>
              <span class={s.emptyTitle}>{t('hero.engravings.mergeNone')}</span>
              <p class={s.emptyHint}>{t('hero.engravings.emptyHint')}</p>
            </div>
          ) : (
            <>
              <div class={s.mergeRow}>
                <span class={s.muted}>{t('hero.engravings.mergeCount')}</span>
                <div class={s.stepper}>
                  <button
                    class={s.stepperBtn}
                    disabled={mergeBatch <= 1}
                    onClick={() => setMergeTimes(Math.max(1, mergeBatch - 1))}
                  >
                    −
                  </button>
                  <span class={s.stepperValue}>{mergeBatch}</span>
                  <button
                    class={s.stepperBtn}
                    disabled={mergeBatch >= maxMergeTimes}
                    onClick={() => setMergeTimes(Math.min(maxMergeTimes, mergeBatch + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
              <div class={s.mergePreview}>
                <span>
                  {mergeBatch * 3} × {mergeGrade}
                </span>
                <span>→</span>
                <span>
                  {mergeBatch} × {ENGRAVING_GRADES[ENGRAVING_GRADES.indexOf(mergeGrade) + 1] ?? 'SS'}
                </span>
              </div>
              <button class="btn btn--primary btn--wide" onClick={doMerge}>
                {t('hero.engravings.mergeAction', { n: mergeBatch })}
              </button>
            </>
          )}
        </Modal>
      ) : null}

      {gearPresetsOpen ? (
        <Modal title={t('hero.gear.presets')} onClose={() => setGearPresetsOpen(false)}>
          <div class={s.setList}>
            {[0, 1, 2].map((slot) => {
              const preset = gearPreset(save, heroId, slot);
              const names = GEAR_SLOTS.map((item) => {
                const id = preset?.[item.slot];
                const def = id ? GEAR_BY_ID[id] : undefined;
                return def ? (locale$.value === 'ru' ? def.nameRu : def.nameEn) : null;
              }).filter((name): name is string => Boolean(name));

              return (
                <div key={slot} class={s.setRow}>
                  <div class={s.setHead}>
                    <span class={s.setName}>{t('hero.gear.preset', { n: slot + 1 })}</span>
                  </div>
                  <div class={s.mutedSmall}>
                    {names.length > 0 ? names.join(' · ') : t('hero.gear.none')}
                  </div>
                  <div class={s.headActions}>
                    <button class="btn btn--sm btn--ghost" onClick={() => saveGearPresetSlot(slot)}>
                      {t('hero.gear.presetSave')}
                    </button>
                    <button class="btn btn--sm" disabled={!preset} onClick={() => loadGearPresetSlot(slot)}>
                      {t('hero.gear.presetLoad')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p class="muted">{t('hero.gear.presetHint')}</p>
          <button class="btn btn--wide" onClick={() => setGearPresetsOpen(false)}>
            {t('common.close')}
          </button>
        </Modal>
      ) : null}

      {resetOpen ? (
        <Modal title={t('hero.reset')} onClose={() => setResetOpen(false)}>
          <p class="muted">{t('hero.reset.hint')}</p>
          <div class={s.setList}>
            <div class={s.setRow}>
              <div class={s.setHead}>
                <span class={s.setName}>{t('hero.reset.back')}</span>
              </div>
              <div class={s.mutedSmall}>
                +{formatNumber(refund.gold, locale$.value)} {t('resource.gold')} · +
                {formatNumber(refund.essence, locale$.value)} {t('resource.essence')} · +{refund.shards}{' '}
                {t('battle.shards')}
              </div>
            </div>
          </div>
          <div class={s.rowActions}>
            <button class="btn btn--ghost" onClick={() => setResetOpen(false)}>
              {t('common.cancel')}
            </button>
            <button class="btn btn--danger" onClick={confirmReset}>
              {t('hero.reset.confirm')}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Quote({ label, text }: { label: string; text: string }) {
  return (
    <div class={s.quote}>
      <span class={s.quoteLabel}>{label}</span>
      <span class={s.quoteText}>«{text}»</span>
    </div>
  );
}
