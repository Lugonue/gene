// Отряды: случайное снаряжение по роли, угроза монстра и набор отрядов уровня в пределах бюджета угрозы.
import {
  FACTIONS,
  ITEMS,
  LEADER_RETINUE,
  MONSTERS,
  ROLE_GEAR,
  SQUAD_SIZE,
  factionForDepth,
  type ArmourDef,
  type ArmourKind,
  type FactionDef,
  type ItemDef,
  type MonsterDef,
  type MonsterRole,
  type WeaponDef,
} from '@gene/data'
import { levelThreatBudget, monsterThreat } from '../combat/formulas'
import { speciesSkill } from '../body'
import { chance, pick, randInt, weightedIndex, type RngState } from '../rng'
import type { Creature, GameState } from '../state'

/**
 * Член отряда — один монстр со своим снаряжением. Связку «наездник + зверь» (ADR 0002) можно будет
 * описать как члена отряда со вторым существом, не меняя остального.
 */
export interface SquadMember {
  species: string
  gear: string[]
  threat: number
}

export interface SquadPlan {
  members: SquadMember[]
  threat: number
  /** Отряд вожака ставится в последнюю комнату. */
  leader: boolean
}

const ARMOUR_KINDS: ArmourKind[] = ['head', 'body', 'hands', 'legs']
/** Сколько раз подряд можно не уложиться в остаток бюджета, прежде чем уровень считается заполненным. */
const MAX_MISSES = 20

const isWeapon = (it: ItemDef | undefined): it is WeaponDef => it?.category === 'weapon'
const isArmour = (it: ItemDef | undefined): it is ArmourDef => it?.category === 'armour'

/** Случайное снаряжение монстра из набора его фракции: оружие по роли и броня с шансом роли. */
export function rollGear(rng: RngState, def: MonsterDef, faction: FactionDef): string[] {
  const role = ROLE_GEAR[def.role]
  const gear: string[] = []
  const weapons = faction.gear.filter((id) => {
    const it = ITEMS[id]
    return isWeapon(it) && role.weaponSkills.includes(it.skill)
  })
  if (weapons.length > 0) gear.push(pick(rng, weapons))
  if (role.armourChance <= 0) return gear
  for (const kind of ARMOUR_KINDS) {
    const pieces = faction.gear.filter((id) => {
      const it = ITEMS[id]
      return isArmour(it) && it.kind === kind
    })
    if (pieces.length > 0 && chance(rng, role.armourChance)) gear.push(pick(rng, pieces))
  }
  return gear
}

/** Угроза монстра вида def в снаряжении gear (с учётом черты его фракции). */
export function speciesThreat(def: MonsterDef, gear: string[]): number {
  const items = gear.map((id) => ITEMS[id])
  const weapon = items.find(isWeapon)
  const fighting = speciesSkill(def, 'fighting')
  const natural = def.attacks.reduce<MonsterDef['attacks'][number] | undefined>(
    (best, a) => (!best || a.damage > best.damage ? a : best),
    undefined,
  )
  return monsterThreat({
    maxHp: def.maxHp,
    speed: def.speed,
    evasion: def.evasion,
    damage: weapon?.damage ?? natural?.damage ?? 0,
    accuracy: weapon?.accuracy ?? natural?.accuracy ?? 0,
    attackSkill: weapon ? speciesSkill(def, weapon.skill) : fighting,
    fighting,
    dodging: speciesSkill(def, 'dodging'),
    absorb: items.filter(isArmour).reduce((s, it) => s + it.absorb, 0),
    trait: FACTIONS[def.faction].trait,
  })
}

/** Угроза монстра на уровне — по виду и надетому снаряжению. */
export function creatureThreat(state: GameState, c: Creature): number {
  const def = MONSTERS[c.kind]
  if (!def) return 0
  const gear = Object.values(c.equipment).map((id) => state.items[id]!.defId)
  return speciesThreat(def, gear)
}

/**
 * Отряд из size монстров (плюс вожак, если задан). Ограничения: первым идёт воин или зверь,
 * магов не больше одного, стрелков не больше половины отряда.
 */
function rollSquad(rng: RngState, faction: FactionDef, size: number, leader?: MonsterDef): SquadPlan {
  const pool = Object.values(MONSTERS).filter(
    (m) => m.faction === faction.id && m.role !== 'leader' && m.spawnWeight > 0,
  )
  const picked: MonsterDef[] = leader ? [leader] : []
  const total = picked.length + size
  const count = (role: MonsterRole): number => picked.filter((m) => m.role === role).length
  for (let i = 0; i < size; i++) {
    const allowed = pool.filter((m) => {
      if (i === 0) return m.role === 'warrior' || m.role === 'beast'
      if (m.role === 'mage') return count('mage') === 0
      if (m.role === 'archer') return (count('archer') + 1) * 2 <= total
      return true
    })
    picked.push(
      allowed[
        weightedIndex(
          rng,
          allowed.map((m) => m.spawnWeight),
        )
      ]!,
    )
  }
  const members = picked.map((def) => {
    const gear = rollGear(rng, def, faction)
    return { species: def.id, gear, threat: speciesThreat(def, gear) }
  })
  return { members, threat: members.reduce((s, m) => s + m.threat, 0), leader: leader !== undefined }
}

/**
 * Отряды уровня: сначала отряд вожака, затем случайные отряды фракции, пока они укладываются
 * в бюджет угрозы. Не влезший отряд перебрасывается на единицу меньше.
 */
export function planSquads(rng: RngState, depth: number): SquadPlan[] {
  const faction = factionForDepth(depth)
  if (!faction) return []
  let remaining = levelThreatBudget(depth)
  const squads: SquadPlan[] = []
  const leader = Object.values(MONSTERS).find((m) => m.faction === faction.id && m.role === 'leader')
  if (leader) {
    const squad = rollSquad(rng, faction, randInt(rng, LEADER_RETINUE[0], LEADER_RETINUE[1]), leader)
    squads.push(squad)
    remaining -= squad.threat
  }
  const rollSize = (): number => randInt(rng, SQUAD_SIZE[0], SQUAD_SIZE[1])
  let size = rollSize()
  for (let misses = 0; misses < MAX_MISSES;) {
    const squad = rollSquad(rng, faction, size)
    if (squad.threat <= remaining) {
      squads.push(squad)
      remaining -= squad.threat
      size = rollSize()
    } else {
      misses++
      size = Math.max(SQUAD_SIZE[0], size - 1)
    }
  }
  return squads
}
