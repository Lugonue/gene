// Угроза монстра относительно игрока — для карточки встречи в окне-сцене.
import { ATTACKS, ITEMS } from '@gene/data'
import { equippedWeapon, skillLevel } from './body'
import { PLAYER_BASE_EVASION, monsterThreat, threatTier, type ThreatTier } from './combat/formulas'
import type { Creature, GameState } from './state'
import { creatureSpeed } from './time'
import { creatureThreat } from './world/squads'

/** Угроза игрока по той же формуле, что и у монстров: оружие (или кулак), навыки, броня, скорость. */
export function playerThreat(state: GameState, p: Creature): number {
  const weapon = equippedWeapon(state, p)?.def
  const fist = ATTACKS.fist!
  const absorb = Object.values(p.equipment).reduce((sum, id) => {
    const def = ITEMS[state.items[id]!.defId]
    return sum + (def?.category === 'armour' ? def.absorb : 0)
  }, 0)
  return monsterThreat({
    maxHp: p.maxHp,
    speed: creatureSpeed(p),
    evasion: PLAYER_BASE_EVASION,
    damage: weapon?.damage ?? fist.damage,
    accuracy: weapon?.accuracy ?? fist.accuracy,
    attackSkill: skillLevel(state, p, weapon?.skill ?? 'unarmed'),
    fighting: skillLevel(state, p, 'fighting'),
    dodging: skillLevel(state, p, 'dodging'),
    absorb,
    spells: [],
  })
}

/** Насколько монстр c опасен для игрока p. */
export function threatToPlayer(state: GameState, c: Creature, p: Creature): ThreatTier {
  return threatTier(creatureThreat(state, c), playerThreat(state, p))
}
