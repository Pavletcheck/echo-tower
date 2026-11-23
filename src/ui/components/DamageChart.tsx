import { locale$, t } from '../../core/i18n';
import { formatNumber } from '../../core/time';
import { allyBattleStats, damageShare } from '../../game/battle/metrics';
import type { UnitBattleStats } from '../../game/battle/types';
import { HeroAvatar } from './HeroAvatar';
import s from './DamageChart.module.css';

export interface DamageChartProps {
  stats: readonly UnitBattleStats[];
}

/** График боя: урон, лечение, полученный урон и вклад каждого героя. */
export function DamageChart({ stats }: DamageChartProps) {
  const allies = allyBattleStats(stats);
  const total = allies.reduce((sum, line) => sum + line.damageDealt, 0);
  const max = Math.max(1, ...allies.map((line) => line.damageDealt));

  if (allies.length === 0) return null;

  return (
    <div class={s.root}>
      <div class={s.head}>
        <span>{t('battle.damageChart')}</span>
        <span class={s.total}>{t('battle.totalDamage', { n: formatNumber(total, locale$.value) })}</span>
      </div>

      <div class={s.list}>
        {allies.map((line) => {
          const share = Math.round(damageShare(stats, line.uid) * 100);
          const width = Math.max(2, Math.round((line.damageDealt / max) * 100));
          const name = locale$.value === 'ru' ? line.name : (line.nameEn ?? line.name);

          return (
            <div key={line.uid} class={s.row}>
              <HeroAvatar heroId={line.defId} size={30} />
              <div class={s.info}>
                <div class={s.nameRow}>
                  <span class={s.name}>{name}</span>
                  <span class={s.share}>{t('battle.share', { n: share })}</span>
                </div>
                <div class={s.bar}>
                  <div class={s.fill} style={{ width: `${width}%` }} />
                </div>
                <div class={s.meta}>
                  {t('battle.dealt')} {formatNumber(line.damageDealt, locale$.value)} · {t('battle.healed')}{' '}
                  {formatNumber(line.healing, locale$.value)} · {t('battle.taken')}{' '}
                  {formatNumber(line.damageTaken, locale$.value)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
