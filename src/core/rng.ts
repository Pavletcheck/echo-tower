/**
 * Детерминированный xorshift128.
 * Правило проекта: в бою и в экономике нет Math.random() — только этот генератор с явным seed.
 */
export class Rng {
  private s0 = 0;
  private s1 = 0;
  private s2 = 0;
  private s3 = 0;

  constructor(seed: number) {
    let x = seed | 0;
    if (x === 0) x = 0x9e3779b9;
    this.s0 = x;
    this.s1 = (x ^ 0x9e3779b9) | 0;
    this.s2 = (x ^ 0x85ebca6b) | 0;
    this.s3 = (x ^ 0xc2b2ae35) | 0;
    // Разогрев, чтобы первые значения не были линейными.
    for (let i = 0; i < 12; i += 1) this.nextU32();
  }

  nextU32(): number {
    let t = this.s3;
    const s = this.s0;
    this.s3 = this.s2;
    this.s2 = this.s1;
    this.s1 = s;
    t ^= t << 11;
    t ^= t >>> 8;
    this.s0 = t ^ s ^ (s >>> 19);
    return this.s0 >>> 0;
  }

  /** Дробное число [0, 1). */
  next(): number {
    return this.nextU32() / 0x100000000;
  }

  /** Целое в диапазоне [min, max] включительно. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty array');
    return items[this.int(0, items.length - 1)];
  }

  /** Стабильный снимок состояния — нужен для сохранения и тестов. */
  snapshot(): [number, number, number, number] {
    return [this.s0, this.s1, this.s2, this.s3];
  }
}

/** FNV-1a: стабильный 32-битный хэш строки (id героя, состав отряда, этаж). */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Seed боя: одинаковый состав и этаж дают одинаковый бой. */
export function battleSeed(saveId: string, floor: number, attempt: number, composition: readonly string[]): number {
  return hashString(`${saveId}|${floor}|${attempt}|${composition.join(',')}`);
}
