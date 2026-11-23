import type { JSX } from 'preact';

export type IconName =
  | 'play'
  | 'gear'
  | 'close'
  | 'altar'
  | 'shield'
  | 'hammer'
  | 'bowl'
  | 'swords'
  | 'book'
  | 'coin'
  | 'crystal'
  | 'key'
  | 'mail'
  | 'gift'
  | 'lock'
  | 'back'
  | 'star'
  | 'users';

const ICONS: Record<IconName, JSX.Element> = {
  play: <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" stroke="none" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.6v2.8M12 18.6v2.8M2.6 12h2.8M18.6 12h2.8M5.4 5.4l2 2M16.6 16.6l2 2M18.6 5.4l-2 2M7.4 16.6l-2 2" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  altar: (
    <>
      <path d="M12 3.2l6.4 11.2H5.6L12 3.2z" />
      <path d="M8.6 19.2h6.8" />
    </>
  ),
  shield: <path d="M12 3l7 2.8v5.3c0 4.6-2.9 7.6-7 9.9-4.1-2.3-7-5.3-7-9.9V5.8L12 3z" />,
  hammer: (
    <>
      <path d="M14.2 3.4l6.4 6.4-2.7 2.7-6.4-6.4 2.7-2.7z" />
      <path d="M11.4 9.2L3.6 17l3.4 3.4 7.8-7.8" />
    </>
  ),
  bowl: (
    <>
      <path d="M3.8 11h16.4a8.2 8.2 0 0 1-16.4 0z" />
      <path d="M9 7.6c0-1.8 1.8-1.9 1.8-3.6M13.2 7.6c0-1.4 1.4-1.6 1.4-3" />
    </>
  ),
  swords: (
    <>
      <path d="M4 3.5l9.6 9.6M3.5 4l2.6-.5.5 2.6" />
      <path d="M20 3.5l-9.6 9.6M20.5 4l-2.6-.5-.5 2.6" />
      <path d="M6.6 15.4l2 2M17.4 15.4l-2 2" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.2A2.2 2.2 0 0 1 6.2 3H20v18H6.2A2.2 2.2 0 0 1 4 18.8V5.2z" />
      <path d="M8 3v18" />
    </>
  ),
  coin: (
    <>
      <ellipse cx="12" cy="8" rx="7" ry="3" />
      <path d="M5 8v8c0 1.7 3.1 3 7 3s7-1.3 7-3V8" />
    </>
  ),
  crystal: (
    <>
      <path d="M12 2.8l6.4 4.6L16 20.4H8L5.6 7.4 12 2.8z" />
      <path d="M5.6 7.4h12.8M12 2.8v17.6" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="8" r="3.4" />
      <path d="M10.4 10.4L20 20M16.6 16.6l2-2M18.6 18.6l2-2" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  gift: (
    <>
      <path d="M4 9.5h16V20H4V9.5z" />
      <path d="M3 6.5h18v3H3v-3zM12 6.5V20" />
      <path d="M12 6.5c-1.6-3.4-6-3-6-.6 0 1.4 1.6 2.4 6 .6zM12 6.5c1.6-3.4 6-3 6-.6 0 1.4-1.6 2.4-6 .6z" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  star: <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4L2.6 9.4l6.5-.9L12 2.6z" fill="currentColor" stroke="none" />,
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.4 19.4c0-3.1 2.5-5.6 5.6-5.6s5.6 2.5 5.6 5.6" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M15.4 14.2c2.8-.5 5.2 1.7 5.2 4.5" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      class={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
