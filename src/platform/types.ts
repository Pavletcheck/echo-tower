export type PlatformId = 'mock' | 'yandex' | 'crazy' | 'poki' | 'telegram';
export type AdResult = 'rewarded' | 'closed' | 'error';
export type PurchaseResult = 'success' | 'cancel' | 'error';

export interface PlatformUser {
  id: string;
  name?: string;
  avatar?: string;
}

/**
 * Единственный интерфейс, который знает игра.
 * В игровом коде не должно быть if (platform === 'poki').
 */
export interface PlatformSDK {
  readonly id: PlatformId;
  init(): Promise<void>;
  getLanguage(): 'ru' | 'en';
  getUser(): Promise<PlatformUser | null>;
  cloudSave: {
    load(): Promise<string | null>;
    put(data: string): Promise<void>;
  };
  ads: {
    rewarded(placement: string): Promise<AdResult>;
    interstitial(): Promise<void>;
    canShowInterstitial(): boolean;
  };
  payments: {
    available: boolean;
    buy(sku: string): Promise<PurchaseResult>;
    restore(): Promise<string[]>;
    /** Цены из каталога площадки: локаль, валюта, промо. */
    catalog?(): Promise<Array<{ sku: string; price: string }>>;
  };
  leaderboard?: {
    submit(score: number): Promise<void>;
    get(): Promise<Array<{ name: string; score: number }>>;
  };
  haptics(type: 'light' | 'medium' | 'heavy'): void;
  share?(text: string): Promise<void>;
  onPause(callback: () => void): void;
  onResume(callback: () => void): void;
}
