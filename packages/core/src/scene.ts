// Яркие моменты хода для окна-сцены клиента: какую сцену из них показать, решает клиент.
import type { GameEvent } from './events'

export type SceneMoment =
  /** Монстр убит игроком. */
  | { kind: 'death'; species: string }
  /** Сильный удар игрока по монстру (byPlayer) или монстра по игроку. */
  | { kind: 'strongHit'; species: string; byPlayer: boolean }
  /** Вид впервые попал в бестиарий. */
  | { kind: 'encounter'; species: string }

/** Моменты хода в порядке событий. */
export function sceneMoments(events: GameEvent[], playerId: string): SceneMoment[] {
  const out: SceneMoment[] = []
  for (const e of events) {
    if (e.type === 'speciesDiscovered') out.push({ kind: 'encounter', species: e.kind })
    else if (e.type === 'attackHit' && e.strong) {
      if (e.attacker.id === playerId && e.target.id !== playerId)
        out.push({ kind: 'strongHit', species: e.target.kind, byPlayer: true })
      else if (e.target.id === playerId && e.attacker.id !== playerId)
        out.push({ kind: 'strongHit', species: e.attacker.kind, byPlayer: false })
    } else if (e.type === 'creatureDied' && e.killer?.id === playerId && e.creature.id !== playerId)
      out.push({ kind: 'death', species: e.creature.kind })
  }
  return out
}
