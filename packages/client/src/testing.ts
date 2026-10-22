// Фикстуры представления для тестов клиента: собираются вручную, без логики @gene/core (клиент берёт из ядра только типы).
import type { ItemView, PartView, PlayerView } from '@gene/core'

export function part(id: string, over: Partial<PartView> = {}): PartView {
  return {
    id,
    name: id,
    material: 'organic',
    wound: 'none',
    label: 'цела',
    hp: 10,
    maxHp: 10,
    damaged: false,
    ...over,
  }
}

export function item(id: string, defId: string, over: Partial<ItemView> = {}): ItemView {
  return {
    id,
    defId,
    name: defId,
    glyph: '?',
    color: '#ffffff',
    category: 'consumable',
    status: 'known',
    stats: {},
    ...over,
  }
}

/** Здоровый игрок с бинтом, зельем и ремкомплектом в инвентаре. */
export function viewFixture(over: { parts?: PartView[]; inventory?: ItemView[]; fullHealth?: boolean } = {}): PlayerView {
  return {
    status: 'active',
    depth: 1,
    turn: 7,
    map: { width: 1, height: 1, tiles: '.', vis: '2' },
    monsters: [],
    floorItems: [],
    player: {
      name: 'Тест',
      x: 0,
      y: 0,
      hp: 30,
      maxHp: 30,
      bodyPlan: 'humanoid',
      fovRadius: 8,
      fullHealth: over.fullHealth ?? true,
      parts: over.parts ?? [part('head'), part('torso')],
    },
    inventory: over.inventory ?? [
      item('i1', 'bandage', { letter: 'a' }),
      item('i2', 'heal_potion', { letter: 'b' }),
      item('i3', 'repair_kit', { letter: 'c' }),
    ],
    equipment: [],
    here: [],
    skills: [],
    itemTypes: [],
    phenomena: [],
    bestiary: [],
  }
}
