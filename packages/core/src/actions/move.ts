import { reject, type ActionResult, type Ctx } from '../context'
import { DIRS, TILE, creatureAt, itemsAt, player, setTile, tileAt, type Dir } from '../state'
import { actionCost } from '../time'
import { arrivalPoint, ensureLevel } from '../world/level'
import { syncLevelTime } from '../time'
import { isPassable } from '../world/fov'
import { playerAttack } from './attack'

export function moveAction(ctx: Ctx, dir: Dir): ActionResult {
  const { state } = ctx
  const p = player(state)
  if (typeof dir !== 'string' || !Object.hasOwn(DIRS, dir)) return reject('invalid')
  const d = DIRS[dir]
  const level = state.levels[p.depth]!
  const nx = p.x + d.x
  const ny = p.y + d.y

  const target = creatureAt(state, p.depth, nx, ny)
  if (target && target.id !== p.id) return playerAttack(ctx, target)

  const t = tileAt(level, nx, ny)
  if (t === TILE.doorClosed) {
    setTile(level, nx, ny, TILE.doorOpen)
    ctx.events.push({ type: 'doorOpened' })
    return { ok: true, cost: actionCost(p, 'move') }
  }
  if (!isPassable(t)) return reject('blocked')

  p.x = nx
  p.y = ny
  const here = itemsAt(state, p.depth, nx, ny)
  if (here.length > 0) ctx.events.push({ type: 'itemsHere', itemDefIds: here.map((i) => i.defId) })
  return { ok: true, cost: actionCost(p, 'move') }
}

export function stairsAction(ctx: Ctx, dir: 'down' | 'up'): ActionResult {
  const { state } = ctx
  const p = player(state)
  const level = state.levels[p.depth]!
  const t = tileAt(level, p.x, p.y)

  if (dir === 'down' && t === TILE.portal) {
    state.status = 'won'
    ctx.events.push({ type: 'gameWon' })
    return { ok: true, cost: actionCost(p, 'stairs') }
  }
  if (dir === 'down' && t !== TILE.stairsDown) return reject('noStairs')
  if (dir === 'up' && t !== TILE.stairsUp) return reject('noStairs')

  const depth = p.depth + (dir === 'down' ? 1 : -1)
  ensureLevel(state, depth)
  const at = arrivalPoint(state, depth, dir)
  // Если на точке прибытия стоит монстр — он уступает место (сдвигается на свободную соседнюю клетку).
  const blocker = creatureAt(state, depth, at.x, at.y)
  if (blocker) displace(ctx, blocker.id, depth, at.x, at.y)
  p.depth = depth
  p.x = at.x
  p.y = at.y
  state.depth = depth
  state.maxDepthReached = Math.max(state.maxDepthReached, depth)
  syncLevelTime(state, depth)
  ctx.events.push({ type: 'levelChanged', depth, dir })
  return { ok: true, cost: actionCost(p, 'stairs') }
}

function displace(ctx: Ctx, id: string, depth: number, x: number, y: number): void {
  const level = ctx.state.levels[depth]!
  const c = ctx.state.creatures[id]!
  for (const d of Object.values(DIRS)) {
    const nx = x + d.x
    const ny = y + d.y
    if (isPassable(tileAt(level, nx, ny)) && !creatureAt(ctx.state, depth, nx, ny)) {
      c.x = nx
      c.y = ny
      return
    }
  }
}
