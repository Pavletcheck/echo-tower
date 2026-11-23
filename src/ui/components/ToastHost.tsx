import { toasts$ } from './toast';

export function ToastHost() {
  const items = toasts$.value;

  return (
    <div class="toast-host" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} class={`toast${item.tone === 'info' ? '' : ` toast--${item.tone}`}`}>
          {item.text}
        </div>
      ))}
    </div>
  );
}
