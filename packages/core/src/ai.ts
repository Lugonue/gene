// Простой ИИ монстров: видит игрока — идёт к нему (A*) и атакует; ранен — может отступать; иначе бродит.
// Стрелки держат дистанцию и стреляют, когда есть линия огня.
import * as ROT from 'rot-js'
import { FACTIONS, MONSTERS, type FactionTrait } from '@gene/data'
import type { Ctx } from './context'
import { DIRS, TILE, creatureAt, player, setTile, tileAt, type Creature, type Pos } from './state'
import { actionCost, spendTime } from './time'
import { TRACK_TIME, fovRadius, wantsToFlee } from './combat/formulas'
import { actorRef, resolveAttack } from './combat/attack'
import { planOf } from './body'
import { chance, pick } from './rng'
import { computeFov } from './world/fov'
import { distance, fire, firstCreatureOnPath, projectilePath, readyToShoot, type ShotReady } from './combat/ranged'

export function monsterTurn(ctx: Ctx, c: Creature): void {
  const { state } = ctx
  const p = player(state)
  const ai = (c.ai ??= { mode: 'idle' })
  const level = state.levels[c.depth]!

  const trait = factionTrait(c)
  const sees = c.depth === p.depth && canSee(ctx, c, p)
  if (sees) {
    ai.lastSeen = { x: p.x, y: p.y }
    if (trait === 'relentless') ai.trackUntil = state.now + TRACK_TIME
  } else if (ai.trackUntil !== undefined && c.depth === p.depth && state.now < ai.trackUntil) {
    // Идёт по следу: знает, где игрок, хотя и не видит его.
    ai.lastSeen = { x: p.x, y: p.y }
  }

  // Отступление раненых.
  if (sees) {
    const flee = wantsToFlee(state.rng, c, trait)
    if (flee && ai.mode !== 'flee') {
      ai.mode = 'flee'
      ctx.events.push({ type: 'monsterFlees', creature: actorRef(c) })
    } else if (!flee && ai.mode === 'flee' && c.hp >= c.maxHp * 0.5) ai.mode = 'hunt'
    else if (ai.mode === 'idle') ai.mode = 'hunt'
  }

  const adjacent = sees && distance(c, p) === 1

  // Отступает не прочь от игрока, а к ближайшему союзнику; рядом с ним держится.
  if (ai.mode === 'flee' && trait === 'rallying') {
    const ally = nearestAlly(ctx, c)
    if (ally && distance(c, ally) <= 1) return adjacent ? attack(ctx, c, p) : rest(c)
    const step = ally && pathStep(ctx, c, ally)
    if (step) return moveTo(ctx, c, step)
    // Пути к союзнику нет — отступает как обычно.
  }

  if (ai.mode === 'flee' && sees) {
    const step = fleeStep(ctx, c, p)
    if (step) return moveTo(ctx, c, step)
    if (adjacent) return attack(ctx, c, p) // загнан в угол
    return rest(c)
  }

  if (sees) {
    const ready = readyToShoot(state, c)
    if (typeof ready !== 'string') return shooterTurn(ctx, c, p, ready)
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
  if (distance(c, target) > r) return false
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
  const dist = (q: Pos): number => distance(q, goal)
  const alternatives = Object.values(DIRS)
    .map((d) => ({ x: c.x + d.x, y: c.y + d.y }))
    .filter((q) => canEnter(ctx, c, q) && dist(q) < dist(c))
  return alternatives[0]
}

function fleeStep(ctx: Ctx, c: Creature, from: Pos): Pos | undefined {
  const dist = (q: Pos): number => distance(q, from)
  let best: Pos | undefined
  for (const d of Object.values(DIRS)) {
    const q = { x: c.x + d.x, y: c.y + d.y }
    if (!canEnter(ctx, c, q)) continue
    if (dist(q) > dist(best ?? c)) best = q
  }
  return best
}

/**
 * Ход стрелка, видящего цель: рядом — отходит (зажатый в угол бьёт в ближнем бою); есть линия огня — стреляет;
 * иначе переходит на соседнюю клетку с линией огня или подходит, не вставая вплотную.
 */
function shooterTurn(ctx: Ctx, c: Creature, target: Creature, ready: ShotReady): void {
  if (distance(c, target) <= 1) {
    const step = fleeStep(ctx, c, target)
    return step ? moveTo(ctx, c, step) : attack(ctx, c, target)
  }
  if (hasLineOfFire(ctx, c, c, target, ready.range)) {
    fire(ctx, c, target, ready)
    return spendTime(c, actionCost(c, 'attack'))
  }
  const spot = Object.values(DIRS)
    .map((d) => ({ x: c.x + d.x, y: c.y + d.y }))
    .find((q) => canEnter(ctx, c, q) && distance(q, target) > 1 && hasLineOfFire(ctx, c, q, target, ready.range))
  if (spot) return moveTo(ctx, c, spot)
  const step = pathStep(ctx, c, target)
  if (step && distance(step, target) > 1) return moveTo(ctx, c, step)
  rest(c)
}

/** Из клетки from снаряд стрелка c долетает до цели, ни в кого не попав по дороге. */
function hasLineOfFire(ctx: Ctx, c: Creature, from: Pos, target: Creature, range: number): boolean {
  if (distance(from, target) > range) return false
  const path = projectilePath(ctx.state.levels[c.depth]!, from, target, range)
  return firstCreatureOnPath(ctx.state, c.depth, path, c.id)?.creature.id === target.id
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

function factionTrait(c: Creature): FactionTrait | undefined {
  const def = MONSTERS[c.kind]
  return def ? FACTIONS[def.faction].trait : undefined
}

/** Ближайший монстр той же фракции на уровне. */
function nearestAlly(ctx: Ctx, c: Creature): Creature | undefined {
  const faction = MONSTERS[c.kind]?.faction
  let best: Creature | undefined
  for (const o of Object.values(ctx.state.creatures)) {
    if (o.id === c.id || o.depth !== c.depth || MONSTERS[o.kind]?.faction !== faction) continue
    if (!best || distance(c, o) < distance(c, best)) best = o
  }
  return best
}
