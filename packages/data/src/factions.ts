import type { FactionDef, FactionId, MonsterRole, RoleGearDef } from './types'

export const MONSTER_ROLES: MonsterRole[] = ['warrior', 'archer', 'mage', 'beast', 'leader']

/**
 * Снаряжение по ролям. Стрелки до появления дальнего боя (задача 03) берут короткий клинок,
 * маги — посох; звери снаряжения не носят.
 */
export const ROLE_GEAR: Record<MonsterRole, RoleGearDef> = {
  warrior: { weaponSkills: ['short_blades', 'long_blades', 'maces', 'axes'], armourChance: 0.6 },
  archer: { weaponSkills: ['short_blades'], armourChance: 0.35 },
  mage: { weaponSkills: ['staves'], armourChance: 0.15 },
  beast: { weaponSkills: [], armourChance: 0 },
  leader: { weaponSkills: ['long_blades', 'maces', 'axes'], armourChance: 0.9 },
}

/** Фракции по глубине: каждая занимает свой уровень целиком (docs/lore.md). */
export const FACTIONS: Record<FactionId, FactionDef> = {
  goblins: {
    id: 'goblins',
    name: 'Гоблины',
    depth: 1,
    trait: 'cowardly',
    gear: ['dagger', 'short_sword', 'mace', 'staff', 'leather_jacket', 'leather_gloves', 'leather_boots'],
  },
  orcs: {
    id: 'orcs',
    name: 'Орки',
    depth: 2,
    trait: 'fearless',
    gear: ['dagger', 'axe', 'mace', 'staff', 'leather_jacket', 'chainmail', 'helmet', 'bracers', 'greaves'],
  },
  order: {
    id: 'order',
    name: 'Орден',
    depth: 3,
    trait: 'relentless',
    gear: ['dagger', 'short_sword', 'mace', 'staff', 'chainmail', 'helmet', 'leather_gloves', 'greaves'],
  },
  kobolds: {
    id: 'kobolds',
    name: 'Кобольды драконьего культа',
    depth: 4,
    trait: 'rallying',
    gear: ['dagger', 'short_sword', 'axe', 'staff', 'leather_jacket', 'chainmail', 'helmet', 'leather_boots'],
  },
}

export function factionForDepth(depth: number): FactionDef | undefined {
  return Object.values(FACTIONS).find((f) => f.depth === depth)
}
