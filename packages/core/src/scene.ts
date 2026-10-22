// Яркие моменты хода для окна-сцены клиента: какую сцену из них показать, решает клиент.
import type { ThreatTier } from './combat/formulas'
import type { GameEvent } from './events'

/** Новый вид в карточке встречи и его угроза относительно игрока. */
export interface EncounterSpecies {
  species: string
  threat: ThreatTier
}

export type SceneMoment =
  /** Монстр убит игроком. */
  | { kind: 'death'; species: string }
  /** Сильный удар игрока по монстру (byPlayer) или монстра по игроку. */
  | { kind: 'strongHit'; species: string; byPlayer: boolean }
  /** Виды, впервые попавшие в бестиарий за ход, — одной группой. */
  | { kind: 'encounter'; seen: EncounterSpecies[] }

/** Моменты хода в порядке событий; все встречи хода собираются в один момент на месте первой. */
export function sceneMoments(events: GameEvent[], playerId: string): SceneMoment[] {
  const out: SceneMoment[] = []
  let encounter: Extract<SceneMoment, { kind: 'encounter' }> | undefined
  for (const e of events) {
    if (e.type === 'speciesDiscovered') {
      if (!encounter) out.push((encounter = { kind: 'encounter', seen: [] }))
      encounter.seen.push({ species: e.kind, threat: e.threat })
    } else if (e.type === 'attackHit' && e.strong) {
      if (e.attacker.id === playerId && e.target.id !== playerId)
        out.push({ kind: 'strongHit', species: e.target.kind, byPlayer: true })
      else if (e.target.id === playerId && e.attacker.id !== playerId)
        out.push({ kind: 'strongHit', species: e.attacker.kind, byPlayer: false })
    } else if (e.type === 'creatureDied' && e.killer?.id === playerId && e.creature.id !== playerId)
      out.push({ kind: 'death', species: e.creature.kind })
  }
  return out
}
