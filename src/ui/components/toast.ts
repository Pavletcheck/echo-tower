import { signal } from '@preact/signals';
import { playSfx } from '../../core/audio';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
}

export const toasts$ = signal<ToastItem[]>([]);

let sequence = 0;

export function dismissToast(id: number): void {
  toasts$.value = toasts$.value.filter((item) => item.id !== id);
}

export function toast(text: string, tone: ToastTone = 'info'): void {
  sequence += 1;
  const item: ToastItem = { id: sequence, text, tone };
  toasts$.value = [...toasts$.value.slice(-2), item];
  if (tone === 'error') playSfx('error');
  setTimeout(() => dismissToast(item.id), 2600);
}
