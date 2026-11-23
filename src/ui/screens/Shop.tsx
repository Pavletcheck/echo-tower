import { useEffect, useState } from 'preact/hooks';
import { asset } from '../../core/asset';
import { playSfx } from '../../core/audio';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { formatNumber } from '../../core/time';
import { IAP_ITEMS, SHOP_ITEMS } from '../../data/shop';
import { heroName } from '../../data/heroes';
import { claimPassGift, passGiftChosen, passGiftHeroes } from '../../game/pass-gift';
import type { IapItemDef, ShopItemDef } from '../../data/types';
import { platform } from '../../platform';
import {
  boughtFor,
  buyItem,
  canWatchAd,
  ensureShopDay,
  grantAdCrystals,
  grantIap,
  shopGearPreview,
} from '../../game/shop';
import { commit, save$ } from '../../game/state';
import { trackQuest } from '../../game/quests';
import { liveTab$ } from '../nav';
import { HeroAvatar } from '../components/HeroAvatar';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { toast } from '../components/toast';
import s from './Shop.module.css';

type ShopTab = 'daily' | 'arena' | 'crystals' | 'pass';

const TABS: ReadonlyArray<{ id: ShopTab; label: string }> = [
  { id: 'daily', label: 'shop.tab.daily' },
  { id: 'arena', label: 'shop.tab.arena' },
  { id: 'crystals', label: 'shop.tab.crystals' },
  { id: 'pass', label: 'shop.tab.pass' },
];

function currencyLabel(currency: ShopItemDef['currency']): string {
  if (currency === 'gold') return t('resource.gold');
  if (currency === 'crystals') return t('resource.crystals');
  return t('resource.arena');
}

export function Shop() {
  const [tab, setTab] = useState<ShopTab>('daily');
  const [buying, setBuying] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Record<string, string>>({});
  const [giftOpen, setGiftOpen] = useState(false);
  const save = save$.value;

  let paymentsAvailable = false;
  let platformId = 'mock';
  try {
    const sdk = platform();
    paymentsAvailable = sdk.payments.available;
    platformId = sdk.id;
  } catch {
    paymentsAvailable = false;
  }

  const items = SHOP_ITEMS.filter((item) => item.slot === tab);
  const pass = IAP_ITEMS.find((item) => item.sku === 'pass_echo');
  const adsLeft = Math.max(0, 5 - save.shop.adsToday);

  useEffect(() => {
    commit((draft) => {
      ensureShopDay(draft);
    }, 'shop-day');
  }, []);

  const purchase = (item: ShopItemDef) => {
    let ok = false;
    commit((draft) => {
      ensureShopDay(draft);
      ok = buyItem(draft, item.id);
      if (ok && item.currency === 'gold') trackQuest(draft, 'spendGold', item.price);
    }, 'shop-buy');
    if (ok) playSfx('coin');
    toast(ok ? t('shop.purchaseSuccess') : t('shop.insufficient'), ok ? 'success' : 'error');
  };

  const chooseGift = (heroId: string) => {
    let ok = false;
    commit((draft) => {
      ok = claimPassGift(draft, heroId);
    }, 'pass-gift');
    if (!ok) return;
    playSfx('starUp');
    toast(t('shop.passGift.done', { name: heroName(heroId, locale$.value) }), 'success');
    setGiftOpen(false);
  };

  const watchAd = async () => {
    if (!canWatchAd(save$.value)) {
      toast(t('shop.adLimit'), 'error');
      return;
    }
    const result = await platform().ads.rewarded('shop_crystals');
    if (result === 'rewarded') {
      commit((draft) => {
        grantAdCrystals(draft);
      }, 'shop-ad');
      toast(t('shop.rewarded'), 'success');
    }
  };

  const buyIap = async (item: IapItemDef) => {
    if (save.flags[`iap_${item.sku}`]) {
      toast(t('shop.owned'), 'info');
      return;
    }
    setBuying(item.sku);
    try {
      const result = await platform().payments.buy(item.sku);
      if (result === 'success') {
        let granted = false;
        commit((draft) => {
          granted = grantIap(draft, item);
        }, 'iap');
        toast(granted ? t('shop.purchaseSuccess') : t('shop.owned'), granted ? 'success' : 'info');
      } else {
        toast(t('shop.purchaseFailed'), 'error');
      }
    } catch {
      toast(t('shop.purchaseFailed'), 'error');
    } finally {
      setBuying(null);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const list = await platform().payments.catalog?.();
        if (!list || list.length === 0) return;
        setCatalog(Object.fromEntries(list.map((product) => [product.sku, product.price])));
      } catch {
        /* площадка без каталога — останутся рублёвые цены из данных */
      }
    })();
  }, []);

  const priceLabel = (item: IapItemDef): string => {
    if (platformId === 'telegram') return `${item.priceStars} ★`;
    const fromPlatform = catalog[item.sku];
    if (fromPlatform) return fromPlatform;
    return `${item.priceRub.toLocaleString('ru-RU')} ₽`;
  };

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/forge.webp')})` }} />
      <div class={s.scrim} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('lobby')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.heading}>
          <span class={s.title}>{t('shop.title')}</span>
          <span class={s.sub}>
            {formatNumber(save.currencies.gold, locale$.value)} ·{' '}
            {formatNumber(save.currencies.crystals, locale$.value)}
          </span>
        </div>
      </header>

      <div class={s.tabs}>
        {TABS.map((item) => (
          <button
            key={item.id}
            class={`${s.tab}${tab === item.id ? ` ${s.tabActive}` : ''}`}
            onClick={() => setTab(item.id)}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      <div class={s.scroll}>
        {tab === 'daily' ? (
          <button class={s.adCard} onClick={watchAd} disabled={adsLeft <= 0}>
            <Icon name="gift" size={18} />
            <span>{adsLeft > 0 ? t('shop.rewarded') : t('shop.adLimit')}</span>
            <span class={s.adCount}>{adsLeft}/5</span>
          </button>
        ) : null}

        {items.map((item) => {
          const bought = boughtFor(save, item) >= 1;
          const gearPreview = bought ? null : shopGearPreview(save, item.id);
          return (
            <div key={item.id} class={s.card}>
              <div class={s.cardInfo}>
                <span class={s.cardName}>{locale$.value === 'ru' ? item.nameRu : item.nameEn}</span>
                <span class={s.cardMeta}>
                  {gearPreview
                    ? `${locale$.value === 'ru' ? gearPreview.nameRu : gearPreview.nameEn} · `
                    : ''}
                  {item.amount > 1 ? `×${item.amount} · ` : ''}
                  {currencyLabel(item.currency)}
                  {item.limit !== 'none' ? ` · ${t('shop.limit')}` : ''}
                </span>
              </div>
              <div class={s.cardBuy}>
                <span class={s.price}>{formatNumber(item.price, locale$.value)}</span>
                <button class="btn btn--sm" disabled={bought} onClick={() => purchase(item)}>
                  {bought ? t('shop.bought') : t('shop.buy')}
                </button>
              </div>
            </div>
          );
        })}

        {tab !== 'pass' && items.length === 0 ? <p class={s.empty}>{t('common.comingSoon')}</p> : null}

        {tab === 'crystals' && paymentsAvailable ? (
          <div class={s.iapBlock}>
            <div class={s.sectionLabel}>{t('shop.tab.crystals')}</div>
            {IAP_ITEMS.filter((item) => item.sku !== 'pass_echo').map((item) => {
              const owned = Boolean(save.flags[`iap_${item.sku}`]);
              return (
                <div key={item.sku} class={s.card}>
                  <div class={s.cardInfo}>
                    <span class={s.cardName}>{locale$.value === 'ru' ? item.nameRu : item.nameEn}</span>
                    <span class={s.cardMeta}>{locale$.value === 'ru' ? item.contentsRu : item.contentsEn}</span>
                  </div>
                  <div class={s.cardBuy}>
                    <span class={s.price}>{priceLabel(item)}</span>
                    <button
                      class={`btn btn--sm ${owned ? 'btn--ghost' : 'btn--gold'}`}
                      disabled={owned || buying === item.sku}
                      onClick={() => buyIap(item)}
                    >
                      {owned ? t('shop.owned') : t('shop.buy')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {tab === 'pass' ? (
          <div class={s.passCard}>
            <div class={s.passTitle}>{pass ? (locale$.value === 'ru' ? pass.nameRu : pass.nameEn) : 'Echo Pass'}</div>
            <p class={s.passText}>{t('shop.passDesc')}</p>
            {save.flags.pass ? (
              <div class={s.passGift}>
                <span class={s.passGiftLabel}>{t('shop.passGift.title')}</span>
                {passGiftChosen(save) ? (
                  <span class={s.passGiftValue}>
                    {t('shop.passGift.chosen', { name: heroName(passGiftChosen(save) ?? '', locale$.value) })}
                  </span>
                ) : (
                  <button class="btn btn--sm btn--gold" onClick={() => setGiftOpen(true)}>
                    {t('shop.passGift.pick')}
                  </button>
                )}
              </div>
            ) : null}
            {paymentsAvailable && pass ? (
              <button
                class="btn btn--gold btn--wide"
                disabled={buying === pass.sku || Boolean(save.flags.pass)}
                onClick={() => buyIap(pass)}
              >
                {save.flags.pass ? t('shop.owned') : `${t('shop.buy')} · ${priceLabel(pass)}`}
              </button>
            ) : (
              <p class={s.empty}>{paymentsAvailable ? t('shop.owned') : t('shop.iapUnavailable')}</p>
            )}
            <button
              class="btn btn--primary btn--wide"
              onClick={() => {
                liveTab$.value = 'pass';
                navigate('live');
              }}
            >
              {t('live.pass.open')}
            </button>
          </div>
        ) : null}

        {!paymentsAvailable ? <p class={s.note}>{t('shop.iapUnavailable')}</p> : null}
      </div>

      {giftOpen ? (
        <Modal title={t('shop.passGift.title')} onClose={() => setGiftOpen(false)}>
          <p class="muted">{t('shop.passGift.hint')}</p>
          <div class={s.giftGrid}>
            {passGiftHeroes().map((heroId) => (
              <button key={heroId} class={s.giftCard} onClick={() => chooseGift(heroId)}>
                <HeroAvatar heroId={heroId} size={54} star={5} />
                <span class={s.giftName}>{heroName(heroId, locale$.value)}</span>
                {save.heroes[heroId] ? <span class={s.giftOwned}>{t('shop.passGift.owned')}</span> : null}
              </button>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
