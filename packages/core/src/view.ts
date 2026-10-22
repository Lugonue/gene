// PlayerView — только то, что игрок видит или помнит. Полная карта, невидимые монстры
// и точные характеристики неизученных типов предметов сюда не попадают.
import {
  BIONIC_FAILURE_LABEL,
  DAMAGE_TYPE_LABELS,
  FACTIONS,
  ITEMS,
  MONSTERS,
  PHENOMENA,
  ROLE_LABELS,
  SKILLS,
  SKILL_IDS,
  SLOTS,
  WOUND_LABELS,
  phenomenonName,
  type ItemCategory,
  type Material,
  type PhenomenonId,
  type SkillId,
  type SlotId,
  type WoundStage,
} from '@gene/data'
import { isEquipped, partDef, skillLevel, slotsOf } from './body'
import {
  durabilityEfficiency,
  fovRadius,
  phenomenonStatusFor,
  studyStatusFor,
  xpForSkillLevel,
  MAX_SKILL,
  PHENOMENON_THRESHOLDS,
  STUDY_THRESHOLDS,
} from './combat/formulas'
import { computeFov } from './world/fov'
import {
  cellIndex,
  speciesOf,
  player,
  type BodyPartState,
  type Creature,
  type GameState,
  type GameStatus,
  type ItemInstance,
  type PhenomenonRecord,
  type Pos,
  type StudyStatus,
} from './state'

export const INVENTORY_LETTERS = 'abcdefghijklmnopqrst'

export interface PartView {
  id: string
  name: string
  material: Material
  wound: WoundStage
  /** Название стадии с учётом материала. */
  label: string
  hp: number
  maxHp: number
}

export interface VisiblePartView {
  id: string
  name: string
  material: Material
  wound: WoundStage
  label: string
}

export interface MonsterView {
  id: string
  kind: string
  name: string
  glyph: string
  color: string
  x: number
  y: number
  /** Грубая оценка общего состояния: 0 — при смерти … 4 — невредим. */
  health: number
  parts: VisiblePartView[]
  fleeing: boolean
}

export interface ItemStatsView {
  damage?: string
  accuracy?: string
  absorb?: string
  maxDurability?: string
  damageType?: string
  skill?: string
  /** Дальность оружия дальнего боя. */
  range?: string
  /** Боеприпас (название) для метателя снарядов. */
  ammo?: string
  twoHanded?: boolean
}

export interface ItemView {
  id: string
  defId: string
  letter?: string
  name: string
  glyph: string
  color: string
  category: ItemCategory
  count?: number
  equippedSlot?: SlotId
  status: StudyStatus
  /** Отображение прочности с учётом изученности: «34/40», «~35/~40», «~70%». */
  durabilityText?: string
  /** Ступень эффективности: 4 — 100%, 3 — 85%, 2 — 65%, 1 — 40%, 0 — сломан. */
  effTier?: number
  stats: ItemStatsView
}

export interface FloorItemView {
  x: number
  y: number
  glyph: string
  color: string
  name: string
  count: number
}

export interface SkillView {
  id: SkillId
  name: string
  group: 'weapon' | 'armour' | 'general'
  level: number
  /** Прогресс до следующего уровня, 0..1. */
  progress: number
}

export interface ItemTypeView {
  defId: string
  name: string
  category: ItemCategory
  status: StudyStatus
  /** Прогресс изучения, 0..1. */
  progress: number
}

/** Явление в базе знаний. Ключ — номер обнаружения: id раскрыл бы настоящее название. */
export interface PhenomenonView {
  n: number
  /** Имя по стадии: условное, с оценкой или настоящее. */
  name: string
  status: StudyStatus
  /** Прогресс до открытия рецепта, 0..1. */
  progress: number
  /** Открытый рецепт (только у изученного явления). */
  recipe?: { name: string; description: string }
}

/** Встреченный вид монстра. Изученности видов нет. */
export interface SpeciesView {
  kind: string
  name: string
  glyph: string
  color: string
  /** Роль в отряде (подпись). */
  role: string
}

/** Бестиарий: встреченные виды фракции в порядке встречи. */
export interface BestiaryFactionView {
  faction: string
  species: SpeciesView[]
}

export interface EquipmentSlotView {
  slot: SlotId
  slotName: string
  item?: ItemView
}

export interface PlayerView {
  status: GameStatus
  depth: number
  turn: number
  map: {
    width: number
    height: number
    /** Символ клетки или ' ' для неизвестной. */
    tiles: string
    /** '2' — видна сейчас, '1' — запомнена, '0' — неизвестна. */
    vis: string
  }
  monsters: MonsterView[]
  floorItems: FloorItemView[]
  player: {
    name: string
    x: number
    y: number
    hp: number
    maxHp: number
    bodyPlan: string
    fovRadius: number
    parts: PartView[]
  }
  inventory: ItemView[]
  equipment: EquipmentSlotView[]
  /** Предметы на клетке игрока. */
  here: ItemView[]
  skills: SkillView[]
  itemTypes: ItemTypeView[]
  /** Явления в порядке обнаружения. */
  phenomena: PhenomenonView[]
  /** Встреченные виды по фракциям; фракции — по глубине. */
  bestiary: BestiaryFactionView[]
}

export function woundLabel(part: BodyPartState): string {
  if (part.material === 'bionic' && part.hp <= 0 && part.wound !== 'severed') return BIONIC_FAILURE_LABEL
  return WOUND_LABELS[part.material][part.wound]
}

export function studyStatus(state: GameState, defId: string): StudyStatus {
  const def = ITEMS[defId]
  if (!def || def.category === 'consumable') return 'known'
  return studyStatusFor(state.knowledge.itemData[defId] ?? 0)
}

function effTier(item: ItemInstance): number {
  const eff = durabilityEfficiency(item)
  if (eff >= 1) return 4
  if (eff >= 0.85) return 3
  if (eff >= 0.65) return 2
  if (eff > 0) return 1
  return 0
}

const approx10 = (v: number): number => Math.round(v / 10) * 10
const approx5 = (v: number): number => Math.round(v / 5) * 5
function range(v: number): string {
  const lo = Math.floor(v * 0.75)
  const hi = Math.ceil(v * 1.25)
  return lo === hi ? `~${v}` : `${lo}–${hi}`
}

export function itemView(state: GameState, inst: ItemInstance, owner?: Creature): ItemView {
  const def = ITEMS[inst.defId]
  if (!def) throw new Error(`неизвестный предмет ${inst.defId}`)
  const status = studyStatus(state, inst.defId)
  const view: ItemView = {
    id: inst.id,
    defId: def.id,
    name: def.name.nom,
    glyph: def.glyph,
    color: def.color,
    category: def.category,
    status,
    stats: {},
  }
  if (inst.count !== undefined && inst.count > 1) view.count = inst.count
  if (owner) {
    const idx = owner.inventory.indexOf(inst.id)
    if (idx >= 0) view.letter = INVENTORY_LETTERS[idx]
    const slot = isEquipped(owner, inst.id)
    if (slot) view.equippedSlot = slot
  }
  if (def.category === 'consumable') return view

  const cur = inst.durability ?? 0
  const max = inst.maxDurability ?? 0
  view.effTier = effTier(inst)
  const hidden = '??'
  if (status === 'known') {
    view.durabilityText = `${cur}/${max}`
    view.stats.maxDurability = String(max)
  } else if (status === 'partial') {
    view.durabilityText = `~${approx5(cur)}/~${approx10(max)}`
    view.stats.maxDurability = `~${approx10(max)}`
  } else {
    view.durabilityText = `~${max > 0 ? approx10((cur / max) * 100) : 0}%`
    view.stats.maxDurability = hidden
  }

  if (def.category === 'weapon') {
    view.stats.damageType = DAMAGE_TYPE_LABELS[def.damageType]
    view.stats.skill = SKILLS[def.skill].name
    view.stats.damage = status === 'known' ? String(def.damage) : status === 'partial' ? range(def.damage) : hidden
    view.stats.accuracy =
      status === 'known' ? signed(def.accuracy) : status === 'partial' ? `~${signed(def.accuracy)}` : hidden
    if (def.ranged) {
      view.stats.range = String(def.ranged.range)
      const ammo = def.ranged.ammo ? ITEMS[def.ranged.ammo] : undefined
      if (ammo) view.stats.ammo = ammo.name.nom
    }
    if (def.twoHanded) view.stats.twoHanded = true
  } else {
    view.stats.skill = SKILLS[def.skill].name
    view.stats.absorb = status === 'known' ? String(def.absorb) : status === 'partial' ? range(def.absorb) : hidden
  }
  return view
}

function signed(v: number): string {
  return v > 0 ? `+${v}` : String(v)
}

function monsterHealth(c: Creature): number {
  const f = c.hp / c.maxHp
  if (f >= 1) return 4
  if (f > 0.66) return 3
  if (f > 0.33) return 2
  if (f > 0.1) return 1
  return 0
}

export function buildView(state: GameState): PlayerView {
  const p = player(state)
  const level = state.levels[p.depth]!
  const visible = computeFov(level, p.x, p.y, fovRadius(p))

  const vis = new Array<string>(level.width * level.height)
  const tiles = new Array<string>(level.width * level.height)
  for (let i = 0; i < vis.length; i++) {
    if (visible.has(i)) {
      vis[i] = '2'
      tiles[i] = level.tiles[i] as string
    } else if (level.memory[i] !== ' ') {
      vis[i] = '1'
      tiles[i] = level.memory[i] as string
    } else {
      vis[i] = '0'
      tiles[i] = ' '
    }
  }

  const monsters: MonsterView[] = []
  for (const c of Object.values(state.creatures)) {
    if (c.kind === 'player' || c.depth !== p.depth) continue
    if (!visible.has(c.y * level.width + c.x)) continue
    const def = speciesOf(c)
    if (!def) continue
    monsters.push({
      id: c.id,
      kind: c.kind,
      name: def.name.nom,
      glyph: def.glyph,
      color: def.color,
      x: c.x,
      y: c.y,
      health: monsterHealth(c),
      fleeing: c.ai?.mode === 'flee',
      parts: c.parts.map((part) => ({
        id: part.defId,
        name: partDef(c, part).name.nom,
        material: part.material,
        wound: part.wound,
        label: woundLabel(part),
      })),
    })
  }

  const floorMap = new Map<number, FloorItemView>()
  for (const it of Object.values(state.items)) {
    if (it.loc.kind !== 'floor' || it.loc.depth !== p.depth) continue
    const idx = it.loc.y * level.width + it.loc.x
    if (!visible.has(idx)) continue
    const def = ITEMS[it.defId]
    if (!def) continue
    const existing = floorMap.get(idx)
    if (existing) existing.count += it.count ?? 1
    else floorMap.set(idx, { x: it.loc.x, y: it.loc.y, glyph: def.glyph, color: def.color, name: def.name.nom, count: it.count ?? 1 })
  }

  const inventory = p.inventory
    .map((id) => state.items[id])
    .filter((i): i is ItemInstance => !!i)
    .map((i) => itemView(state, i, p))

  const equipment: EquipmentSlotView[] = slotsOf(p).map((slot) => {
    const id = p.equipment[slot]
    const inst = id ? state.items[id] : undefined
    return { slot, slotName: SLOTS[slot].name, ...(inst ? { item: itemView(state, inst, p) } : {}) }
  })

  const here = Object.values(state.items)
    .filter((i) => i.loc.kind === 'floor' && i.loc.depth === p.depth && i.loc.x === p.x && i.loc.y === p.y)
    .map((i) => itemView(state, i))

  const skills: SkillView[] = SKILL_IDS.map((id) => {
    const xp = state.knowledge.skillXp[id] ?? 0
    const lvl = skillLevel(state, p, id)
    const lo = xpForSkillLevel(lvl)
    const hi = xpForSkillLevel(lvl + 1)
    return {
      id,
      name: SKILLS[id].name,
      group: SKILLS[id].group,
      level: lvl,
      progress: lvl >= MAX_SKILL ? 1 : Math.min(1, (xp - lo) / (hi - lo)),
    }
  })

  const itemTypes: ItemTypeView[] = Object.entries(state.knowledge.itemData).map(([defId, data]) => {
    const def = ITEMS[defId]!
    return {
      defId,
      name: def.name.nom,
      category: def.category,
      status: studyStatusFor(data),
      progress: Math.min(1, data / STUDY_THRESHOLDS.known),
    }
  })

  const phenomena: PhenomenonView[] = (
    Object.entries(state.knowledge.phenomena ?? {}) as [PhenomenonId, PhenomenonRecord][]
  )
    .map(([id, { data, n }]) => {
      const status = phenomenonStatusFor(data)
      const view: PhenomenonView = {
        n,
        name: phenomenonName(id, n, status),
        status,
        progress: Math.min(1, data / PHENOMENON_THRESHOLDS.known),
      }
      if (status === 'known') view.recipe = { ...PHENOMENA[id].recipe }
      return view
    })
    .sort((a, b) => a.n - b.n)

  const seen = (state.knowledge.species ?? []).flatMap((kind) => MONSTERS[kind] ?? [])
  const bestiary: BestiaryFactionView[] = Object.values(FACTIONS)
    .sort((a, b) => a.depth - b.depth)
    .map((f) => ({
      faction: f.name,
      species: seen
        .filter((def) => def.faction === f.id)
        .map((def) => ({ kind: def.id, name: def.name.nom, glyph: def.glyph, color: def.color, role: ROLE_LABELS[def.role] })),
    }))
    .filter((f) => f.species.length > 0)

  return {
    status: state.status,
    depth: p.depth,
    turn: state.turn,
    map: { width: level.width, height: level.height, tiles: tiles.join(''), vis: vis.join('') },
    monsters,
    floorItems: [...floorMap.values()],
    player: {
      name: p.name ?? '',
      x: p.x,
      y: p.y,
      hp: p.hp,
      maxHp: p.maxHp,
      bodyPlan: p.bodyPlan,
      fovRadius: fovRadius(p),
      parts: p.parts.map((part) => ({
        id: part.defId,
        name: partDef(p, part).name.nom,
        material: part.material,
        wound: part.wound,
        label: woundLabel(part),
        hp: part.hp,
        maxHp: part.maxHp,
      })),
    },
    inventory,
    equipment,
    here,
    skills,
    itemTypes,
    phenomena,
    bestiary,
  }
}

/** Видимые игроку клетки (для серверных проверок и ИИ). */
export function playerVisibleCells(state: GameState): Set<number> {
  const p = player(state)
  const level = state.levels[p.depth]!
  return computeFov(level, p.x, p.y, fovRadius(p))
}

/** Видит ли игрок хоть одну из клеток cells уровня depth. */
export function playerSeesAny(state: GameState, depth: number, cells: Pos[]): boolean {
  if (player(state).depth !== depth) return false
  const level = state.levels[depth]!
  const visible = playerVisibleCells(state)
  return cells.some((q) => visible.has(cellIndex(level, q)))
}
