// Игровое состояние. Обычный JSON-совместимый объект: без классов, без циклов, ссылки — по id.
import type { Material, SkillId, SlotId, WoundStage } from '@gene/data'
import type { RngState } from './rng'

export const MAP_WIDTH = 80
export const MAP_HEIGHT = 40
export const MAX_DEPTH = 3
export const INVENTORY_SIZE = 20

export interface Pos {
  x: number
  y: number
}

/** Символы клеток карты. */
export const TILE = {
  wall: '#',
  floor: '.',
  doorClosed: '+',
  doorOpen: "'",
  stairsUp: '<',
  stairsDown: '>',
  portal: 'Ω',
} as const
export type Tile = (typeof TILE)[keyof typeof TILE]

export interface LevelState {
  depth: number
  width: number
  height: number
  /** Клетки построчно, один символ на клетку. */
  tiles: string
  /** Запомненные игроком клетки: ' ' — неизвестна, иначе символ клетки на момент последнего наблюдения. */
  memory: string
}

export interface BionicUpgrades {
  strength: number
  precision: number
  mobility: number
  sensors: number
  plating: number
}

export interface BodyPartState {
  defId: string
  material: Material
  hp: number
  maxHp: number
  wound: WoundStage
  /** Органическая часть, дошедшая до crippled: сама не лечится выше wounded без перевязки. */
  needsTreatment?: boolean
  upgrades?: BionicUpgrades
}

export type AiMode = 'idle' | 'hunt' | 'flee'

export interface Creature {
  id: string
  /** 'player' или id из MONSTERS. */
  kind: string
  name?: string
  depth: number
  x: number
  y: number
  hp: number
  maxHp: number
  bodyPlan: string
  parts: BodyPartState[]
  /** Занятые слоты → id предмета. */
  equipment: Partial<Record<SlotId, string>>
  /** Носимые предметы (включая надетые), порядок = буквы инвентаря у игрока. */
  inventory: string[]
  /** Время (aut), когда существо ходит в следующий раз. */
  nextActAt: number
  /** Накопленное время для регенерации. */
  regenAcc: number
  ai?: { mode: AiMode; lastSeen?: Pos; noticed?: boolean }
}

export type ItemLocation =
  | { kind: 'floor'; depth: number; x: number; y: number }
  | { kind: 'carried'; owner: string }

export interface ItemInstance {
  id: string
  defId: string
  /** Для снаряжения. */
  durability?: number
  maxDurability?: number
  /** Для расходников (складываются в стопку). */
  count?: number
  loc: ItemLocation
}

export type StudyStatus = 'unknown' | 'partial' | 'known'

/** База знаний ядра (навыки и изученность типов предметов). */
export interface Knowledge {
  skillXp: Record<SkillId, number>
  /** Данные об изучаемых типах предметов: id типа → накопленные данные. */
  itemData: Record<string, number>
  /** Использование навыков с последнего убийства — для распределения опыта за убийство. */
  recentUse: Partial<Record<SkillId, number>>
}

export type GameStatus = 'active' | 'dead' | 'won'

export interface GameState {
  version: 1
  seed: number
  rng: RngState
  status: GameStatus
  /** Количество действий игрока. */
  turn: number
  /** Текущее игровое время (aut). */
  now: number
  depth: number
  levels: Record<number, LevelState>
  creatures: Record<string, Creature>
  items: Record<string, ItemInstance>
  playerId: string
  nextId: number
  knowledge: Knowledge
  /** Причина смерти (id типа монстра), для итогов. */
  killedBy?: string
  maxDepthReached: number
}

export type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export const DIRS: Record<Dir, Pos> = {
  n: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
  ne: { x: 1, y: -1 },
  nw: { x: -1, y: -1 },
  se: { x: 1, y: 1 },
  sw: { x: -1, y: 1 },
}

export type Command =
  | { type: 'move'; dir: Dir }
  | { type: 'wait' }
  | { type: 'rest' }
  | { type: 'pickup' }
  | { type: 'drop'; itemId: string }
  | { type: 'equip'; itemId: string; slot?: SlotId }
  | { type: 'unequip'; slot: SlotId }
  | { type: 'use'; itemId: string; targetPartId?: string; targetItemId?: string }
  | { type: 'disassemble'; itemId: string }
  | { type: 'stairsDown' }
  | { type: 'stairsUp' }

export function player(state: GameState): Creature {
  const p = state.creatures[state.playerId]
  if (!p) throw new Error('нет игрока в состоянии')
  return p
}

export function newId(state: GameState, prefix: string): string {
  return `${prefix}${state.nextId++}`
}

export function tileAt(level: LevelState, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return TILE.wall
  return level.tiles[y * level.width + x] as string
}

export function setTile(level: LevelState, x: number, y: number, t: string): void {
  const i = y * level.width + x
  level.tiles = level.tiles.slice(0, i) + t + level.tiles.slice(i + 1)
}

export function creaturesOnLevel(state: GameState, depth: number): Creature[] {
  return Object.values(state.creatures).filter((c) => c.depth === depth)
}

export function creatureAt(state: GameState, depth: number, x: number, y: number): Creature | undefined {
  for (const c of Object.values(state.creatures)) if (c.depth === depth && c.x === x && c.y === y) return c
  return undefined
}

export function itemsAt(state: GameState, depth: number, x: number, y: number): ItemInstance[] {
  return Object.values(state.items).filter(
    (i) => i.loc.kind === 'floor' && i.loc.depth === depth && i.loc.x === x && i.loc.y === y,
  )
}
