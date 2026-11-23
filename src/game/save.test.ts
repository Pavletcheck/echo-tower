import { describe, expect, it } from 'vitest';
import { decodeSave, defaultSave, encodeSave, migrate, SAVE_VERSION } from './save';

describe('save', () => {
  it('creates a playable default save', () => {
    const save = defaultSave();
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.squad.length).toBe(5);
    expect(save.heroes.thorn?.star).toBe(3);
    expect(save.heroes.thorn?.level).toBe(8);
    expect(Object.values(save.heroes).every((hero) => hero.star === 3)).toBe(true);
    expect(save.tower.maxFloor).toBe(1);
  });

  it('round-trips through the export code', () => {
    const save = defaultSave();
    save.currencies.gold = 987_654;
    save.heroes.thorn.level = 33;
    save.flags.tutorialDone = true;

    const decoded = decodeSave(encodeSave(save));
    expect(decoded.currencies.gold).toBe(987_654);
    expect(decoded.heroes.thorn.level).toBe(33);
    expect(decoded.flags.tutorialDone).toBe(true);
  });

  it('rejects malformed export codes', () => {
    expect(() => decodeSave('nonsense')).toThrow();
  });

  it('merges partial legacy saves with defaults', () => {
    const migrated = migrate({ currencies: { gold: 42 } });
    expect(migrated.currencies.gold).toBe(42);
    expect(migrated.currencies.crystals).toBe(defaultSave().currencies.crystals);
    expect(migrated.squad.length).toBe(5);
    expect(migrated.version).toBe(SAVE_VERSION);
  });

  it('falls back to a fresh save for garbage input', () => {
    const migrated = migrate('broken');
    expect(migrated.currencies.gold).toBe(defaultSave().currencies.gold);
  });

  it('clamps broken audio and quality settings from legacy saves', () => {
    const migrated = migrate({
      settings: { music: 5, sfx: -2, haptics: 'yes', quality: 'ultra' },
    });
    expect(migrated.settings.music).toBe(1);
    expect(migrated.settings.sfx).toBe(0);
    expect(migrated.settings.haptics).toBe(defaultSave().settings.haptics);
    expect(migrated.settings.quality).toBe('auto');
    expect(migrated.settings.musicEnabled).toBe(true);
    expect(migrated.settings.sfxEnabled).toBe(true);
  });

  it('keeps explicit music/sfx off flags', () => {
    const migrated = migrate({ settings: { musicEnabled: false, sfxEnabled: false } });
    expect(migrated.settings.musicEnabled).toBe(false);
    expect(migrated.settings.sfxEnabled).toBe(false);
  });

  it('adds a safe default dining state for old saves', () => {
    const migrated = migrate({ currencies: { gold: 10 } });
    expect(migrated.dining).toEqual({
      date: '',
      claimed: false,
      buff: null,
      battles: 0,
      goldUntil: 0,
    });
  });

  it('starts the tutorial on a fresh save', () => {
    const save = defaultSave();
    expect(save.ftue.step).toBe(0);
    expect(save.ftue.completed).toBe(false);
    expect(save.ftue.skipped).toBe(false);
    expect(save.starter.claimedDays).toEqual([]);
    expect(save.squadPresets).toEqual([[], [], []]);
    expect(save.gearPresets).toEqual({});
    expect(save.settings.battleSpeed).toBe(1);
    expect(save.resonance).toEqual([]);
    expect(save.currencies.echoMarks).toBe(0);
    expect(save.endgame.world.total).toBe(0);
    expect(save.live.calendar.claimedDays).toEqual([]);
    expect(save.live.pass.xp).toBe(0);
    expect(save.live.event.id).toBe('glass-rain');
    expect(save.heroEssences).toEqual({});
    expect(save.heroes.thorn?.skillLevels).toEqual([1, 1, 1, 1]);
    expect(save.heroes.thorn?.artifactLevel).toBe(0);
    expect(save.version).toBe(SAVE_VERSION);
  });

  it('does not force the tutorial on legacy saves and keeps progress', () => {
    const migrated = migrate({
      version: 1,
      currencies: { gold: 777 },
      tower: { maxFloor: 12, clears: { '1': { stars: 3, first: true } } },
      gacha: { totalPulls: 42, beginnerUsed: true, pity5: 5, featuredGuaranteed: false, freeAt: 0 },
      quests: { lifetime: { floors: 12 } },
    });

    expect(migrated.tower.maxFloor).toBe(12);
    expect(migrated.gacha.totalPulls).toBe(42);
    expect(migrated.gacha.beginnerUsed).toBe(true);
    expect(migrated.currencies.gold).toBe(777);
    expect(migrated.ftue.completed).toBe(true);
    expect(migrated.ftue.skipped).toBe(true);
    expect(migrated.ftue.winPanelSeen).toBe(true);
    expect(migrated.ftue.lossPanelSeen).toBe(true);
    expect(migrated.starter.claimedDays).toEqual([]);
    expect(migrated.version).toBe(SAVE_VERSION);
  });

  it('normalizes broken tutorial and starter data', () => {
    const migrated = migrate({
      ftue: { step: 99, completed: false, skipped: 'yes', restarts: -4, firstWin: true },
      starter: { claimedDays: [2, 2, 0, 8, 3.9, 'x'], claimed: ['', 'a', 'a'] },
      squadPresets: [['thorn', 'thorn', '', 7], 'bad', ['neya', 'ghost']],
    });

    expect(migrated.ftue.step).toBe(3);
    expect(migrated.ftue.completed).toBe(true);
    expect(migrated.ftue.skipped).toBe(false);
    expect(migrated.ftue.restarts).toBe(0);
    expect(migrated.ftue.firstWin).toBe(true);
    expect(migrated.starter.claimedDays).toEqual([2, 3]);
    expect(migrated.starter.claimed).toEqual(['a']);
    expect(migrated.squadPresets).toEqual([['thorn'], [], ['neya', 'ghost']]);
  });

  it('normalizes battle speed and gear presets', () => {
    const migrated = migrate({
      settings: { battleSpeed: 9 },
      gearPresets: {
        thorn: [{ weapon: 'glass_weapon' }, 'broken', { armor: 'glass_armor', boots: 5 }],
        empty: [],
      },
    });

    expect(migrated.settings.battleSpeed).toBe(1);
    expect(migrated.gearPresets.thorn).toEqual([
      { weapon: 'glass_weapon' },
      {},
      { armor: 'glass_armor' },
    ]);
    expect(migrated.gearPresets.empty).toEqual([{}, {}, {}]);

    const fast = migrate({ settings: { battleSpeed: 4 } });
    expect(fast.settings.battleSpeed).toBe(4);
  });

  it('adds skill, artifact and resonance fields to legacy heroes', () => {
    const migrated = migrate({
      heroes: { thorn: { star: 4, level: 12, xp: 3 } },
      resonance: ['thorn', 'thorn', '', 'neya', 'ghost', 'zip'],
    });

    expect(migrated.heroes.thorn?.skillLevels).toEqual([1, 1, 1, 1]);
    expect(migrated.heroes.thorn?.artifactLevel).toBe(0);
    expect(migrated.heroes.thorn?.ascensionShardsSpent).toBe(0);
    expect(migrated.heroes.thorn?.levelGoldSpent).toBe(0);
    expect(migrated.resonance).toEqual(['thorn', 'neya', 'ghost', 'zip']);

    const broken = migrate({
      heroes: { thorn: { skillLevels: [9, 0, 2, 'x'], artifactLevel: 12, ascensionShardsSpent: -5 } },
    });
    expect(broken.heroes.thorn?.skillLevels).toEqual([5, 1, 2, 1]);
    expect(broken.heroes.thorn?.artifactLevel).toBe(5);
    expect(broken.heroes.thorn?.ascensionShardsSpent).toBe(0);
  });

  it('normalizes endgame state for old and broken saves', () => {
    const migrated = migrate({
      endgame: {
        world: { attempts: 9, total: -5, best: 10, claimed: ['tier1', 'tier1'] },
        towers: { echo: 99, ash: -3 },
        endless: { runs: 9, best: 4 },
        hard: { cleared: [0, 1, 1, 11] },
        challenges: { claimed: ['a', 'a', 7] },
        shop: { bought: { endgame_essence: 2, bad: -1 } },
      },
    });

    expect(migrated.endgame.world.attempts).toBe(3);
    expect(migrated.endgame.world.total).toBe(0);
    expect(migrated.endgame.world.best).toBe(10);
    expect(migrated.endgame.world.claimed).toEqual(['tier1']);
    expect(migrated.endgame.towers).toEqual({ echo: 30, ash: 0 });
    expect(migrated.endgame.endless.runs).toBe(3);
    expect(migrated.endgame.hard.cleared).toEqual([1]);
    expect(migrated.endgame.challenges.claimed).toEqual(['a']);
    expect(migrated.endgame.shop.bought.endgame_essence).toBe(2);
  });

  it('normalizes live-ops state and keeps mail rewards', () => {
    const migrated = migrate({
      live: {
        calendar: { claimedDays: [1, 1, 99] },
        pass: { xp: 99_999, claimedFree: [1, 1, 99], claimedPaid: [2] },
        event: { cleared: [0, 0, 9], currency: -5 },
        mail: [
          {
            id: 'mail-test',
            key: 'mail.welcome',
            rewards: { gold: 5 },
            createdAt: 1,
            expiresAt: 2,
            claimed: false,
          },
        ],
      },
    });

    expect(migrated.live.calendar.claimedDays).toEqual([1]);
    expect(migrated.live.pass.xp).toBe(5000);
    expect(migrated.live.pass.claimedFree).toEqual([1]);
    expect(migrated.live.pass.claimedPaid).toEqual([2]);
    expect(migrated.live.event.cleared).toEqual([0]);
    expect(migrated.live.event.currency).toBe(0);
    expect(migrated.live.mail[0]?.rewards.gold).toBe(5);
  });

  it('keeps tutorial and starter progress through the export code', () => {
    const save = defaultSave();
    save.ftue.step = 3;
    save.ftue.firstWin = true;
    save.starter.claimedDays = [1, 2];

    const decoded = decodeSave(encodeSave(save));
    expect(decoded.ftue.step).toBe(3);
    expect(decoded.ftue.firstWin).toBe(true);
    expect(decoded.starter.claimedDays).toEqual([1, 2]);
  });
});
