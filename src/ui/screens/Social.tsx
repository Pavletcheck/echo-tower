import { useEffect, useState } from 'preact/hooks';
import { asset } from '../../core/asset';
import { playSfx } from '../../core/audio';
import { locale$, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { formatNumber } from '../../core/time';
import { HEROES_BY_ID } from '../../data/heroes';
import { GUILD_MILESTONES } from '../../data/social';
import {
  claimGuildMilestone,
  fightGuildBoss,
  guildCandidates,
  joinGuild,
  leaveGuild,
} from '../../game/guild';
import {
  canHireMercenary,
  dismissMercenary,
  hireMercenary,
  mercenaryCap,
} from '../../game/mercenary';
import { ensureSocial } from '../../game/social';
import { commit, save$ } from '../../game/state';
import { socialAPI, type SocialFriendBlockReason, type SocialSnapshot } from '../../social';
import { HeroAvatar } from '../components/HeroAvatar';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { toast } from '../components/toast';
import s from './Social.module.css';

type Tab = 'guild' | 'friends';

function heroLabel(heroId: string): string {
  const hero = HEROES_BY_ID[heroId];
  if (!hero) return heroId;
  return locale$.value === 'ru' ? hero.nameRu : hero.nameEn;
}

function blockReasonKey(reason: SocialFriendBlockReason): string | null {
  if (reason === 'owned') return 'social.friends.owned';
  if (reason === 'squad') return 'social.friends.inSquad';
  if (reason === 'limit') return 'social.friends.limit';
  return null;
}

export function Social() {
  const [tab, setTab] = useState<Tab>('guild');
  const [snapshot, setSnapshot] = useState<SocialSnapshot | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const save = save$.value;

  useEffect(() => {
    commit((draft) => {
      ensureSocial(draft);
    }, 'social-init');
  }, []);

  useEffect(() => {
    let alive = true;
    void socialAPI()
      .snapshot(save)
      .then((next) => {
        if (alive) setSnapshot(next);
      });
    return () => {
      alive = false;
    };
  }, [save]);

  const join = (guildId: string) => {
    let ok = false;
    commit((draft) => {
      ok = joinGuild(draft, guildId);
    }, 'guild-join');
    toast(ok ? t('social.guild.joined') : t('common.later'), ok ? 'success' : 'error');
  };

  const leave = () => {
    let ok = false;
    commit((draft) => {
      ok = leaveGuild(draft);
    }, 'guild-leave');
    setLeaveOpen(false);
    if (ok) toast(t('social.guild.left'), 'success');
  };

  const strike = () => {
    let outcome: ReturnType<typeof fightGuildBoss> | undefined;
    commit((draft) => {
      outcome = fightGuildBoss(draft, Date.now());
    }, 'guild-boss');
    if (!outcome) {
      toast(t('social.guild.noAttempts'), 'error');
      return;
    }
    playSfx(outcome.result.outcome === 'win' ? 'coin' : 'hit');
    toast(
      t('social.guild.bossResult', {
        n: formatNumber(outcome.damage, locale$.value),
        total: formatNumber(outcome.total, locale$.value),
      }),
      'success',
    );
  };

  const claim = (milestoneId: string) => {
    let reward: ReturnType<typeof claimGuildMilestone> | undefined;
    commit((draft) => {
      reward = claimGuildMilestone(draft, milestoneId);
    }, 'guild-claim');
    if (reward) {
      playSfx('coin');
      toast(
        t('social.guild.milestoneClaimed', {
          crystals: reward.crystals,
          tokens: reward.tokens,
        }),
        'success',
      );
    }
  };

  const hire = (friendId: string, friendName: string) => {
    let ok = false;
    commit((draft) => {
      ok = hireMercenary(draft, friendId);
    }, 'mercenary-hire');
    toast(ok ? t('social.friends.hiredToast', { name: friendName }) : t('common.later'), ok ? 'success' : 'error');
  };

  const dismiss = () => {
    let ok = false;
    commit((draft) => {
      ok = dismissMercenary(draft);
    }, 'mercenary-dismiss');
    if (ok) toast(t('social.friends.dismissed'), 'success');
  };

  const guild = snapshot?.guild ?? null;
  const totalDamage = guild?.totalDamage ?? 0;
  const playerDamage = guild?.playerDamage ?? 0;
  const cap = mercenaryCap(save);
  const contribution = guild?.members ?? [];

  return (
    <div class={s.root}>
      <div class={s.bg} style={{ backgroundImage: `url(${asset('assets/bg/barracks.webp')})` }} />
      <div class={s.scrim} />

      <header class={s.top}>
        <button class={s.iconBtn} onClick={() => navigate('lobby')} aria-label={t('common.back')}>
          <Icon name="back" size={20} />
        </button>
        <div class={s.heading}>
          <span class={s.title}>{t('social.title')}</span>
          <span class={s.sub}>{t('social.desc')}</span>
        </div>
      </header>

      <div class={s.tabs}>
        <button
          class={`${s.tab}${tab === 'guild' ? ` ${s.tabActive}` : ''}`}
          onClick={() => setTab('guild')}
        >
          {t('social.tab.guild')}
        </button>
        <button
          class={`${s.tab}${tab === 'friends' ? ` ${s.tabActive}` : ''}`}
          onClick={() => setTab('friends')}
        >
          {t('social.tab.friends')}
        </button>
      </div>

      <div class={s.scroll}>
        {tab === 'guild' ? (
          guild ? (
            <>
              <section class={s.card}>
                <div class={s.cardHead}>
                  <span class={s.cardTitle}>{guild.nameRu ? (locale$.value === 'ru' ? guild.nameRu : guild.nameEn) : ''}</span>
                  <span class={s.badge}>{t('social.guild.members', { n: guild.members.length })}</span>
                </div>
                <p class={s.desc}>{locale$.value === 'ru' ? guild.mottoRu : guild.mottoEn}</p>
                <div class={s.stats}>
                  <span>{t('social.guild.week', { week: guild.week })}</span>
                  <span>{t('social.guild.totalDamage', { n: formatNumber(totalDamage, locale$.value) })}</span>
                  <span>{t('social.guild.yourDamage', { n: formatNumber(playerDamage, locale$.value) })}</span>
                </div>
                <button class="btn btn--sm btn--ghost" onClick={() => setLeaveOpen(true)}>
                  {t('social.guild.leave')}
                </button>
              </section>

              <section class={s.card}>
                <div class={s.cardHead}>
                  <span class={s.cardTitle}>{t('social.guild.boss')}</span>
                  <span class={s.badge}>{t('social.guild.attempts', { n: guild.attemptsLeft })}</span>
                </div>
                <p class={s.desc}>{t('social.guild.bossDesc')}</p>
                <button
                  class="btn btn--primary btn--wide"
                  disabled={guild.attemptsLeft <= 0}
                  onClick={strike}
                >
                  {t('social.guild.fight')}
                </button>
              </section>

              <section class={s.card}>
                <div class={s.cardHead}>
                  <span class={s.cardTitle}>{t('social.guild.milestones')}</span>
                </div>
                <div class={s.milestones}>
                  {GUILD_MILESTONES.map((milestone) => {
                    const claimed = guild.claimed.includes(milestone.id);
                    const claimable = !claimed && totalDamage >= milestone.damage;
                    return (
                      <button
                        key={milestone.id}
                        class={`${s.milestone}${claimed ? ` ${s.milestoneDone}` : ''}`}
                        disabled={claimed || !claimable}
                        onClick={() => claim(milestone.id)}
                      >
                        <span>{t('social.guild.milestone', { n: formatNumber(milestone.damage, locale$.value) })}</span>
                        <span class={s.milestoneReward}>
                          {claimed
                            ? t('social.guild.claimed')
                            : t('social.guild.milestoneClaimed', {
                                crystals: milestone.crystals,
                                tokens: milestone.tokens,
                              })}
                        </span>
                        {!claimed ? <b>{t('social.guild.claim')}</b> : null}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section class={s.card}>
                <div class={s.cardHead}>
                  <span class={s.cardTitle}>{t('social.guild.contribution')}</span>
                </div>
                <div class={s.board}>
                  {contribution.map((member, index) => (
                    <div key={member.id} class={`${s.boardRow}${member.you ? ` ${s.boardYou}` : ''}`}>
                      <span class={s.rank}>{t('social.guild.rank', { n: index + 1 })}</span>
                      <span class={s.boardName}>
                        {member.you ? t('social.guild.you') : member.name}
                      </span>
                      <span class={s.gold}>{formatNumber(member.damage, locale$.value)}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section class={s.card}>
              <div class={s.cardHead}>
                <span class={s.cardTitle}>{t('social.guild.none')}</span>
              </div>
              <p class={s.desc}>{t('social.guild.noneHint')}</p>
              <div class={s.candidates}>
                {guildCandidates().map((candidate) => (
                  <div key={candidate.id} class={s.candidate}>
                    <div class={s.candidateInfo}>
                      <b>{locale$.value === 'ru' ? candidate.nameRu : candidate.nameEn}</b>
                      <span>{locale$.value === 'ru' ? candidate.mottoRu : candidate.mottoEn}</span>
                    </div>
                    <button class="btn btn--sm btn--primary" onClick={() => join(candidate.id)}>
                      {t('social.guild.join')}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )
        ) : (
          <>
            <section class={s.card}>
              <div class={s.cardHead}>
                <span class={s.cardTitle}>{t('social.friends.mercenary')}</span>
                <span class={s.badge}>{t('social.friends.cap', { n: formatNumber(cap, locale$.value) })}</span>
              </div>
              <p class={s.desc}>{t('social.friends.hint')}</p>

              {snapshot?.friends.mercenary ? (
                <div class={s.mercenary}>
                  <HeroAvatar
                    heroId={snapshot.friends.mercenary.heroId}
                    size={46}
                    star={snapshot.friends.mercenary.star}
                  />
                  <div class={s.mercenaryInfo}>
                    <b>{heroLabel(snapshot.friends.mercenary.heroId)}</b>
                    <span>
                      {snapshot.friends.mercenary.friendName} ·{' '}
                      {t('social.friends.level', { n: snapshot.friends.mercenary.level })} ·{' '}
                      {t('social.friends.power', {
                        n: formatNumber(snapshot.friends.mercenary.power, locale$.value),
                      })}
                    </span>
                    <span class={s.echo}>{t('social.friends.extraSlot')}</span>
                  </div>
                  <button class="btn btn--sm btn--ghost" onClick={dismiss}>
                    {t('social.friends.dismiss')}
                  </button>
                </div>
              ) : (
                <div class={s.empty}>{t('social.friends.none')}</div>
              )}
            </section>

            <section class={s.card}>
              <div class={s.cardHead}>
                <span class={s.cardTitle}>{t('social.tab.friends')}</span>
              </div>
              {snapshot && snapshot.friends.list.length > 0 ? (
                <div class={s.friends}>
                  {snapshot.friends.list.map((entry) => {
                    const reasonKey = blockReasonKey(entry.reason);
                    const hireable = canHireMercenary(save, entry.friend.id);
                    return (
                      <div key={entry.friend.id} class={s.friend}>
                        <HeroAvatar heroId={entry.friend.heroId} size={40} star={entry.friend.star} />
                        <div class={s.friendInfo}>
                          <b>{heroLabel(entry.friend.heroId)}</b>
                          <span>
                            {entry.friend.name} · {t('social.friends.level', { n: entry.friend.level })} ·{' '}
                            {t('social.friends.power', {
                              n: formatNumber(entry.friend.power, locale$.value),
                            })}
                          </span>
                          {reasonKey ? <span class={s.warn}>{t(reasonKey)}</span> : null}
                        </div>
                        {entry.hired ? (
                          <span class={s.hired}>{t('social.friends.hired')}</span>
                        ) : (
                          <button
                            class="btn btn--sm btn--ghost"
                            disabled={!hireable}
                            onClick={() => hire(entry.friend.id, entry.friend.name)}
                          >
                            {t('social.friends.hire')}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div class={s.empty}>{t('social.friends.noFriends')}</div>
              )}
            </section>
          </>
        )}
      </div>

      {leaveOpen ? (
        <Modal title={t('social.guild.leave')} onClose={() => setLeaveOpen(false)}>
          <p class="muted">{t('social.guild.leaveConfirm')}</p>
          <button class="btn btn--wide btn--primary" onClick={leave}>
            {t('social.guild.leave')}
          </button>
          <button class="btn btn--wide" onClick={() => setLeaveOpen(false)}>
            {t('common.cancel')}
          </button>
        </Modal>
      ) : null}
    </div>
  );
}
