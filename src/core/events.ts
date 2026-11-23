type Handler<M, K extends keyof M> = (payload: M[K]) => void;

/** Минимальная типизированная шина событий: без DOM, без зависимостей. */
export class Emitter<M extends object> {
  private handlers = new Map<keyof M, Set<(payload: unknown) => void>>();

  on<K extends keyof M>(event: K, fn: Handler<M, K>): () => void {
    const set = this.handlers.get(event) ?? new Set<(payload: unknown) => void>();
    set.add(fn as (payload: unknown) => void);
    this.handlers.set(event, set);
    return () => {
      set.delete(fn as (payload: unknown) => void);
    };
  }

  emit<K extends keyof M>(event: K, payload: M[K]): void {
    this.handlers.get(event)?.forEach((fn) => fn(payload));
  }

  clear(): void {
    this.handlers.clear();
  }
}

export interface AppEvents {
  'save:changed': { reason: string };
  'toast:show': { text: string; tone: 'info' | 'success' | 'error' };
}

export const bus = new Emitter<AppEvents>();
