import type { Howl } from 'howler';
import { asset } from './asset';
import { logError } from './logger';

export type SfxName =
  | 'click'
  | 'error'
  | 'coin'
  | 'hit'
  | 'crit'
  | 'ult'
  | 'heal'
  | 'shatter'
  | 'starUp'
  | 'summon';

export type MusicName = 'lobby' | 'battle' | 'boss';

type HowlerModule = typeof import('howler');

const SFX_FILES: Record<SfxName, string> = {
  click: 'ui-click',
  error: 'ui-error',
  coin: 'coin',
  hit: 'hit',
  crit: 'crit',
  ult: 'ult',
  heal: 'heal',
  shatter: 'shatter',
  starUp: 'star-up',
  summon: 'summon',
};

const MUSIC_FILES: Record<MusicName, string> = {
  lobby: 'lobby',
  battle: 'battle',
  boss: 'boss',
};

/** РњРёРЅРёРјР°Р»СЊРЅС‹Р№ РёРЅС‚РµСЂРІР°Р» РјРµР¶РґСѓ РѕРґРёРЅР°РєРѕРІС‹РјРё Р·РІСѓРєР°РјРё, РјСЃ: Р·Р°С‰РёС‚Р° РѕС‚ В«РїСѓР»РµРјС‘С‚Р°В» РІ Р±РѕСЋ. */
const THROTTLE: Partial<Record<SfxName, number>> = {
  click: 40,
  hit: 65,
  crit: 110,
  heal: 400,
  coin: 90,
};

const sfxCache = new Map<SfxName, Howl>();
const failedSfx = new Set<SfxName>();
const lastPlayed = new Map<SfxName, number>();
let howler: HowlerModule | null = null;
let howlerPromise: Promise<HowlerModule> | null = null;
let music: Howl | null = null;
let currentMusic: MusicName | null = null;
let musicToken = 0;
let sfxVolume = 0.8;
let musicVolume = 0.6;
let initialized = false;
let muted = false;
/** До первого жеста браузер всё равно не даст играть — не качаем музыку зря. */
let unlocked = false;

function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

/**
 * Общий запас громкости и перцептивная кривая.
 * Слышимая громкость растёт нелинейно, поэтому линейный ползунок на минимуме
 * всё равно звучал громко. 0.65 — общий минус ~35% по всему миксу.
 */
const MASTER_GAIN = 0.65;
const CURVE_POWER = 1.5;

function gain(value: number): number {
  return Math.pow(clampVolume(value), CURVE_POWER) * MASTER_GAIN;
}

/** Howler РіСЂСѓР·РёС‚СЃСЏ РѕС‚РґРµР»СЊРЅС‹Рј С‡Р°РЅРєРѕРј: СЃС‚Р°СЂС‚РѕРІС‹Р№ Р±Р°РЅРґР» РЅРµ Р¶РґС‘С‚ Р°СѓРґРёРѕ-РґРІРёР¶РѕРє. */
function loadHowler(): Promise<HowlerModule> {
  if (howler) return Promise.resolve(howler);
  if (!howlerPromise) {
    howlerPromise = import('howler')
      .then((module) => {
        howler = module;
        module.Howler.autoUnlock = true;
        module.Howler.mute(muted);
        return module;
      })
      .catch((error: unknown) => {
        logError(error, 'audio:load');
        throw error;
      });
  }
  return howlerPromise;
}

function getSfx(module: HowlerModule, name: SfxName): Howl | null {
  if (failedSfx.has(name)) return null;
  const cached = sfxCache.get(name);
  if (cached) return cached;

  try {
    const howl = new module.Howl({
      src: [asset(`assets/audio/sfx/${SFX_FILES[name]}.ogg`)],
      preload: true,
      volume: gain(sfxVolume),
      onloaderror: () => {
        failedSfx.add(name);
        if (__DEV__) console.warn(`[echo] audio missing: ${name}`);
      },
    });
    sfxCache.set(name, howl);
    return howl;
  } catch (error) {
    failedSfx.add(name);
    logError(error, `audio:${name}`);
    return null;
  }
}

function getMusic(module: HowlerModule, name: MusicName): Howl | null {
  try {
    return new module.Howl({
      src: [asset(`assets/audio/music/${MUSIC_FILES[name]}.ogg`)],
      loop: true,
      preload: true,
      volume: 0,
      onloaderror: () => {
        if (currentMusic === name) currentMusic = null;
        if (__DEV__) console.warn(`[echo] music missing: ${name}`);
      },
    });
  } catch (error) {
    logError(error, `music:${name}`);
    return null;
  }
}

/** Р Р°Р·Р±Р»РѕРєРёСЂСѓРµС‚ Web Audio РїРѕСЃР»Рµ РїРµСЂРІРѕРіРѕ Р¶РµСЃС‚Р° РёРіСЂРѕРєР°. */
export function initAudio(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const unlock = () => {
    unlocked = true;
    void loadHowler()
      .then((module) => {
        const context = module.Howler.ctx;
        if (context && context.state === 'suspended') void context.resume();
        if (music && musicVolume > 0 && !music.playing()) music.play();
        else if (!music && currentMusic && musicVolume > 0) playMusic(currentMusic);
      })
      .catch(() => {
        // Р±РµР· Р°СѓРґРёРѕ РёРіСЂР° РїСЂРѕРґРѕР»Р¶Р°РµС‚ СЂР°Р±РѕС‚Р°С‚СЊ
      });
  };

  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true });

  // Р”РІРёР¶РѕРє Рё СЃР°РјС‹Рµ С‡Р°СЃС‚С‹Рµ Р·РІСѓРєРё РіРѕС‚РѕРІРёРј РІ С„РѕРЅРµ, РЅРµ Р±Р»РѕРєРёСЂСѓСЏ РїРµСЂРІС‹Р№ СЌРєСЂР°РЅ.
  void loadHowler()
    .then((module) => {
      if (sfxVolume <= 0) return;
      (['click', 'error', 'coin'] as const).forEach((name) => getSfx(module, name));
    })
    .catch(() => {
      // Р±РµР· Р°СѓРґРёРѕ РёРіСЂР° РїСЂРѕРґРѕР»Р¶Р°РµС‚ СЂР°Р±РѕС‚Р°С‚СЊ
    });
}

/** Р“СЂРѕРјРєРѕСЃС‚СЊ 0..1. */
export function setAudioVolumes(nextMusic: number, nextSfx: number): void {
  musicVolume = clampVolume(nextMusic);
  sfxVolume = clampVolume(nextSfx);

  if (musicVolume <= 0) {
    music?.pause();
    return;
  }
  if (!music && currentMusic) {
    playMusic(currentMusic);
    return;
  }
  if (!music) return;
  music.volume(gain(musicVolume));
  if (!music.playing()) music.play();
}

export function playSfx(name: SfxName, volumeScale = 1): void {
  if (sfxVolume <= 0) return;

  const now = Date.now();
  const interval = THROTTLE[name] ?? 0;
  if (now - (lastPlayed.get(name) ?? 0) < interval) return;
  lastPlayed.set(name, now);

  void loadHowler()
    .then((module) => {
      const howl = getSfx(module, name);
      if (!howl) return;
      howl.volume(gain(sfxVolume * volumeScale));
      howl.play();
    })
    .catch(() => {
      // Р±РµР· Р°СѓРґРёРѕ РёРіСЂР° РїСЂРѕРґРѕР»Р¶Р°РµС‚ СЂР°Р±РѕС‚Р°С‚СЊ
    });
}

/** РџР»Р°РІРЅРѕ РїРµСЂРµРєР»СЋС‡Р°РµС‚ РјСѓР·С‹РєСѓ. РџРѕРІС‚РѕСЂРЅС‹Р№ РІС‹Р·РѕРІ С‚РѕРіРѕ Р¶Рµ С‚СЂРµРєР° РЅРµ СЂРµСЃС‚Р°СЂС‚РёС‚ РµРіРѕ. */
export function playMusic(name: MusicName): void {
  if (!unlocked) {
    // Запоминаем трек, но не тянем мегабайт музыки до первого тапа.
    currentMusic = name;
    return;
  }
  if (currentMusic === name && music) {
    if (musicVolume > 0) {
      music.volume(gain(musicVolume));
      if (!music.playing()) music.play();
    }
    return;
  }

  currentMusic = name;
  musicToken += 1;
  const token = musicToken;
  const previous = music;
  music = null;

  if (previous) {
    const startVolume = previous.volume();
    if (startVolume > 0) previous.fade(startVolume, 0, 350);
    window.setTimeout(() => {
      // Р•СЃР»Рё С‚СЂРµРє СѓСЃРїРµР»Рё РІРµСЂРЅСѓС‚СЊ, РѕРЅ СЃРЅРѕРІР° current вЂ” РЅРµ РіР»СѓС€РёРј РµРіРѕ.
      if (music === previous) return;
      previous.stop();
      previous.unload();
    }, 380);
  }

  if (musicVolume <= 0) return;

  void loadHowler()
    .then((module) => {
      if (musicToken !== token) return;
      const next = getMusic(module, name);
      music = next;
      if (!next || musicVolume <= 0) return;
      next.volume(0);
      next.play();
      next.fade(0, gain(musicVolume), 700);
    })
    .catch(() => {
      currentMusic = null;
    });
}

export function stopMusic(fadeMs = 350): void {
  const active = music;
  currentMusic = null;
  musicToken += 1;
  music = null;
  if (!active) return;

  if (fadeMs <= 0) {
    active.stop();
    return;
  }
  const volume = active.volume();
  active.fade(volume, 0, fadeMs);
  window.setTimeout(() => {
    active.stop();
  }, fadeMs + 30);
}

export function currentMusicTrack(): MusicName | null {
  return currentMusic;
}

/** РЎРІРѕСЂР°С‡РёРІР°РЅРёРµ РІРєР»Р°РґРєРё: РЅРµ С‚СЂР°С‚РёРј Р±Р°С‚Р°СЂРµСЋ Рё РЅРµ РёРіСЂР°РµРј РІ С„РѕРЅРµ. */
export function pauseAudio(): void {
  muted = true;
  howler?.Howler.mute(true);
  music?.pause();
}

export function resumeAudio(): void {
  muted = false;
  if (!howler) return;
  howler.Howler.mute(false);
  const context = howler.Howler.ctx;
  if (context && context.state === 'suspended') void context.resume();
  if (music && musicVolume > 0 && !music.playing()) music.play();
}

/** Р”Р»СЏ С‚РµСЃС‚РѕРІ/РѕС‚Р»Р°РґРєРё. */
export function audioState(): { musicVolume: number; sfxVolume: number; track: MusicName | null } {
  return { musicVolume, sfxVolume, track: currentMusic };
}

