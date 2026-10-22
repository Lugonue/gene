// Прицеливание (f): цели, курсор и предпросмотр линии огня.
// Линия — та же прямая, что у снаряда в core (combat/ranged.ts, projectilePath): клиент не импортирует логику core.
import { ITEMS, REJECT_TEXT, type WeaponDef } from '@gene/data'
import type { PlayerView } from '@gene/core'
import { pushWarning, store } from './store'
import { sendCommand } from './net'
import { cellIndex } from './grid'

type Pos = { x: number; y: number }

const distance = (a: Pos, b: Pos): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/** Оружие дальнего боя в руке игрока. */
export function heldRangedWeapon(view: PlayerView): WeaponDef | undefined {
  const defId = view.equipment.find((s) => s.slot === 'weapon')?.item?.defId
  const def = defId ? ITEMS[defId] : undefined
  return def?.category === 'weapon' && def.ranged ? def : undefined
}

/** Видимые враги от ближнего к дальнему. */
function targets(view: PlayerView): Pos[] {
  return [...view.monsters].sort((a, b) => distance(view.player, a) - distance(view.player, b) || a.id.localeCompare(b.id))
}

/** Клетки полёта до первого видимого существа или стены (неизвестные клетки считаются свободными). */
export function aimPath(view: PlayerView, to: Pos, range: number): Pos[] {
  const from = view.player
  const dx = to.x - from.x
  const dy = to.y - from.y
  const n = Math.max(Math.abs(dx), Math.abs(dy))
  const path: Pos[] = []
  if (n === 0) return path
  const { width, height, tiles } = view.map
  for (let i = 1; i <= range; i++) {
    const x = from.x + Math.round((i * dx) / n)
    const y = from.y + Math.round((i * dy) / n)
    if (x < 0 || y < 0 || x >= width || y >= height) break
    const t = tiles[cellIndex(width, x, y)]
    if (t === '#' || t === '+') break
    path.push({ x, y })
    if (view.monsters.some((m) => m.x === x && m.y === y)) break
  }
  return path
}

/** Начать прицеливание: курсор на ближайшем враге (или на себе, если врагов не видно). */
export function startAim(): void {
  const view = store.view
  if (!view) return
  if (!heldRangedWeapon(view)) return pushWarning(REJECT_TEXT.noRangedWeapon)
  const first = targets(view)[0] ?? view.player
  store.aim = { x: first.x, y: first.y }
  store.inspect = { ...store.aim }
}

export function moveAim(d: Pos): void {
  const view = store.view
  if (!view || !store.aim) return
  store.aim = {
    x: Math.min(view.map.width - 1, Math.max(0, store.aim.x + d.x)),
    y: Math.min(view.map.height - 1, Math.max(0, store.aim.y + d.y)),
  }
  store.inspect = { ...store.aim }
}

/** Следующая (или предыдущая) цель по удалённости. */
export function cycleAim(back: boolean): void {
  const view = store.view
  if (!view || !store.aim) return
  const list = targets(view)
  if (list.length === 0) return
  const cur = list.findIndex((t) => t.x === store.aim!.x && t.y === store.aim!.y)
  const next = cur < 0 ? 0 : (cur + (back ? list.length - 1 : 1)) % list.length
  store.aim = { x: list[next]!.x, y: list[next]!.y }
  store.inspect = { ...store.aim }
}

export function cancelAim(): void {
  store.aim = null
  store.inspect = null
}

export function confirmAim(): void {
  const aim = store.aim
  cancelAim()
  if (aim) sendCommand({ type: 'fire', x: aim.x, y: aim.y })
}
