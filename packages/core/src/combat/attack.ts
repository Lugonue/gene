// Разрешение одной атаки (порядок шагов — ТЗ 5.5). Все числа — в ./formulas.
import { ATTACKS, type NaturalAttackDef, type WeaponDef } from '@gene/data'
import type { Ctx } from '../context'
import type { ActorRef, AttackRef } from '../events'
import { pick } from '../rng'
import type { Creature, ItemInstance } from '../state'
import { armourInSlot, equippedWeapon, findPart, partDef, planOf, skillLevel, speciesOf } from '../body'
import { distributeKillXp, gainSkillXp, studyItemType } from '../knowledge'
import { dropToFloor } from '../items'
import { applySlow } from '../time'
import {
  PLAYER_BASE_EVASION,
  SKILL_XP,
  STUDY_GAIN,
  armourAbsorb,
  chooseHitPart,
  durabilityEfficiency,
  durabilityWear,
  hitSeverity,
  isStrongHit,
  rollDamage,
  rollHit,
  splitDamage,
  stageIndex,
  woundStageFor,
  type AttackContext,
  type AttackProfile,
} from './formulas'

export function actorRef(c: Creature): ActorRef {
  return { id: c.id, kind: c.kind }
}

export interface ChosenAttack {
  profile: AttackProfile
  ref: AttackRef
}

function weaponProfile(inst: ItemInstance, def: WeaponDef): AttackProfile {
  return {
    damage: def.damage,
    accuracy: def.accuracy,
    damageType: def.damageType,
    skill: def.skill,
    partTag: 'grasp',
    weapon: inst,
    ...(def.twoHanded ? { twoHanded: true } : {}),
  }
}

/**
 * Чем атакует существо в ближнем бою: оружием в руке, кулаком (сломанное оружие, метатель снарядов
 * или без оружия) или естественной атакой.
 */
export function chooseAttack(ctx: Ctx, c: Creature): ChosenAttack {
  const weapon = equippedWeapon(ctx.state, c)
  if (weapon && durabilityEfficiency(weapon.inst) > 0 && !weapon.def.ranged?.ammo) {
    return {
      profile: weaponProfile(weapon.inst, weapon.def),
      ref: { kind: 'weapon', itemDefId: weapon.def.id, damageType: weapon.def.damageType },
    }
  }
  let natural: NaturalAttackDef
  if (c.kind === 'player' || planOf(c).mainHand) natural = ATTACKS.fist!
  else natural = pick(ctx.state.rng, speciesOf(c)?.attacks ?? [ATTACKS.fist!])
  const usesFist = natural.id === 'fist'
  return {
    profile: {
      damage: natural.damage,
      accuracy: natural.accuracy,
      damageType: natural.damageType,
      skill: usesFist ? 'unarmed' : 'fighting',
      partTag: natural.partTag,
    },
    ref: { kind: 'natural', attackId: natural.id, damageType: natural.damageType },
  }
}

/** Выстрел или бросок оружием inst; projectileDefId — боеприпас или само метательное оружие. */
export function rangedAttack(inst: ItemInstance, def: WeaponDef, projectileDefId: string): ChosenAttack {
  return {
    profile: weaponProfile(inst, def),
    ref: { kind: 'ranged', itemDefId: def.id, projectileDefId, damageType: def.damageType },
  }
}

/** Разрешить атаку (по умолчанию — ближний бой). Возвращает, было ли попадание. */
export function resolveAttack(
  ctx: Ctx,
  attacker: Creature,
  target: Creature,
  chosen: ChosenAttack = chooseAttack(ctx, attacker),
): boolean {
  const { state } = ctx
  const rng = state.rng
  const { profile, ref } = chosen
  const isPlayerAttacker = attacker.kind === 'player'
  const isPlayerTarget = target.kind === 'player'

  const actx: AttackContext = {
    attacker,
    target,
    attack: profile,
    attackerSkill: skillLevel(state, attacker, profile.skill),
    attackerFighting: profile.skill === 'fighting' ? 0 : skillLevel(state, attacker, 'fighting'),
    targetDodging: skillLevel(state, target, 'dodging'),
    targetEvasion: isPlayerTarget ? PLAYER_BASE_EVASION : (speciesOf(target)?.evasion ?? 0),
  }

  // 2. Часть тела цели.
  const part = chooseHitPart(rng, actx)
  const def = partDef(target, part)
  actx.part = part
  actx.partDef = def

  // Опыт атакующего (игрока) за использование оружия — за каждую атаку.
  if (isPlayerAttacker) {
    gainSkillXp(ctx, profile.skill, SKILL_XP.weaponAttack)
    if (profile.skill !== 'fighting') gainSkillXp(ctx, 'fighting', SKILL_XP.fighting)
    if (profile.weapon) studyItemType(ctx, profile.weapon.defId, STUDY_GAIN.weaponAttack)
  }

  // 3. Попадание.
  const { hit } = rollHit(rng, actx)
  if (!hit) {
    ctx.events.push({ type: 'attackMissed', attacker: actorRef(attacker), target: actorRef(target), attack: ref, partId: part.defId })
    if (isPlayerTarget) gainSkillXp(ctx, 'dodging', SKILL_XP.dodge)
    return false
  }

  // 4–5. Броня и урон.
  const armour = armourInSlot(state, target, def.armorSlot)
  const raw = rollDamage(rng, actx)
  const absorbedRoll = armourAbsorb(
    rng,
    actx,
    armour
      ? { inst: armour.inst, absorb: armour.def.absorb, skillLevel: skillLevel(state, target, armour.def.skill) }
      : undefined,
  )
  const absorbed = Math.min(raw, absorbedRoll)
  const damage = raw - absorbed
  const split = splitDamage(damage, findPart(target, 'torso'))

  const fromStage = part.wound
  part.hp = Math.max(0, part.hp - split.part)
  target.hp -= split.total
  part.wound = woundStageFor(part)
  if (part.material === 'organic' && part.wound === 'crippled') part.needsTreatment = true

  ctx.events.push({
    type: 'attackHit',
    attacker: actorRef(attacker),
    target: actorRef(target),
    attack: ref,
    partId: part.defId,
    partMaterial: part.material,
    damage,
    absorbed,
    ...(armour && absorbed > 0 ? { armourDefId: armour.def.id } : {}),
    severity: hitSeverity(damage, part),
    ...(isStrongHit(damage, target.maxHp, fromStage, part.wound) ? { strong: true as const } : {}),
    ...(isPlayerTarget
      ? { readout: { integrity: Math.max(0, target.hp), maxIntegrity: target.maxHp, partHp: part.hp, partMaxHp: part.maxHp } }
      : {}),
  })
  if (stageIndex(part.wound) > stageIndex(fromStage)) {
    ctx.events.push({
      type: 'woundChanged',
      creature: actorRef(target),
      partId: part.defId,
      material: part.material,
      from: fromStage,
      to: part.wound,
      hp: part.hp,
      maxHp: part.maxHp,
    })
  }

  // 6. Износ.
  if (profile.weapon) applyWear(ctx, attacker, profile.weapon, durabilityWear({ damage, armoured: !!armour }, profile.weapon, 'weapon'))
  if (armour) applyWear(ctx, target, armour.inst, durabilityWear({ damage: raw, armoured: true }, armour.inst, 'armour'))

  // 7. Опыт брони у игрока-цели.
  if (isPlayerTarget && armour) {
    gainSkillXp(ctx, armour.def.skill, SKILL_XP.armourHit)
    studyItemType(ctx, armour.def.id, STUDY_GAIN.armourHit)
  }

  // Смерть: общий HP ≤ 0; монстр гибнет и от разрушения vital-части, киборг — нет (ADR 0003).
  const vitalDestroyed = !isPlayerTarget && def.tags.includes('vital') && part.hp <= 0
  if (vitalDestroyed || target.hp <= 0) {
    killCreature(ctx, target, attacker, vitalDestroyed ? 'vital' : 'hp', vitalDestroyed ? part.defId : undefined)
  } else if (profile.damageType === 'cold' && damage > 0 && applySlow(target, state.now)) {
    // Холод вместо лишнего урона замедляет выжившую цель.
    ctx.events.push({ type: 'creatureSlowed', creature: actorRef(target) })
  }
  return true
}

/** Износ предмета; события — при падении ступени эффективности и при поломке. */
export function applyWear(ctx: Ctx, owner: Creature, inst: ItemInstance, amount: number): void {
  if (amount <= 0 || (inst.durability ?? 0) <= 0) return
  const before = durabilityEfficiency(inst)
  inst.durability = Math.max(0, (inst.durability ?? 0) - amount)
  const after = durabilityEfficiency(inst)
  if (after === before) return
  if (after <= 0) ctx.events.push({ type: 'itemBroken', owner: actorRef(owner), itemDefId: inst.defId })
  else
    ctx.events.push({
      type: 'itemDamaged',
      owner: actorRef(owner),
      itemDefId: inst.defId,
      durability: inst.durability,
      maxDurability: inst.maxDurability ?? 0,
      efficiency: after,
    })
}

export function killCreature(
  ctx: Ctx,
  victim: Creature,
  killer: Creature | undefined,
  cause: 'vital' | 'hp',
  partId?: string,
): void {
  const { state } = ctx
  ctx.events.push({
    type: 'creatureDied',
    creature: actorRef(victim),
    ...(killer ? { killer: actorRef(killer) } : {}),
    cause,
    ...(partId ? { partId } : {}),
  })
  if (victim.kind === 'player') {
    state.status = 'dead'
    if (killer) state.killedBy = killer.kind
    return
  }
  // Снаряжение монстра выпадает с текущей прочностью.
  for (const id of [...victim.inventory]) {
    const inst = state.items[id]
    if (!inst) continue
    dropToFloor(state, victim, inst)
    ctx.events.push({ type: 'itemDropped', itemDefId: inst.defId, count: inst.count ?? 1, owner: actorRef(victim) })
  }
  delete state.creatures[victim.id]
  if (killer?.kind === 'player') distributeKillXp(ctx, speciesOf(victim)?.xp ?? 0)
}
