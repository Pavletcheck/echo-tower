import type { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { asset } from '../../core/asset';
import { playSfx } from '../../core/audio';
import { haptic } from '../../core/haptics';
import { locale$ } from '../../core/i18n';
import { battleBackground } from '../../data/backgrounds';
import { BOSSES_BY_ID, ENEMIES_BY_ID } from '../../data/enemies';
import { unitCombatStats } from '../../game/battle/stats';
import type { BattleEvent, UnitInit } from '../../game/battle/types';
import type { SaveV1 } from '../../game/save';

type Quality = SaveV1['settings']['quality'];
type NumberTone = 'damage' | 'heal' | 'crit';

type PixiModule = typeof import('pixi.js');

const W = 720;
const H = 1080;

const ELEMENT_COLOR: Record<string, number> = {
  echo: 0x37e0c8,
  ash: 0xff6b4a,
  frost: 0x6fb6ff,
  rot: 0x8fcf4a,
  light: 0xf2d27a,
};

const ELEMENT_GLOW: Record<string, number> = {
  echo: 0x0d3a36,
  ash: 0x3a150d,
  frost: 0x0d2440,
  rot: 0x1d2f0d,
  light: 0x3a2d0d,
};

interface UnitView {
  uid: string;
  side: 'ally' | 'enemy';
  root: Container;
  hpFill: Graphics;
  shieldRing: Graphics;
  color: number;
  hp: number;
  maxHp: number;
  pulse: number;
  shieldTimer: number;
  baseX: number;
  baseY: number;
  bob: number;
  flash: Graphics;
  deathTimer: number;
}

interface FloatingNumber {
  text: Text;
  tone: NumberTone;
  life: number;
  vy: number;
}

interface Effect {
  view: Graphics;
  life: number;
  duration: number;
  kind: 'ring' | 'spark';
  vx?: number;
  vy?: number;
}

function hexPoints(width: number, height: number, offsetX = 0, offsetY = 0): number[] {
  return [
    offsetX,
    offsetY - height / 2,
    offsetX + width / 2,
    offsetY - height / 4,
    offsetX + width / 2,
    offsetY + height / 4,
    offsetX,
    offsetY + height / 2,
    offsetX - width / 2,
    offsetY + height / 4,
    offsetX - width / 2,
    offsetY - height / 4,
  ];
}

export class BattleStage {
  private pixi: PixiModule | null = null;
  private app: Application | null = null;
  private root: Container | null = null;
  private background: Graphics | null = null;
  private unitLayer: Container | null = null;
  private effectLayer: Container | null = null;
  private textLayer: Container | null = null;
  private units = new Map<string, UnitView>();
  private numbers: FloatingNumber[] = [];
  private effects: Effect[] = [];
  private bgSprite: Sprite | null = null;
  private bgChapter = 0;
  private resizeObserver: ResizeObserver | null = null;
  private readonly host: HTMLElement;
  private readonly lowQuality: boolean;
  private readonly reducedMotion: boolean;
  private destroyed = false;
  private shake = 0;
  private shakeTime = 0;
  private shakeClock = 0;
  private jitter = 0;
  private textPools: Record<NumberTone, Text[]> = { damage: [], heal: [], crit: [] };
  private ringPool: Graphics[] = [];
  private sparkPool: Graphics[] = [];

  onTick: ((dt: number) => void) | null = null;

  constructor(host: HTMLElement, quality: Quality = 'auto') {
    this.host = host;
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 8 : 8;
    this.lowQuality = quality === 'low' || (quality === 'auto' && cores <= 4);
    this.reducedMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  async init(): Promise<void> {
    if (this.destroyed || this.app) return;

    const pixi = await import('pixi.js');
    if (this.destroyed) return;
    this.pixi = pixi;

    const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    const app = new pixi.Application();
    await app.init({
      resizeTo: this.host,
      backgroundAlpha: 0,
      antialias: !this.lowQuality,
      resolution: this.lowQuality ? 1 : Math.min(pixelRatio, 2),
      autoDensity: true,
      preference: 'webgl',
    });
    app.ticker.maxFPS = 60;

    if (this.destroyed) {
      app.destroy(true, { children: true });
      return;
    }

    this.app = app;
    this.host.appendChild(app.canvas);
    app.canvas.style.width = '100%';
    app.canvas.style.height = '100%';
    app.canvas.style.display = 'block';

    this.root = new pixi.Container();
    this.background = new pixi.Graphics();
    this.unitLayer = new pixi.Container();
    this.effectLayer = new pixi.Container();
    this.textLayer = new pixi.Container();
    this.root.addChild(this.background, this.unitLayer, this.effectLayer, this.textLayer);
    app.stage.addChild(this.root);

    this.drawBackground(1, 'echo');
    this.layout();

    this.resizeObserver = new ResizeObserver(() => {
      this.app?.resize();
      this.layout();
    });
    this.resizeObserver.observe(this.host);

    app.ticker.add((ticker) => {
      const dt = Math.min(0.05, ticker.deltaMS / 1000);
      this.animate(dt);
      this.onTick?.(dt);
    });
  }

  setPaused(paused: boolean): void {
    if (!this.app) return;
    if (paused) this.app.ticker.stop();
    else this.app.ticker.start();
  }

  private layout(): void {
    const app = this.app;
    const root = this.root;
    if (!app || !root) return;

    const width = app.screen.width;
    const height = app.screen.height;
    const scale = Math.min(width / W, height / H);
    const offsetX = (width - W * scale) / 2;
    const offsetY = (height - H * scale) / 2;

    let sx = 0;
    let sy = 0;
    if (this.shakeTime > 0 && !this.reducedMotion) {
      sx = Math.sin(this.shakeClock * 131) * this.shake * 0.5;
      sy = Math.cos(this.shakeClock * 97) * this.shake * 0.5;
    }

    root.scale.set(scale);
    root.position.set(offsetX + sx, offsetY + sy);
  }

  private drawBackground(chapter: number, element: string): void {
    const g = this.background;
    if (!g) return;

    const top = ELEMENT_GLOW[element] ?? 0x14102a;
    const bottom = 0x07050d;

    g.clear();
    g.rect(0, 0, W, H).fill(bottom);

    const bands = this.lowQuality ? 10 : 18;
    for (let index = 0; index < bands; index += 1) {
      const ratio = index / bands;
      const color = this.mix(top, bottom, ratio);
      g.rect(0, (H / bands) * index, W, H / bands + 1).fill({ color });
    }

    const hexCount = this.lowQuality ? 12 : 26;
    for (let index = 0; index < hexCount; index += 1) {
      const x = (index * 137 + chapter * 53) % W;
      const y = (index * 211 + chapter * 97) % H;
      const size = 18 + (index % 5) * 10;
      g.poly(hexPoints(size, size * 1.14, x, y)).stroke({ width: 1, color: 0x9b7bff, alpha: 0.07 });
    }

    g.rect(0, H - 210, W, 210).fill({ color: 0x07050d, alpha: 0.55 });
  }

  private mix(a: number, b: number, ratio: number): number {
    const ar = (a >> 16) & 0xff;
    const ag = (a >> 8) & 0xff;
    const ab = a & 0xff;
    const br = (b >> 16) & 0xff;
    const bg = (b >> 8) & 0xff;
    const bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * ratio);
    const gr = Math.round(ag + (bg - ag) * ratio);
    const bl = Math.round(ab + (bb - ab) * ratio);
    return (r << 16) | (gr << 8) | bl;
  }

  setChapter(chapter: number, element: string): void {
    if (this.bgChapter === chapter) return;
    this.bgChapter = chapter;
    this.drawBackground(chapter, element);
    void this.loadBattleArt(chapter);
  }

  private async loadBattleArt(chapter: number): Promise<void> {
    const pixi = this.pixi;
    if (!pixi || !this.root) return;

    if (this.bgSprite) {
      this.bgSprite.destroy();
      this.bgSprite = null;
    }

    const index = Math.min(10, Math.max(1, Math.round(chapter)));
    const file = battleBackground(index);

    try {
      const texture = await pixi.Assets.load(asset(file));
      if (this.destroyed || !this.root) return;

      const sprite = new pixi.Sprite(texture);
      const scale = Math.max(W / texture.width, H / texture.height);
      sprite.anchor.set(0.5);
      sprite.scale.set(scale);
      sprite.position.set(W / 2, H / 2);
      sprite.alpha = 0.54;

      this.root.addChildAt(sprite, 1);
      this.bgSprite = sprite;
      this.bgChapter = chapter;
    } catch (error) {
      if (__DEV__) console.warn('[echo] battle background failed', error);
    }
  }

  hasBackgroundArt(): boolean {
    return Boolean(this.bgSprite);
  }

  private positionFor(side: 'ally' | 'enemy', slot: number, count: number): { x: number; y: number } {
    const span = 540;
    const x = count <= 1 ? W / 2 : W / 2 - span / 2 + (span / Math.max(1, count - 1)) * slot;
    const baseY = side === 'ally' ? 800 : 320;
    const y = baseY;
    return { x, y };
  }

  loadWave(allies: readonly UnitInit[], enemies: readonly UnitInit[], startHp: Map<string, number>): void {
    const pixi = this.pixi;
    if (!pixi || !this.unitLayer) return;

    for (const view of this.units.values()) view.root.destroy({ children: true });
    this.units.clear();
    for (const number of this.numbers) this.releaseText(number.tone, number.text);
    this.numbers = [];
    for (const effect of this.effects) this.releaseEffect(effect.view, effect.kind);
    this.effects = [];
    this.shake = 0;
    this.shakeTime = 0;
    this.shakeClock = 0;
    this.layout();

    const sides = [
      { side: 'enemy' as const, units: enemies },
      { side: 'ally' as const, units: allies },
    ];

    for (const group of sides) {
      group.units.forEach((unit, index) => this.createUnitView(unit, group.side, index, group.units.length, startHp));
    }
  }

  private createUnitView(
    unit: UnitInit,
    side: 'ally' | 'enemy',
    index: number,
    count: number,
    startHp: Map<string, number>,
  ): void {
    const pixi = this.pixi;
    const layer = this.unitLayer;
    if (!pixi || !layer) return;

    const color = ELEMENT_COLOR[unit.element] ?? 0x9b7bff;
    const displayName = locale$.value === 'ru' ? unit.name : unit.nameEn ?? unit.name;
    const { x, y } = this.positionFor(side, index, count);
    const stats = unitCombatStats(unit);
    const maxHp = Math.round(stats.hp * (unit.hpMult ?? 1));
    const hp = Math.max(0, Math.min(maxHp, startHp.get(unit.uid) ?? maxHp));

    const root = new pixi.Container();
    root.position.set(x, y);

    const body = new pixi.Graphics();
    body
      .poly(hexPoints(96, 110))
      .fill({ color: 0x0d0a18, alpha: 0.94 })
      .stroke({ width: 2, color, alpha: 0.9 });
    body.poly(hexPoints(70, 80)).stroke({ width: 1, color, alpha: 0.16 });
    root.addChild(body);

    const initial = new pixi.Text({
      text: displayName.slice(0, 2).toUpperCase(),
      style: {
        fontFamily: 'Oswald, Arial Narrow, sans-serif',
        fontSize: 26,
        fontWeight: '700',
        fill: color,
      },
    });
    initial.anchor.set(0.5);
    initial.y = -6;
    root.addChild(initial);

    const flash = new pixi.Graphics();
    flash.poly(hexPoints(96, 110)).fill({ color: 0xffffff, alpha: 1 });
    flash.alpha = 0;
    root.addChild(flash);

    const barWidth = 94;
    const bar = new pixi.Graphics();
    bar
      .roundRect(-barWidth / 2, -78, barWidth, 7, 3)
      .fill({ color: 0x05030a, alpha: 0.92 })
      .stroke({ width: 1, color: 0x2e2450 });
    root.addChild(bar);

    const hpFill = new pixi.Graphics();
    hpFill.rect(0, 0, barWidth - 2, 5).fill({ color: side === 'ally' ? 0x37e0c8 : 0xff5a6e });
    hpFill.position.set(-barWidth / 2 + 1, -77);
    root.addChild(hpFill);

    const shieldRing = new pixi.Graphics();
    shieldRing.circle(0, 0, 60).stroke({ width: 3, color: 0x9b7bff, alpha: 0.7 });
    shieldRing.visible = false;
    root.addChild(shieldRing);

    const name = new pixi.Text({
      text: displayName,
      style: {
        fontFamily: 'Manrope, Segoe UI, sans-serif',
        fontSize: 12,
        fill: 0x9a8fb8,
      },
    });
    name.anchor.set(0.5);
    name.y = 74;
    root.addChild(name);

    layer.addChild(root);

    const view: UnitView = {
      uid: unit.uid,
      side,
      root,
      hpFill,
      shieldRing,
      color,
      hp,
      maxHp,
      pulse: 0,
      shieldTimer: 0,
      baseX: x,
      baseY: y,
      bob: (index % 5) * 1.3,
      flash,
      deathTimer: 0,
    };
    this.units.set(unit.uid, view);
    this.setHp(unit.uid, hp, maxHp);
    void this.attachUnitArt(unit, view, initial);
  }

  /** Art paths for a unit, most specific first. */
  private artPaths(unit: UnitInit): string[] {
    if (unit.side === 'ally') {
      return [
        `assets/heroes/${unit.defId}/card.webp`,
        `assets/heroes/${unit.defId}/portrait.webp`,
        `assets/heroes/${unit.defId}/sprite.webp`,
      ];
    }
    const enemy = ENEMIES_BY_ID[unit.defId];
    if (enemy?.asset) return [enemy.asset];
    const boss = BOSSES_BY_ID[unit.defId];
    if (boss?.asset) return [boss.asset];
    return [];
  }

  private async attachUnitArt(unit: UnitInit, view: UnitView, initial: Text): Promise<void> {
    const pixi = this.pixi;
    if (!pixi || this.destroyed) return;

    for (const path of this.artPaths(unit)) {
      try {
        const texture = await this.loadTexture(path);
        if (this.destroyed || !view.root.parent) return;

        const sprite = new pixi.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.alpha = 0.98;

        // cover the hexagon without distortion
        const boxW = 92;
        const boxH = 104;
        const scale = Math.max(boxW / texture.width, boxH / texture.height);
        sprite.scale.set(scale);
        // Карточка героя выше гекса: сдвигаем вниз, чтобы в кадре остались лицо и торс.
        sprite.position.set(0, unit.side === 'ally' ? 10 : 2);

        const mask = new pixi.Graphics();
        mask.poly(hexPoints(94, 108)).fill({ color: 0xffffff });
        const holder = new pixi.Container();
        holder.addChild(sprite);
        holder.addChild(mask);
        sprite.mask = mask;

        view.root.addChildAt(holder, 1);
        initial.visible = false;
        return;
      } catch {
        // try the next candidate
      }
    }
  }

  private textureCache = new Map<string, Promise<import('pixi.js').Texture>>();

  private loadTexture(path: string): Promise<import('pixi.js').Texture> {
    const pixi = this.pixi;
    if (!pixi) return Promise.reject(new Error('pixi not ready'));
    const url = asset(path);
    const cached = this.textureCache.get(url);
    if (cached) return cached;
    const promise = pixi.Assets.load(url) as Promise<import('pixi.js').Texture>;
    this.textureCache.set(url, promise);
    return promise;
  }

  setHp(uid: string, hp: number, maxHp?: number): void {
    const view = this.units.get(uid);
    if (!view) return;
    if (maxHp !== undefined) view.maxHp = maxHp;
    view.hp = Math.max(0, Math.min(view.maxHp, hp));
    view.hpFill.scale.x = view.maxHp > 0 ? view.hp / view.maxHp : 0;
    view.root.alpha = view.hp <= 0 ? 0.18 : 1;
  }

  getHp(uid: string): number {
    return this.units.get(uid)?.hp ?? 0;
  }

  private takeText(tone: NumberTone): Text | null {
    const pixi = this.pixi;
    if (!pixi) return null;
    const pooled = this.textPools[tone].pop();
    if (pooled) {
      pooled.visible = true;
      pooled.alpha = 1;
      pooled.scale.set(1);
      return pooled;
    }
    const text = new pixi.Text({
      text: '',
      style: {
        fontFamily: 'Manrope, Segoe UI, sans-serif',
        fontSize: tone === 'crit' ? 30 : 22,
        fontWeight: '800',
        fill: tone === 'heal' ? 0x37e0c8 : tone === 'crit' ? 0xffd77a : 0xff8a9a,
        stroke: { color: 0x05030a, width: 4 },
      },
    });
    text.anchor.set(0.5);
    return text;
  }

  private releaseText(tone: NumberTone, text: Text): void {
    text.visible = false;
    this.textPools[tone].push(text);
  }

  private takeRing(): Graphics | null {
    const pixi = this.pixi;
    if (!pixi) return null;
    const pooled = this.ringPool.pop();
    if (pooled) {
      pooled.visible = true;
      pooled.alpha = 1;
      pooled.scale.set(1);
      return pooled;
    }
    return new pixi.Graphics();
  }

  private takeSpark(): Graphics | null {
    const pixi = this.pixi;
    if (!pixi) return null;
    const pooled = this.sparkPool.pop();
    if (pooled) {
      pooled.visible = true;
      pooled.alpha = 1;
      pooled.scale.set(1);
      pooled.rotation = 0;
      return pooled;
    }
    return new pixi.Graphics();
  }

  private releaseEffect(view: Graphics, kind: Effect['kind']): void {
    view.visible = false;
    if (kind === 'ring') this.ringPool.push(view);
    else this.sparkPool.push(view);
  }

  private spawnNumber(uid: string, value: number, tone: NumberTone): void {
    const layer = this.textLayer;
    const view = this.units.get(uid);
    if (!layer || !view) return;

    const text = this.takeText(tone);
    if (!text) return;
    text.text = `${tone === 'heal' ? '+' : '−'}${Math.abs(Math.round(value))}`;
    this.jitter = (this.jitter + 1) % 16;
    text.position.set(view.root.x + Math.sin(this.jitter * 1.7) * 18, view.root.y - 54);
    text.alpha = 1;
    text.scale.set(tone === 'crit' ? 1.45 : 1.12);
    if (!text.parent) layer.addChild(text);
    this.numbers.push({ text, tone, life: 0.9, vy: -70 });

    const cap = this.lowQuality ? 16 : 28;
    if (this.numbers.length > cap) {
      const oldest = this.numbers.shift();
      if (oldest) this.releaseText(oldest.tone, oldest.text);
    }
  }

  private spawnRing(uid: string): void {
    const layer = this.effectLayer;
    const view = this.units.get(uid);
    if (!layer || !view) return;

    const ring = this.takeRing();
    if (!ring) return;
    ring.clear();
    ring.circle(0, 0, 34).stroke({ width: 4, color: view.color, alpha: 0.9 });
    ring.position.set(view.root.x, view.root.y);
    if (!ring.parent) layer.addChild(ring);
    this.effects.push({ view: ring, life: 0.45, duration: 0.45, kind: 'ring' });

    const cap = this.lowQuality ? 36 : 72;
    if (this.effects.length > cap) {
      const oldest = this.effects.shift();
      if (oldest) this.releaseEffect(oldest.view, oldest.kind);
    }
  }

  private spawnBurst(uid: string): void {
    const layer = this.effectLayer;
    const view = this.units.get(uid);
    if (!layer || !view) return;

    for (const [radius, width, duration] of [
      [40, 6, 0.55],
      [26, 3, 0.8],
    ] as const) {
      const ring = this.takeRing();
      if (!ring) return;
      ring.clear();
      ring.circle(0, 0, radius).stroke({ width, color: view.color, alpha: 0.95 });
      ring.position.set(view.root.x, view.root.y);
      if (!ring.parent) layer.addChild(ring);
      this.effects.push({ view: ring, life: duration, duration, kind: 'ring' });
    }
    this.spawnSparks(uid, view.color);
  }

  private spawnSparks(uid: string, color: number): void {
    const layer = this.effectLayer;
    const view = this.units.get(uid);
    if (!layer || !view) return;

    const count = this.lowQuality ? 3 : 7;
    for (let index = 0; index < count; index += 1) {
      const spark = this.takeSpark();
      if (!spark) return;
      spark.clear();
      spark.poly(hexPoints(7, 8)).fill({ color, alpha: 0.9 });
      spark.position.set(view.root.x, view.root.y);
      if (!spark.parent) layer.addChild(spark);
      const angle = (Math.PI * 2 * index) / count;
      this.effects.push({
        view: spark,
        life: 0.8,
        duration: 0.8,
        kind: 'spark',
        vx: Math.cos(angle) * 120,
        vy: Math.sin(angle) * 120 - 30,
      });
    }

    const cap = this.lowQuality ? 36 : 72;
    while (this.effects.length > cap) {
      const oldest = this.effects.shift();
      if (oldest) this.releaseEffect(oldest.view, oldest.kind);
    }
  }

  applyEvent(event: BattleEvent): void {
    const view = event.targetId ? this.units.get(event.targetId) : undefined;
    const source = event.unitId ? this.units.get(event.unitId) : undefined;

    switch (event.type) {
      case 'action': {
        if (source) {
          source.pulse = 0.22;
          source.root.scale.set(1.06);
        }
        if (event.skillId?.endsWith('_ultimate')) {
          playSfx('ult', 0.9);
          haptic('medium');
          this.shake = Math.max(this.shake, 8);
          this.shakeTime = 0.26;
          if (source) this.spawnBurst(source.uid);
        }
        break;
      }
      case 'damage': {
        if (view) {
          const crit = event.note === 'crit';
          const quiet = event.note === 'dot' || event.note === 'reflect';
          this.setHp(view.uid, view.hp - (event.value ?? 0));
          this.spawnNumber(view.uid, event.value ?? 0, crit ? 'crit' : 'damage');
          if (!quiet) {
            view.flash.alpha = crit ? 0.7 : 0.4;
            this.spawnRing(view.uid);
            this.spawnSparks(view.uid, crit ? 0xffd77a : view.color);
            playSfx(crit ? 'crit' : 'hit');
            if (crit) haptic('light');
            this.shake = Math.max(this.shake, crit ? 6 : 3);
            this.shakeTime = 0.18;
          }
        }
        break;
      }
      case 'heal': {
        if (view) {
          this.setHp(view.uid, view.hp + (event.value ?? 0));
          this.spawnNumber(view.uid, event.value ?? 0, 'heal');
          playSfx('heal');
        }
        break;
      }
      case 'shield': {
        if (view) {
          view.shieldRing.visible = true;
          view.shieldTimer = 5;
        }
        break;
      }
      case 'shatter': {
        if (view) {
          this.spawnSparks(view.uid, 0x37e0c8);
          view.root.alpha = 0.15;
          view.shieldRing.visible = false;
          view.shieldTimer = 0;
          playSfx('shatter');
          haptic('heavy');
        }
        break;
      }
      case 'death': {
        if (view) {
          this.spawnSparks(view.uid, 0x6c4cf1);
          view.deathTimer = 0.6;
          view.shieldRing.visible = false;
          view.shieldTimer = 0;
          playSfx('hit', 0.7);
        }
        break;
      }
      case 'echo': {
        if (view && event.note === 'revive') {
          view.root.alpha = 1;
          view.shieldRing.visible = false;
          view.shieldTimer = 0;
          this.setHp(view.uid, view.maxHp * 0.5, view.maxHp);
          this.spawnSparks(view.uid, 0x37e0c8);
          playSfx('heal');
        }
        break;
      }
      case 'master': {
        this.shake = 12;
        this.shakeTime = 0.3;
        break;
      }
      default:
        break;
    }
  }

  private animate(dt: number): void {
    for (const view of this.units.values()) {
      if (view.pulse > 0) {
        view.pulse = Math.max(0, view.pulse - dt);
        view.root.scale.set(1 + view.pulse * 0.3);
      } else if (view.deathTimer <= 0 && view.root.scale.x !== 1) {
        view.root.scale.set(1);
      }

      if (view.deathTimer > 0) {
        view.deathTimer = Math.max(0, view.deathTimer - dt);
        const left = view.deathTimer / 0.6;
        view.root.alpha = 0.08 + 0.92 * left;
        view.root.scale.set(1 - (1 - left) * 0.18);
      } else if (!this.reducedMotion) {
        view.bob += dt;
        view.root.y = view.baseY + Math.sin(view.bob * 1.6) * 3;
      }

      if (view.flash.alpha > 0) {
        view.flash.alpha = Math.max(0, view.flash.alpha - dt * 3.4);
      }

      if (view.shieldTimer > 0) {
        view.shieldTimer = Math.max(0, view.shieldTimer - dt);
        if (view.shieldTimer === 0) view.shieldRing.visible = false;
      }
    }

    this.numbers = this.numbers.filter((item) => {
      item.life -= dt;
      item.text.y += item.vy * dt;
      item.vy += 60 * dt;
      item.text.alpha = Math.max(0, item.life / 0.9);
      if (item.text.scale.x > 1) {
        item.text.scale.set(Math.max(1, item.text.scale.x - dt * 2.6));
      }
      if (item.life <= 0) {
        this.releaseText(item.tone, item.text);
        return false;
      }
      return true;
    });

    this.effects = this.effects.filter((effect) => {
      effect.life -= dt;
      const progress = 1 - effect.life / effect.duration;
      if (effect.kind === 'ring') {
        effect.view.scale.set(1 + progress * 2.2);
        effect.view.alpha = Math.max(0, 1 - progress);
      } else {
        effect.view.x += (effect.vx ?? 0) * dt;
        effect.view.y += (effect.vy ?? 0) * dt;
        effect.view.rotation += dt * 4;
        effect.view.alpha = Math.max(0, 1 - progress);
      }
      if (effect.life <= 0) {
        this.releaseEffect(effect.view, effect.kind);
        return false;
      }
      return true;
    });

    if (this.shakeTime > 0) {
      this.shakeClock += dt;
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      this.layout();
      if (this.shakeTime === 0) this.layout();
    }
  }

  flashMaster(): void {
    this.shake = 12;
    this.shakeTime = 0.3;
  }

  destroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.units.clear();
    this.numbers = [];
    this.effects = [];
    this.textPools = { damage: [], heal: [], crit: [] };
    this.ringPool = [];
    this.sparkPool = [];
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
    this.pixi = null;
  }
}
