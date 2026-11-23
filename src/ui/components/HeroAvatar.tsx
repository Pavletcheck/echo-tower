import { useEffect, useState } from 'preact/hooks';
import { asset } from '../../core/asset';
import { locale$ } from '../../core/i18n';
import { ELEMENT_COLOR, HEROES_BY_ID, heroName } from '../../data/heroes';
import s from './HeroAvatar.module.css';

export interface HeroAvatarProps {
  heroId: string;
  size?: number;
  star?: number;
  /** hex is the default crystal frame; square is used for the lobby squad row. */
  shape?: 'hex' | 'square';
}

export function HeroAvatar({ heroId, size = 46, star, shape = 'hex' }: HeroAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const hero = HEROES_BY_ID[heroId];

  useEffect(() => {
    setImageFailed(false);
    setAttempt(0);
  }, [heroId]);

  if (!hero) return null;

  const name = heroName(heroId, locale$.value);
  const accent = ELEMENT_COLOR[hero.element];
  // portrait is the intended avatar; card art is a graceful fallback until portraits exist
  const sources = [hero.asset.portrait, hero.asset.card].filter(
    (src): src is string => Boolean(src)
  );
  const current = sources[attempt];
  const showImage = Boolean(current) && !imageFailed;
  const square = shape === 'square';
  const style = {
    width: `${size}px`,
    height: `${square ? size : Math.round(size * 1.16)}px`,
    '--accent': accent,
    background: showImage ? undefined : `linear-gradient(165deg, ${accent}, #0b0714 72%)`,
  };

  return (
    <div class={`${s.root}${square ? ` ${s.square}` : ''}`} style={style} title={name}>
      {showImage ? (
        <img
          class={s.img}
          src={asset(current ?? '')}
          alt={name}
          loading="lazy"
          draggable={false}
          onError={() => {
            if (attempt + 1 < sources.length) setAttempt(attempt + 1);
            else setImageFailed(true);
          }}
        />
      ) : (
        <span class={s.initial}>{name.slice(0, 1)}</span>
      )}
      <span class={s.badge}>{star ?? hero.rarity}★</span>
    </div>
  );
}
