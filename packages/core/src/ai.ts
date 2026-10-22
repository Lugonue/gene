// Простой ИИ монстров: видит игрока — идёт к нему (A*) и атакует; ранен — может отступать; иначе бродит.
// Стрелки и маги держат дистанцию и стреляют или колдуют, когда есть линия огня; маги лечат раненых союзников.
import * as ROT from 'rot-js'
import { FACTIONS, type ProjectileSpellDef, type FactionTrait } from '@gene/data'
import type { Ctx } from './context'
import {
  DIRS,
  TILE,
  cellIndex,
  creatureAt,
  creaturesOnLevel,
  distance,
  player,
  setTile,
  speciesOf,
  tileAt,
  type Creature,
  type Pos,
} from './state'
import { actionCost, spendTime } from './time'
import { HEAL_ALLY_HP_SHARE, SEARCH_RADIUS, TRACK_TIME, fovRadius, wantsToFlee } from './combat/formulas'
import { actorRef, resolveAttack } from './combat/attack'
import { planOf } from './body'
import { chance, pick } from './rng'
import { computeFov, isPassable } from './world/fov'
import { fire, readyToShoot, traceProjectile } from './combat/ranged'
import { castSpell, spellReady, spellsOf } from './combat/spells'

export function monsterTurn(ctx: Ctx, c: Creature): void {
  const { state } = ctx
  const p = player(state)
  const ai = (c.ai ??= { mode: 'idle' })
  const level = state.levels[c.depth]!

  const trait = factionTrait(c)
  const sees = c.depth === p.depth && canSee(ctx, c, p)
  if (sees) {
    ai.lastSeen = { x: p.x, y: p.y }
    if (trait === 'relentless') {
      ai.searchFrom = ai.lastSeen
      ai.trackUntil = state.now + TRACK_TIME
    }
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

  // Отступает не прочь от игрока, а к вожаку или союзнику; рядом с ним держится.
  if (ai.mode === 'flee' && trait === 'rallying') {
    const ally = rallyPoint(ctx, c)
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

  // Вплотную к игроку маг сперва отходит, а не лечит.
  if (!adjacent && healAlly(ctx, c)) return

  if (sees) {
    const ready = readyToShoot(state, c)
    if (typeof ready !== 'string') return rangedTurn(ctx, c, p, ready.range, () => fire(ctx, c, p, ready))
    const projectile = spellsOf(c).find((s): s is ProjectileSpellDef => s.effect === 'projectile')
    if (projectile) {
      const cast = spellReady(state, c, projectile) ? () => castSpell(ctx, c, projectile, p) : undefined
      if (speciesOf(c)?.role === 'mage') return rangedTurn(ctx, c, p, projectile.range, cast)
      // Остальные заклинатели (вожаки) колдуют между ударами, если цель не вплотную.
      if (cast && !adjacent && hasLineOfFire(ctx, c, c, p, projectile.range)) {
        cast()
        return spendAttack(c)
      }
    }
  }

  if (adjacent) return attack(ctx, c, p)

  const goal = sees ? p : ai.lastSeen
  if (goal) {
    const step = pathStep(ctx, c, goal)
    if (step) return moveTo(ctx, c, step)
  }
  // Дошёл до места, где видел игрока (или пути туда нет): Орден ещё осматривается вокруг, остальные бросают поиск.
  if (!sees && ai.lastSeen) {
    ai.lastSeen = searchSpot(ctx, c)
    const step = ai.lastSeen && pathStep(ctx, c, ai.lastSeen)
    if (step) return moveTo(ctx, c, step)
  }

  // Бродит или стоит.
  if (chance(state.rng, 0.5)) {
    const options = Object.values(DIRS)
      .map((d) => ({ x: c.x + d.x, y: c.y + d.y }))
      .filter((q) => canEnter(ctx, c, q) && tileAt(level, q.x, q.y) !== TILE.doorClosed)
    if (options.length > 0) return moveTo(ctx, c, pick(state.rng, options))
  }
  rest(c)
}

/** Следующая клетка для осмотра вокруг места, где игрока видели в последний раз, — пока не вышло время поиска. */
function searchSpot(ctx: Ctx, c: Creature): Pos | undefined {
  const ai = c.ai!
  const from = ai.searchFrom
  if (!from || ai.trackUntil === undefined || ctx.state.now >= ai.trackUntil) {
    ai.searchFrom = ai.trackUntil = undefined
    return undefined
  }
  const level = ctx.state.levels[c.depth]!
  const spots: Pos[] = []
  for (let y = from.y - SEARCH_RADIUS; y <= from.y + SEARCH_RADIUS; y++)
    for (let x = from.x - SEARCH_RADIUS; x <= from.x + SEARCH_RADIUS; x++)
      if ((x !== c.x || y !== c.y) && isPassable(tileAt(level, x, y))) spots.push({ x, y })
  return spots.length > 0 ? pick(ctx.state.rng, spots) : undefined
}

function canSee(ctx: Ctx, c: Creature, target: Creature): boolean {
  const r = fovRadius(c)
  if (distance(c, target) > r) return false
  const level = ctx.state.levels[c.depth]!
  return computeFov(level, c.x, c.y, r).has(cellIndex(level, target))
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
 * Ход стрелка или мага, видящего цель: рядом — отходит (зажатый в угол бьёт в ближнем бою); есть линия огня —
 * стреляет или колдует (shoot), а без готового заклинания ждёт на месте; иначе переходит на соседнюю клетку
 * с линией огня или подходит, не вставая вплотную.
 */
function rangedTurn(ctx: Ctx, c: Creature, target: Creature, range: number, shoot?: () => void): void {
  if (distance(c, target) <= 1) {
    const step = fleeStep(ctx, c, target)
    return step ? moveTo(ctx, c, step) : attack(ctx, c, target)
  }
  if (hasLineOfFire(ctx, c, c, target, range)) {
    if (!shoot) return rest(c)
    shoot()
    return spendAttack(c)
  }
  const spot = Object.values(DIRS)
    .map((d) => ({ x: c.x + d.x, y: c.y + d.y }))
    .find((q) => canEnter(ctx, c, q) && distance(q, target) > 1 && hasLineOfFire(ctx, c, q, target, range))
  if (spot) return moveTo(ctx, c, spot)
  const step = pathStep(ctx, c, target)
  if (step && distance(step, target) > 1) return moveTo(ctx, c, step)
  rest(c)
}

/** Из клетки from снаряд стрелка c долетает до цели, ни в кого не попав по дороге. */
function hasLineOfFire(ctx: Ctx, c: Creature, from: Pos, target: Creature, range: number): boolean {
  if (distance(from, target) > range) return false
  return traceProjectile(ctx.state, c, from, target, range).struck?.id === target.id
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
  spendAttack(c)
}

/** Ход ушёл на удар, выстрел или заклинание. */
function spendAttack(c: Creature): void {
  spendTime(c, actionCost(c, 'attack'))
}

function rest(c: Creature): void {
  spendTime(c, actionCost(c, 'wait'))
}

function factionTrait(c: Creature): FactionTrait | undefined {
  const def = speciesOf(c)
  return def ? FACTIONS[def.faction].trait : undefined
}

/** Маг с готовым лечением лечит самого раненого союзника в поле зрения и в пределах дальности. */
function healAlly(ctx: Ctx, c: Creature): boolean {
  const heal = spellsOf(c).find((s) => s.effect === 'heal' && spellReady(ctx.state, c, s))
  if (!heal) return false
  const share = (o: Creature): number => o.hp / o.maxHp
  let best: Creature | undefined
  for (const o of allies(ctx, c)) {
    if (share(o) >= HEAL_ALLY_HP_SHARE || distance(c, o) > heal.range || !canSee(ctx, c, o)) continue
    if (!best || share(o) < share(best)) best = o
  }
  if (!best) return false
  castSpell(ctx, c, heal, best)
  spendAttack(c)
  return true
}

/** Монстры той же фракции на уровне существа. */
function allies(ctx: Ctx, c: Creature): Creature[] {
  const faction = speciesOf(c)?.faction
  if (!faction) return []
  return creaturesOnLevel(ctx.state, c.depth).filter((o) => o.id !== c.id && speciesOf(o)?.faction === faction)
}

/** Куда отступает раненый с чертой rallying: к вожаку, если он жив на уровне, иначе к ближайшему не убегающему союзнику. */
function rallyPoint(ctx: Ctx, c: Creature): Creature | undefined {
  const others = allies(ctx, c)
  const leader = others.find((o) => speciesOf(o)?.role === 'leader')
  if (leader) return leader
  let best: Creature | undefined
  for (const o of others) {
    if (o.ai?.mode === 'flee') continue
    if (!best || distance(c, o) < distance(c, best)) best = o
  }
  return best
}
