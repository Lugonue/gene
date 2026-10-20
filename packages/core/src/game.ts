// Главная точка входа логики: applyCommand(state, cmd) → { state, events }.
// Вход не мутируется: работаем с глубокой копией. Результат детерминирован (весь рандом — из state.rng).
import { reject, type ActionResult, type Ctx } from './context'
import type { GameEvent } from './events'
import { DIRS, creatureAt, player, tileAt, type Command, type Dir, type GameState } from './state'
import { actionCost, nextActor, spendTime } from './time'
import { monsterTurn } from './ai'
import { moveAction, stairsAction } from './actions/move'
import { fireAction } from './actions/fire'
import { computeFov, isPassable, rememberVisible } from './world/fov'
import { exploreStep } from './world/explore'
import { noticeObjects } from './world/notice'
import type { MoveFrame, ProjectileTrail } from './protocol'
import { fovRadius, organicHealCap } from './combat/formulas'
import { applyRegen } from './health'
import { actorRef } from './combat/attack'
import {
  disassembleAction,
  dropAction,
  equipAction,
  pickupAction,
  studyWornItems,
  unequipAction,
  useAction,
} from './actions/items'

export interface CommandResult {
  state: GameState
  events: GameEvent[]
  /** Кадры перемещения для анимации (автоисследование, бег). */
  frames?: MoveFrame[]
  /** Полёты снарядов, видимые игроку. */
  projectiles?: ProjectileTrail[]
}

/** Защита от бесконечного цикла мира (если вдруг что-то не тратит время). */
const MAX_WORLD_STEPS = 10_000
/** Максимум ходов отдыха за одну команду rest. */
const MAX_REST_TURNS = 200
/** Максимум шагов автоисследования и бега за одну команду. */
const MAX_AUTO_STEPS = 500

export function applyCommand(prev: GameState, cmd: Command): CommandResult {
  if (prev.status !== 'active') return { state: prev, events: [{ type: 'commandRejected', reason: 'gameOver' }] }
  if (!cmd || typeof cmd !== 'object' || typeof (cmd as { type?: unknown }).type !== 'string')
    return { state: prev, events: [{ type: 'commandRejected', reason: 'invalid' }] }

  const state = structuredClone(prev)
  const ctx: Ctx = { state, events: [] }

  const multi = MULTI_TURN[cmd.type]
  if (multi) {
    const res = multi(ctx, cmd)
    if (!res.ok) return { state: prev, events: [{ type: 'commandRejected', reason: res.reason }] }
    return { state, events: ctx.events, ...animation(ctx) }
  }

  const res = performPlayerAction(ctx, cmd)
  if (!res.ok) return { state: prev, events: [{ type: 'commandRejected', reason: res.reason }] }
  playerTurn(ctx, res.cost)
  return { state, events: ctx.events, ...animation(ctx) }
}

function animation(ctx: Ctx): Pick<CommandResult, 'frames' | 'projectiles'> {
  return {
    ...(ctx.frames && ctx.frames.length > 0 ? { frames: ctx.frames } : {}),
    ...(ctx.projectiles && ctx.projectiles.length > 0 ? { projectiles: ctx.projectiles } : {}),
  }
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
  studyWornItems(ctx)
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
    case 'pickup':
      return pickupAction(ctx)
    case 'drop':
      return dropAction(ctx, cmd.itemId)
    case 'equip':
      return equipAction(ctx, cmd.itemId, cmd.slot)
    case 'unequip':
      return unequipAction(ctx, cmd.slot)
    case 'use':
      return useAction(ctx, cmd.itemId, cmd.targetPartId, cmd.targetItemId)
    case 'disassemble':
      return disassembleAction(ctx, cmd.itemId)
    case 'fire':
      return fireAction(ctx, cmd.x, cmd.y)
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

/** Обновить память карты и отметить монстров и объекты, впервые попавшие в поле зрения. */
function observe(ctx: Ctx): void {
  const { state } = ctx
  const p = player(state)
  const level = state.levels[p.depth]
  if (!level) return
  const visible = computeFov(level, p.x, p.y, fovRadius(p))
  const noticed = noticeObjects(state, visible)
  rememberVisible(level, visible)
  for (const c of Object.values(state.creatures)) {
    if (c.kind === 'player' || c.depth !== p.depth || !c.ai) continue
    const seen = visible.has(c.y * level.width + c.x)
    if (seen && !c.ai.noticed) ctx.events.push({ type: 'monsterNoticed', creature: actorRef(c) })
    c.ai.noticed = seen
  }
  for (const feature of noticed.features) ctx.events.push({ type: 'featureNoticed', feature })
  if (noticed.itemDefIds.length > 0) ctx.events.push({ type: 'itemsNoticed', itemDefIds: noticed.itemDefIds })
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

// ---------------------------------------------------------------------------
// Многоходовые действия: отдых, автоисследование, бег. Общие условия остановки.
// ---------------------------------------------------------------------------

type MultiTurnAction = (ctx: Ctx, cmd: Command) => ActionResult

const MULTI_TURN: Partial<Record<Command['type'], MultiTurnAction>> = {
  rest: (ctx) => rest(ctx),
  explore: (ctx) => explore(ctx),
  run: (ctx, cmd) => runStraight(ctx, (cmd as Extract<Command, { type: 'run' }>).dir),
}

/** Чем закончился цикл: none — не сделано ни шага; finished — делать больше нечего; stopped — условие остановки. */
type AutoEnd = 'none' | 'finished' | 'stopped' | 'limit'

/** Условие остановки многоходового действия. */
function isStopEvent(e: GameEvent, playerId: string): boolean {
  switch (e.type) {
    case 'monsterNoticed':
    case 'itemsNoticed':
    case 'featureNoticed':
    case 'doorOpened':
    case 'levelChanged':
      return true
    case 'attackHit':
    case 'attackMissed':
      return e.target.id === playerId
    case 'woundChanged':
      return e.creature.id === playerId
    default:
      return false
  }
}

/**
 * Повторять шаг, пока он возможен и не сработало условие остановки. step возвращает undefined,
 * когда делать больше нечего; отказ на первом шаге отклоняет всю команду.
 * Сообщения «здесь лежит» на промежуточных шагах убираются.
 */
function autoLoop(
  ctx: Ctx,
  maxSteps: number,
  step: () => ActionResult | undefined,
  trackFrames = false,
): AutoEnd | ActionResult {
  const { state } = ctx
  const p = player(state)
  for (let i = 0; i < maxSteps; i++) {
    const from = ctx.events.length
    const memBefore = trackFrames ? state.levels[p.depth]!.memory : ''
    const res = step()
    if (!res) return i === 0 ? 'none' : 'finished'
    if (!res.ok) return i === 0 ? res : 'finished'
    playerTurn(ctx, res.cost)
    if (trackFrames) pushFrame(ctx, memBefore)
    const stepEvents = ctx.events.slice(from)
    if (state.status !== 'active' || stepEvents.some((e) => isStopEvent(e, p.id)) || monstersInView(ctx))
      return 'stopped'
    if (i < maxSteps - 1)
      ctx.events.splice(from, stepEvents.length, ...stepEvents.filter((e) => e.type !== 'itemsHere'))
  }
  return 'limit'
}

function pushFrame(ctx: Ctx, memBefore: string): void {
  const p = player(ctx.state)
  const mem = ctx.state.levels[p.depth]!.memory
  const cells: number[] = []
  let tiles = ''
  for (let i = 0; i < mem.length; i++) {
    if (mem[i] === memBefore[i]) continue
    cells.push(i)
    tiles += mem[i]
  }
  ;(ctx.frames ??= []).push({ x: p.x, y: p.y, cells, tiles })
}

/** Отдых: ждать, пока не восстановится здоровье (органика) или не сработает условие остановки. */
function rest(ctx: Ctx): ActionResult {
  if (monstersInView(ctx)) return reject('blocked')
  if (!needsRest(ctx)) return reject('notDamaged')
  const p = player(ctx.state)
  const end = autoLoop(ctx, MAX_REST_TURNS, () =>
    needsRest(ctx) ? { ok: true, cost: actionCost(p, 'wait') } : undefined,
  )
  if (typeof end !== 'string') return end
  const interrupted = end === 'stopped' && ctx.state.status === 'active'
  ctx.events.push({ type: interrupted ? 'restInterrupted' : 'restFinished' })
  return { ok: true, cost: 0 }
}

/** Автоисследование: идти к ближайшей неизвестной клетке по памяти карты. */
function explore(ctx: Ctx): ActionResult {
  if (monstersInView(ctx)) return reject('blocked')
  const p = player(ctx.state)
  const end = autoLoop(
    ctx,
    MAX_AUTO_STEPS,
    () => {
      const dir = exploreStep(ctx.state.levels[p.depth]!, p)
      return dir ? moveAction(ctx, dir) : undefined
    },
    true,
  )
  if (typeof end !== 'string') return end
  if (end === 'none') return reject('nothingToExplore')
  if (end === 'finished') ctx.events.push({ type: 'exploreFinished' })
  if (end === 'limit') ctx.events.push({ type: 'autoLimitReached' })
  return { ok: true, cost: 0 }
}

/** Бег: идти по прямой, пока впереди свободная проходимая клетка и не сработало условие остановки. */
function runStraight(ctx: Ctx, dir: Dir): ActionResult {
  if (typeof dir !== 'string' || !Object.hasOwn(DIRS, dir)) return reject('invalid')
  if (monstersInView(ctx)) return reject('blocked')
  const { state } = ctx
  const p = player(state)
  const d = DIRS[dir]
  const end = autoLoop(
    ctx,
    MAX_AUTO_STEPS,
    () => {
      const nx = p.x + d.x
      const ny = p.y + d.y
      if (!isPassable(tileAt(state.levels[p.depth]!, nx, ny)) || creatureAt(state, p.depth, nx, ny)) return undefined
      return moveAction(ctx, dir)
    },
    true,
  )
  if (typeof end !== 'string') return end
  if (end === 'none') return reject('blocked')
  if (end === 'limit') ctx.events.push({ type: 'autoLimitReached' })
  return { ok: true, cost: 0 }
}
