// Главная точка входа логики: applyCommand(state, cmd) → { state, events }.
// Вход не мутируется: работаем с глубокой копией. Результат детерминирован (весь рандом — из state.rng).
import { reject, type ActionResult, type Ctx } from './context'
import type { GameEvent } from './events'
import { player, type Command, type GameState } from './state'
import { actionCost, nextActor, spendTime } from './time'
import { monsterTurn } from './ai'
import { moveAction, stairsAction } from './actions/move'
import { computeFov, rememberVisible } from './world/fov'
import { fovRadius } from './combat/formulas'

export interface CommandResult {
  state: GameState
  events: GameEvent[]
}

/** Защита от бесконечного цикла мира (если вдруг что-то не тратит время). */
const MAX_WORLD_STEPS = 10_000

export function applyCommand(prev: GameState, cmd: Command): CommandResult {
  if (prev.status !== 'active') return { state: prev, events: [{ type: 'commandRejected', reason: 'gameOver' }] }
  if (!cmd || typeof cmd !== 'object' || typeof (cmd as { type?: unknown }).type !== 'string')
    return { state: prev, events: [{ type: 'commandRejected', reason: 'invalid' }] }

  const state = structuredClone(prev)
  const ctx: Ctx = { state, events: [] }

  const res = performPlayerAction(ctx, cmd)
  if (!res.ok) return { state: prev, events: [{ type: 'commandRejected', reason: res.reason }] }

  endPlayerAction(ctx, res.cost)
  runWorld(ctx)
  observe(ctx)
  return { state, events: ctx.events }
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

/** Время за действие игрока. */
function endPlayerAction(ctx: Ctx, cost: number): void {
  const p = player(ctx.state)
  spendTime(p, cost)
  ctx.state.turn++
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
    monsterTurn(ctx, actor)
  }
}

/** Обновить память карты по текущему полю зрения игрока. */
function observe(ctx: Ctx): void {
  const p = player(ctx.state)
  const level = ctx.state.levels[p.depth]
  if (!level) return
  rememberVisible(level, computeFov(level, p.x, p.y, fovRadius(p)))
}
