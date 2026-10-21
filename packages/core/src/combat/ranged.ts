// Дальний бой: готовность к выстрелу, полёт снаряда по прямой, попадание и судьба снаряда.
// Полёт переиспользуется заклинаниями-снарядами.
import { ITEMS, type WeaponDef } from '@gene/data'
import type { Ctx } from '../context'
import type { RejectReason } from '../events'
import type { ProjectileTrail } from '../protocol'
import { creatureAt, player, tileAt, type Creature, type GameState, type ItemInstance, type LevelState, type Pos } from '../state'
import { equippedWeapon, isEquipped } from '../body'
import { destroyItem, dropAt, removeFromOwner } from '../items'
import { blocksSight } from '../world/fov'
import { playerVisibleCells } from '../view'
import { durabilityEfficiency, projectileBreaks } from './formulas'
import { actorRef, rangedAttack, resolveAttack } from './attack'

export interface ShotReady {
  inst: ItemInstance
  def: WeaponDef
  range: number
  /** Стопка боеприпасов (у метательного оружия нет). */
  ammo?: ItemInstance
}

/** Может ли существо стрелять тем, что держит в руке; если нет — причина отказа. */
export function readyToShoot(state: GameState, c: Creature): ShotReady | RejectReason {
  const weapon = equippedWeapon(state, c)
  const ranged = weapon?.def.ranged
  if (!weapon || !ranged) return 'noRangedWeapon'
  if (durabilityEfficiency(weapon.inst) <= 0) return 'weaponBroken'
  const base = { inst: weapon.inst, def: weapon.def, range: ranged.range }
  if (!ranged.ammo) return base
  const ammo = c.inventory.map((id) => state.items[id]).find((i) => i?.defId === ranged.ammo)
  return ammo ? { ...base, ammo } : 'noAmmo'
}

export function distance(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

/**
 * Клетки полёта снаряда из from через to — прямая (DDA), продолжается за цель до дальности range.
 * Обрывается перед стеной или закрытой дверью; клетка from не входит.
 */
export function projectilePath(level: LevelState, from: Pos, to: Pos, range: number): Pos[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const n = Math.max(Math.abs(dx), Math.abs(dy))
  const path: Pos[] = []
  if (n === 0) return path
  for (let i = 1; i <= range; i++) {
    const x = from.x + Math.round((i * dx) / n)
    const y = from.y + Math.round((i * dy) / n)
    if (blocksSight(tileAt(level, x, y))) break
    path.push({ x, y })
  }
  return path
}

/** Первое существо на пути снаряда (кроме стрелка) и номер его клетки. */
export function firstCreatureOnPath(
  state: GameState,
  depth: number,
  path: Pos[],
  shooterId: string,
): { creature: Creature; index: number } | undefined {
  for (let index = 0; index < path.length; index++) {
    const q = path[index]!
    const creature = creatureAt(state, depth, q.x, q.y)
    if (creature && creature.id !== shooterId) return { creature, index }
  }
  return undefined
}

/** Выстрел или бросок из клетки стрелка в сторону клетки target. Готовность проверяет вызывающий. */
export function fire(ctx: Ctx, shooter: Creature, target: Pos, ready: ShotReady): void {
  const { state } = ctx
  const level = state.levels[shooter.depth]!
  const path = projectilePath(level, shooter, target, ready.range)
  const struck = firstCreatureOnPath(state, shooter.depth, path, shooter.id)
  const flight = struck ? path.slice(0, struck.index + 1) : path
  const projectileDefId = ready.ammo?.defId ?? ready.def.id
  const land = flight[flight.length - 1] ?? { x: shooter.x, y: shooter.y }

  ctx.events.push({ type: 'shotFired', attacker: actorRef(shooter), weaponDefId: ready.def.id, projectileDefId })
  recordTrail(ctx, shooter, flight, { itemDefId: projectileDefId })

  const hit = struck ? resolveAttack(ctx, shooter, struck.creature, rangedAttack(ready.inst, ready.def, projectileDefId)) : false
  if (!struck) ctx.events.push({ type: 'projectileLanded', projectileDefId, wall: path.length < ready.range })

  if (ready.ammo) {
    ready.ammo.count = (ready.ammo.count ?? 1) - 1
    if (ready.ammo.count <= 0) destroyItem(state, shooter, ready.ammo)
    const ammoDef = ITEMS[projectileDefId]
    const breakChance = ammoDef?.category === 'consumable' ? (ammoDef.breakChance ?? 0) : 0
    if (projectileBreaks(state.rng, breakChance, hit)) ctx.events.push({ type: 'projectileBroken', projectileDefId })
    else dropAt(state, projectileDefId, shooter.depth, land.x, land.y)
    return
  }
  throwWeapon(ctx, shooter, ready.inst, land)
}

/** Метательное оружие улетает само: падает у цели, в руку берётся следующее такое же. */
function throwWeapon(ctx: Ctx, owner: Creature, inst: ItemInstance, land: Pos): void {
  const { state } = ctx
  removeFromOwner(state, owner, inst.id)
  inst.loc = { kind: 'floor', depth: owner.depth, x: land.x, y: land.y }
  const next = owner.inventory
    .map((id) => state.items[id])
    .find((i) => i?.defId === inst.defId && !isEquipped(owner, i.id))
  if (!next) return
  owner.equipment.weapon = next.id
  if (owner.kind === 'player') ctx.events.push({ type: 'itemEquipped', itemDefId: next.defId, slot: 'weapon' })
}

/** Полёт попадает в анимацию, если игрок видит стрелка или хоть одну клетку пути. what — что летит. */
export function recordTrail(ctx: Ctx, shooter: Creature, flight: Pos[], what: Omit<ProjectileTrail, 'cells'>): void {
  const { state } = ctx
  const p = player(state)
  if (p.depth !== shooter.depth || flight.length === 0) return
  const level = state.levels[p.depth]!
  const visible = playerVisibleCells(state)
  const idx = (q: Pos): number => q.y * level.width + q.x
  if (!visible.has(idx(shooter)) && !flight.some((q) => visible.has(idx(q)))) return
  ;(ctx.projectiles ??= []).push({ cells: flight.map(idx), ...what })
}
