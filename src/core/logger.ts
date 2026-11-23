interface LogEntry {
  at: number;
  level: 'error' | 'warn' | 'info';
  message: string;
  context?: string;
}

const buffer: LogEntry[] = [];
const MAX_ENTRIES = 30;

function push(level: LogEntry['level'], message: string, context?: string): void {
  buffer.push({ at: Date.now(), level, message, context });
  if (buffer.length > MAX_ENTRIES) buffer.shift();
}

export function logError(error: unknown, context?: string): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  push('error', message, context);
  if (__DEV__) console.error(`[echo] ${context ?? 'error'}`, error);
}

export function logWarn(message: string, context?: string): void {
  push('warn', message, context);
  if (__DEV__) console.warn(`[echo] ${context ?? 'warn'} ${message}`);
}

export function getErrorLog(): readonly LogEntry[] {
  return buffer;
}

/** Глобальные перехватчики: не даём игре упасть молча. */
export function initLogger(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    logError(event.error ?? event.message, 'window.error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    logError(event.reason, 'unhandledrejection');
  });
}
