// Сидированный ГПСЧ (mulberry32). Состояние — одно 32-битное число, хранится в GameState
// и мутируется только внутри копии состояния, которую обрабатывает applyCommand.

export interface RngState {
  s: number
}

export function createRng(seed: number): RngState {
  return { s: seed >>> 0 }
}

/** Равномерное число в [0, 1). */
export function nextFloat(rng: RngState): number {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0
  let t = rng.s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Целое в [min, max] включительно. */
export function randInt(rng: RngState, min: number, max: number): number {
  return min + Math.floor(nextFloat(rng) * (max - min + 1))
}

export function chance(rng: RngState, p: number): boolean {
  return nextFloat(rng) < p
}

export function pick<T>(rng: RngState, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick: пустой список')
  return items[Math.floor(nextFloat(rng) * items.length)] as T
}

/** Выбор по весам. Возвращает индекс. */
export function weightedIndex(rng: RngState, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return 0
  let r = nextFloat(rng) * total
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] as number
    if (r < 0) return i
  }
  return weights.length - 1
}

export function shuffle<T>(rng: RngState, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat(rng) * (i + 1))
    const tmp = items[i] as T
    items[i] = items[j] as T
    items[j] = tmp
  }
  return items
}

/** Производный 32-битный сид, например для ROT.RNG при генерации уровня. */
export function deriveSeed(rng: RngState): number {
  return Math.floor(nextFloat(rng) * 4294967296) >>> 0
}
