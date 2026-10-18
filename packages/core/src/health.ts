// Регенерация (числа — в combat/formulas).
import type { Ctx } from './context'
import type { Creature } from './state'
import { regenTick, stageIndex, woundStageFor } from './combat/formulas'
import { actorRef } from './combat/attack'

export function applyRegen(ctx: Ctx, c: Creature, elapsed: number): void {
  const r = regenTick(c, elapsed)
  if (r.hp > 0) c.hp = Math.min(c.maxHp, c.hp + r.hp)
  for (const { index, gain } of r.parts) {
    const part = c.parts[index]
    if (!part) continue
    const from = part.wound
    part.hp = Math.min(part.maxHp, part.hp + gain)
    part.wound = woundStageFor(part)
    if (c.kind === 'player' && stageIndex(part.wound) < stageIndex(from)) {
      ctx.events.push({
        type: 'woundChanged',
        creature: actorRef(c),
        partId: part.defId,
        material: part.material,
        from,
        to: part.wound,
        hp: part.hp,
        maxHp: part.maxHp,
      })
    }
  }
}
