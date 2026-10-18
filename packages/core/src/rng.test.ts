import { describe, expect, it } from 'vitest'
import { createRng, nextFloat, randInt, weightedIndex } from './rng'

describe('rng', () => {
  it('одинаковый сид даёт одинаковую последовательность', () => {
    const a = createRng(42)
    const b = createRng(42)
    for (let i = 0; i < 100; i++) expect(nextFloat(a)).toBe(nextFloat(b))
  })

  it('состояние сериализуемо и продолжает последовательность', () => {
    const a = createRng(7)
    for (let i = 0; i < 10; i++) nextFloat(a)
    const b = JSON.parse(JSON.stringify(a))
    expect(nextFloat(a)).toBe(nextFloat(b))
  })

  it('randInt в границах', () => {
    const r = createRng(1)
    for (let i = 0; i < 1000; i++) {
      const v = randInt(r, 3, 5)
      expect(v).toBeGreaterThanOrEqual(3)
      expect(v).toBeLessThanOrEqual(5)
    }
  })

  it('weightedIndex соблюдает веса', () => {
    const r = createRng(99)
    const counts = [0, 0]
    for (let i = 0; i < 10000; i++) counts[weightedIndex(r, [1, 3])]!++
    expect(counts[1]! / 10000).toBeCloseTo(0.75, 1)
  })
})
