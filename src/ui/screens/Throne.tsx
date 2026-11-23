import { useEffect } from 'preact/hooks';
import { asset } from '../../core/asset';
import { playSfx } from '../../core/audio';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { formatNumber } from '../../core/time';
import {
  BASE_TRIAL_ATTEMPTS,
  BUILDINGS,
  EXCHANGE_OFFERS,
  MASTER_LEVEL_MAX,
  type BuildingDef,
  type ExchangeCurrency,
} from '../../data/base';
import {
  canClaimMasterReward,
  canExchange,
  canUpgradeBuilding,
  claimMasterReward,
  claimableMasterLevels,
  ensureBase,
  ensureExchangeDay,
  exchangeLeft,
  exchangeResource,
  masterLevel,
  masterRewardOf,
  masterXp,
  masterXpNeeded,
  nextBuildingCost,
  upgradeBuilding,
} from '../../game/base';
import { commit, save$ } from '../../game/state';
import { Icon, type IconName } from '../components/Icon';
import { toast } from '../components/toast';
import s from './Throne.module.css';

const BUILDING_ICONS: Record<string, IconName> = {
  altar: 'altar',
  barracks: 'shield',
  dining: 'bowl',
  training: 'swords',
  archive: 'book',
};

const RESOURCE_KEYS: Record<ExchangeCurrency, string> = {
  gold: 'resource.gold',
  crystals: 'resource.crystals',
  essence: 'resource.essence',
  dust: 'resource.dust',
};

function effectText(building: BuildingDef, level: number): string {
  const value = building.perLevel * (level - 1);
  if (building.effect === 'trial') return t('throne.effect.trial', { n: BASE_TRIAL_ATTEMPTS + value });
  return t(`throne.effect.${building.effect}`, { n: Math.round(value * 100) });
}

function costLabel(cost: NonNullable<ReturnType<typeof nextBuildingCost>>): string {
  const parts: string[] = [];
  if (cost.gold) parts.push(`${formatNumber(cost.gold, locale$.value)} ${t('resource.gold')}`);
  if (cost.crystals) parts.push(`${formatNumber(cost.crystals, locale$.value)} ${t('resource.crystals')}`);
  if (cost.essence) parts.push(`${formatNumber(cost.essence, locale$.value)} ${t('resource.essence')}`);
  if (cost.dust) parts.push(`${formatNumber(cost.dust, locale$.value)} ${t('resource.dust')}`);
  return parts.join(' · ');
}

export function Throne() {
  const save = save$.value;
  const level = masterLevel(save);
  const xp = masterXp(save);
  const need = masterXpNeeded(save);
  const percent = level >= MASTER_LEVEL_MAX ? 100 : Math.min(100, Math.round((xp / need) * 100));
  const claimable = claimableMasterLevels(save);

  useEffect(() => {
    commit((draft) => {
      ensureBase(draft);
      ensureExchangeDay(draft);
    }, 'throne-open');
  }, []);

  const upgrade = (id: BuildingDef['id']) => {
    let result: ReturnType<typeof upgradeBuilding> | undefined;
    commit((draft) => {
      result = upgradeBuilding(draft, id);
    }, 'building-upgrade');
    if (!result) {
      toast(t('throne.upgradeFail'), 'error');
      return;
    }
    playSfx('coin');
    const def = BUILDINGS.find((building) => building.id === id);
    toast(t('throne.upgraded', { name: def ? t(def.nameKey) : id, n: result.level }), 'success');
  };

  const claim = (levelToClaim: number) => {
    let reward: ReturnType<typeof claimMasterReward> | undefined;
    commit((draft) => {
      reward = claimMasterReward(draft, levelToClaim);
    }, 'master-reward');
    if (!reward) return;
    playSfx('coin');
    toast(t('throne.rewardClaimed'), 'success');
  };

  const exchange = (offerId: string) => {
    let result: ReturnType<typeof exchangeResource> | undefined;
    commit((draft) => {
      result = exchangeResource(draft, offerId);
    }, 'resource-exchange');
    if (!result) {
      toast(t('throne.exchangeFail'), 'error');
      return;
    }
    playSfx('coin');
    toast(t('throne.exchangeDone'), 'success');
  };

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/lobby-tower.webp')})` }} />
      <div class={s.scrim} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('lobby')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.heading}>
          <span class={s.title}>{t('throne.title')}</span>
          <span class={s.sub}>{t('throne.masterLevel', { n: level })}</span>
        </div>
      </header>

      <div class={s.scroll}>
        <section class={s.card}>
          <div class={s.masterHead}>
            <span class={s.masterBadge}>{level}</span>
            <div class={s.masterMeta}>
              <b>{t('throne.masterLevel', { n: level })}</b>
              <span>
                {level >= MASTER_LEVEL_MAX
                  ? t('throne.maxLevel')
                  : t('throne.xp', { xp: formatNumber(xp, locale$.value), next: formatNumber(need, locale$.value) })}
              </span>
            </div>
          </div>
          <div class={s.xpBar} aria-hidden="true">
            <div class={s.xpFill} style={{ width: `${percent}%` }} />
          </div>

          {claimable.length > 0 ? (
            <div class={s.rewards}>
              <span class={s.sectionLabel}>{t('throne.rewards')}</span>
              {claimable.map((rewardLevel) => {
                const reward = masterRewardOf(rewardLevel);
                return (
                  <button
                    key={rewardLevel}
                    class={s.rewardRow}
                    disabled={!canClaimMasterReward(save, rewardLevel)}
                    onClick={() => claim(rewardLevel)}
                  >
                    <span>
                      {t('throne.rewardLine', {
                        level: rewardLevel,
                        crystals: reward.crystals,
                        gold: formatNumber(reward.gold, locale$.value),
                        essence: reward.essence,
                      })}
                    </span>
                    <b>{t('throne.claim')}</b>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>

        <div class={s.sectionRow}>
          <span class={s.sectionTitle}>{t('throne.buildings')}</span>
        </div>

        {BUILDINGS.map((building) => {
          const currentLevel = save.base.buildings[building.id] ?? 1;
          const cost = nextBuildingCost(save, building.id);
          return (
            <section key={building.id} class={s.building}>
              <div class={s.buildingHead}>
                <span class={s.buildingIcon}>
                  <Icon name={BUILDING_ICONS[building.id] ?? 'altar'} size={18} />
                </span>
                <div class={s.buildingMeta}>
                  <b>{t(building.nameKey)}</b>
                  <span>{t(building.descKey)}</span>
                </div>
                <span class={s.badge}>{t('throne.level', { n: currentLevel })}</span>
              </div>
              <div class={s.effect}>{effectText(building, currentLevel)}</div>

              {cost ? (
                <div class={s.upgradeRow}>
                  <span class={s.cost}>
                    {t('throne.cost')}: {costLabel(cost)}
                  </span>
                  <button
                    class="btn btn--sm btn--gold"
                    disabled={!canUpgradeBuilding(save, building.id)}
                    onClick={() => upgrade(building.id)}
                  >
                    {t('throne.upgrade')}
                  </button>
                </div>
              ) : (
                <div class={s.max}>{t('throne.max')}</div>
              )}
            </section>
          );
        })}

        <section class={s.card}>
          <div class={s.cardHead}>
            <span class={s.cardTitle}>{t('throne.exchange')}</span>
          </div>
          <p class={s.desc}>{t('throne.exchangeHint')}</p>
          <div class={s.exchanges}>
            {EXCHANGE_OFFERS.map((offer) => {
              const left = exchangeLeft(save, offer.id);
              return (
                <div key={offer.id} class={s.exchangeRow}>
                  <div class={s.exchangeInfo}>
                    <b>
                      {formatNumber(offer.cost.amount, locale$.value)} {t(RESOURCE_KEYS[offer.cost.currency])}
                    </b>
                    <span class={s.arrow}>→</span>
                    <b>
                      {formatNumber(offer.give.amount, locale$.value)} {t(RESOURCE_KEYS[offer.give.currency])}
                    </b>
                    <span class={s.left}>{t('throne.exchangeLeft', { n: left })}</span>
                  </div>
                  <button
                    class="btn btn--sm btn--ghost"
                    disabled={!canExchange(save, offer.id)}
                    onClick={() => exchange(offer.id)}
                  >
                    {t('throne.exchangeAction')}
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
