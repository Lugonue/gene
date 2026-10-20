import { describe, expect, it } from 'vitest'
import { FACTIONS, MONSTERS, MONSTER_ROLES } from './index'

describe('фракции и виды', () => {
  it('четыре фракции занимают уровни 1–4, по одной на уровень', () => {
    expect(Object.values(FACTIONS).map((f) => f.depth).sort()).toEqual([1, 2, 3, 4])
  })

  it('у каждого вида есть существующая фракция и роль', () => {
    for (const m of Object.values(MONSTERS)) {
      expect(FACTIONS[m.faction], m.id).toBeDefined()
      expect(MONSTER_ROLES, m.id).toContain(m.role)
    }
  })

  it('в каждой фракции есть все пять ролей и ровно один вожак', () => {
    for (const f of Object.values(FACTIONS)) {
      const species = Object.values(MONSTERS).filter((m) => m.faction === f.id)
      expect(new Set(species.map((m) => m.role)), f.id).toEqual(new Set(MONSTER_ROLES))
      expect(species.filter((m) => m.role === 'leader'), f.id).toHaveLength(1)
    }
  })

  it('звери фракций ходят на четырёх лапах и без снаряжения', () => {
    for (const m of Object.values(MONSTERS).filter((m) => m.role === 'beast')) {
      expect(m.bodyPlan, m.id).toBe('quadruped')
      expect(m.equipment ?? [], m.id).toEqual([])
    }
  })
})
