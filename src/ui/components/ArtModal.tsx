import { asset } from '../../core/asset';
import { t } from '../../core/i18n';
import { Modal } from './Modal';
import s from './ArtModal.module.css';

export interface ArtModalProps {
  title: string;
  text: string;
  image?: string;
  onClose: () => void;
}

export function ArtModal({ title, text, image, onClose }: ArtModalProps) {
  return (
    <Modal title={title} onClose={onClose}>
      {image ? <div class={s.art} style={{ backgroundImage: `url(${asset(image)})` }} /> : null}
      <p class={s.text}>{text}</p>
      <button class="btn btn--wide" onClick={onClose}>
        {t('common.close')}
      </button>
    </Modal>
  );
}
