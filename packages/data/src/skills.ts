import type { SkillDef, SkillId } from './types'

export const SKILLS: Record<SkillId, SkillDef> = {
  short_blades: { id: 'short_blades', name: 'Короткие клинки', group: 'weapon' },
  long_blades: { id: 'long_blades', name: 'Длинные клинки', group: 'weapon' },
  maces: { id: 'maces', name: 'Булавы', group: 'weapon' },
  axes: { id: 'axes', name: 'Топоры', group: 'weapon' },
  staves: { id: 'staves', name: 'Посохи', group: 'weapon' },
  unarmed: { id: 'unarmed', name: 'Рукопашный бой', group: 'weapon' },
  light_armour: { id: 'light_armour', name: 'Лёгкая броня', group: 'armour' },
  heavy_armour: { id: 'heavy_armour', name: 'Тяжёлая броня', group: 'armour' },
  fighting: { id: 'fighting', name: 'Боевые алгоритмы', group: 'general' },
  dodging: { id: 'dodging', name: 'Уклонение', group: 'general' },
}

export const SKILL_IDS = Object.keys(SKILLS) as SkillId[]
