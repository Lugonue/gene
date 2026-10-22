// Анимация многоходовых действий (автоисследование, бег): проигрывает кадры с сервера,
// постепенно проявляя память карты, затем применяет итоговый вид. Так же, по клетке за кадр,
// пролетают снаряды — поверх карты до хода.
import { ITEMS, SPELLS } from '@gene/data'
import type { MoveFrame, ProjectileTrail } from '@gene/core'
import { store } from './store'

const STEP_MS = 25

let timer: ReturnType<typeof setInterval> | null = null
let finish: (() => void) | null = null

/** Видимость кадра: запомненные клетки в радиусе обзора — яркие (приближение поля зрения). */
function visFor(tiles: string[], width: number, x: number, y: number, radius: number): string {
  const r2 = radius * radius
  let vis = ''
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === ' ') {
      vis += '0'
      continue
    }
    const dx = (i % width) - x
    const dy = Math.floor(i / width) - y
    vis += dx * dx + dy * dy <= r2 ? '2' : '1'
  }
  return vis
}

export function playFrames(frames: MoveFrame[], onDone: () => void): void {
  const view = store.view
  if (!view) return onDone()
  const { width } = view.map
  const radius = view.player.fovRadius
  const tiles = [...view.map.tiles]
  let i = 0
  finish = onDone
  const step = (): void => {
    const f = frames[i++]
    if (!f) {
      skipAnimation()
      return
    }
    for (let k = 0; k < f.cells.length; k++) tiles[f.cells[k]!] = f.tiles[k]!
    store.anim = { tiles: tiles.join(''), vis: visFor(tiles, width, f.x, f.y, radius), x: f.x, y: f.y }
  }
  step()
  timer = setInterval(step, STEP_MS)
}

/** Символ и цвет снаряда: предмет или заклинание-снаряд (без своего символа — черта). */
function projectileLook(trail: ProjectileTrail): { glyph?: string; color: string } {
  if (trail.kind === 'spell') {
    const spell = SPELLS[trail.spellId]
    if (spell.effect === 'projectile') return { ...(spell.glyph ? { glyph: spell.glyph } : {}), color: spell.color }
    return { color: '#ffffff' }
  }
  const def = ITEMS[trail.itemDefId]
  const glyph = def?.category === 'consumable' ? def.projectileGlyph : undefined
  return { ...(glyph ? { glyph } : {}), color: def?.color ?? '#ffffff' }
}

/** Черта по направлению полёта; камень, огненный шар и прочее со своим символом — им. */
function projectileGlyph(trail: ProjectileTrail, width: number): string {
  const own = projectileLook(trail).glyph
  if (own) return own
  const a = trail.cells[0]!
  const b = trail.cells[trail.cells.length - 1]!
  const dx = Math.sign((b % width) - (a % width))
  const dy = Math.sign(Math.floor(b / width) - Math.floor(a / width))
  if (dy === 0) return '-'
  if (dx === 0) return '|'
  return dx === dy ? '\\' : '/'
}

export function playProjectiles(trails: ProjectileTrail[], onDone: () => void): void {
  const view = store.view
  if (!view) return onDone()
  const { width } = view.map
  const steps = trails.flatMap((t) => {
    const glyph = projectileGlyph(t, width)
    const { color } = projectileLook(t)
    return t.cells.map((i) => ({ x: i % width, y: Math.floor(i / width), glyph, color }))
  })
  let i = 0
  finish = onDone
  const step = (): void => {
    const s = steps[i++]
    if (!s) {
      skipAnimation()
      return
    }
    store.projectile = s
  }
  step()
  timer = setInterval(step, STEP_MS)
}

/** Сразу закончить анимацию и применить итоговый вид (если анимация шла). */
export function skipAnimation(): void {
  if (timer) clearInterval(timer)
  timer = null
  store.anim = null
  store.projectile = null
  const done = finish
  finish = null
  done?.()
}
