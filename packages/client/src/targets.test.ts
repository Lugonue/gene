import { describe, expect, it } from 'vitest'
import { buildView, createGame, player, type GameState } from '@gene/core'
import { NO_TARGETS_TEXT, useTargets } from './targets'

function newGame(): GameState {
  return createGame(34, { name: 'Тест-7', bodyPlan: 'humanoid', startWeapon: 'short_sword' })
}

function itemId(s: GameState, defId: string): string {
  const id = player(s).inventory.find((i) => s.items[i]?.defId === defId)
  if (!id) throw new Error(`нет ${defId}`)
  return id
}

function part(s: GameState, defId: string) {
  return player(s).parts.find((p) => p.defId === defId)!
}

describe('цели применения', () => {
  it('при полном здоровье у бинта нет целей', () => {
    const s = newGame()
    expect(useTargets(buildView(s), itemId(s, 'bandage'), 'bandage')).toEqual([])
    expect(NO_TARGETS_TEXT.bandage).toBe('Я полностью здоров.')
  })

  it('бинт предлагает только повреждённые органические части, цифры по видимому списку', () => {
    const s = newGame()
    const torso = part(s, 'torso')
    torso.hp = Math.floor(torso.maxHp / 2)
    torso.wound = 'wounded'
    const head = part(s, 'head')
    head.hp = head.maxHp - 1
    head.wound = 'bruised'
    const targets = useTargets(buildView(s), itemId(s, 'bandage'), 'bandage')
    expect(targets.map((t) => [t.key, t.cmd])).toEqual([
      ['1', { type: 'use', itemId: itemId(s, 'bandage'), targetPartId: 'head' }],
      ['2', { type: 'use', itemId: itemId(s, 'bandage'), targetPartId: 'torso' }],
    ])
  })

  it('ремкомплект предлагает только предметы с неполной прочностью', () => {
    const s = newGame()
    const kit = itemId(s, 'repair_kit')
    const weaponId = player(s).equipment.weapon
    expect(useTargets(buildView(s), kit, 'repair')).toEqual([])
    const weapon = s.items[weaponId!]!
    weapon.durability = weapon.maxDurability! - 1
    const targets = useTargets(buildView(s), kit, 'repair')
    expect(targets.map((t) => t.cmd)).toEqual([{ type: 'use', itemId: kit, targetItemId: weapon.id }])
  })
})
