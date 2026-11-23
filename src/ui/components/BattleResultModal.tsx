import { locale$, t } from '../../core/i18n';
import { formatNumber } from '../../core/time';
import type { UnitBattleStats } from '../../game/battle/types';
import { DamageChart } from './DamageChart';
import { Modal } from './Modal';
import s from './BattleResultModal.module.css';

export interface BattleResultModalProps {
  win: boolean;
  damageDealt: number;
  damageTaken: number;
  stats?: readonly UnitBattleStats[];
  title?: string;
  extra?: string;
  onClose: () => void;
}

export function BattleResultModal({
  win,
  damageDealt,
  damageTaken,
  stats,
  title,
  extra,
  onClose,
}: BattleResultModalProps) {
  return (
    <Modal title={title ?? (win ? t('common.win') : t('common.lose'))} onClose={onClose}>
      <div class={s.rows}>
        <div class={s.row}>
          <span>{t('common.damage')}</span>
          <b>{formatNumber(damageDealt, locale$.value)}</b>
        </div>
        <div class={s.row}>
          <span>{t('common.taken')}</span>
          <b>{formatNumber(damageTaken, locale$.value)}</b>
        </div>
      </div>
      {stats && stats.length > 0 ? <DamageChart stats={stats} /> : null}
      {extra ? <p class={s.extra}>{extra}</p> : null}
      <button class={`btn ${win ? 'btn--primary' : 'btn--ghost'} btn--wide`} onClick={onClose}>
        {t('common.continue')}
      </button>
    </Modal>
  );
}
