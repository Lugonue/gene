// Главная точка входа логики: applyCommand(state, cmd) → { state, events }.
// Вход не мутируется: работаем с глубокой копией. Результат детерминирован (весь рандом — из state.rng).
import { reject, type ActionResult, type Ctx } from './context'
import type { GameEvent } from './events'
import { player, type Command, type GameState } from './state'
import { actionCost, nextActor, spendTime } from './time'
import { monsterTurn } from './ai'
import { moveAction, stairsAction } from './actions/move'
import { computeFov, rememberVisible } from './world/fov'
import { fovRadius, organicHealCap } from './combat/formulas'
import { applyRegen } from './health'
import { actorRef } from './combat/attack'

export interface CommandResult {
  state: GameState
  events: GameEvent[]
}

/** Защита от бесконечного цикла мира (если вдруг что-то не тратит время). */
const MAX_WORLD_STEPS = 10_000
/** Максимум ходов отдыха за одну команду rest. */
const MAX_REST_TURNS = 200

export function applyCommand(prev: GameState, cmd: Command): CommandResult {
  if (prev.status !== 'active') return { state: prev, events: [{ type: 'commandRejected', reason: 'gameOver' }] }
  if (!cmd || typeof cmd !== 'object' || typeof (cmd as { type?: unknown }).type !== 'string')
    return { state: prev, events: [{ type: 'commandRejected', reason: 'invalid' }] }

  const state = structuredClone(prev)
  const ctx: Ctx = { state, events: [] }

  if (cmd.type === 'rest') {
    const res = rest(ctx)
    if (!res.ok) return { state: prev, events: [{ type: 'commandRejected', reason: res.reason }] }
    return { state, events: ctx.events }
  }

  const res = performPlayerAction(ctx, cmd)
  if (!res.ok) return { state: prev, events: [{ type: 'commandRejected', reason: res.reason }] }
  playerTurn(ctx, res.cost)
  return { state, events: ctx.events }
}

/** Завершение действия игрока: время, регенерация, ходы мира, наблюдение. */
function playerTurn(ctx: Ctx, cost: number): void {
  const p = player(ctx.state)
  spendTime(p, cost)
  ctx.state.turn++
  if (ctx.state.status !== 'active') {
    observe(ctx)
    return
  }
  applyRegen(ctx, p, cost)
  runWorld(ctx)
  observe(ctx)
}

function performPlayerAction(ctx: Ctx, cmd: Command): ActionResult {
  const p = player(ctx.state)
  switch (cmd.type) {
    case 'move':
      return moveAction(ctx, cmd.dir)
    case 'wait':
      return { ok: true, cost: actionCost(p, 'wait') }
    case 'stairsDown':
      return stairsAction(ctx, 'down')
    case 'stairsUp':
      return stairsAction(ctx, 'up')
    default:
      return reject('invalid')
  }
}

/** Ходят остальные существа уровня, пока очередь не дойдёт до игрока. */
function runWorld(ctx: Ctx): void {
  const { state } = ctx
  for (let step = 0; step < MAX_WORLD_STEPS; step++) {
    if (state.status !== 'active') return
    const actor = nextActor(state, state.depth)
    if (!actor) return
    state.now = Math.max(state.now, actor.nextActAt)
    if (actor.kind === 'player') return
    const before = actor.nextActAt
    monsterTurn(ctx, actor)
    if (state.creatures[actor.id]) applyRegen(ctx, actor, actor.nextActAt - before)
  }
}

/** Обновить память карты и отметить монстров, впервые попавших в поле зрения. */
function observe(ctx: Ctx): void {
  const { state } = ctx
  const p = player(state)
  const level = state.levels[p.depth]
  if (!level) return
  const visible = computeFov(level, p.x, p.y, fovRadius(p))
  rememberVisible(level, visible)
  for (const c of Object.values(state.creatures)) {
    if (c.kind === 'player' || c.depth !== p.depth || !c.ai) continue
    const seen = visible.has(c.y * level.width + c.x)
    if (seen && !c.ai.noticed) ctx.events.push({ type: 'monsterNoticed', creature: actorRef(c) })
    c.ai.noticed = seen
  }
}

function monstersInView(ctx: Ctx): boolean {
  const { state } = ctx
  const p = player(state)
  const level = state.levels[p.depth]!
  const visible = computeFov(level, p.x, p.y, fovRadius(p))
  return Object.values(state.creatures).some(
    (c) => c.kind !== 'player' && c.depth === p.depth && visible.has(c.y * level.width + c.x),
  )
}

function needsRest(ctx: Ctx): boolean {
  const p = player(ctx.state)
  if (p.hp < p.maxHp) return true
  return p.parts.some((part) => part.material === 'organic' && part.hp < organicHealCap(part))
}

/** Отдых: ждать, пока не восстановится здоровье (органика) или не появится монстр. */
function rest(ctx: Ctx): ActionResult {
  if (monstersInView(ctx)) return reject('blocked')
  if (!needsRest(ctx)) return reject('notDamaged')
  const p = player(ctx.state)
  for (let i = 0; i < MAX_REST_TURNS; i++) {
    playerTurn(ctx, actionCost(p, 'wait'))
    if (ctx.state.status !== 'active') break
    if (monstersInView(ctx)) {
      ctx.events.push({ type: 'restInterrupted' })
      return { ok: true, cost: 0 }
    }
    if (!needsRest(ctx)) break
  }
  ctx.events.push({ type: 'restFinished' })
  return { ok: true, cost: 0 }
}
