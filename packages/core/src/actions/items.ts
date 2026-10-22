// Действия с предметами: подобрать, бросить, надеть/снять, применить, разобрать.
import { ITEMS, SLOTS, type SlotId } from '@gene/data'
import { reject, type ActionResult, type Ctx } from '../context'
import { INVENTORY_SIZE, itemsAt, player, type Creature, type ItemInstance } from '../state'
import { actionCost } from '../time'
import { findPart, isEquipped, slotsForItem } from '../body'
import { destroyItem, dropToFloor, giveItem, needsSlot } from '../items'
import { encounterItemType, gainSkillXp, studyItemType } from '../knowledge'
import { healCreature, isDamagedPart, isFullyHealthy } from '../health'
import {
  SKILL_XP,
  STUDY_GAIN,
  potionHeal,
  repairAmount,
  treatOneStage,
  woundStageFor,
} from '../combat/formulas'

function ownItem(p: Creature, ctx: Ctx, itemId: unknown): ItemInstance | undefined {
  if (typeof itemId !== 'string' || !p.inventory.includes(itemId)) return undefined
  return ctx.state.items[itemId]
}

function cost(ctx: Ctx): ActionResult {
  return { ok: true, cost: actionCost(player(ctx.state), 'item') }
}

export function pickupAction(ctx: Ctx): ActionResult {
  const { state } = ctx
  const p = player(state)
  const here = itemsAt(state, p.depth, p.x, p.y)
  if (here.length === 0) return reject('nothingHere')
  let picked = 0
  for (const inst of here) {
    if (needsSlot(state, p, inst.defId) && p.inventory.length >= INVENTORY_SIZE) continue
    const count = inst.count ?? 1
    giveItem(state, p, inst)
    ctx.events.push({ type: 'itemPickedUp', itemDefId: inst.defId, count })
    encounterItemType(ctx, inst.defId)
    picked++
  }
  if (picked === 0) return reject('inventoryFull')
  return cost(ctx)
}

export function dropAction(ctx: Ctx, itemId: string): ActionResult {
  const p = player(ctx.state)
  const inst = ownItem(p, ctx, itemId)
  if (!inst) return reject('noItem')
  const slot = isEquipped(p, inst.id)
  if (slot) ctx.events.push({ type: 'itemUnequipped', itemDefId: inst.defId, slot })
  dropToFloor(ctx.state, p, inst)
  ctx.events.push({ type: 'itemDropped', itemDefId: inst.defId, count: inst.count ?? 1, owner: { id: p.id, kind: p.kind } })
  return cost(ctx)
}

export function equipAction(ctx: Ctx, itemId: string, slot?: SlotId): ActionResult {
  const p = player(ctx.state)
  const inst = ownItem(p, ctx, itemId)
  if (!inst) return reject('noItem')
  const allowed = slotsForItem(p, inst.defId)
  if (allowed.length === 0) return reject('cannotEquip')
  if (slot !== undefined && !allowed.includes(slot)) return reject('cannotEquip')
  const current = isEquipped(p, inst.id)
  const target = slot ?? allowed.find((s) => !p.equipment[s]) ?? allowed[0]!
  if (current === target) return reject('invalid')
  if (current) {
    delete p.equipment[current]
  }
  const old = p.equipment[target]
  if (old) {
    const oldInst = ctx.state.items[old]
    if (oldInst) ctx.events.push({ type: 'itemUnequipped', itemDefId: oldInst.defId, slot: target })
  }
  p.equipment[target] = inst.id
  ctx.events.push({ type: 'itemEquipped', itemDefId: inst.defId, slot: target })
  encounterItemType(ctx, inst.defId)
  return cost(ctx)
}

export function unequipAction(ctx: Ctx, slot: SlotId): ActionResult {
  const p = player(ctx.state)
  if (typeof slot !== 'string' || !Object.hasOwn(SLOTS, slot)) return reject('invalid')
  const id = p.equipment[slot]
  const inst = id ? ctx.state.items[id] : undefined
  if (!inst) return reject('slotEmpty')
  delete p.equipment[slot]
  ctx.events.push({ type: 'itemUnequipped', itemDefId: inst.defId, slot })
  return cost(ctx)
}

function consumeOne(ctx: Ctx, p: Creature, inst: ItemInstance): void {
  inst.count = (inst.count ?? 1) - 1
  if (inst.count <= 0) destroyItem(ctx.state, p, inst)
}

export function useAction(ctx: Ctx, itemId: string, targetPartId?: string, targetItemId?: string): ActionResult {
  const p = player(ctx.state)
  const inst = ownItem(p, ctx, itemId)
  if (!inst) return reject('noItem')
  const def = ITEMS[inst.defId]
  if (!def || def.category !== 'consumable') return reject('notUsable')

  switch (def.effect) {
    case 'ammo':
      return reject('notUsable')
    case 'bandage': {
      if (targetPartId === undefined) return reject('needTarget')
      const part = findPart(p, targetPartId)
      if (!part) return reject('wrongTarget')
      if (part.material !== 'organic') return reject('bandageOnBionic')
      if (!isDamagedPart(part)) return reject('notDamaged')
      const from = part.wound
      part.hp = treatOneStage(part)
      part.needsTreatment = false
      part.wound = woundStageFor(part)
      ctx.events.push({ type: 'bandageApplied', partId: part.defId, from, to: part.wound })
      break
    }
    case 'healPotion': {
      if (isFullyHealthy(p)) return reject('fullHealth')
      const before = p.hp
      healCreature(p, potionHeal(p))
      ctx.events.push({ type: 'potionDrunk', healed: p.hp - before })
      break
    }
    case 'repairKit': {
      if (targetItemId !== undefined) {
        const target = ownItem(p, ctx, targetItemId)
        if (!target || target.maxDurability === undefined) return reject('wrongTarget')
        if ((target.durability ?? 0) >= target.maxDurability) return reject('notDamaged')
        target.durability = Math.min(target.maxDurability, (target.durability ?? 0) + repairAmount(target))
        ctx.events.push({
          type: 'itemRepaired',
          itemDefId: target.defId,
          durability: target.durability,
          maxDurability: target.maxDurability,
        })
      } else if (targetPartId !== undefined) {
        const part = findPart(p, targetPartId)
        if (!part) return reject('wrongTarget')
        if (part.material !== 'bionic') return reject('repairOnOrganic')
        if (!isDamagedPart(part)) return reject('notDamaged')
        const from = part.wound
        part.hp = treatOneStage(part)
        part.wound = woundStageFor(part)
        ctx.events.push({ type: 'partRepaired', partId: part.defId, from, to: part.wound })
      } else return reject('needTarget')
      break
    }
  }
  consumeOne(ctx, p, inst)
  return cost(ctx)
}

export function disassembleAction(ctx: Ctx, itemId: string): ActionResult {
  const p = player(ctx.state)
  const inst = ownItem(p, ctx, itemId)
  if (!inst) return reject('noItem')
  const def = ITEMS[inst.defId]
  if (!def || def.category === 'consumable') return reject('notUsable')
  const slot = isEquipped(p, inst.id)
  if (slot) ctx.events.push({ type: 'itemUnequipped', itemDefId: inst.defId, slot })
  destroyItem(ctx.state, p, inst)
  // Сломанные предметы дают столько же данных, сколько целые.
  ctx.events.push({ type: 'itemDisassembled', itemDefId: def.id, skill: def.skill })
  gainSkillXp(ctx, def.skill, SKILL_XP.disassemble, false)
  studyItemType(ctx, def.id, STUDY_GAIN.disassemble)
  return cost(ctx)
}

/** Данные о надетых предметах копятся с каждым действием игрока. */
export function studyWornItems(ctx: Ctx): void {
  const p = player(ctx.state)
  for (const id of Object.values(p.equipment)) {
    const inst = id ? ctx.state.items[id] : undefined
    if (inst) studyItemType(ctx, inst.defId, STUDY_GAIN.wornPerAction)
  }
}
