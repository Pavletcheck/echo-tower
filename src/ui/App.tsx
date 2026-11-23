import { useEffect } from 'preact/hooks';
import { initAudio, pauseAudio, playMusic, playSfx, resumeAudio, setAudioVolumes } from '../core/audio';
import { bus } from '../core/events';
import { screen$ } from '../core/router';
import { commit, flushSave, save$ } from '../game/state';
import { IAP_ITEMS } from '../data/shop';
import { grantIap } from '../game/shop';
import { platform } from '../platform';
import { ToastHost } from './components/ToastHost';
import { Battle } from './screens/Battle';
import { Boot } from './screens/Boot';
import { Arena } from './screens/Arena';
import { Expeditions } from './screens/Expeditions';
import { HeroDetail } from './screens/HeroDetail';
import { Heroes } from './screens/Heroes';
import { Modes } from './screens/Modes';
import { Quests } from './screens/Quests';
import { Rift } from './screens/Rift';
import { Shop } from './screens/Shop';
import { Squad } from './screens/Squad';
import { Starter } from './screens/Starter';
import { Endgame } from './screens/Endgame';
import { Live } from './screens/Live';
import { Mail } from './screens/Mail';
import { Achievements } from './screens/Achievements';
import { Storage } from './screens/Storage';
import { Summon } from './screens/Summon';
import { Tower } from './screens/Tower';
import { Trials } from './screens/Trials';
import { Lobby } from './screens/Lobby';
import { Social } from './screens/Social';
import { Throne } from './screens/Throne';
import { Title } from './screens/Title';
import { TutorialOverlay } from './tutorial/TutorialOverlay';

export function App() {
  const screen = screen$.value;

  useEffect(() => {
    const applyAudio = () => {
      const settings = save$.value.settings;
      setAudioVolumes(
        settings.musicEnabled ? settings.music : 0,
        settings.sfxEnabled ? settings.sfx : 0,
      );
    };

    applyAudio();
    initAudio();
    const unsubscribe = bus.on('save:changed', applyAudio);

    const onVisibility = () => {
      if (document.hidden) {
        flushSave();
        pauseAudio();
      } else {
        resumeAudio();
      }
    };
    const onPageHide = () => {
      flushSave();
      pauseAudio();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target.closest('button') : null;
      if (target instanceof HTMLButtonElement && !target.disabled) playSfx('click');
    };

    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pagehide', onPageHide);

    // Рекламный оверлей площадки не всегда триггерит visibilitychange.
    try {
      platform().onPause(() => {
        flushSave();
        pauseAudio();
      });
      platform().onResume(() => {
        resumeAudio();
      });
    } catch {
      /* платформа ещё не готова */
    }

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  useEffect(() => {
    // Восстанавливаем покупки площадки: после переустановки или смены устройства.
    void (async () => {
      try {
        const sdk = platform();
        if (!sdk.payments.available) return;
        const owned = await sdk.payments.restore();
        if (owned.length === 0) return;
        commit((draft) => {
          for (const sku of owned) {
            // Кристаллы — расходуемый товар; restore не должен начислять их повторно.
            if (sku === 'crystals_600') continue;
            const item = IAP_ITEMS.find((product) => product.sku === sku);
            if (item) grantIap(draft, item);
          }
        }, 'iap-restore');
      } catch {
        /* площадка без платежей */
      }
    })();
  }, []);

  useEffect(() => {
    // В бою трек выбирает Battle: обычный этаж или босс.
    if (screen !== 'battle') playMusic('lobby');
  }, [screen]);

  return (
    <div class="stage">
      <main class="frame">
        {screen === 'boot' ? <Boot /> : null}
        {screen === 'title' ? <Title /> : null}
        {screen === 'lobby' ? <Lobby /> : null}
        {screen === 'battle' ? <Battle /> : null}
        {screen === 'squad' ? <Squad /> : null}
        {screen === 'heroes' ? <Heroes /> : null}
        {screen === 'hero' ? <HeroDetail /> : null}
        {screen === 'storage' ? <Storage /> : null}
        {screen === 'summon' ? <Summon /> : null}
        {screen === 'shop' ? <Shop /> : null}
        {screen === 'tower' ? <Tower /> : null}
        {screen === 'modes' ? <Modes /> : null}
        {screen === 'expeditions' ? <Expeditions /> : null}
        {screen === 'rift' ? <Rift /> : null}
        {screen === 'arena' ? <Arena /> : null}
        {screen === 'trials' ? <Trials /> : null}
        {screen === 'quests' ? <Quests /> : null}
        {screen === 'starter' ? <Starter /> : null}
        {screen === 'endgame' ? <Endgame /> : null}
        {screen === 'live' ? <Live /> : null}
        {screen === 'mail' ? <Mail /> : null}
        {screen === 'achievements' ? <Achievements /> : null}
        {screen === 'social' ? <Social /> : null}
        {screen === 'throne' ? <Throne /> : null}
        <TutorialOverlay />
        <ToastHost />
      </main>
    </div>
  );
}
