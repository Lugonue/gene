// Регенерация и лечение (числа — в combat/formulas).
import type { Ctx } from './context'
import type { BodyPartState, Creature } from './state'
import { organicHealCap, regenTick, stageIndex, woundStageFor } from './combat/formulas'
import { actorRef } from './combat/attack'

/** Часть тела повреждена: hp неполный, есть стадия раны или ждёт перевязки. Одно правило для бинта, ремкомплекта, зелья и представления. */
export function isDamagedPart(part: BodyPartState): boolean {
  return part.hp < part.maxHp || part.wound !== 'none' || !!part.needsTreatment
}

/** Зелью нечего лечить: общий HP полон и все органические части целы. */
export function isFullyHealthy(c: Creature): boolean {
  if (c.hp < c.maxHp) return false
  return !c.parts.some((part) => part.material === 'organic' && part.wound !== 'severed' && isDamagedPart(part))
}

/** Лечение (зелье, заклинание): общий HP и доля hp каждой органической части, не выше предела самолечения. */
export function healCreature(c: Creature, heal: { hp: number; partFraction: number }): void {
  c.hp = Math.min(c.maxHp, c.hp + heal.hp)
  for (const part of c.parts) {
    if (part.material !== 'organic' || part.wound === 'severed') continue
    const gain = Math.ceil(part.maxHp * heal.partFraction)
    part.hp = Math.max(part.hp, Math.min(organicHealCap(part), part.hp + gain))
    part.wound = woundStageFor(part)
  }
}

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
