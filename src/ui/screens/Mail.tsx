import { useEffect } from 'preact/hooks';
import { asset } from '../../core/asset';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { claimAllMail, claimMail, ensureMail } from '../../game/mail';
import { commit, save$ } from '../../game/state';
import { Icon } from '../components/Icon';
import { toast } from '../components/toast';
import { rewardLines } from '../reward';
import s from './Mail.module.css';

export function Mail() {
  const save = save$.value;

  useEffect(() => {
    commit((draft) => {
      ensureMail(draft);
    }, 'mail-ensure');
  }, []);

  const unread = save.live.mail.filter((mail) => !mail.claimed).length;

  const claim = (id: string) => {
    let reward: ReturnType<typeof claimMail> | undefined;
    commit((draft) => {
      reward = claimMail(draft, id);
    }, 'mail-claim');
    if (reward) toast(rewardLines(reward).join(' · '), 'success');
  };

  const claimAll = () => {
    let count = 0;
    commit((draft) => {
      count = claimAllMail(draft);
    }, 'mail-claim-all');
    if (count > 0) toast(t('mail.claimedAll', { n: count }), 'success');
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
          <span class={s.title}>{t('mail.title')}</span>
          <span class={s.sub}>{t('mail.unread', { n: unread })}</span>
        </div>
        <button class="btn btn--sm btn--gold" disabled={unread === 0} onClick={claimAll}>
          {t('mail.claimAll')}
        </button>
      </header>

      <div class={s.scroll}>
        {save.live.mail.length === 0 ? <p class={s.empty}>{t('mail.empty')}</p> : null}
        {save.live.mail
          .slice()
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((mail) => (
            <div key={mail.id} class={`${s.card}${mail.claimed ? ` ${s.cardDone}` : ''}`}>
              <div class={s.cardHead}>
                <b>{t(`${mail.key}.subject`)}</b>
                <span>{new Date(mail.expiresAt).toLocaleDateString(locale$.value === 'en' ? 'en-US' : 'ru-RU')}</span>
              </div>
              <p class={s.body}>{t(`${mail.key}.body`)}</p>
              <div class={s.foot}>
                <span class={s.reward}>{rewardLines(mail.rewards).join(' · ')}</span>
                <button class="btn btn--sm" disabled={mail.claimed} onClick={() => claim(mail.id)}>
                  {mail.claimed ? t('mail.claimed') : t('mail.claim')}
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
