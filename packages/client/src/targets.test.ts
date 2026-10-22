import { describe, expect, it } from 'vitest'
import { NO_TARGETS_TEXT, targetsFor } from './targets'
import { item, part, viewFixture } from './testing'

describe('цели применения', () => {
  it('при полном здоровье у бинта нет целей', () => {
    expect(targetsFor(viewFixture(), 'i1', 'bandage')).toEqual([])
    expect(NO_TARGETS_TEXT.bandage).toBe('Я полностью здоров.')
  })

  it('бинт предлагает только органические части с флагом повреждения от ядра, цифры по видимому списку', () => {
    const view = viewFixture({
      parts: [
        part('head', { damaged: true, wound: 'bruised', hp: 9 }),
        part('torso'),
        // Полный hp, но ядро считает часть повреждённой (ждёт перевязки) — клиент верит флагу.
        part('left_arm', { damaged: true }),
        part('right_arm', { material: 'bionic', damaged: true, hp: 5 }),
      ],
    })
    expect(targetsFor(view, 'i1', 'bandage').map((t) => [t.key, t.cmd])).toEqual([
      ['1', { type: 'use', itemId: 'i1', targetPartId: 'head' }],
      ['2', { type: 'use', itemId: 'i1', targetPartId: 'left_arm' }],
    ])
  })

  it('ремкомплект предлагает повреждённую бионику и предметы с флагом повреждения', () => {
    const sword = item('w1', 'short_sword', { letter: 'd', category: 'weapon', durabilityText: '49/50' })
    expect(targetsFor(viewFixture({ inventory: [sword] }), 'i3', 'repair')).toEqual([])
    const view = viewFixture({
      parts: [part('right_arm', { material: 'bionic', damaged: true, hp: 5 })],
      inventory: [{ ...sword, damaged: true }],
    })
    expect(targetsFor(view, 'i3', 'repair').map((t) => t.cmd)).toEqual([
      { type: 'use', itemId: 'i3', targetPartId: 'right_arm' },
      { type: 'use', itemId: 'i3', targetItemId: 'w1' },
    ])
  })
})
