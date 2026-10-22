// Вспомогательные функции для тел и снаряжения существ (без игровых констант — они в combat/formulas).
import {
  BODY_PLANS,
  ITEMS,
  SKILLS,
  SLOTS,
  type ArmourDef,
  type ArmourSlotId,
  type BodyPartDef,
  type BodyPlanDef,
  type MonsterDef,
  type PartTag,
  type SkillId,
  type SlotId,
  type WeaponDef,
} from '@gene/data'
import { speciesOf, type BodyPartState, type Creature, type GameState, type ItemInstance } from './state'
import { skillLevelFromXp, stageIndex } from './combat/formulas'

export function planOf(c: Creature): BodyPlanDef {
  const plan = BODY_PLANS[c.bodyPlan]
  if (!plan) throw new Error(`неизвестный план тела: ${c.bodyPlan}`)
  return plan
}

export function partDef(c: Creature, part: BodyPartState): BodyPartDef {
  const def = planOf(c).parts.find((p) => p.id === part.defId)
  if (!def) throw new Error(`нет части ${part.defId} в плане ${c.bodyPlan}`)
  return def
}

export function findPart(c: Creature, partId: string): BodyPartState | undefined {
  return c.parts.find((p) => p.defId === partId)
}

export function partsWithTag(c: Creature, tag: PartTag): BodyPartState[] {
  return c.parts.filter((p) => partDef(c, p).tags.includes(tag))
}

export function mainHand(c: Creature): BodyPartState | undefined {
  const id = planOf(c).mainHand
  return id ? findPart(c, id) : undefined
}

/** Вторая рука для двуручного оружия: наименее раненая хватательная часть, кроме основной руки. */
export function offHand(c: Creature): BodyPartState | undefined {
  const main = mainHand(c)
  let best: BodyPartState | undefined
  for (const p of partsWithTag(c, 'grasp')) {
    if (p === main) continue
    if (!best || stageIndex(p.wound) < stageIndex(best.wound)) best = p
  }
  return best
}

/** Слоты, доступные существу: оружие (если есть хватательные части) + слоты брони из плана тела. */
export function slotsOf(c: Creature): SlotId[] {
  const plan = planOf(c)
  const slots: SlotId[] = []
  if (plan.mainHand) slots.push('weapon')
  for (const p of plan.parts) if (p.armorSlot && !slots.includes(p.armorSlot)) slots.push(p.armorSlot)
  return slots
}

/** Слоты, в которые можно надеть предмет данного типа. */
export function slotsForItem(c: Creature, defId: string): SlotId[] {
  const def = ITEMS[defId]
  if (!def || def.category === 'consumable') return []
  const own = slotsOf(c)
  if (def.category === 'weapon') return own.includes('weapon') ? ['weapon'] : []
  return own.filter((s) => SLOTS[s].kind === def.kind)
}

export function item(state: GameState, id: string | undefined): ItemInstance | undefined {
  return id ? state.items[id] : undefined
}

export function equippedWeapon(state: GameState, c: Creature): { inst: ItemInstance; def: WeaponDef } | undefined {
  const inst = item(state, c.equipment.weapon)
  if (!inst) return undefined
  const def = ITEMS[inst.defId]
  return def && def.category === 'weapon' ? { inst, def } : undefined
}

export function armourInSlot(
  state: GameState,
  c: Creature,
  slot: ArmourSlotId | undefined,
): { inst: ItemInstance; def: ArmourDef } | undefined {
  if (!slot) return undefined
  const inst = item(state, c.equipment[slot])
  if (!inst) return undefined
  const def = ITEMS[inst.defId]
  return def && def.category === 'armour' ? { inst, def } : undefined
}

export function isEquipped(c: Creature, itemId: string): SlotId | undefined {
  for (const [slot, id] of Object.entries(c.equipment)) if (id === itemId) return slot as SlotId
  return undefined
}

/** Уровень навыка существа: у игрока — из базы знаний Ядра, у монстра — из данных вида. */
export function skillLevel(state: GameState, c: Creature, skill: SkillId): number {
  if (c.kind === 'player') return skillLevelFromXp(state.knowledge.skillXp[skill] ?? 0)
  const def = speciesOf(c)
  return def ? speciesSkill(def, skill) : 0
}

/**
 * Навык вида. Снаряжение монстров случайное, поэтому оружием и бронёй, которых нет в навыках вида,
 * монстр владеет на уровне своего лучшего навыка той же группы.
 */
export function speciesSkill(def: MonsterDef, skill: SkillId): number {
  const own = def.skills[skill]
  if (own !== undefined) return own
  const group = SKILLS[skill].group
  if (group === 'general') return 0
  let best = 0
  for (const [id, level] of Object.entries(def.skills)) {
    if (SKILLS[id as SkillId].group === group) best = Math.max(best, level ?? 0)
  }
  return best
}
