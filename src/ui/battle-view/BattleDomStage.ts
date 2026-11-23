import { asset } from '../../core/asset';
import { locale$ } from '../../core/i18n';
import { battleBackground } from '../../data/backgrounds';
import { BOSSES_BY_ID, ENEMIES_BY_ID } from '../../data/enemies';
import { unitCombatStats } from '../../game/battle/stats';
import type { BattleEvent, UnitInit } from '../../game/battle/types';
import type { SaveV1 } from '../../game/save';
import s from './BattleDomStage.module.css';
import type { BattleStageLike } from './stage-types';

type Quality = SaveV1['settings']['quality'];

const ELEMENT_COLOR: Record<string, string> = {
  echo: '#37e0c8',
  ash: '#ff6b4a',
  frost: '#6fb6ff',
  rot: '#8fcf4a',
  light: '#f2d27a',
};

interface DomUnit {
  uid: string;
  side: 'ally' | 'enemy';
  root: HTMLDivElement;
  fill: HTMLDivElement;
  bar: HTMLDivElement;
  flash: HTMLDivElement;
  hp: number;
  maxHp: number;
  color: string;
}

function artPaths(unit: UnitInit): string[] {
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

export class BattleDomStage implements BattleStageLike {
  onTick: ((dt: number) => void) | null = null;

  private readonly host: HTMLElement;
  private readonly lowQuality: boolean;
  private readonly reducedMotion: boolean;
  private root: HTMLDivElement | null = null;
  private bg: HTMLDivElement | null = null;
  private unitLayer: HTMLDivElement | null = null;
  private fxLayer: HTMLDivElement | null = null;
  private units = new Map<string, DomUnit>();
  private raf = 0;
  private last = 0;
  private destroyed = false;
  private bgLoaded = false;
  private phase = 0;

  constructor(host: HTMLElement, quality: Quality = 'auto') {
    this.host = host;
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 8 : 8;
    this.lowQuality = quality === 'low' || (quality === 'auto' && cores <= 4);
    this.reducedMotion =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  }

  async init(): Promise<void> {
    if (this.destroyed || this.root) return;

    const root = document.createElement('div');
    root.className = s.root;

    const bg = document.createElement('div');
    bg.className = s.bg;
    root.appendChild(bg);

    const units = document.createElement('div');
    units.className = s.units;
    root.appendChild(units);

    const fx = document.createElement('div');
    fx.className = s.fx;
    root.appendChild(fx);

    this.host.appendChild(root);
    this.root = root;
    this.bg = bg;
    this.unitLayer = units;
    this.fxLayer = fx;

    const loop = (time: number) => {
      if (this.destroyed) return;
      const dt = Math.min(0.05, this.last ? (time - this.last) / 1000 : 0.016);
      this.last = time;
      this.phase += dt;
      if (!this.reducedMotion && !this.lowQuality) {
        for (const unit of this.units.values()) {
          unit.root.style.transform = `translate(-50%, -50%) translateY(${Math.sin(this.phase * 1.6 + unit.hp) * 2}px)`;
        }
      }
      this.onTick?.(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  setPaused(paused: boolean): void {
    if (paused) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    if (this.destroyed || this.raf) return;
    this.last = 0;
    const resume = (time: number) => {
      if (this.destroyed) return;
      const dt = Math.min(0.05, this.last ? (time - this.last) / 1000 : 0.016);
      this.last = time;
      this.phase += dt;
      if (!this.reducedMotion && !this.lowQuality) {
        for (const unit of this.units.values()) {
          unit.root.style.transform = `translate(-50%, -50%) translateY(${Math.sin(this.phase * 1.6 + unit.hp) * 2}px)`;
        }
      }
      this.onTick?.(dt);
      this.raf = requestAnimationFrame(resume);
    };
    this.raf = requestAnimationFrame(resume);
  }

  setChapter(chapter: number, element: string): void {
    if (!this.bg) return;
    const color = ELEMENT_COLOR[element] ?? '#9b7bff';
    this.bg.style.background = `radial-gradient(70% 55% at 50% 30%, ${color}22, transparent 70%), linear-gradient(180deg, #0a0714, #07050d)`;
    const index = Math.min(10, Math.max(1, Math.round(chapter)));
    const file = battleBackground(index);
    const image = new Image();
    image.onload = () => {
      if (!this.bg || this.destroyed) return;
      this.bg.style.backgroundImage = `linear-gradient(180deg, rgba(7,5,13,0.55), rgba(7,5,13,0.9)), url(${asset(file)})`;
      this.bg.style.backgroundSize = 'cover';
      this.bg.style.backgroundPosition = 'center';
      this.bgLoaded = true;
    };
    image.src = asset(file);
  }

  hasBackgroundArt(): boolean {
    return this.bgLoaded;
  }

  loadWave(allies: readonly UnitInit[], enemies: readonly UnitInit[], startHp: Map<string, number>): void {
    if (!this.unitLayer) return;
    this.units.clear();
    this.unitLayer.innerHTML = '';
    if (this.fxLayer) this.fxLayer.innerHTML = '';

    const groups: Array<{ side: 'ally' | 'enemy'; units: readonly UnitInit[] }> = [
      { side: 'enemy', units: enemies },
      { side: 'ally', units: allies },
    ];

    for (const group of groups) {
      group.units.forEach((unit, index) => this.createUnit(unit, group.side, index, group.units.length, startHp));
    }
  }

  private createUnit(
    unit: UnitInit,
    side: 'ally' | 'enemy',
    index: number,
    count: number,
    startHp: Map<string, number>,
  ): void {
    if (!this.unitLayer) return;

    const span = 62;
    const left = count <= 1 ? 50 : 50 - span / 2 + (span / Math.max(1, count - 1)) * index;
    // Все юниты стороны стоят на одной линии: лесенка читалась как «упавшая» картинка.
    const top = side === 'ally' ? 74 : 30;

    const color = ELEMENT_COLOR[unit.element] ?? '#9b7bff';
    const stats = unitCombatStats(unit);
    const maxHp = Math.round(stats.hp * (unit.hpMult ?? 1));
    const hp = Math.max(0, Math.min(maxHp, startHp.get(unit.uid) ?? maxHp));

    const root = document.createElement('div');
    root.className = `${s.unit} ${side === 'ally' ? s.ally : s.enemy}`;
    root.style.left = `${left}%`;
    root.style.top = `${top}%`;
    root.style.setProperty('--accent', color);
    if (unit.isBoss) root.classList.add(s.boss);

    const hex = document.createElement('div');
    hex.className = s.hex;

    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.loading = 'eager';
    img.decoding = 'async';
    const paths = artPaths(unit);

    if (side === 'ally') {
      img.classList.add(s.cardArt);
      // Сначала лёгкий портрет, чтобы гекс не пустовал, затем полный арт карточки.
      img.src = asset(`assets/heroes/${unit.defId}/portrait.webp`);
      const full = new Image();
      full.decoding = 'async';
      full.onload = () => {
        if (img.isConnected) img.src = full.src;
      };
      full.src = asset(paths[0] ?? `assets/heroes/${unit.defId}/card.webp`);
      img.onerror = () => {
        img.src = asset(`assets/heroes/${unit.defId}/sprite.webp`);
      };
      hex.appendChild(img);
    } else {
      let attempt = 0;
      const fallback = () => {
        attempt += 1;
        if (attempt < paths.length) img.src = asset(paths[attempt]);
        else img.remove();
      };
      img.onerror = fallback;
      if (paths[0]) img.src = asset(paths[0]);
      hex.appendChild(img);
    }

    const flash = document.createElement('div');
    flash.className = s.flash;
    hex.appendChild(flash);

    const bar = document.createElement('div');
    bar.className = s.bar;
    const fill = document.createElement('div');
    fill.className = s.fill;
    fill.style.width = `${Math.round((hp / Math.max(1, maxHp)) * 100)}%`;
    bar.appendChild(fill);

    const name = document.createElement('div');
    name.className = s.name;
    name.textContent = locale$.value === 'ru' ? unit.name : unit.nameEn ?? unit.name;

    root.append(hex, bar, name);
    this.unitLayer.appendChild(root);

    this.units.set(unit.uid, { uid: unit.uid, side, root, fill, bar, flash, hp, maxHp, color });
  }

  setHp(uid: string, hp: number, maxHp?: number): void {
    const unit = this.units.get(uid);
    if (!unit) return;
    if (maxHp !== undefined) unit.maxHp = maxHp;
    unit.hp = Math.max(0, Math.min(unit.maxHp, hp));
    const ratio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 0;
    unit.fill.style.width = `${Math.round(ratio * 100)}%`;
    unit.root.classList.toggle(s.down, unit.hp <= 0);
  }

  getHp(uid: string): number {
    return this.units.get(uid)?.hp ?? 0;
  }

  private number(uid: string, value: number, tone: 'damage' | 'heal' | 'crit'): void {
    const unit = this.units.get(uid);
    if (!unit || !this.fxLayer) return;
    const el = document.createElement('div');
    el.className = `${s.number} ${s[tone]}`;
    el.textContent = `${tone === 'heal' ? '+' : '−'}${Math.abs(Math.round(value))}`;
    el.style.left = unit.root.style.left;
    el.style.top = unit.root.style.top;
    this.fxLayer.appendChild(el);
    window.setTimeout(() => el.remove(), 900);
  }

  private burst(uid: string, kind: 'hit' | 'ult' | 'death'): void {
    const unit = this.units.get(uid);
    if (!unit || !this.fxLayer) return;
    const ring = document.createElement('div');
    ring.className = `${s.ring} ${s[kind]}`;
    ring.style.left = unit.root.style.left;
    ring.style.top = unit.root.style.top;
    this.fxLayer.appendChild(ring);
    window.setTimeout(() => ring.remove(), kind === 'ult' ? 700 : 500);
  }

  applyEvent(event: BattleEvent): void {
    const unit = event.targetId ? this.units.get(event.targetId) : undefined;
    const source = event.unitId ? this.units.get(event.unitId) : undefined;

    switch (event.type) {
      case 'damage':
        if (unit) {
          const crit = event.note === 'crit';
          this.setHp(unit.uid, unit.hp - (event.value ?? 0));
          this.number(unit.uid, event.value ?? 0, crit ? 'crit' : 'damage');
          unit.flash.classList.remove(s.flashOn);
          void unit.flash.offsetWidth;
          unit.flash.classList.add(s.flashOn);
          if (event.note !== 'dot' && event.note !== 'reflect') this.burst(unit.uid, 'hit');
        }
        break;
      case 'heal':
        if (unit) {
          this.setHp(unit.uid, unit.hp + (event.value ?? 0));
          this.number(unit.uid, event.value ?? 0, 'heal');
        }
        break;
      case 'shield':
        if (unit) unit.root.classList.add(s.shielded);
        break;
      case 'shatter':
        if (unit) {
          unit.root.classList.remove(s.shielded);
          this.burst(unit.uid, 'death');
        }
        break;
      case 'death':
        if (unit) {
          unit.root.classList.add(s.dead);
          this.burst(unit.uid, 'death');
        }
        break;
      case 'action':
        if (source) {
          source.root.classList.add(s.acting);
          window.setTimeout(() => source.root.classList.remove(s.acting), 220);
          if (event.skillId?.endsWith('_ultimate')) this.burst(source.uid, 'ult');
        }
        break;
      case 'echo':
        if (unit) {
          unit.root.classList.remove(s.dead);
          this.setHp(unit.uid, unit.maxHp * 0.5, unit.maxHp);
        }
        break;
      default:
        break;
    }
  }

  flashMaster(): void {
    if (!this.root || this.reducedMotion) return;
    this.root.classList.add(s.shake);
    window.setTimeout(() => this.root?.classList.remove(s.shake), 300);
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.units.clear();
    this.root?.remove();
    this.root = null;
  }
}
