import { t } from '../../core/i18n';
import { STATUS_KINDS } from '../../data/statuses';
import { Modal } from './Modal';
import s from './StatusHelp.module.css';

export interface StatusHelpProps {
  onClose: () => void;
}

/** Справочник статусов боя: название и короткое правило. */
export function StatusHelp({ onClose }: StatusHelpProps) {
  return (
    <Modal title={t('battle.statuses')} onClose={onClose}>
      <div class={s.list}>
        {STATUS_KINDS.map((status) => (
          <div key={status} class={s.row} data-status={status}>
            <b>{t(`status.${status}.name`)}</b>
            <span>{t(`status.${status}.hint`)}</span>
          </div>
        ))}
      </div>
      <button class="btn btn--wide" onClick={onClose}>
        {t('common.close')}
      </button>
    </Modal>
  );
}
