import { locale$, t } from '../../core/i18n';
import { formatDuration, formatNumber } from '../../core/time';
import { idleGoldPerMinute } from '../../game/config';
import { claimIdle, idleCapHours } from '../../game/idle';
import type { OfflineReport } from '../../game/offline';
import { commit, save$ } from '../../game/state';
import { Modal } from './Modal';
import { toast } from './toast';
import s from './OfflineReportModal.module.css';

export interface OfflineReportModalProps {
  report: OfflineReport;
  onClose: () => void;
}

/** Сводка дохода за время отсутствия; показывается один раз за вход. */
export function OfflineReportModal({ report, onClose }: OfflineReportModalProps) {
  const claim = (): void => {
    let gold = 0;
    commit((draft) => {
      gold = claimIdle(draft);
    }, 'offline-claim');
    if (gold > 0) toast(`+${formatNumber(gold, locale$.value)}`, 'success');
    onClose();
  };

  return (
    <Modal title={t('offline.title')} onClose={onClose}>
      <p class="muted">{t('offline.away', { time: formatDuration(report.awayMs, locale$.value) })}</p>

      <div class={s.rows}>
        <div class={s.row}>
          <span>{t('offline.gold')}</span>
          <b>+{formatNumber(report.gold, locale$.value)}</b>
        </div>
        <div class={s.row}>
          <span>{t('offline.essence')}</span>
          <b>+{formatNumber(report.essence, locale$.value)}</b>
        </div>
      </div>

      <p class="muted">
        {t('offline.rate', {
          rate: formatNumber(idleGoldPerMinute(save$.value.tower.maxFloor) * 60, locale$.value),
        })}
      </p>
      <p class="muted">
        {t('offline.cap', {
          time: formatDuration(idleCapHours(save$.value) * 3_600_000, locale$.value),
        })}
      </p>
      <p class={s.hint}>{t('offline.hint')}</p>

      <div class={s.actions}>
        <button class="btn btn--ghost" onClick={onClose}>
          {t('common.later')}
        </button>
        <button class="btn btn--primary" onClick={claim}>
          {t('offline.claim')}
        </button>
      </div>
    </Modal>
  );
}
