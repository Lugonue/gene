// База знаний ядра: опыт навыков, изученность типов предметов и явлений (только у игрока).
import { ITEMS, type PhenomenonId, type SkillId } from '@gene/data'
import type { Ctx } from './context'
import { killXp, phenomenonStatusFor, skillLevelFromXp, studyStatusFor } from './combat/formulas'

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

/** Добавить данные о явлении; при первом наблюдении ядро фиксирует его под условным именем. */
export function studyPhenomenon(ctx: Ctx, id: PhenomenonId, amount: number): void {
  const phenomena = (ctx.state.knowledge.phenomena ??= {})
  let entry = phenomena[id]
  if (!entry) {
    entry = phenomena[id] = { data: 0, n: Object.keys(phenomena).length + 1 }
    ctx.events.push({ type: 'phenomenonDiscovered', phenomenon: id, n: entry.n })
  }
  const before = phenomenonStatusFor(entry.data)
  entry.data += amount
  const after = phenomenonStatusFor(entry.data)
  if (after === before || after === 'unknown') return
  ctx.events.push({ type: 'phenomenonStudyChanged', phenomenon: id, n: entry.n, status: after })
  if (after === 'known') ctx.events.push({ type: 'recipeUnlocked', phenomenon: id })
}
