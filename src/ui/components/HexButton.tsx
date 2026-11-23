import { useState } from 'preact/hooks';
import { asset } from '../../core/asset';
import { Icon, type IconName } from './Icon';
import s from './HexButton.module.css';

export interface HexButtonProps {
  label: string;
  icon: IconName;
  onClick: () => void;
  style?: Record<string, string | number | undefined>;
  locked?: boolean;
  badge?: string;
  /** Иллюстрация здания внутри гексагона; иконка остаётся фолбэком. */
  art?: string;
}

export function HexButton({ label, icon, onClick, style, locked, badge, art }: HexButtonProps) {
  const [artFailed, setArtFailed] = useState(false);
  const showArt = Boolean(art) && !artFailed;

  return (
    <button class={s.root} style={style} onClick={onClick}>
      <span class={`${s.hex}${showArt ? ` ${s.hexArt}` : ''}`}>
        <span class={s.inner}>
          {showArt ? (
            <img class={s.art} src={asset(art ?? '')} alt="" draggable={false} loading="lazy" onError={() => setArtFailed(true)} />
          ) : (
            <Icon name={icon} size={20} />
          )}
        </span>
        {locked ? (
          <span class={s.lock}>
            <Icon name="lock" size={11} />
          </span>
        ) : null}
      </span>
      <span class={s.label}>{label}</span>
      {badge ? <span class={s.badge}>{badge}</span> : null}
    </button>
  );
}
