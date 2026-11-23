import { computed, signal } from '@preact/signals';
import { HEROES_BY_ID, heroPower } from '../data/heroes';
import { platform } from '../platform';
import { defaultSave, loadSave, migrate, persistSave, type SaveV1 } from './save';
import { offlineReport, type OfflineReport } from './offline';
import { effectiveLevel } from './resonance';
import { ensureMail } from './mail';
import { ensurePass } from './pass';
import { ensureEvent } from './event';
import { mercenaryPower, syncMercenary } from './mercenary';
import { ensureSocial } from './social';
import { bus } from '../core/events';

export const save$ = signal<SaveV1>(defaultSave());
/** Сводка отсутствия, создаётся один раз при загрузке сейва. */
export const offlineReport$ = signal<OfflineReport | null>(null);

export const gold$ = computed(() => save$.value.currencies.gold);
export const crystals$ = computed(() => save$.value.currencies.crystals);
export const maxFloor$ = computed(() => save$.value.tower.maxFloor);
export const squad$ = computed(() => save$.value.squad);

let persistTimer: ReturnType<typeof setTimeout> | undefined;
const TAB_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const saveChannel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('echo-tower-save') : null;

/** Грубая оценка прогресса, чтобы вкладка со старым сейвом не съела прогресс новой. */
function progressScore(save: SaveV1): number {
  const heroes = Object.keys(save.heroes).length;
  const clears = Object.keys(save.tower.clears).length;
  return heroes * 1_000_000 + save.gacha.totalPulls * 10_000 + clears * 1_000 + save.tower.maxFloor * 100;
}

if (saveChannel) {
  saveChannel.onmessage = (event: MessageEvent) => {
    const data = event.data as { tabId?: string; save?: unknown } | null;
    if (!data || data.tabId === TAB_ID || !data.save) return;
    try {
      const incoming = migrate(data.save);
      const current = save$.value;
      const incomingScore = progressScore(incoming);
      const currentScore = progressScore(current);
      // Свежие настройки принимаем, только если вкладка не отстала по прогрессу.
      if (incomingScore > currentScore || (incoming.lastSeen > current.lastSeen && incomingScore >= currentScore)) {
        save$.value = incoming;
        schedulePersist();
        bus.emit('save:changed', { reason: 'other-tab' });
      }
    } catch {
      /* битое сообщение другой вкладки игнорируем */
    }
  };
}
/** Облако не дёргаем на каждый commit: площадки имеют лимиты на запись. */
const CLOUD_INTERVAL_MS = 30_000;
let lastCloudAt = 0;

async function persistNow(forceCloud = false): Promise<void> {
  try {
    await persistSave(save$.value);
    const at = Date.now();
    if (forceCloud || at - lastCloudAt >= CLOUD_INTERVAL_MS) {
      lastCloudAt = at;
      const json = JSON.stringify(save$.value);
      void platform()
        .cloudSave.put(json)
        .catch(() => {
          /* облако недоступно — локальный сейв уже записан */
        });
    }
    bus.emit('save:changed', { reason: 'auto' });
  } catch (error) {
    console.error('[echo] save failed', error);
  }
}

function schedulePersist(): void {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void persistNow();
  }, 300);
}

/** Единственный способ изменить сейв. Копия — чтобы UI не видел частичных мутаций. */
export function commit(mutate: (draft: SaveV1) => void, reason = 'commit'): void {
  const draft = structuredClone(save$.value);
  mutate(draft);
  // Инвариант социального слоя: наёмник не может дублировать героя коллекции/отряда.
  syncMercenary(draft);
  draft.lastSeen = Date.now();
  save$.value = draft;
  saveChannel?.postMessage({ tabId: TAB_ID, save: draft });
  schedulePersist();
  bus.emit('save:changed', { reason });
}

export function setSave(next: SaveV1, reason = 'replace'): void {
  // Импорт/сброс должны записаться даже поверх более свежего локального файла.
  next.lastSeen = Date.now();
  save$.value = next;
  saveChannel?.postMessage({ tabId: TAB_ID, save: next });
  schedulePersist();
  bus.emit('save:changed', { reason });
}

export async function initState(): Promise<void> {
  let loaded = await loadSave();

  // Облачный сейв площадки: при конфликте побеждает более свежий lastSeen.
  try {
    const cloud = await platform().cloudSave.load();
    if (cloud) {
      const remote = migrate(JSON.parse(cloud));
      if ((remote.lastSeen ?? 0) > (loaded.lastSeen ?? 0)) loaded = remote;
    }
  } catch {
    /* площадка без облака или битые данные — работаем с локальным сейвом */
  }

  const at = Date.now();
  offlineReport$.value = offlineReport(loaded, at);
  ensureMail(loaded, at, Math.max(0, at - loaded.lastSeen));
  ensurePass(loaded, new Date(at));
  ensureEvent(loaded);
  ensureSocial(loaded, new Date(at));
  save$.value = loaded;
}

export function flushSave(): void {
  clearTimeout(persistTimer);
  void persistNow(true);
}

/** Отправка прогресса в лидерборд площадки (если он есть). */
export function submitLeaderboard(): void {
  try {
    const sdk = platform();
    // maxFloor — это следующий незачищенный этаж, поэтому в рейтинг уходит максимум из clears.
    const cleared = Object.keys(save$.value.tower.clears).reduce((best, floor) => {
      const value = Number(floor);
      return Number.isFinite(value) ? Math.max(best, value) : best;
    }, 0);
    void sdk.leaderboard?.submit(Math.min(100, cleared)).catch(() => {
      /* лидерборд опционален */
    });
  } catch {
    /* платформа ещё не инициализирована */
  }
}

export function hasHero(heroId: string): boolean {
  return Boolean(save$.value.heroes[heroId]);
}

export function heroLevel(heroId: string): number {
  return save$.value.heroes[heroId]?.level ?? 0;
}

export function teamPower(): number {
  const owned = save$.value.squad.reduce((total, heroId) => {
    const hero = HEROES_BY_ID[heroId];
    const ownedHero = save$.value.heroes[heroId];
    if (!hero || !ownedHero) return total;
    return total + heroPower(hero, effectiveLevel(save$.value, heroId), ownedHero.star);
  }, 0);
  return owned + mercenaryPower(save$.value);
}
