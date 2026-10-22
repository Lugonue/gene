import { describe, expect, it } from 'vitest'
import { alertLook, nextFlash } from './alertFx'

describe('вид тревоги в клиенте', () => {
  it('вне тревоги — обычная полоса, без виньетки и плашки', () => {
    expect(alertLook('none')).toEqual({ vignette: false, banner: false, bar: 'ok' })
  })

  it('опасное состояние — жёлтая полоса без мигания, без виньетки и плашки', () => {
    expect(alertLook('danger')).toEqual({ vignette: false, banner: false, bar: 'danger' })
  })

  it('критическое состояние — виньетка, плашка и мигающая полоса', () => {
    expect(alertLook('critical')).toEqual({ vignette: true, banner: true, bar: 'critical' })
  })
})

describe('вспышка по краю', () => {
  it('ход с флагом вспышки запускает новую вспышку', () => {
    expect(nextFlash(0, { criticalFlash: true })).toBe(1)
    expect(nextFlash(1, { criticalFlash: true })).toBe(2)
  })

  it('ход без флага вспышку не запускает', () => {
    expect(nextFlash(3, {})).toBe(3)
  })

  it('полный вид после переподключения вспышку не запускает', () => {
    expect(nextFlash(3, { criticalFlash: true, fresh: true })).toBe(3)
  })
})
