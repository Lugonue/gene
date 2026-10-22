import { describe, expect, it } from 'vitest'
import { FACTIONS, ITEMS, MONSTERS } from '@gene/data'
import { RANGED_SUPPLY } from '../combat/formulas'
import { createRng } from '../rng'
import { planSquads, speciesThreat, type SquadPlan } from './squads'

// Угроза реально поставленных на уровень монстров проверяется в world.test.ts.
const roles = (squad: SquadPlan) => squad.members.map((m) => MONSTERS[m.species]!.role)

describe('отряды уровня', () => {
  it('в отряде есть воин или зверь, магов не больше одного, стрелков не больше половины', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const depth of [1, 2, 3, 4]) {
        for (const squad of planSquads(createRng(seed), depth)) {
          const r = roles(squad)
          expect(
            r.some((x) => x === 'warrior' || x === 'beast'),
            r.join(),
          ).toBe(true)
          expect(r.filter((x) => x === 'mage').length, r.join()).toBeLessThanOrEqual(1)
          expect(r.filter((x) => x === 'archer').length, r.join()).toBeLessThanOrEqual(r.length / 2)
        }
      }
    }
  })

  it('один сид — один состав, разные сиды — разные составы', () => {
    const lineup = (seed: number) =>
      JSON.stringify(planSquads(createRng(seed), 2).map((q) => q.members.map((m) => m.species)))
    expect(lineup(11)).toBe(lineup(11))
    const variants = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(lineup))
    expect(variants.size).toBe(8)
  })

  it('снаряжение берётся из набора фракции по роли: маг с посохом, стрелок с запасом, зверь без снаряжения', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const depth of [1, 2, 3, 4]) {
        for (const m of planSquads(createRng(seed), depth).flatMap((q) => q.members)) {
          const def = MONSTERS[m.species]!
          for (const id of m.gear)
            if (ITEMS[id]!.category !== 'consumable') expect(FACTIONS[def.faction].gear, m.species).toContain(id)
          const weapon = m.gear.find((id) => ITEMS[id]!.category === 'weapon')
          if (def.role === 'beast') expect(m.gear).toEqual([])
          if (def.role === 'mage') expect(weapon).toBe('staff')
          if (def.role === 'warrior' || def.role === 'leader') expect(weapon, m.species).toBeDefined()
          if (def.role !== 'mage') expect(weapon).not.toBe('staff')
          if (def.role === 'archer') {
            const w = ITEMS[weapon!]
            const ranged = w?.category === 'weapon' ? w.ranged : undefined
            expect(ranged, m.species).toBeDefined()
            // Запас: боеприпасы к метателю или несколько метательных копий.
            const supply = m.gear.filter((id) => id === (ranged!.ammo ?? weapon)).length
            expect(supply, m.species).toBeGreaterThanOrEqual(ranged!.ammo ? RANGED_SUPPLY.ammo[0] : RANGED_SUPPLY.thrown[0])
          }
        }
      }
    }
  })

  it('заклинания вида добавляют угрозы, и сильные — больше слабых', () => {
    for (const id of ['goblin_shaman', 'orc_warshaman', 'sorcerer', 'inquisitor', 'dragon_priest', 'dragonborn']) {
      const def = MONSTERS[id]!
      expect(speciesThreat(def, []), id).toBeGreaterThan(speciesThreat({ ...def, spells: [] }, []))
    }
    const shaman = MONSTERS.goblin_shaman!
    const gain = (power: number) => speciesThreat({ ...shaman, spellPower: power }, []) - speciesThreat({ ...shaman, spells: [] }, [])
    expect(gain(1)).toBeGreaterThan(gain(0.6))
  })

  it('снаряжение случайно: один вид встречается в разных комплектах', () => {
    const kits = new Set<string>()
    for (let seed = 1; seed <= 30; seed++) {
      for (const m of planSquads(createRng(seed), 1).flatMap((q) => q.members)) {
        if (m.species === 'goblin_brute') kits.add(m.gear.join('+'))
      }
    }
    expect(kits.size).toBeGreaterThan(3)
  })
})
