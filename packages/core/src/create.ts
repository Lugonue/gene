// Создание новой партии.
import { BODY_PLANS, CYBORG_CONFIGS, ITEMS, SKILL_IDS, START_KIT, START_WEAPONS, type SkillId } from '@gene/data'
import { createRng } from './rng'
import {
  STARTING_SKILL_LEVELS,
  STUDY_THRESHOLDS,
  fovRadius,
  partMaxHp,
  xpForSkillLevel,
} from './combat/formulas'
import { createEquipped, createItem, giveItem } from './items'
import type { BodyPartState, Creature, GameState } from './state'
import { generateLevel } from './world/mapgen'
import { populateLevel } from './world/populate'
import { computeFov, rememberVisible } from './world/fov'

export interface NewGameOptions {
  name: string
  bodyPlan: string
  startWeapon: string
}

export function validateNewGame(opts: NewGameOptions): string | null {
  if (typeof opts.name !== 'string' || opts.name.trim().length === 0 || opts.name.length > 24)
    return 'Обозначение: от 1 до 24 символов'
  if (typeof opts.bodyPlan !== 'string' || !Object.hasOwn(CYBORG_CONFIGS, opts.bodyPlan))
    return 'Неизвестная конфигурация тела'
  if (!(START_WEAPONS as readonly string[]).includes(opts.startWeapon)) return 'Недопустимое стартовое оружие'
  return null
}

export function createGame(seed: number, opts: NewGameOptions): GameState {
  const err = validateNewGame(opts)
  if (err) throw new Error(err)
  const config = CYBORG_CONFIGS[opts.bodyPlan]!
  const plan = BODY_PLANS[config.bodyPlan]!

  const skillXp = Object.fromEntries(SKILL_IDS.map((s) => [s, 0])) as Record<SkillId, number>

  const state: GameState = {
    version: 1,
    seed,
    rng: createRng(seed),
    status: 'active',
    turn: 0,
    now: 0,
    depth: 1,
    levels: {},
    creatures: {},
    items: {},
    playerId: 'p',
    nextId: 1,
    knowledge: { skillXp, itemData: {}, recentUse: {} },
    maxDepthReached: 1,
  }

  const parts: BodyPartState[] = plan.parts.map((def) => {
    const material = config.materials[def.id] ?? 'organic'
    const maxHp = partMaxHp(def, material, config.partHpScale)
    const part: BodyPartState = { defId: def.id, material, hp: maxHp, maxHp, wound: 'none' }
    if (material === 'bionic') part.upgrades = { strength: 0, precision: 0, mobility: 0, sensors: 0, plating: 0 }
    return part
  })

  // Первый уровень генерируется до появления игрока, чтобы знать точку старта.
  const gen = generateLevel(state.rng, 1)
  state.levels[1] = gen.level

  const p: Creature = {
    id: state.playerId,
    kind: 'player',
    name: opts.name.trim(),
    depth: 1,
    x: gen.start.x,
    y: gen.start.y,
    hp: config.maxHp,
    maxHp: config.maxHp,
    bodyPlan: plan.id,
    parts,
    equipment: {},
    inventory: [],
    nextActAt: 0,
    regenAcc: 0,
  }
  state.creatures[p.id] = p

  // Стартовое снаряжение: выбранное оружие (тип изучен), кожаная куртка (тип изучен частично), расходники.
  createEquipped(state, p, opts.startWeapon)
  for (const { item, count } of START_KIT) {
    const def = ITEMS[item]
    if (def?.category === 'consumable') giveItem(state, p, createItem(state, item, { kind: 'carried', owner: p.id }, count))
    else for (let i = 0; i < count; i++) createEquipped(state, p, item)
  }
  const weaponDef = ITEMS[opts.startWeapon]
  state.knowledge.itemData[opts.startWeapon] = STUDY_THRESHOLDS.known
  state.knowledge.itemData.leather_jacket = STUDY_THRESHOLDS.partial
  if (weaponDef?.category === 'weapon') skillXp[weaponDef.skill] = xpForSkillLevel(STARTING_SKILL_LEVELS.weapon)
  skillXp.fighting = xpForSkillLevel(STARTING_SKILL_LEVELS.fighting)
  skillXp.dodging = xpForSkillLevel(STARTING_SKILL_LEVELS.dodging)

  populateLevel(state, gen)

  const level = state.levels[1]!
  rememberVisible(level, computeFov(level, p.x, p.y, fovRadius(p)))
  return state
}
