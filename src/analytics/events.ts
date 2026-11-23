type Sink = (name: string, params: Record<string, unknown>) => void;

let sink: Sink = (name, params) => {
  if (__DEV__) console.debug('[analytics]', name, params);
};

export function setAnalyticsSink(next: Sink): void {
  sink = next;
}

/** Единая точка аналитики. Позже сюда подключится SDK площадки. */
export function track(name: string, params: Record<string, unknown> = {}): void {
  try {
    sink(name, params);
  } catch {
    /* аналитика никогда не ломает игру */
  }
}
