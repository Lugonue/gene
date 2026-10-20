import { BODY_PLANS, MONSTERS } from '@gene/data'
import { partMaxHp } from './combat/formulas'
import { createEquipped } from './items'
import { newId, type Creature, type GameState } from './state'

/** Монстр вида kind в клетке (x, y), надевший снаряжение gear (id типов предметов). */
export function spawnMonster(
  state: GameState,
  kind: string,
  depth: number,
  x: number,
  y: number,
  gear: readonly string[] = [],
): Creature {
  const def = MONSTERS[kind]
  if (!def) throw new Error(`неизвестный монстр ${kind}`)
  const plan = BODY_PLANS[def.bodyPlan]
  if (!plan) throw new Error(`неизвестный план тела ${def.bodyPlan}`)
  const c: Creature = {
    id: newId(state, 'm'),
    kind,
    depth,
    x,
    y,
    hp: def.maxHp,
    maxHp: def.maxHp,
    bodyPlan: plan.id,
    parts: plan.parts.map((p) => {
      const maxHp = partMaxHp(p, 'organic', def.partHpScale)
      return { defId: p.id, material: 'organic', hp: maxHp, maxHp, wound: 'none' }
    }),
    equipment: {},
    inventory: [],
    nextActAt: state.now,
    regenAcc: 0,
    ai: { mode: 'idle' },
  }
  state.creatures[c.id] = c
  for (const itemId of gear) createEquipped(state, c, itemId)
  return c
}
