import { locale$ } from '../../core/i18n';
import { formatNumber } from '../../core/time';
import { Icon } from './Icon';

export type ResourceKind = 'gold' | 'crystal';

const ICON: Record<ResourceKind, 'coin' | 'crystal'> = {
  gold: 'coin',
  crystal: 'crystal',
};

export interface ResourcePillProps {
  kind: ResourceKind;
  value: number;
  title: string;
  /** Если задан — пилюля становится кнопкой (например, открывает магазин). */
  onClick?: () => void;
}

export function ResourcePill({ kind, value, title, onClick }: ResourcePillProps) {
  const content = (
    <>
      <span class={`pill__dot pill__dot--${kind}`}>
        <Icon name={ICON[kind]} size={14} />
      </span>
      <span>{formatNumber(value, locale$.value)}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        class="pill pill--button"
        title={title}
        aria-label={`${formatNumber(value, locale$.value)} ${title}`}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div class="pill" title={title} aria-label={`${formatNumber(value, locale$.value)} ${title}`}>
      {content}
    </div>
  );
}
