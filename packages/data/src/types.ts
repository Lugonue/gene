// Типы определений игровых данных. Только данные, никакой логики.

export type Gender = 'm' | 'f' | 'n' | 'pl'
export type Case = 'nom' | 'gen' | 'dat' | 'acc' | 'ins' | 'prep'

export interface WordForms {
  nom: string
  gen: string
  dat: string
  acc: string
  ins: string
  prep: string
  gender: Gender
  animate?: boolean
}

// ---------- Тела ----------

export type PartTag = 'grasp' | 'stance' | 'vision' | 'vital' | 'bite' | 'claw'
export type Material = 'organic' | 'bionic'
export type WoundStage = 'none' | 'bruised' | 'wounded' | 'crippled' | 'severed'

/** Слот брони; у четырёхрукого есть второй слот для рук. */
export type ArmourSlotId = 'head' | 'body' | 'hands' | 'hands_lower' | 'legs'
export type SlotId = 'weapon' | ArmourSlotId
/** Вид брони — какие слоты он может занимать. */
export type ArmourKind = 'head' | 'body' | 'hands' | 'legs'

export interface BodyPartDef {
  id: string
  name: WordForms
  tags: PartTag[]
  hitWeight: number
  /** Базовое «здоровье части», умножается на partHpScale существа. */
  maxHp: number
  armorSlot?: ArmourSlotId
  severable?: boolean
}

export interface BodyPlanDef {
  id: string
  name: WordForms
  parts: BodyPartDef[]
  /** Часть тела, которая держит оружие (для существ с оружием). */
  mainHand?: string
}

export interface SlotDef {
  id: SlotId
  kind: ArmourKind | 'weapon'
  name: string
}

export interface CyborgConfigDef {
  bodyPlan: string
  name: string
  description: string
  /** Материал по id части тела; не указанные — organic. */
  materials: Record<string, Material>
  maxHp: number
  partHpScale: number
}

// ---------- Атаки и монстры ----------

export type DamageType = 'slash' | 'pierce' | 'blunt'

export interface NaturalAttackDef {
  id: string
  name: WordForms
  damageType: DamageType
  damage: number
  accuracy: number
  /** Тег частей тела, которыми наносится атака (раны этих частей ослабляют атаку). */
  partTag: 'bite' | 'claw' | 'grasp'
}

export interface MonsterDef {
  id: string
  name: WordForms
  glyph: string
  color: string
  bodyPlan: string
  maxHp: number
  partHpScale: number
  /** 10 — обычная скорость. */
  speed: number
  /** Естественные атаки (если нет оружия). */
  attacks: NaturalAttackDef[]
  /** Стартовое снаряжение: id типов предметов. */
  equipment?: string[]
  /** Навыки монстра (уровень 0–27). */
  skills: Partial<Record<SkillId, number>>
  evasion: number
  /** Опыт за убийство (распределяется по навыкам, использованным в бою). */
  xp: number
  packSize?: [number, number]
  /** Минимальная/максимальная глубина появления и вес при расстановке. */
  depth: [number, number]
  spawnWeight: number
  boss?: boolean
}

// ---------- Предметы ----------

export type ItemCategory = 'weapon' | 'armour' | 'consumable'
export type ConsumableEffect = 'bandage' | 'healPotion' | 'repairKit'

interface ItemDefBase {
  id: string
  name: WordForms
  glyph: string
  color: string
  category: ItemCategory
}

export interface WeaponDef extends ItemDefBase {
  category: 'weapon'
  damage: number
  accuracy: number
  damageType: DamageType
  skill: SkillId
  maxDurability: number
}

export interface ArmourDef extends ItemDefBase {
  category: 'armour'
  kind: ArmourKind
  absorb: number
  skill: 'light_armour' | 'heavy_armour'
  maxDurability: number
}

export interface ConsumableDef extends ItemDefBase {
  category: 'consumable'
  effect: ConsumableEffect
}

export type ItemDef = WeaponDef | ArmourDef | ConsumableDef

// ---------- Навыки ----------

export type SkillId =
  | 'short_blades'
  | 'long_blades'
  | 'maces'
  | 'axes'
  | 'unarmed'
  | 'light_armour'
  | 'heavy_armour'
  | 'fighting'
  | 'dodging'

export interface SkillDef {
  id: SkillId
  name: string
  group: 'weapon' | 'armour' | 'general'
}
