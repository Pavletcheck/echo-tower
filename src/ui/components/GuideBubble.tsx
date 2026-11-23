import { asset } from '../../core/asset';
import { useState } from 'preact/hooks';
import { GUIDE } from '../../data/guide';
import s from './GuideBubble.module.css';

export interface GuideBubbleProps {
  name: string;
  role?: string;
  text: string;
  onClose?: () => void;
  /** Компактный вариант для модалок и туториала. */
  compact?: boolean;
}

export function GuideAvatar({ size = 44 }: { size?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <span class={s.avatar} style={{ width: `${size}px`, height: `${size}px` }}>
      {failed ? (
        <span class={s.glyph}>✦</span>
      ) : (
        <img src={asset(GUIDE.portrait)} alt="" draggable={false} loading="lazy" onError={() => setFailed(true)} />
      )}
    </span>
  );
}

export function GuideBubble({ name, role, text, onClose, compact = false }: GuideBubbleProps) {
  return (
    <div class={`${s.bubble}${compact ? ` ${s.compact}` : ''}`}>
      <GuideAvatar size={compact ? 38 : 48} />
      <div class={s.body}>
        <span class={s.name}>
          {name}
          {role ? <span class={s.role}> · {role}</span> : null}
        </span>
        <p class={s.text}>{text}</p>
      </div>
      {onClose ? (
        <button class={s.close} onClick={onClose} aria-label="close">
          ×
        </button>
      ) : null}
    </div>
  );
}
