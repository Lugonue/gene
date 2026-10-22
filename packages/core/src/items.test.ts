import { describe, expect, it } from 'vitest'
import { applyCommand } from './game'
import { createEquipped, createItem, giveItem } from './items'
import { spawnMonster } from './monsters'
import { resolveAttack } from './combat/attack'
import { durabilityEfficiency, woundStageFor } from './combat/formulas'
import { findPart } from './body'
import { newTestGame } from './testing'
import { buildView, studyStatus } from './view'
import { player, type BodyPartState, type GameState, type ItemInstance } from './state'
import type { Ctx } from './context'

function clearMonsters(s: GameState): void {
  for (const id of Object.keys(s.creatures)) if (id !== s.playerId) delete s.creatures[id]
}

function inv(s: GameState, defId: string): ItemInstance {
  const p = player(s)
  const id = p.inventory.find((i) => s.items[i]?.defId === defId)
  if (!id) throw new Error(`нет ${defId} в инвентаре`)
  return s.items[id]!
}

function damage(part: BodyPartState, frac: number): void {
  part.hp = Math.max(0, Math.floor(part.maxHp * frac))
  part.wound = woundStageFor(part)
  if (part.material === 'organic' && part.wound === 'crippled') part.needsTreatment = true
}

describe('прочность', () => {
  it('кривая эффективности пороговая', () => {
    const item = (d: number): ItemInstance => ({ id: 'x', defId: 'dagger', durability: d, maxDurability: 100, loc: { kind: 'carried', owner: 'p' } })
    expect(durabilityEfficiency(item(100))).toBe(1)
    expect(durabilityEfficiency(item(75))).toBe(1)
    expect(durabilityEfficiency(item(74))).toBe(0.85)
    expect(durabilityEfficiency(item(50))).toBe(0.85)
    expect(durabilityEfficiency(item(49))).toBe(0.65)
    expect(durabilityEfficiency(item(25))).toBe(0.65)
    expect(durabilityEfficiency(item(24))).toBe(0.4)
    expect(durabilityEfficiency(item(1))).toBe(0.4)
    expect(durabilityEfficiency(item(0))).toBe(0)
  })

  it('броня изнашивается только у предмета в слоте поражённой части', () => {
    const s = newTestGame(21)
    clearMonsters(s)
    const p = player(s)
    const goblin = spawnMonster(s, 'goblin_brute', p.depth, p.x + 1, p.y, ['dagger', 'leather_jacket'])
    const helmet = createEquipped(s, goblin, 'helmet')
    const jacket = s.items[goblin.equipment.body!]!
    // Попадания возможны только в торс.
    for (const part of goblin.parts) if (part.defId !== 'torso') part.wound = 'severed'
    goblin.hp = goblin.maxHp = 100_000
    findPart(goblin, 'torso')!.maxHp = findPart(goblin, 'torso')!.hp = 100_000
    const ctx: Ctx = { state: s, events: [] }
    for (let i = 0; i < 60; i++) resolveAttack(ctx, p, goblin)
    expect(jacket.durability).toBeLessThan(jacket.maxDurability!)
    expect(helmet.durability).toBe(helmet.maxDurability)
    // Оружие атакующего тоже изнашивается.
    const weapon = s.items[p.equipment.weapon!]!
    expect(weapon.durability).toBeLessThan(weapon.maxDurability!)
  })

  it('ремкомплект восстанавливает прочность предмета', () => {
    let s = newTestGame(22)
    clearMonsters(s)
    const weapon = s.items[player(s).equipment.weapon!]!
    weapon.durability = 3
    const kit = inv(s, 'repair_kit')
    const r = applyCommand(s, { type: 'use', itemId: kit.id, targetItemId: weapon.id })
    s = r.state
    expect(s.items[weapon.id]!.durability).toBeGreaterThan(3)
    expect(r.events.some((e) => e.type === 'itemRepaired')).toBe(true)
    expect(inv(s, 'repair_kit').count).toBe(1)
  })

  it('сломанное оружие остаётся надетым, а атака идёт кулаком', () => {
    const s = newTestGame(23)
    clearMonsters(s)
    const p = player(s)
    const weapon = s.items[p.equipment.weapon!]!
    weapon.durability = 0
    const rat = spawnMonster(s, 'hyena', p.depth, p.x + 1, p.y)
    const ctx: Ctx = { state: s, events: [] }
    resolveAttack(ctx, p, rat)
    const attack = ctx.events.find((e) => e.type === 'attackHit' || e.type === 'attackMissed')
    expect(attack && 'attack' in attack && attack.attack).toMatchObject({ kind: 'natural', attackId: 'fist' })
    expect(p.equipment.weapon).toBe(weapon.id)
  })
})

describe('материалы тела, лечение и ремонт', () => {
  it('бинт на бионику и ремкомплект на органику — отказ без траты хода', () => {
    const s = newTestGame(31)
    clearMonsters(s)
    const p = player(s)
    damage(findPart(p, 'left_arm')!, 0.3) // бионика
    damage(findPart(p, 'head')!, 0.3) // органика
    const r1 = applyCommand(s, { type: 'use', itemId: inv(s, 'bandage').id, targetPartId: 'left_arm' })
    expect(r1.events).toEqual([{ type: 'commandRejected', reason: 'bandageOnBionic' }])
    expect(r1.state).toBe(s)
    const r2 = applyCommand(s, { type: 'use', itemId: inv(s, 'repair_kit').id, targetPartId: 'head' })
    expect(r2.events).toEqual([{ type: 'commandRejected', reason: 'repairOnOrganic' }])
    expect(r2.state.turn).toBe(0)
  })

  it('бинт снимает стадию раны с органики, ремкомплект — с бионики', () => {
    let s = newTestGame(32)
    clearMonsters(s)
    damage(findPart(player(s), 'head')!, 0.2) // crippled
    damage(findPart(player(s), 'right_leg')!, 0.4) // wounded
    s = applyCommand(s, { type: 'use', itemId: inv(s, 'bandage').id, targetPartId: 'head' }).state
    expect(findPart(player(s), 'head')!.wound).toBe('wounded')
    expect(findPart(player(s), 'head')!.needsTreatment).toBe(false)
    s = applyCommand(s, { type: 'use', itemId: inv(s, 'repair_kit').id, targetPartId: 'right_leg' }).state
    expect(findPart(player(s), 'right_leg')!.wound).toBe('bruised')
  })

  it('органика регенерирует, бионика — нет; искалеченная органика без перевязки не выше wounded', () => {
    let s = newTestGame(33)
    clearMonsters(s)
    const p = player(s)
    damage(findPart(p, 'torso')!, 0.6) // органика, bruised
    damage(findPart(p, 'left_leg')!, 0.6) // бионика
    damage(findPart(p, 'head')!, 0.1) // органика, crippled → needsTreatment
    const legHp = findPart(p, 'left_leg')!.hp
    for (let i = 0; i < 600; i++) s = applyCommand(s, { type: 'wait' }).state
    const after = player(s)
    expect(findPart(after, 'torso')!.wound).toBe('none')
    expect(findPart(after, 'left_leg')!.hp).toBe(legHp)
    const head = findPart(after, 'head')!
    expect(head.wound).toBe('wounded')
    expect(head.hp).toBeLessThanOrEqual(Math.floor(head.maxHp * 0.5))
  })

  it('зелье лечит общий HP и органику, но не бионику', () => {
    let s = newTestGame(34)
    clearMonsters(s)
    const p = player(s)
    p.hp = 10
    damage(findPart(p, 'torso')!, 0.4)
    damage(findPart(p, 'right_arm')!, 0.4)
    const torso = findPart(p, 'torso')!.hp
    const arm = findPart(p, 'right_arm')!.hp
    s = applyCommand(s, { type: 'use', itemId: inv(s, 'heal_potion').id }).state
    expect(player(s).hp).toBeGreaterThan(10)
    expect(findPart(player(s), 'torso')!.hp).toBeGreaterThan(torso)
    expect(findPart(player(s), 'right_arm')!.hp).toBe(arm)
    expect(player(s).inventory.some((id) => s.items[id]?.defId === 'heal_potion')).toBe(false)
  })

  it('зелье при полном здоровье не выпивается: отказ, предмет цел, время не идёт', () => {
    const s = newTestGame(34)
    clearMonsters(s)
    const potion = inv(s, 'heal_potion')
    const r = applyCommand(s, { type: 'use', itemId: potion.id })
    expect(r.events).toEqual([{ type: 'commandRejected', reason: 'fullHealth' }])
    expect(r.state.turn).toBe(s.turn)
    expect(inv(r.state, 'heal_potion').count ?? 1).toBe(potion.count ?? 1)
  })

  it('зелье выпивается, если ранена часть тела при полном общем HP', () => {
    let s = newTestGame(34)
    clearMonsters(s)
    damage(findPart(player(s), 'torso')!, 0.4)
    s = applyCommand(s, { type: 'use', itemId: inv(s, 'heal_potion').id }).state
    expect(player(s).inventory.some((id) => s.items[id]?.defId === 'heal_potion')).toBe(false)
  })
})

describe('инвентарь и снаряжение', () => {
  it('подобрать, надеть со сменой, снять, бросить', () => {
    let s = newTestGame(41)
    clearMonsters(s)
    const p = player(s)
    createItem(s, 'chainmail', { kind: 'floor', depth: p.depth, x: p.x, y: p.y })
    let r = applyCommand(s, { type: 'pickup' })
    s = r.state
    expect(r.events.some((e) => e.type === 'newItemType' && e.itemDefId === 'chainmail')).toBe(true)
    const mail = inv(s, 'chainmail')
    r = applyCommand(s, { type: 'equip', itemId: mail.id })
    s = r.state
    expect(player(s).equipment.body).toBe(mail.id)
    expect(r.events.map((e) => e.type)).toEqual(expect.arrayContaining(['itemUnequipped', 'itemEquipped']))
    s = applyCommand(s, { type: 'unequip', slot: 'body' }).state
    expect(player(s).equipment.body).toBeUndefined()
    s = applyCommand(s, { type: 'drop', itemId: mail.id }).state
    expect(s.items[mail.id]!.loc).toMatchObject({ kind: 'floor' })
    expect(applyCommand(s, { type: 'equip', itemId: inv(s, 'bandage').id }).events[0]).toMatchObject({ reason: 'cannotEquip' })
  })

  it('четырёхрукий может надеть две пары перчаток', () => {
    let s = newTestGame(42, { bodyPlan: 'humanoid_fourarmed' })
    clearMonsters(s)
    const p = player(s)
    const g1 = giveItem(s, p, createItem(s, 'leather_gloves', { kind: 'carried', owner: p.id }))
    const g2 = giveItem(s, p, createItem(s, 'bracers', { kind: 'carried', owner: p.id }))
    s = applyCommand(s, { type: 'equip', itemId: g1.id }).state
    s = applyCommand(s, { type: 'equip', itemId: g2.id }).state
    expect(player(s).equipment.hands).toBe(g1.id)
    expect(player(s).equipment.hands_lower).toBe(g2.id)
  })

  it('инвентарь ограничен 20 слотами; расходники складываются в стопку', () => {
    let s = newTestGame(43)
    clearMonsters(s)
    const p = player(s)
    while (p.inventory.length < 20) giveItem(s, p, createItem(s, 'dagger', { kind: 'carried', owner: p.id }))
    createItem(s, 'bandage', { kind: 'floor', depth: p.depth, x: p.x, y: p.y }, 3)
    s = applyCommand(s, { type: 'pickup' }).state
    expect(inv(s, 'bandage').count).toBe(5)
    createItem(s, 'axe', { kind: 'floor', depth: p.depth, x: player(s).x, y: player(s).y })
    expect(applyCommand(s, { type: 'pickup' }).events[0]).toMatchObject({ reason: 'inventoryFull' })
  })

  it('монстр с оружием теряет его при смерти, предмет сохраняет прочность', () => {
    const s = newTestGame(44)
    clearMonsters(s)
    const p = player(s)
    const goblin = spawnMonster(s, 'goblin_brute', p.depth, p.x + 1, p.y, ['dagger'])
    const dagger = s.items[goblin.equipment.weapon!]!
    dagger.durability = 17
    goblin.hp = 1
    const ctx: Ctx = { state: s, events: [] }
    for (let i = 0; i < 100 && s.creatures[goblin.id]; i++) resolveAttack(ctx, p, goblin)
    expect(s.items[dagger.id]!.loc).toMatchObject({ kind: 'floor', x: goblin.x, y: goblin.y })
    expect(s.items[dagger.id]!.durability).toBe(17)
  })
})

describe('изучение снаряжения', () => {
  it('PlayerView не содержит точных характеристик неизученных типов', () => {
    const s = newTestGame(51)
    const p = player(s)
    const axe = giveItem(s, p, createItem(s, 'axe', { kind: 'carried', owner: p.id }))
    axe.durability = 37
    const view = buildView(s)
    const v = view.inventory.find((i) => i.id === axe.id)!
    expect(v.status).toBe('unknown')
    expect(v.stats.damage).toBe('??')
    expect(v.stats.accuracy).toBe('??')
    expect(v.stats.maxDurability).toBe('??')
    expect(v.durabilityText).toBe('~70%')
    expect(JSON.stringify(v)).not.toMatch(/37|"8"|"50"/)
    // Стартовое оружие изучено — точные числа.
    const sword = view.equipment.find((e) => e.slot === 'weapon')!.item!
    expect(sword.status).toBe('known')
    expect(sword.stats.damage).toBe('6')
    expect(sword.durabilityText).toBe('50/50')
    // Куртка изучена частично — приблизительно.
    const jacket = view.equipment.find((e) => e.slot === 'body')!.item!
    expect(jacket.status).toBe('partial')
    expect(jacket.stats.absorb).toMatch(/–|~/)
  })

  it('использование оружия продвигает и навык класса, и изученность типа', () => {
    let s = newTestGame(52)
    clearMonsters(s)
    const p = player(s)
    const axe = giveItem(s, p, createItem(s, 'axe', { kind: 'carried', owner: p.id }))
    s = applyCommand(s, { type: 'equip', itemId: axe.id }).state
    const xpBefore = s.knowledge.skillXp.axes
    const dataBefore = s.knowledge.itemData.axe ?? 0
    const rat = spawnMonster(s, 'hyena', 1, player(s).x + 1, player(s).y)
    rat.hp = rat.maxHp = 10_000
    for (const part of rat.parts) part.hp = part.maxHp = 10_000
    const ctx: Ctx = { state: s, events: [] }
    for (let i = 0; i < 20; i++) resolveAttack(ctx, player(s), rat)
    expect(s.knowledge.skillXp.axes).toBeGreaterThan(xpBefore)
    expect(s.knowledge.itemData.axe!).toBeGreaterThan(dataBefore)
    expect(studyStatus(s, 'axe')).toBe('partial')
  })

  it('разборка уничтожает предмет и даёт данные о типе (сломанный — столько же)', () => {
    let s = newTestGame(53)
    clearMonsters(s)
    const p = player(s)
    const mace = giveItem(s, p, createItem(s, 'mace', { kind: 'carried', owner: p.id }))
    mace.durability = 0
    const r = applyCommand(s, { type: 'disassemble', itemId: mace.id })
    s = r.state
    expect(s.items[mace.id]).toBeUndefined()
    expect(s.knowledge.itemData.mace).toBe(25)
    expect(s.knowledge.skillXp.maces).toBe(20)
    expect(r.events.map((e) => e.type)).toEqual(expect.arrayContaining(['itemDisassembled', 'studyChanged']))
  })
})
