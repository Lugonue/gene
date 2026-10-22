// Заклинания монстров: перезарядка, усталость, срыв; снаряд летит механизмом дальнего боя. Числа — в ./formulas.
import { MONSTERS, SPELLS, type BoltSpellDef, type SpellDef } from '@gene/data'
import type { Ctx } from '../context'
import { player, type Creature, type GameState } from '../state'
import { chance } from '../rng'
import { healCreature } from '../health'
import { playerVisibleCells } from '../view'
import { studyPhenomenon } from '../knowledge'
import {
  FATIGUE_PER_CAST,
  PHENOMENON_GAIN,
  fatigueStage,
  fizzleChance,
  recoverFatigue,
  spellCooldown,
  spellDamage,
  spellHeal,
} from './formulas'
import { actorRef, resolveAttack, type ChosenAttack } from './attack'
import { firstCreatureOnPath, projectilePath, recordTrail } from './ranged'

/** Заклинания вида существа. */
export function spellsOf(c: Creature): SpellDef[] {
  return (MONSTERS[c.kind]?.spells ?? []).flatMap((id) => SPELLS[id] ?? [])
}

function spellPower(c: Creature): number | undefined {
  return MONSTERS[c.kind]?.spellPower
}

/** Усталость заклинателя сейчас (спадает со временем). */
export function currentFatigue(state: GameState, c: Creature): number {
  const m = c.magic
  return m ? recoverFatigue(m.fatigue, state.now - m.fatigueAt) : 0
}

export function spellReady(state: GameState, c: Creature, spell: SpellDef): boolean {
  return (c.magic?.readyAt[spell.id] ?? Number.NEGATIVE_INFINITY) <= state.now
}

/**
 * Колдовство: снаряд в сторону target или лечение target. Готовность, цель и трату хода проверяет вызывающий.
 * Перезарядка и усталость тратятся и при срыве; чем выше усталость до заклинания, тем дольше перезарядка и чаще срыв.
 */
export function castSpell(ctx: Ctx, caster: Creature, spell: SpellDef, target: Creature): void {
  const { state } = ctx
  const fatigue = currentFatigue(state, caster)
  const magic = (caster.magic ??= { fatigue: 0, fatigueAt: state.now, readyAt: {} })
  magic.readyAt[spell.id] = state.now + spellCooldown(spell.cooldown, fatigue)
  magic.fatigue = fatigue + FATIGUE_PER_CAST
  magic.fatigueAt = state.now

  const casterSeen = playerSees(state, caster)
  const seen = target.kind === 'player' || casterSeen
  // Данные явления для ядра: колдовство в поле зрения (или его срыв) и попадание по киборгу.
  let data = 0
  if (chance(state.rng, fizzleChance(fatigue))) {
    if (seen) ctx.events.push({ type: 'spellFizzled', caster: actorRef(caster), spellId: spell.id })
    if (casterSeen) data = PHENOMENON_GAIN.fizzle
  } else {
    if (seen) ctx.events.push({ type: 'spellCast', caster: actorRef(caster), spellId: spell.id, target: actorRef(target) })
    if (casterSeen) data = PHENOMENON_GAIN.observe
    if (spell.effect === 'bolt') {
      if (bolt(ctx, caster, spell, target)?.kind === 'player') data += PHENOMENON_GAIN.hit
    } else healCreature(target, spellHeal(spell.heal, spellPower(caster), target))
  }
  if (data > 0 && state.status === 'active') studyPhenomenon(ctx, spell.phenomenon, data)

  const stage = fatigueStage(magic.fatigue)
  if (seen && stage !== 'fresh' && stage !== fatigueStage(fatigue))
    ctx.events.push({ type: 'casterTired', caster: actorRef(caster), stage })
}

/** Колдовство на игрока видно всегда, остальное — только если игрок видит заклинателя. */
function playerSees(state: GameState, c: Creature): boolean {
  const p = player(state)
  return p.depth === c.depth && playerVisibleCells(state).has(c.y * state.levels[c.depth]!.width + c.x)
}

/** Снаряд заклинания; возвращает существо, по которому он попал. */
function bolt(ctx: Ctx, caster: Creature, spell: BoltSpellDef, target: Creature): Creature | undefined {
  const { state } = ctx
  const path = projectilePath(state.levels[caster.depth]!, caster, target, spell.range)
  const struck = firstCreatureOnPath(state, caster.depth, path, caster.id)
  recordTrail(ctx, caster, struck ? path.slice(0, struck.index + 1) : path, { spellId: spell.id })
  if (!struck) return undefined
  const hit = resolveAttack(ctx, caster, struck.creature, spellAttack(spell, spellPower(caster)))
  return hit ? struck.creature : undefined
}

/** Атака снарядом заклинания: навыка магии у монстров нет, точность растёт с fighting. */
function spellAttack(spell: BoltSpellDef, power: number | undefined): ChosenAttack {
  return {
    profile: {
      damage: spellDamage(spell.damage, power),
      accuracy: spell.accuracy,
      damageType: spell.damageType,
      skill: 'fighting',
      partTag: 'grasp',
    },
    ref: { kind: 'spell', spellId: spell.id, damageType: spell.damageType },
  }
}
