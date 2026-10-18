// База знаний ядра: опыт навыков и изученность типов предметов (только у игрока).
import { ITEMS, type SkillId } from '@gene/data'
import type { Ctx } from './context'
import { killXp, skillLevelFromXp, studyStatusFor } from './combat/formulas'

/** Начислить опыт навыку. Учитывается и как «использование в бою» для распределения опыта за убийство. */
export function gainSkillXp(ctx: Ctx, skill: SkillId, amount: number, countAsUse = true): void {
  const k = ctx.state.knowledge
  const before = skillLevelFromXp(k.skillXp[skill] ?? 0)
  k.skillXp[skill] = (k.skillXp[skill] ?? 0) + amount
  if (countAsUse) k.recentUse[skill] = (k.recentUse[skill] ?? 0) + amount
  const after = skillLevelFromXp(k.skillXp[skill])
  if (after > before) ctx.events.push({ type: 'skillUp', skill, level: after })
}

/** Опыт за убийство: распределяется пропорционально навыкам, использованным с прошлого убийства. */
export function distributeKillXp(ctx: Ctx, monsterXp: number): void {
  const k = ctx.state.knowledge
  const used = Object.entries(k.recentUse) as [SkillId, number][]
  const total = used.reduce((s, [, v]) => s + v, 0)
  const pool = killXp(monsterXp)
  if (total > 0) {
    for (const [skill, v] of used) {
      const share = Math.round((pool * v) / total)
      if (share > 0) gainSkillXp(ctx, skill, share, false)
    }
  }
  k.recentUse = {}
}

/** Первое знакомство ядра с типом снаряжения. */
export function encounterItemType(ctx: Ctx, defId: string): void {
  const def = ITEMS[defId]
  if (!def || def.category === 'consumable') return
  const k = ctx.state.knowledge
  if (defId in k.itemData) return
  k.itemData[defId] = 0
  ctx.events.push({ type: 'newItemType', itemDefId: defId })
}

/** Добавить данные об изучаемом типе предмета. */
export function studyItemType(ctx: Ctx, defId: string, amount: number): void {
  const def = ITEMS[defId]
  if (!def || def.category === 'consumable') return
  encounterItemType(ctx, defId)
  const k = ctx.state.knowledge
  const before = studyStatusFor(k.itemData[defId] ?? 0)
  k.itemData[defId] = (k.itemData[defId] ?? 0) + amount
  const after = studyStatusFor(k.itemData[defId])
  if (after !== before) ctx.events.push({ type: 'studyChanged', itemDefId: defId, status: after })
}
