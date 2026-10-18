// Простой ИИ монстров: видит игрока — идёт к нему (A*) и атакует; ранен — может отступать; иначе бродит.
import * as ROT from 'rot-js'
import type { Ctx } from './context'
import { DIRS, TILE, creatureAt, player, setTile, tileAt, type Creature, type Pos } from './state'
import { actionCost, spendTime } from './time'
import { fovRadius, wantsToFlee } from './combat/formulas'
import { actorRef, resolveAttack } from './combat/attack'
import { planOf } from './body'
import { chance, pick } from './rng'
import { computeFov } from './world/fov'

export function monsterTurn(ctx: Ctx, c: Creature): void {
  const { state } = ctx
  const p = player(state)
  const ai = (c.ai ??= { mode: 'idle' })
  const level = state.levels[c.depth]!

  const sees = c.depth === p.depth && canSee(ctx, c, p)
  if (sees) ai.lastSeen = { x: p.x, y: p.y }

  // Отступление раненых.
  if (sees) {
    const flee = wantsToFlee(state.rng, c)
    if (flee && ai.mode !== 'flee') {
      ai.mode = 'flee'
      ctx.events.push({ type: 'monsterFlees', creature: actorRef(c) })
    } else if (!flee && ai.mode === 'flee' && c.hp >= c.maxHp * 0.5) ai.mode = 'hunt'
    else if (ai.mode === 'idle') ai.mode = 'hunt'
  }

  const adjacent = sees && Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) === 1

  if (ai.mode === 'flee' && sees) {
    const step = fleeStep(ctx, c, p)
    if (step) return moveTo(ctx, c, step)
    if (adjacent) return attack(ctx, c, p) // загнан в угол
    return rest(c)
  }

  if (adjacent) return attack(ctx, c, p)

  const goal = sees ? p : ai.lastSeen
  if (goal) {
    const step = pathStep(ctx, c, goal)
    if (step) return moveTo(ctx, c, step)
    if (!sees) ai.lastSeen = undefined
  }
  if (!sees && ai.lastSeen && ai.lastSeen.x === c.x && ai.lastSeen.y === c.y) ai.lastSeen = undefined

  // Бродит или стоит.
  if (chance(state.rng, 0.5)) {
    const options = Object.values(DIRS)
      .map((d) => ({ x: c.x + d.x, y: c.y + d.y }))
      .filter((q) => canEnter(ctx, c, q) && tileAt(level, q.x, q.y) !== TILE.doorClosed)
    if (options.length > 0) return moveTo(ctx, c, pick(state.rng, options))
  }
  rest(c)
}

function canSee(ctx: Ctx, c: Creature, target: Creature): boolean {
  const r = fovRadius(c)
  if (Math.max(Math.abs(c.x - target.x), Math.abs(c.y - target.y)) > r) return false
  const level = ctx.state.levels[c.depth]!
  return computeFov(level, c.x, c.y, r).has(target.y * level.width + target.x)
}

/** Существа с руками открывают двери, звери — нет. */
function opensDoors(c: Creature): boolean {
  return !!planOf(c).mainHand
}

function canEnter(ctx: Ctx, c: Creature, q: Pos): boolean {
  const level = ctx.state.levels[c.depth]!
  const t = tileAt(level, q.x, q.y)
  if (t === TILE.wall) return false
  if (t === TILE.doorClosed && !opensDoors(c)) return false
  const other = creatureAt(ctx.state, c.depth, q.x, q.y)
  return !other
}

function pathStep(ctx: Ctx, c: Creature, goal: Pos): Pos | undefined {
  const level = ctx.state.levels[c.depth]!
  const astar = new ROT.Path.AStar(
    goal.x,
    goal.y,
    (x, y) => {
      if (x === c.x && y === c.y) return true
      if (x === goal.x && y === goal.y) return true
      const t = tileAt(level, x, y)
      if (t === TILE.wall) return false
      if (t === TILE.doorClosed && !opensDoors(c)) return false
      return true
    },
    { topology: 8 },
  )
  const path: Pos[] = []
  astar.compute(c.x, c.y, (x, y) => path.push({ x, y }))
  const next = path[1]
  if (!next) return undefined
  // Клетку занимает другой монстр — пробуем обойти соседней клеткой, приближающей к цели.
  if (canEnter(ctx, c, next)) return next
  const dist = (q: Pos): number => Math.max(Math.abs(q.x - goal.x), Math.abs(q.y - goal.y))
  const alternatives = Object.values(DIRS)
    .map((d) => ({ x: c.x + d.x, y: c.y + d.y }))
    .filter((q) => canEnter(ctx, c, q) && dist(q) < dist(c))
  return alternatives[0]
}

function fleeStep(ctx: Ctx, c: Creature, from: Pos): Pos | undefined {
  const dist = (q: Pos): number => Math.max(Math.abs(q.x - from.x), Math.abs(q.y - from.y))
  let best: Pos | undefined
  for (const d of Object.values(DIRS)) {
    const q = { x: c.x + d.x, y: c.y + d.y }
    if (!canEnter(ctx, c, q)) continue
    if (dist(q) > dist(best ?? c)) best = q
  }
  return best
}

function moveTo(ctx: Ctx, c: Creature, q: Pos): void {
  const level = ctx.state.levels[c.depth]!
  if (tileAt(level, q.x, q.y) === TILE.doorClosed) {
    setTile(level, q.x, q.y, TILE.doorOpen)
  } else {
    c.x = q.x
    c.y = q.y
  }
  spendTime(c, actionCost(c, 'move'))
}

function attack(ctx: Ctx, c: Creature, target: Creature): void {
  resolveAttack(ctx, c, target)
  spendTime(c, actionCost(c, 'attack'))
}

function rest(c: Creature): void {
  spendTime(c, actionCost(c, 'wait'))
}
