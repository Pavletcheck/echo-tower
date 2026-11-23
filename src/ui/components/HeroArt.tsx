import { useEffect, useState } from 'preact/hooks';
import { asset } from '../../core/asset';
import { HEROES_BY_ID } from '../../data/heroes';
import s from './HeroArt.module.css';

export interface HeroArtProps {
  heroId: string;
  /** Which art to prefer; the other one is used as a fallback. */
  kind?: 'card' | 'portrait';
  fit?: 'cover' | 'contain';
  /** Blurred copy of the art behind the contain letterbox. */
  backdrop?: boolean;
  /** Use the small card thumbnail (grids, lists) instead of the full 1024×1536 file. */
  thumb?: boolean;
  objectPosition?: string;
}

export function HeroArt({
  heroId,
  kind = 'card',
  fit = 'cover',
  backdrop = false,
  thumb = false,
  objectPosition = '50% 16%',
}: HeroArtProps) {
  const [attempt, setAttempt] = useState(0);
  const hero = HEROES_BY_ID[heroId];

  useEffect(() => {
    setAttempt(0);
  }, [heroId]);

  if (!hero) return null;

  const order =
    kind === 'card'
      ? [hero.asset.card, hero.asset.portrait]
      : [hero.asset.portrait, hero.asset.card];
  const thumbPath = thumb && kind === 'card' ? hero.asset.card?.replace('card.webp', 'card-thumb.webp') : undefined;
  const sources = [thumbPath, ...order].filter((src): src is string => Boolean(src));
  const current = sources[attempt];
  if (!current) return null;

  const url = asset(current);

  return (
    <span class={s.root}>
      {backdrop ? <img class={s.backdrop} src={url} alt="" aria-hidden="true" draggable={false} /> : null}
      <img
        class={fit === 'contain' ? s.contain : s.cover}
        src={url}
        alt=""
        draggable={false}
        loading="lazy"
        style={{ objectPosition }}
        onError={() => setAttempt((value) => value + 1)}
      />
    </span>
  );
}
