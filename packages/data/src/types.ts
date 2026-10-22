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

/** Физические типы — оружие и естественные атаки; магические (fire, cold, lightning) — заклинания. */
export const MAGIC_DAMAGE_TYPES = ['fire', 'cold', 'lightning'] as const
export type MagicDamageType = (typeof MAGIC_DAMAGE_TYPES)[number]
export type DamageType = 'slash' | 'pierce' | 'blunt' | MagicDamageType

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
  /** Навыки монстра (уровень 0–27). */
  skills: Partial<Record<SkillId, number>>
  evasion: number
  /** Опыт за убийство (распределяется по навыкам, использованным в бою). */
  xp: number
  faction: FactionId
  role: MonsterRole
  /** Вес при расстановке среди видов фракции (вожак ставится отдельно). */
  spawnWeight: number
  /** Заклинания вида (id из SPELLS). */
  spells?: string[]
  /** Сила заклинаний вида: множитель урона и лечения (по умолчанию 1). */
  spellPower?: number
}

// ---------- Заклинания ----------

/** Явление — эффект, как его видит Ядро: огненный шар гоблина и плевок драконорождённого — одно явление. */
export type PhenomenonId = 'fireball' | 'frost_bolt' | 'lightning' | 'heal'

interface SpellDefBase {
  id: string
  name: WordForms
  phenomenon: PhenomenonId
  /** Дальность (клетки, по Чебышёву). */
  range: number
  /** Базовая перезарядка (aut). */
  cooldown: number
}

/** Снаряд: летит и попадает как стрела. */
export interface BoltSpellDef extends SpellDefBase {
  effect: 'bolt'
  damageType: MagicDamageType
  damage: number
  accuracy: number
  /** Символ снаряда в полёте; без него — черта по направлению полёта. */
  glyph?: string
  color: string
}

/** Лечение союзника в поле зрения. */
export interface HealSpellDef extends SpellDefBase {
  effect: 'heal'
  heal: number
}

export type SpellDef = BoltSpellDef | HealSpellDef

// ---------- Фракции ----------

export type FactionId = 'goblins' | 'orcs' | 'order' | 'kobolds'

/** Боевое амплуа монстра внутри фракции. */
export type MonsterRole = 'warrior' | 'archer' | 'mage' | 'beast' | 'leader'

/**
 * Черта поведения фракции:
 * cowardly — отступает раньше; fearless — не отступает;
 * relentless — ещё какое-то время идёт по следу невидимого игрока; rallying — отступает к союзникам.
 */
export type FactionTrait = 'cowardly' | 'fearless' | 'relentless' | 'rallying'

export interface FactionDef {
  id: FactionId
  name: string
  /** Уровень подземелья, который фракция занимает целиком. */
  depth: number
  trait: FactionTrait
  /** Снаряжение, из которого генерируется снаряжение монстров фракции. */
  gear: string[]
}

/** Как роль выбирает снаряжение из набора фракции. */
export interface RoleGearDef {
  /** Навыки оружия, подходящего роли; пусто — роль без оружия (звери). */
  weaponSkills: SkillId[]
  /** Шанс надеть броню на каждый вид брони (голова, тело, руки, ноги), если она есть в наборе фракции. */
  armourChance: number
}

/** Запас стрелка: боеприпасы к метателю или число метательных копий (вместе с тем, что в руке). */
export interface RangedSupplyDef {
  ammo: [number, number]
  thrown: [number, number]
}

// ---------- Предметы ----------

export type ItemCategory = 'weapon' | 'armour' | 'consumable'
/** ammo — боеприпас: не применяется, тратится при выстреле. */
export type ConsumableEffect = 'bandage' | 'healPotion' | 'repairKit' | 'ammo'

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
  /** Двуручное: вторая рука нужна для точности. */
  twoHanded?: boolean
  /** Дальний бой. */
  ranged?: RangedDef
}

export interface RangedDef {
  /** Дальность (клетки, по Чебышёву). */
  range: number
  /** Тип боеприпаса; без него оружие бросается само (метательное). Метатель снарядов в ближнем бою бьёт кулаком. */
  ammo?: string
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
  /** Боеприпас: шанс сломаться при попадании. */
  breakChance?: number
  /** Символ снаряда в полёте; без него — черта по направлению полёта. */
  projectileGlyph?: string
}

export type ItemDef = WeaponDef | ArmourDef | ConsumableDef

// ---------- Отказы команд ----------

export type RejectReasonKey =
  | 'gameOver'
  | 'invalid'
  | 'blocked'
  | 'noStairs'
  | 'noItem'
  | 'nothingHere'
  | 'inventoryFull'
  | 'cannotEquip'
  | 'slotEmpty'
  | 'needTarget'
  | 'wrongTarget'
  | 'bandageOnBionic'
  | 'repairOnOrganic'
  | 'notDamaged'
  | 'fullHealth'
  | 'nothingToRepair'
  | 'notUsable'
  | 'equippedItem'
  | 'nothingToExplore'
  | 'noRangedWeapon'
  | 'noAmmo'
  | 'weaponBroken'
  | 'outOfRange'

// ---------- Навыки ----------

export type SkillId =
  | 'short_blades'
  | 'long_blades'
  | 'maces'
  | 'axes'
  | 'staves'
  | 'bows'
  | 'crossbows'
  | 'slings'
  | 'throwing'
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
