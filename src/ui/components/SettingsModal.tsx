import { useState } from 'preact/hooks';
import { locale$, setLocale, t } from '../../core/i18n';
import { navigate } from '../../core/router';
import { formatNumber } from '../../core/time';
import {
  decodeSave,
  defaultSave,
  encodeSave,
  type Locale,
  type SaveV1,
} from '../../game/save';
import { commit, save$, setSave } from '../../game/state';
import { ftueStatus, restartFtue } from '../../game/ftue';
import { Modal } from './Modal';
import { toast } from './toast';

export interface SettingsModalProps {
  onClose: () => void;
}

function changeLocale(next: Locale): void {
  setLocale(next);
  commit((draft) => {
    draft.player.locale = next;
  }, 'locale');
}

const QUALITY_OPTIONS: ReadonlyArray<{ id: SaveV1['settings']['quality']; label: string }> = [
  { id: 'auto', label: 'settings.quality.auto' },
  { id: 'low', label: 'settings.quality.low' },
  { id: 'high', label: 'settings.quality.high' },
];

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [resetConfirm, setResetConfirm] = useState(false);
  const [exportCode, setExportCode] = useState('');
  const [importCode, setImportCode] = useState('');
  const [copied, setCopied] = useState(false);

  const current = locale$.value;
  const save = save$.value;
  const settings = save.settings;
  const ownedHeroes = Object.keys(save.heroes).length;
  const created = new Date(save.createdAt || Date.now()).toLocaleDateString(
    current === 'en' ? 'en-US' : 'ru-RU',
  );

  const update = (patch: Partial<SaveV1['settings']>): void => {
    commit((draft) => {
      draft.settings = { ...draft.settings, ...patch };
    }, 'settings');
  };

  const resetSettings = (): void => {
    commit((draft) => {
      draft.settings = { ...defaultSave().settings, musicEnabled: true, sfxEnabled: true };
    }, 'settings-reset');
    toast(t('settings.resetSettings.done'), 'success');
  };

  const replayTutorial = (): void => {
    commit((draft) => {
      restartFtue(draft);
    }, 'ftue-restart');
    toast(t('tutorial.restarted'), 'success');
    onClose();
    navigate('lobby');
  };

  const showExport = (): void => {
    setExportCode(encodeSave(save$.value));
    setCopied(false);
  };

  const copyExport = async (): Promise<void> => {
    if (!exportCode) return;
    try {
      await navigator.clipboard.writeText(exportCode);
      setCopied(true);
      toast(t('settings.export.copied'), 'success');
    } catch {
      const area = document.querySelector<HTMLTextAreaElement>('.settings-code');
      if (area) {
        area.select();
        document.execCommand('copy');
        setCopied(true);
        toast(t('settings.export.copied'), 'success');
      } else {
        toast(t('settings.import.error'), 'error');
      }
    }
  };

  const importSave = (): void => {
    const code = importCode.trim();
    if (!code) return;
    try {
      const imported = decodeSave(code);
      setSave(imported);
      setLocale(imported.player.locale === 'en' ? 'en' : 'ru');
      toast(t('settings.import.success'), 'success');
      onClose();
      navigate('lobby');
    } catch {
      toast(t('settings.import.error'), 'error');
    }
  };

  const resetProgress = (): void => {
    setSave(defaultSave());
    setLocale('ru');
    toast(t('settings.reset.done'), 'success');
    onClose();
    navigate('title');
  };

  return (
    <Modal title={t('settings.title')} onClose={onClose}>
      <div class="settings-section">
        <div class="settings-section__title">{t('settings.profile')}</div>
        <div class="settings-stats">
          <div class="settings-stat">
            <span>{t('settings.stats.heroes')}</span>
            <b>{ownedHeroes} / 32</b>
          </div>
          <div class="settings-stat">
            <span>{t('settings.stats.floor')}</span>
            <b>{save.tower.maxFloor}</b>
          </div>
          <div class="settings-stat">
            <span>{t('settings.stats.pulls')}</span>
            <b>{formatNumber(save.gacha.totalPulls, current)}</b>
          </div>
          <div class="settings-stat">
            <span>{t('settings.stats.created')}</span>
            <b>{created}</b>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section__title">{t('settings.audio')}</div>

        <div class="row row--between">
          <span>{t('settings.music')}</span>
          <div class="settings-volume">
            <span class="muted">{Math.round(settings.music * 100)}%</span>
            <div class="switch" role="group" aria-label={t('settings.music')}>
              <button
                class={`switch__item${settings.musicEnabled ? ' switch__item--active' : ''}`}
                onClick={() => update({ musicEnabled: true })}
              >
                {t('common.on')}
              </button>
              <button
                class={`switch__item${settings.musicEnabled ? '' : ' switch__item--active'}`}
                onClick={() => update({ musicEnabled: false })}
              >
                {t('common.off')}
              </button>
            </div>
          </div>
        </div>
        <input
          class="range"
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(settings.music * 100)}
          aria-label={t('settings.music')}
          onInput={(event) => update({ music: Number(event.currentTarget.value) / 100 })}
        />

        <div class="row row--between">
          <span>{t('settings.sfx')}</span>
          <div class="settings-volume">
            <span class="muted">{Math.round(settings.sfx * 100)}%</span>
            <div class="switch" role="group" aria-label={t('settings.sfx')}>
              <button
                class={`switch__item${settings.sfxEnabled ? ' switch__item--active' : ''}`}
                onClick={() => update({ sfxEnabled: true })}
              >
                {t('common.on')}
              </button>
              <button
                class={`switch__item${settings.sfxEnabled ? '' : ' switch__item--active'}`}
                onClick={() => update({ sfxEnabled: false })}
              >
                {t('common.off')}
              </button>
            </div>
          </div>
        </div>
        <input
          class="range"
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(settings.sfx * 100)}
          aria-label={t('settings.sfx')}
          onInput={(event) => update({ sfx: Number(event.currentTarget.value) / 100 })}
        />
      </div>

      <div class="settings-section">
        <div class="settings-section__title">{t('settings.language')}</div>
        <div class="switch switch--wide" role="group" aria-label={t('settings.language')}>
          <button
            class={`switch__item${current === 'ru' ? ' switch__item--active' : ''}`}
            onClick={() => changeLocale('ru')}
          >
            RU
          </button>
          <button
            class={`switch__item${current === 'en' ? ' switch__item--active' : ''}`}
            onClick={() => changeLocale('en')}
          >
            EN
          </button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section__title">{t('settings.quality')}</div>
        <div class="switch switch--wide" role="group" aria-label={t('settings.quality')}>
          {QUALITY_OPTIONS.map((option) => (
            <button
              key={option.id}
              class={`switch__item${settings.quality === option.id ? ' switch__item--active' : ''}`}
              onClick={() => update({ quality: option.id })}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section__title">{t('settings.battleSpeed')}</div>
        <div class="switch switch--wide" role="group" aria-label={t('settings.battleSpeed')}>
          {([1, 2, 3, 4] as const).map((value) => (
            <button
              key={value}
              class={`switch__item${settings.battleSpeed === value ? ' switch__item--active' : ''}`}
              onClick={() => update({ battleSpeed: value })}
            >
              {value}×
            </button>
          ))}
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section__title">{t('settings.haptics')}</div>
        <div class="switch switch--wide" role="group" aria-label={t('settings.haptics')}>
          <button
            class={`switch__item${settings.haptics ? ' switch__item--active' : ''}`}
            onClick={() => update({ haptics: true })}
          >
            {t('common.on')}
          </button>
          <button
            class={`switch__item${settings.haptics ? '' : ' switch__item--active'}`}
            onClick={() => update({ haptics: false })}
          >
            {t('common.off')}
          </button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section__title">{t('settings.tutorial')}</div>
        <p class="settings-hint">{t('settings.tutorial.desc')}</p>
        <div class="row row--between">
          <span>{t(`settings.tutorial.status.${ftueStatus(save)}`)}</span>
          <button class="btn btn--sm" onClick={replayTutorial}>
            {t('settings.tutorial.restart')}
          </button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section__title">{t('settings.save')}</div>
        <p class="settings-hint">{t('settings.export.hint')}</p>
        <div class="settings-actions">
          <button class="btn btn--sm" onClick={showExport}>
            {t('settings.export')}
          </button>
          {exportCode ? (
            <button class={`btn btn--sm ${copied ? 'btn--gold' : ''}`} onClick={copyExport}>
              {copied ? t('settings.export.copied') : t('settings.copy')}
            </button>
          ) : null}
        </div>
        {exportCode ? (
          <textarea class="settings-code" readOnly value={exportCode} aria-label={t('settings.export')} />
        ) : null}

        <textarea
          class="settings-code"
          placeholder={t('settings.import.placeholder')}
          value={importCode}
          aria-label={t('settings.import')}
          onInput={(event) => setImportCode(event.currentTarget.value)}
        />
        <button class="btn btn--sm" disabled={!importCode.trim()} onClick={importSave}>
          {t('settings.import')}
        </button>

        <button class="btn btn--ghost btn--sm" onClick={resetSettings}>
          {t('settings.resetSettings')}
        </button>
      </div>

      <div class="settings-section settings-danger">
        <div class="settings-section__title">{t('settings.danger')}</div>
        {resetConfirm ? (
          <>
            <p class="settings-hint">{t('settings.reset.confirm')}</p>
            <div class="settings-actions">
              <button class="btn btn--sm btn--ghost" onClick={() => setResetConfirm(false)}>
                {t('common.cancel')}
              </button>
              <button class="btn btn--sm btn--danger" onClick={resetProgress}>
                {t('settings.reset')}
              </button>
            </div>
          </>
        ) : (
          <button class="btn btn--ghost btn--sm" onClick={() => setResetConfirm(true)}>
            {t('settings.reset')}
          </button>
        )}
      </div>

      <div class="row row--between">
        <span>{t('settings.version')}</span>
        <span class="muted">0.1.0 · prototype</span>
      </div>

      <button class="btn btn--wide" onClick={onClose}>
        {t('settings.close')}
      </button>
    </Modal>
  );
}
