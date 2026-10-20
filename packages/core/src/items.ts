// Экземпляры предметов: создание, перемещение между полом и носителем, стопки расходников.
import { ITEMS } from '@gene/data'
import { slotsForItem } from './body'
import { itemsAt, newId, type Creature, type GameState, type ItemInstance, type ItemLocation } from './state'

export function createItem(state: GameState, defId: string, loc: ItemLocation, count = 1): ItemInstance {
  const def = ITEMS[defId]
  if (!def) throw new Error(`неизвестный тип предмета ${defId}`)
  const inst: ItemInstance = { id: newId(state, 'i'), defId, loc }
  if (def.category === 'consumable') inst.count = count
  else {
    inst.durability = def.maxDurability
    inst.maxDurability = def.maxDurability
  }
  state.items[inst.id] = inst
  return inst
}

export function isStackable(defId: string): boolean {
  return ITEMS[defId]?.category === 'consumable'
}

/**
 * Положить предмет к носителю. Расходники складываются в существующую стопку (исходный экземпляр удаляется).
 * Возвращает экземпляр, в котором предмет оказался.
 */
export function giveItem(state: GameState, owner: Creature, inst: ItemInstance): ItemInstance {
  if (isStackable(inst.defId)) {
    const stack = owner.inventory.map((id) => state.items[id]).find((i) => i && i.defId === inst.defId)
    if (stack) {
      stack.count = (stack.count ?? 1) + (inst.count ?? 1)
      delete state.items[inst.id]
      return stack
    }
  }
  inst.loc = { kind: 'carried', owner: owner.id }
  owner.inventory.push(inst.id)
  return inst
}

/** Сколько слотов инвентаря понадобится, чтобы взять предмет. */
export function needsSlot(state: GameState, owner: Creature, defId: string): boolean {
  if (!isStackable(defId)) return true
  return !owner.inventory.some((id) => state.items[id]?.defId === defId)
}

export function removeFromOwner(state: GameState, owner: Creature, itemId: string): void {
  owner.inventory = owner.inventory.filter((id) => id !== itemId)
  for (const [slot, id] of Object.entries(owner.equipment)) {
    if (id === itemId) delete owner.equipment[slot as keyof typeof owner.equipment]
  }
  void state
}

export function dropToFloor(state: GameState, owner: Creature, inst: ItemInstance): void {
  removeFromOwner(state, owner, inst.id)
  inst.loc = { kind: 'floor', depth: owner.depth, x: owner.x, y: owner.y }
}

/** Положить count предметов типа defId на пол; расходник добавляется к стопке, уже лежащей в клетке. */
export function dropAt(state: GameState, defId: string, depth: number, x: number, y: number, count = 1): ItemInstance {
  if (isStackable(defId)) {
    const stack = itemsAt(state, depth, x, y).find((i) => i.defId === defId)
    if (stack) {
      stack.count = (stack.count ?? 1) + count
      return stack
    }
  }
  return createItem(state, defId, { kind: 'floor', depth, x, y }, count)
}

export function destroyItem(state: GameState, owner: Creature | undefined, inst: ItemInstance): void {
  if (owner) removeFromOwner(state, owner, inst.id)
  delete state.items[inst.id]
}

/** Создать и сразу надеть предмет (снаряжение монстров, стартовый набор). */
export function createEquipped(state: GameState, owner: Creature, defId: string): ItemInstance {
  const inst = giveItem(state, owner, createItem(state, defId, { kind: 'carried', owner: owner.id }))
  const slot = slotsForItem(owner, defId).find((s) => !owner.equipment[s])
  if (slot) owner.equipment[slot] = inst.id
  return inst
}
