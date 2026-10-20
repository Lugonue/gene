import { describe, expect, it } from 'vitest'
import { applyCommand } from './game'
import { createItem } from './items'
import { spawnMonster } from './monsters'
import { MAP_HEIGHT, MAP_WIDTH, TILE, player, type Command, type GameState } from './state'
import { newTestGame } from './testing'

/**
 * Партия на искусственной карте: строки рисуют левый верхний угол уровня, остальное — стена.
 * '@' — игрок. Монстры и предметы на полу убираются, память карты — по полю зрения.
 */
function onMap(rows: string[]): GameState {
  const s = newTestGame(7)
  const p = player(s)
  const tiles = new Array<string>(MAP_WIDTH * MAP_HEIGHT).fill(TILE.wall)
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '@') {
        p.x = x
        p.y = y
        ch = TILE.floor
      }
      tiles[y * MAP_WIDTH + x] = ch
    }),
  )
  const level = s.levels[1]!
  level.tiles = tiles.join('')
  level.memory = ' '.repeat(MAP_WIDTH * MAP_HEIGHT)
  for (const c of Object.values(s.creatures)) if (c.id !== p.id) delete s.creatures[c.id]
  for (const it of Object.values(s.items)) if (it.loc.kind === 'floor') delete s.items[it.id]
  // Ход ожидания обновляет память карты по полю зрения.
  return applyCommand(s, { type: 'wait' }).state
}

const CORRIDOR = '#' + '.'.repeat(40) + '#'

function apply(s: GameState, cmd: Command): ReturnType<typeof applyCommand> {
  return applyCommand(s, cmd)
}

describe('автоисследование', () => {
  it('идёт по коридору до конца, присылает кадры, затем «исследовать нечего»', () => {
    const s = onMap(['#'.repeat(42), '#@' + '.'.repeat(39) + '#', '#'.repeat(42)])
    const r = apply(s, { type: 'explore' })
    const p = player(r.state)
    expect(p.x).toBeGreaterThan(30)
    expect(r.events.some((e) => e.type === 'exploreFinished')).toBe(true)
    expect(r.frames?.length).toBe(p.x - 1)
    expect(r.frames!.at(-1)).toMatchObject({ x: p.x, y: p.y })
    expect(r.state.turn).toBe(s.turn + r.frames!.length)

    const again = apply(r.state, { type: 'explore' })
    expect(again.events).toEqual([{ type: 'commandRejected', reason: 'nothingToExplore' }])
  })

  it('останавливается, впервые заметив предмет; повторно его не замечает и молчит о нём под ногами', () => {
    let s = onMap(['#'.repeat(42), '#@' + '.'.repeat(39) + '#', '#'.repeat(42)])
    createItem(s, 'bandage', { kind: 'floor', depth: 1, x: 20, y: 1 })
    let r = apply(s, { type: 'explore' })
    expect(r.events.filter((e) => e.type === 'itemsNoticed')).toEqual([{ type: 'itemsNoticed', itemDefIds: ['bandage'] }])
    expect(r.events.some((e) => e.type === 'exploreFinished')).toBe(false)
    const stopX = player(r.state).x
    expect(stopX).toBeLessThan(20)

    s = r.state
    r = apply(s, { type: 'explore' })
    expect(player(r.state).x).toBeGreaterThan(20)
    expect(r.events.some((e) => e.type === 'itemsNoticed' || e.type === 'itemsHere')).toBe(false)
  })

  it('открывает закрытую дверь и останавливается', () => {
    const s = onMap(['#'.repeat(42), '#@....+' + '.'.repeat(34) + '#', '#'.repeat(42)])
    const r = apply(s, { type: 'explore' })
    expect(r.events.some((e) => e.type === 'doorOpened')).toBe(true)
    expect(player(r.state).x).toBe(5)
    expect(r.state.levels[1]!.tiles[1 * MAP_WIDTH + 6]).toBe(TILE.doorOpen)
  })

  it('останавливается, заметив лестницу, и не останавливается на уже известной', () => {
    const s = onMap(['#'.repeat(42), '#@' + '.'.repeat(19) + '>' + '.'.repeat(19) + '#', '#'.repeat(42)])
    const r = apply(s, { type: 'explore' })
    expect(r.events).toContainEqual({ type: 'featureNoticed', feature: 'stairsDown' })
    const r2 = apply(r.state, { type: 'explore' })
    expect(r2.events.some((e) => e.type === 'featureNoticed')).toBe(false)
    expect(player(r2.state).x).toBeGreaterThan(21)
  })

  it('отклоняется, если монстр в поле зрения; останавливается, когда монстр появляется', () => {
    let s = onMap(['#'.repeat(42), '#@' + '.'.repeat(39) + '#', '#'.repeat(42)])
    spawnMonster(s, 'hyena', 1, 5, 1)
    s = applyCommand(s, { type: 'wait' }).state
    expect(apply(s, { type: 'explore' }).events).toEqual([{ type: 'commandRejected', reason: 'blocked' }])

    s = onMap(['#'.repeat(42), '#@' + '.'.repeat(39) + '#', '#'.repeat(42)])
    const m = spawnMonster(s, 'hyena', 1, 30, 1)
    const r = apply(s, { type: 'explore' })
    expect(r.events.some((e) => e.type === 'monsterNoticed')).toBe(true)
    expect(player(r.state).x).toBeLessThan(r.state.creatures[m.id]!.x)
  })

  it('уже открытая карта без неизвестных краёв — исследовать нечего', () => {
    const s = onMap(['####', '#@.#', '####'])
    expect(apply(s, { type: 'explore' }).events).toEqual([{ type: 'commandRejected', reason: 'nothingToExplore' }])
  })
})

describe('бег', () => {
  it('бежит по прямой до стены', () => {
    const s = onMap(['#'.repeat(42), '#@' + '.'.repeat(39) + '#', '#'.repeat(42)])
    const r = apply(s, { type: 'run', dir: 'e' })
    expect(player(r.state).x).toBe(40)
    expect(r.frames?.length).toBe(39)
  })

  it('в стену сразу — отказ', () => {
    const s = onMap([CORRIDOR.replace('.', '@')])
    expect(apply(s, { type: 'run', dir: 'w' }).events).toEqual([{ type: 'commandRejected', reason: 'blocked' }])
  })

  it('останавливается на тех же условиях: новый предмет', () => {
    const s = onMap(['#'.repeat(42), '#@' + '.'.repeat(39) + '#', '#'.repeat(42)])
    createItem(s, 'bandage', { kind: 'floor', depth: 1, x: 25, y: 1 })
    const r = apply(s, { type: 'run', dir: 'e' })
    expect(r.events.some((e) => e.type === 'itemsNoticed')).toBe(true)
    expect(player(r.state).x).toBeLessThan(25)
  })

  it('некорректное направление — отказ', () => {
    const s = onMap(['#'.repeat(42), '#@' + '.'.repeat(39) + '#', '#'.repeat(42)])
    expect(apply(s, { type: 'run', dir: 'up' as never }).events).toEqual([{ type: 'commandRejected', reason: 'invalid' }])
  })
})

describe('замечание объектов', () => {
  it('выброшенный игроком предмет не считается новым', () => {
    const s = onMap(['#'.repeat(42), '#@' + '.'.repeat(39) + '#', '#'.repeat(42)])
    const itemId = player(s).inventory.find((id) => s.items[id]?.defId === 'bandage')!
    const r = apply(s, { type: 'drop', itemId })
    expect(r.events.some((e) => e.type === 'itemsNoticed')).toBe(false)
  })
})
