// МОДУЛЬ-ЗАГЛУШКА: все числа и формулы боя, ран, прочности, регенерации и опыта (см. README.md рядом).
// Остальной код core не содержит собственных боевых констант и вызывает только функции отсюда.
import type { BodyPartDef, DamageType, FactionTrait, Material, MonsterRole, PartTag, SkillId, WoundStage } from '@gene/data'
import { nextFloat, randInt, chance as roll, weightedIndex, type RngState } from '../../rng'
import type { BionicUpgrades, BodyPartState, Creature, ItemInstance, StudyStatus } from '../../state'
import { mainHand, offHand, partDef, partsWithTag } from '../../body'

// ---------------------------------------------------------------------------
// Контекст атаки
// ---------------------------------------------------------------------------

export interface AttackProfile {
  /** Базовый урон оружия или естественной атаки. */
  damage: number
  accuracy: number
  damageType: DamageType
  /** Навык, которым наносится атака (для естественных атак монстров — fighting). */
  skill: SkillId
  /** Части тела атакующего, ранения которых ослабляют атаку. */
  partTag: 'grasp' | 'bite' | 'claw'
  /** Экземпляр оружия, если атака оружием. */
  weapon?: ItemInstance
  /** Двуручное оружие: точность зависит и от второй руки. */
  twoHanded?: boolean
}

export interface AttackContext {
  attacker: Creature
  target: Creature
  attack: AttackProfile
  /** Уровни навыков (0–27). */
  attackerSkill: number
  attackerFighting: number
  targetDodging: number
  /** Природное уклонение вида цели (у игрока — PLAYER_BASE_EVASION). */
  targetEvasion: number
  /** Поражённая часть (после chooseHitPart). */
  part?: BodyPartState
  partDef?: BodyPartDef
}

export const PLAYER_BASE_EVASION = 3

// ---------------------------------------------------------------------------
// Стадии ран
// ---------------------------------------------------------------------------

/** Пороги доли hp: выше 75% — none, выше 50% — bruised, выше 25% — wounded, иначе crippled. */
const STAGE_THRESHOLDS: [WoundStage, number][] = [
  ['none', 0.75],
  ['bruised', 0.5],
  ['wounded', 0.25],
]

export function woundStageFor(part: BodyPartState): WoundStage {
  if (part.wound === 'severed') return 'severed'
  const frac = part.maxHp > 0 ? part.hp / part.maxHp : 0
  for (const [stage, t] of STAGE_THRESHOLDS) if (frac > t) return stage
  return 'crippled'
}

const STAGE_ORDER: WoundStage[] = ['none', 'bruised', 'wounded', 'crippled', 'severed']
export function stageIndex(s: WoundStage): number {
  return STAGE_ORDER.indexOf(s)
}

/** Минимальное hp, при котором часть находится в стадии stage (для снятия стадии бинтом/ремкомплектом). */
function minHpForStage(part: BodyPartState, stage: WoundStage): number {
  const t = STAGE_THRESHOLDS.find(([s]) => s === stage)?.[1]
  if (t === undefined) return 0
  return Math.floor(part.maxHp * t) + 1
}

// ---------------------------------------------------------------------------
// Влияние ран по тегам
// ---------------------------------------------------------------------------

const STAGE_MUL: Record<WoundStage, number> = { none: 1, bruised: 0.9, wounded: 0.75, crippled: 0.5, severed: 0.3 }
const VISION_ACC_MUL: Record<WoundStage, number> = { none: 1, bruised: 0.95, wounded: 0.85, crippled: 0.7, severed: 0.6 }
/** Вторая рука двуручного оружия; без второй руки — как отсечённая. */
const OFF_HAND_ACC_MUL: Record<WoundStage, number> = { none: 1, bruised: 0.95, wounded: 0.85, crippled: 0.6, severed: 0.4 }
const VISION_FOV_DELTA: Record<WoundStage, number> = { none: 0, bruised: -1, wounded: -2, crippled: -4, severed: -5 }

function avgMul(parts: BodyPartState[], table: Record<WoundStage, number>): number {
  if (parts.length === 0) return 1
  return parts.reduce((s, p) => s + table[p.wound], 0) / parts.length
}

function worstStage(parts: BodyPartState[]): WoundStage {
  let worst: WoundStage = 'none'
  for (const p of parts) if (stageIndex(p.wound) > stageIndex(worst)) worst = p.wound
  return worst
}

/** Части тела, которыми наносится атака: для оружия и кулака — основная рука, для укуса/когтей — части с тегом. */
export function attackingParts(c: Creature, tag: 'grasp' | 'bite' | 'claw'): BodyPartState[] {
  if (tag === 'grasp') {
    const hand = mainHand(c)
    return hand ? [hand] : partsWithTag(c, 'grasp')
  }
  return partsWithTag(c, tag)
}

export interface WoundModifiers {
  accuracyMul: number
  damageMul: number
  evasionMul: number
  fovDelta: number
  moveCostMul: number
}

export function woundModifiers(c: Creature, attackTag: 'grasp' | 'bite' | 'claw' = 'grasp'): WoundModifiers {
  const attackParts = attackingParts(c, attackTag)
  const vision = partsWithTag(c, 'vision')
  const stance = partsWithTag(c, 'stance')
  const attackMul = avgMul(attackParts, STAGE_MUL)
  return {
    accuracyMul: attackMul * avgMul(vision, VISION_ACC_MUL),
    damageMul: attackMul,
    evasionMul: avgMul(stance, STAGE_MUL),
    fovDelta: VISION_FOV_DELTA[worstStage(vision)],
    moveCostMul: moveCostMultiplier(c),
  }
}

/** Искалеченные ноги/лапы замедляют передвижение. */
export function moveCostMultiplier(c: Creature): number {
  const stance = partsWithTag(c, 'stance')
  if (stance.length === 0) return 1
  const crippled = stance.filter((p) => stageIndex(p.wound) >= stageIndex('crippled')).length
  if (crippled === 0) return 1
  return crippled * 2 >= stance.length ? 2 : 1.5
}

export const BASE_FOV_RADIUS = 8

export function fovRadius(c: Creature): number {
  const sensors = partsWithTag(c, 'vision').reduce((s, p) => s + (p.upgrades?.sensors ?? 0), 0)
  return Math.max(2, BASE_FOV_RADIUS + woundModifiers(c).fovDelta + sensors)
}

function upgradeSum(parts: BodyPartState[], key: keyof BionicUpgrades): number {
  return parts.reduce((s, p) => s + (p.upgrades?.[key] ?? 0), 0)
}

// ---------------------------------------------------------------------------
// Бой
// ---------------------------------------------------------------------------

/** Навык атакующего немного смещает распределение в сторону vital-частей. */
const VITAL_BIAS_PER_SKILL = 0.03

export function chooseHitPart(rng: RngState, ctx: AttackContext): BodyPartState {
  const parts = ctx.target.parts.filter((p) => p.wound !== 'severed')
  const weights = parts.map((p) => {
    const def = partDef(ctx.target, p)
    const bias = def.tags.includes('vital') ? 1 + VITAL_BIAS_PER_SKILL * ctx.attackerSkill : 1
    return def.hitWeight * bias
  })
  return parts[weightedIndex(rng, weights)] as BodyPartState
}

/** Кривая эффективности снаряжения от доли прочности (пороговая, не линейная). */
const DURABILITY_TIERS: [number, number][] = [
  [0.75, 1],
  [0.5, 0.85],
  [0.25, 0.65],
  [0, 0.4],
]

export function durabilityEfficiency(item: ItemInstance): number {
  const max = item.maxDurability ?? 0
  const cur = item.durability ?? 0
  if (max <= 0) return 1
  if (cur <= 0) return 0
  const frac = cur / max
  for (const [t, eff] of DURABILITY_TIERS) if (frac >= t && (t > 0 || frac > 0)) return eff
  return 0
}

export function hitChance(ctx: AttackContext): number {
  const mods = woundModifiers(ctx.attacker, ctx.attack.partTag)
  const precision = upgradeSum(attackingParts(ctx.attacker, ctx.attack.partTag), 'precision')
  let acc = 10 + ctx.attack.accuracy + 1.5 * ctx.attackerSkill + 0.5 * ctx.attackerFighting + precision
  acc *= mods.accuracyMul
  if (ctx.attack.twoHanded) acc *= OFF_HAND_ACC_MUL[offHand(ctx.attacker)?.wound ?? 'severed']
  if (ctx.attack.weapon) acc *= 0.6 + 0.4 * durabilityEfficiency(ctx.attack.weapon)
  const targetMods = woundModifiers(ctx.target)
  const mobility = upgradeSum(partsWithTag(ctx.target, 'stance'), 'mobility')
  const ev = (5 + ctx.targetEvasion + 1.5 * ctx.targetDodging + mobility) * targetMods.evasionMul
  return Math.min(0.95, Math.max(0.05, acc / (acc + ev)))
}

export function rollHit(rng: RngState, ctx: AttackContext): { hit: boolean; roll: number; chance: number } {
  const c = hitChance(ctx)
  const r = nextFloat(rng)
  return { hit: r < c, roll: r, chance: c }
}

export function rollDamage(rng: RngState, ctx: AttackContext): number {
  const mods = woundModifiers(ctx.attacker, ctx.attack.partTag)
  const strength = upgradeSum(attackingParts(ctx.attacker, ctx.attack.partTag), 'strength')
  let dmg = ctx.attack.damage * (0.5 + nextFloat(rng))
  dmg *= 1 + 0.04 * ctx.attackerSkill + 0.02 * ctx.attackerFighting
  dmg *= mods.damageMul
  dmg *= 1 + 0.1 * strength
  if (ctx.attack.weapon) dmg *= Math.max(0.4, durabilityEfficiency(ctx.attack.weapon))
  if (ctx.part) dmg *= damageTypeMultiplier(ctx.attack.damageType, ctx.part.material)
  return Math.max(1, Math.round(dmg))
}

/** Огонь сильнее жжёт органику, молния — бионику. Холод лишнего урона не даёт, он замедляет (модуль времени). */
const DAMAGE_TYPE_MUL: Partial<Record<DamageType, Partial<Record<Material, number>>>> = {
  fire: { organic: 1.5 },
  lightning: { bionic: 1.5 },
}

export function damageTypeMultiplier(type: DamageType, material: Material): number {
  return DAMAGE_TYPE_MUL[type]?.[material] ?? 1
}

/** Замедление холодом (механизм — в модуле времени): длительность в aut и множитель стоимости действий. */
export const SLOW_DURATION = 40
export const SLOW_COST_MUL = 2

/** Поглощение урона бронёй (с учётом прочности и навыка брони) и встроенной защитой бионики. */
export function armourAbsorb(
  rng: RngState,
  ctx: AttackContext,
  armour?: { inst: ItemInstance; absorb: number; skillLevel: number },
): number {
  let total = 0
  if (armour) {
    const eff = durabilityEfficiency(armour.inst)
    const base = randInt(rng, 0, armour.absorb) + armour.absorb * 0.5
    total += base * eff * (1 + 0.05 * armour.skillLevel)
  }
  if (ctx.part?.material === 'bionic') total += randInt(rng, 0, 1) + (ctx.part.upgrades?.plating ?? 0)
  return Math.round(total)
}

export function hitSeverity(damage: number, part: BodyPartState): 'absorbed' | 'light' | 'medium' | 'heavy' {
  if (damage <= 0) return 'absorbed'
  const frac = damage / part.maxHp
  if (frac >= 0.4) return 'heavy'
  if (frac >= 0.2) return 'medium'
  return 'light'
}

/** Порог сильного удара (для окна-сцены): доля от максимума общего HP цели. */
export const STRONG_HIT_FRACTION = 0.25

/** Сильный удар: урон не меньше порога от максимума HP цели или часть тела впервые ранена тяжело (искалечена и хуже). */
export function isStrongHit(damage: number, targetMaxHp: number, from: WoundStage, to: WoundStage): boolean {
  if (damage <= 0) return false
  const heavy = stageIndex('crippled')
  if (stageIndex(to) >= heavy && stageIndex(from) < heavy) return true
  return damage >= targetMaxHp * STRONG_HIT_FRACTION
}

/** Как урон распределяется между частью тела и общим пулом HP. */
export function splitDamage(damage: number): { part: number; total: number } {
  return { part: damage, total: damage }
}

// ---------------------------------------------------------------------------
// Дальний бой
// ---------------------------------------------------------------------------

/** Промахнувшийся снаряд падает мягче и ломается реже. */
const MISS_BREAK_MUL = 0.5

export function projectileBreaks(rng: RngState, breakChance: number, hit: boolean): boolean {
  return roll(rng, hit ? breakChance : breakChance * MISS_BREAK_MUL)
}

// ---------------------------------------------------------------------------
// Заклинания монстров: усталость, срыв, перезарядка
// ---------------------------------------------------------------------------

/** Усталость за одно заклинание (и за сорвавшееся тоже). */
export const FATIGUE_PER_CAST = 1
/** За сколько aut спадает единица усталости. */
const FATIGUE_RECOVERY_TIME = 50
const FIZZLE_BASE = 0.05
const FIZZLE_PER_FATIGUE = 0.12
const FIZZLE_MAX = 0.8
/** На сколько удлиняет перезарядку каждая единица усталости. */
const COOLDOWN_PER_FATIGUE = 0.35

export function fizzleChance(fatigue: number): number {
  return Math.min(FIZZLE_MAX, FIZZLE_BASE + FIZZLE_PER_FATIGUE * fatigue)
}

/** Перезарядка заклинания (aut) с учётом усталости заклинателя. */
export function spellCooldown(base: number, fatigue: number): number {
  return Math.round(base * (1 + COOLDOWN_PER_FATIGUE * fatigue))
}

/** Усталость после отдыха длительностью elapsed (aut). */
export function recoverFatigue(fatigue: number, elapsed: number): number {
  return Math.max(0, fatigue - elapsed / FATIGUE_RECOVERY_TIME)
}

export type FatigueStage = 'fresh' | 'tired' | 'exhausted'

/** Ступень усталости для повествования («шаман тяжело дышит», «шаман выдохся»). */
export function fatigueStage(fatigue: number): FatigueStage {
  if (fatigue >= 4) return 'exhausted'
  if (fatigue >= 2) return 'tired'
  return 'fresh'
}

/** Маг лечит союзника, у которого осталось меньше этой доли HP. */
export const HEAL_ALLY_HP_SHARE = 0.6

/** Урон снаряда заклинания до броска: база заклинания × сила вида (MonsterDef.spellPower). */
export function spellDamage(base: number, power = 1): number {
  return base * power
}

/** Лечение заклинанием: HP и доля hp каждой органической части. */
export function spellHeal(base: number, power = 1, target: Creature): { hp: number; partFraction: number } {
  const hp = Math.max(1, Math.round(base * power))
  return { hp, partFraction: hp / Math.max(1, target.maxHp) }
}

// ---------------------------------------------------------------------------
// Прочность
// ---------------------------------------------------------------------------

export function durabilityWear(
  ctx: { damage: number; armoured: boolean },
  _item: ItemInstance,
  role: 'weapon' | 'armour',
): number {
  if (role === 'weapon') return 1 + (ctx.armoured ? 1 : 0)
  return 1 + (ctx.damage >= 4 ? 1 : 0)
}

/** Ремкомплект восстанавливает половину максимальной прочности. */
export function repairAmount(item: ItemInstance): number {
  return Math.ceil((item.maxDurability ?? 0) * 0.5)
}

// ---------------------------------------------------------------------------
// Здоровье частей тела, лечение, ремонт
// ---------------------------------------------------------------------------

/** Бионика прочнее органики. */
export function partMaxHp(def: BodyPartDef, material: Material, scale: number): number {
  const mul = material === 'bionic' ? 1.25 : 1
  return Math.max(1, Math.round(def.maxHp * scale * mul))
}

export interface RegenResult {
  hp: number
  /** Индекс части → прибавка hp. */
  parts: { index: number; gain: number }[]
}

const REGEN_HP_INTERVAL = 30
const REGEN_PART_INTERVAL = 50

/** Естественная регенерация за прошедшее время. Только органика; бионика не регенерирует. */
export function regenTick(c: Creature, elapsed: number): RegenResult {
  const before = c.regenAcc
  const after = before + elapsed
  c.regenAcc = after
  const hpTicks = Math.floor(after / REGEN_HP_INTERVAL) - Math.floor(before / REGEN_HP_INTERVAL)
  const partTicks = Math.floor(after / REGEN_PART_INTERVAL) - Math.floor(before / REGEN_PART_INTERVAL)
  const result: RegenResult = { hp: Math.min(hpTicks, c.maxHp - c.hp), parts: [] }
  if (partTicks > 0) {
    c.parts.forEach((p, index) => {
      if (p.material !== 'organic' || p.wound === 'severed') return
      const cap = organicHealCap(p)
      const gain = Math.max(0, Math.min(partTicks, cap - p.hp))
      if (gain > 0) result.parts.push({ index, gain })
    })
  }
  return result
}

/** Предел самолечения органической части: искалеченная без перевязки не поднимается выше wounded. */
export function organicHealCap(p: BodyPartState): number {
  return p.needsTreatment ? Math.floor(p.maxHp * 0.5) : p.maxHp
}

/** Снятие одной стадии раны (бинт — органика, ремкомплект — бионика). Возвращает новое hp. */
export function treatOneStage(part: BodyPartState): number {
  const idx = stageIndex(part.wound)
  if (idx <= 0) return part.hp
  const better = STAGE_ORDER[idx - 1] as WoundStage
  const bonus = Math.ceil(part.maxHp * 0.15)
  return Math.min(part.maxHp, Math.max(part.hp + bonus, minHpForStage(part, better)))
}

export function potionHeal(c: Creature): { hp: number; partFraction: number } {
  return { hp: Math.ceil(c.maxHp * 0.4), partFraction: 0.25 }
}

// ---------------------------------------------------------------------------
// Опыт и изучение
// ---------------------------------------------------------------------------

export const MAX_SKILL = 27

/** Опыт, нужный для уровня L: 5·L·(L+1). */
export function xpForSkillLevel(level: number): number {
  return 5 * level * (level + 1)
}

export function skillLevelFromXp(xp: number): number {
  let l = 0
  while (l < MAX_SKILL && xpForSkillLevel(l + 1) <= xp) l++
  return l
}

export type UsageKind = 'weaponAttack' | 'fighting' | 'dodge' | 'armourHit' | 'disassemble'

export const SKILL_XP: Record<UsageKind, number> = {
  weaponAttack: 3,
  fighting: 1,
  dodge: 2,
  armourHit: 2,
  disassemble: 20,
}

/** Опыт за убийство = xp вида × множитель, распределяется пропорционально использованию навыков. */
export function killXp(monsterXp: number): number {
  return monsterXp * 4
}

export const STARTING_SKILL_LEVELS = { weapon: 2, fighting: 2, dodging: 2 }

export const STUDY_THRESHOLDS: Record<Exclude<StudyStatus, 'unknown'>, number> = { partial: 15, known: 40 }

export const STUDY_GAIN = {
  weaponAttack: 1,
  armourHit: 1,
  /** За каждое действие игрока, пока предмет надет. */
  wornPerAction: 0.1,
  disassemble: 25,
}

function statusByThresholds(data: number, t: Record<Exclude<StudyStatus, 'unknown'>, number>): StudyStatus {
  if (data >= t.known) return 'known'
  if (data >= t.partial) return 'partial'
  return 'unknown'
}

export function studyStatusFor(data: number): StudyStatus {
  return statusByThresholds(data, STUDY_THRESHOLDS)
}

/** Данные о явлении за порцию: заклинание в поле зрения, попадание по киборгу (сверх наблюдения), срыв. */
export const PHENOMENON_GAIN = { observe: 2, hit: 5, fizzle: 2 }

/** Пороги данных явления; на known открывается рецепт. */
export const PHENOMENON_THRESHOLDS: Record<Exclude<StudyStatus, 'unknown'>, number> = { partial: 10, known: 30 }

export function phenomenonStatusFor(data: number): StudyStatus {
  return statusByThresholds(data, PHENOMENON_THRESHOLDS)
}

// ---------------------------------------------------------------------------
// ИИ
// ---------------------------------------------------------------------------

/** Доля HP, ниже которой монстр может отступить: трусливые фракции бегут раньше. */
const FLEE_HP_SHARE = 0.25
const COWARDLY_FLEE_HP_SHARE = 0.5
/**
 * Сколько времени (aut) фракция с чертой relentless ищет игрока, пропавшего из виду: дойдя до места,
 * где видела его в последний раз, осматривает клетки вокруг него в пределах SEARCH_RADIUS.
 */
export const TRACK_TIME = 200
export const SEARCH_RADIUS = 6

export function wantsToFlee(rng: RngState, c: Creature, trait?: FactionTrait): boolean {
  if (trait === 'fearless') return false
  const lowHp = c.hp < c.maxHp * (trait === 'cowardly' ? COWARDLY_FLEE_HP_SHARE : FLEE_HP_SHARE)
  const legs = partsWithTag(c, 'stance').some((p) => stageIndex(p.wound) >= stageIndex('crippled'))
  return (lowHp || legs) && roll(rng, 0.35)
}

export function hasTag(def: BodyPartDef, tag: PartTag): boolean {
  return def.tags.includes(tag)
}

// ---------------------------------------------------------------------------
// Угроза монстров и бюджет уровня
// ---------------------------------------------------------------------------

export interface ThreatInput {
  maxHp: number
  speed: number
  evasion: number
  /** Лучшая атака: урон и точность оружия или естественной атаки. */
  damage: number
  accuracy: number
  /** Навык этой атаки (для естественных атак — fighting). */
  attackSkill: number
  fighting: number
  dodging: number
  /** Сумма поглощения надетой брони. */
  absorb: number
  /** Черта фракции; у игрока её нет. */
  trait?: FactionTrait
  /** Заклинания вида: база урона снаряда или лечения и перезарядка; spellPower — сила вида. */
  spells: { amount: number; cooldown: number }[]
  spellPower?: number
}

/** Бесстрашные и упорные опаснее, трусливые — слабее своих чисел. */
const TRAIT_THREAT: Record<FactionTrait, number> = { cowardly: 0.9, fearless: 1.1, relentless: 1.1, rallying: 1 }
/** Вклад заклинания в угрозу: урон (лечение) × сила за столько aut, делённое на перезарядку. */
const SPELL_THREAT_AUT = 20

/** Вклад одного заклинания (урона или лечения) в угрозу: сила эффекта, приведённая к SPELL_THREAT_AUT по перезарядке. */
function spellThreat(amount: number, cooldown: number, power = 1): number {
  return (amount * power * SPELL_THREAT_AUT) / cooldown
}

/**
 * Угроза монстра: нападение (урон × навыки, плюс заклинания — чем сильнее и чаще, тем больше) плюс живучесть
 * (hp, броня, уклонение), × скорость и черта фракции.
 */
export function monsterThreat(t: ThreatInput): number {
  const spells = t.spells.reduce((s, sp) => s + spellThreat(sp.amount, sp.cooldown, t.spellPower), 0)
  const offence = t.damage * (1 + 0.04 * t.attackSkill + 0.02 * t.fighting) + t.accuracy / 4 + spells
  const defence = t.maxHp / 4 + t.absorb + (t.evasion + 1.5 * t.dodging) / 3
  return Math.max(1, Math.round((offence + defence) * (t.speed / 10) * (t.trait ? TRAIT_THREAT[t.trait] : 1)))
}

/** Уровень угрозы монстра относительно игрока: 1 — заметно слабее, 3 — равный, 5 — смертельный. */
export type ThreatTier = 1 | 2 | 3 | 4 | 5

/** Границы отношения угрозы монстра к угрозе игрока между уровнями 1→2, 2→3, 3→4, 4→5. */
const THREAT_TIER_RATIOS = [0.5, 0.8, 1.25, 2]

export function threatTier(threat: number, playerThreat: number): ThreatTier {
  const ratio = threat / Math.max(1, playerThreat)
  return (1 + THREAT_TIER_RATIOS.filter((r) => ratio >= r).length) as ThreatTier
}

// ---------------------------------------------------------------------------
// Генерация отрядов (виды, наборы снаряжения и размеры отрядов — в data)
// ---------------------------------------------------------------------------

/** Сколько раз подряд отряд может не уложиться в остаток бюджета, прежде чем уровень считается заполненным. */
export const SQUAD_FILL_MAX_MISSES = 20
/** Сколько первых членов отряда вожака (вожак и воин или зверь) должны уместиться в его комнате, чтобы она годилась. */
export const LEADER_ROOM_MIN_SQUAD = 2
/** Наибольшая доля стрелков в отряде. */
export const MAX_ARCHER_SHARE = 0.5
/** Шанс надеть броню на каждый вид брони (голова, тело, руки, ноги), если она есть в наборе фракции. */
export const ROLE_ARMOUR_CHANCE: Record<MonsterRole, number> = {
  warrior: 0.6,
  archer: 0.35,
  mage: 0.15,
  beast: 0,
  leader: 0.9,
}
/** Запас стрелка-монстра: боеприпасы к метателю или число метательных копий (вместе с тем, что в руке). */
export const RANGED_SUPPLY: { ammo: [number, number]; thrown: [number, number] } = { ammo: [6, 10], thrown: [2, 4] }

/** Бюджет угрозы по глубине (≈ 8–12 монстров на уровень); в него входит и отряд вожака. */
const LEVEL_THREAT_BUDGET = [0, 120, 230, 260, 280]

export function levelThreatBudget(depth: number): number {
  return LEVEL_THREAT_BUDGET[depth] ?? LEVEL_THREAT_BUDGET[LEVEL_THREAT_BUDGET.length - 1]!
}
