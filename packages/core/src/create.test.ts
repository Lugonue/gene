import { describe, expect, it } from 'vitest'
import { createGame, validateNewGame } from './create'
import { applyCommand } from './game'
import { player } from './state'
import { buildView, studyStatus } from './view'
import { createItem, giveItem } from './items'
import { spawnMonster } from './monsters'
import { resolveAttack } from './combat/attack'
import type { Ctx } from './context'

describe('создание персонажа', () => {
  it.each([
    ['humanoid', 'dagger'],
    ['humanoid', 'mace'],
    ['humanoid_fourarmed', 'short_sword'],
    ['humanoid_fourarmed', 'dagger'],
  ])('%s + %s: стартовое снаряжение и знания', (bodyPlan, startWeapon) => {
    const s = createGame(1, { name: 'КБ', bodyPlan, startWeapon })
    const p = player(s)
    const view = buildView(s)
    expect(s.items[p.equipment.weapon!]!.defId).toBe(startWeapon)
    expect(s.items[p.equipment.body!]!.defId).toBe('leather_jacket')
    const counts = Object.fromEntries(view.inventory.filter((i) => i.category === 'consumable').map((i) => [i.defId, i.count ?? 1]))
    expect(counts).toEqual({ bandage: 2, heal_potion: 1, repair_kit: 2 })
    expect(studyStatus(s, startWeapon)).toBe('known')
    expect(studyStatus(s, 'leather_jacket')).toBe('partial')
    // Стартовый навык выбранного оружия и базовые алгоритмы.
    const lvl = (id: string): number => view.skills.find((x) => x.id === id)!.level
    expect(lvl('fighting')).toBeGreaterThan(0)
    expect(lvl('dodging')).toBeGreaterThan(0)
    expect(lvl('axes')).toBe(0)
    // Материалы: голова и торс — органика, конечности — бионика.
    for (const part of p.parts) expect(part.material).toBe(part.defId === 'head' || part.defId === 'torso' ? 'organic' : 'bionic')
    expect(p.parts.filter((x) => x.upgrades).every((x) => x.upgrades!.strength === 0)).toBe(true)
    // Слоты: у четырёхрукого — два слота для рук.
    expect(view.equipment.some((e) => e.slot === 'hands_lower')).toBe(bodyPlan === 'humanoid_fourarmed')
  })

  it('валидация параметров', () => {
    expect(validateNewGame({ name: '', bodyPlan: 'humanoid', startWeapon: 'dagger' })).not.toBeNull()
    expect(validateNewGame({ name: 'X', bodyPlan: 'tentacles', startWeapon: 'dagger' })).not.toBeNull()
    expect(validateNewGame({ name: 'X', bodyPlan: 'humanoid', startWeapon: 'axe' })).not.toBeNull()
    expect(validateNewGame({ name: 'X', bodyPlan: 'humanoid', startWeapon: 'dagger' })).toBeNull()
  })
})

describe('навыки и база знаний', () => {
  it('удары в броню прокачивают навык брони и изученность её типа, уклонения — dodging', () => {
    const s = createGame(5, { name: 'КБ', bodyPlan: 'humanoid', startWeapon: 'dagger' })
    for (const id of Object.keys(s.creatures)) if (id !== s.playerId) delete s.creatures[id]
    const p = player(s)
    p.hp = p.maxHp = 100_000
    for (const part of p.parts) part.hp = part.maxHp = 100_000
    const goblin = spawnMonster(s, 'goblin', 1, p.x + 1, p.y)
    const light = s.knowledge.skillXp.light_armour
    const dodge = s.knowledge.skillXp.dodging
    const ctx: Ctx = { state: s, events: [] }
    for (let i = 0; i < 300; i++) resolveAttack(ctx, goblin, p)
    expect(s.knowledge.skillXp.light_armour).toBeGreaterThan(light)
    expect(s.knowledge.skillXp.dodging).toBeGreaterThan(dodge)
    expect(studyStatus(s, 'leather_jacket')).toBe('known')
    expect(ctx.events.some((e) => e.type === 'studyChanged' && e.itemDefId === 'leather_jacket' && e.status === 'known')).toBe(true)
  })

  it('ношение предмета постепенно изучает его тип', () => {
    let s = createGame(6, { name: 'КБ', bodyPlan: 'humanoid', startWeapon: 'dagger' })
    for (const id of Object.keys(s.creatures)) if (id !== s.playerId) delete s.creatures[id]
    const p = player(s)
    const helmet = giveItem(s, p, createItem(s, 'helmet', { kind: 'carried', owner: p.id }))
    s = applyCommand(s, { type: 'equip', itemId: helmet.id }).state
    expect(studyStatus(s, 'helmet')).toBe('unknown')
    for (let i = 0; i < 200; i++) s = applyCommand(s, { type: 'wait' }).state
    expect(studyStatus(s, 'helmet')).toBe('partial')
  })

  it('опыт за убийство распределяется по использованным навыкам', () => {
    const s = createGame(7, { name: 'КБ', bodyPlan: 'humanoid', startWeapon: 'mace' })
    for (const id of Object.keys(s.creatures)) if (id !== s.playerId) delete s.creatures[id]
    const p = player(s)
    const rat = spawnMonster(s, 'rat', 1, p.x + 1, p.y)
    const before = s.knowledge.skillXp.maces
    const ctx: Ctx = { state: s, events: [] }
    let attacks = 0
    while (s.creatures[rat.id] && attacks < 200) {
      resolveAttack(ctx, p, rat)
      attacks++
    }
    // Больше, чем дают одни только атаки (3 за каждую).
    expect(s.knowledge.skillXp.maces - before).toBeGreaterThan(attacks * 3)
    expect(s.knowledge.recentUse).toEqual({})
  })
})
