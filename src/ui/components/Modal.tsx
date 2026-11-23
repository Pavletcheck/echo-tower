import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { t } from '../../core/i18n';
import { Icon } from './Icon';

export interface ModalProps {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const focusFirst = () =>
      panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    focusFirst();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div class="modal__head">
          <h2 class="modal__title">{title}</h2>
          <button class="modal__close" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div class="modal__body">{children}</div>
      </div>
    </div>
  );
}
