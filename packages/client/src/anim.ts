// Анимация многоходовых действий (автоисследование, бег): проигрывает кадры с сервера,
// постепенно проявляя память карты, затем применяет итоговый вид.
import type { MoveFrame } from '@gene/core'
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

/** Сразу закончить анимацию и применить итоговый вид (если анимация шла). */
export function skipAnimation(): void {
  if (timer) clearInterval(timer)
  timer = null
  store.anim = null
  const done = finish
  finish = null
  done?.()
}
