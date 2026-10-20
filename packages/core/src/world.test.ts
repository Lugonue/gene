import { describe, expect, it } from 'vitest'
import { applyCommand } from './game'
import { MAP_HEIGHT, MAP_WIDTH, TILE, player, setTile, tileAt, type Command } from './state'
import { generateLevel } from './world/mapgen'
import { createRng } from './rng'
import { newTestGame, run, stairsPos, walkTo } from './testing'
import { buildView } from './view'
import { ensureLevel, findTile } from './world/level'
import { FACTIONS, MONSTERS } from '@gene/data'
import { levelThreatBudget } from './combat/formulas'
import { creatureThreat } from './world/squads'

describe('генерация уровней', () => {
  it('уровень 80×40, есть нужные лестницы и портал', () => {
    for (const depth of [1, 2, 3, 4]) {
      const gen = generateLevel(createRng(depth * 77), depth)
      expect(gen.level.tiles.length).toBe(MAP_WIDTH * MAP_HEIGHT)
      expect(gen.level.tiles.includes(TILE.stairsUp)).toBe(depth > 1)
      expect(gen.level.tiles.includes(TILE.stairsDown)).toBe(depth < 4)
      expect(gen.level.tiles.includes(TILE.portal)).toBe(depth === 4)
    }
  })

  it('одинаковый сид → одинаковая карта', () => {
    const a = generateLevel(createRng(5), 1)
    const b = generateLevel(createRng(5), 1)
    expect(a.level.tiles).toBe(b.level.tiles)
  })
})

describe('фракции на уровнях', () => {
  const monstersOn = (s: ReturnType<typeof newTestGame>, depth: number) =>
    Object.values(s.creatures).filter((c) => c.kind !== 'player' && c.depth === depth)

  it('на уровне N только виды фракции уровня N и ровно один вожак у лестницы вниз / портала', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = newTestGame(seed)
      for (const depth of [1, 2, 3, 4]) {
        ensureLevel(s, depth)
        const monsters = monstersOn(s, depth)
        expect(monsters.length).toBeGreaterThanOrEqual(6)
        for (const c of monsters) expect(FACTIONS[MONSTERS[c.kind]!.faction].depth, c.kind).toBe(depth)
        const leaders = monsters.filter((c) => MONSTERS[c.kind]!.role === 'leader')
        expect(leaders).toHaveLength(1)
        const exit = findTile(s, depth, depth === 4 ? TILE.portal : TILE.stairsDown)!
        expect(Math.max(Math.abs(leaders[0]!.x - exit.x), Math.abs(leaders[0]!.y - exit.y))).toBeLessThanOrEqual(10)
      }
    }
  })

  it('отряд стоит кучно, угроза уровня не превышает бюджет', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = newTestGame(seed)
      for (const depth of [1, 2, 3, 4]) {
        ensureLevel(s, depth)
        const monsters = monstersOn(s, depth)
        const threat = monsters.reduce((sum, c) => sum + creatureThreat(s, c), 0)
        expect(threat).toBeLessThanOrEqual(levelThreatBudget(depth))
        expect(threat).toBeGreaterThanOrEqual(levelThreatBudget(depth) * 0.85)
        expect(monsters.every((c) => c.squad !== undefined)).toBe(true)
        const squads = new Map<string | undefined, typeof monsters>()
        for (const c of monsters) squads.set(c.squad, [...(squads.get(c.squad) ?? []), c])
        expect(squads.size).toBeGreaterThan(1)
        for (const members of squads.values()) {
          // Каждый член отряда стоит вплотную хотя бы к одному другому (связная группа соседних клеток).
          const reached = new Set([members[0]!])
          for (let grew = true; grew; ) {
            grew = false
            for (const c of members) {
              if (reached.has(c)) continue
              if ([...reached].some((r) => Math.max(Math.abs(r.x - c.x), Math.abs(r.y - c.y)) === 1)) {
                reached.add(c)
                grew = true
              }
            }
          }
          expect(reached.size, members.map((c) => c.kind).join()).toBe(members.length)
        }
      }
    }
  })

  it('портал на 4-м уровне сторожит драконорождённый', () => {
    const s = newTestGame(9)
    ensureLevel(s, 4)
    expect(findTile(s, 4, TILE.portal)).toBeDefined()
    expect(monstersOn(s, 4).filter((c) => MONSTERS[c.kind]!.role === 'leader').map((c) => c.kind)).toEqual(['dragonborn'])
  })
})

describe('детерминизм', () => {
  it('одинаковый сид и команды → идентичное состояние', () => {
    const cmds: Command[] = []
    const dirs = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const
    for (let i = 0; i < 200; i++) cmds.push({ type: 'move', dir: dirs[(i * 7) % 8]! })
    const a = run(newTestGame(999), cmds)
    const b = run(newTestGame(999), cmds)
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state))
    expect(a.events).toEqual(b.events)
  })

  it('applyCommand не мутирует входное состояние', () => {
    const s = newTestGame(3)
    const before = JSON.stringify(s)
    applyCommand(s, { type: 'wait' })
    applyCommand(s, { type: 'move', dir: 'e' })
    expect(JSON.stringify(s)).toBe(before)
  })
})

describe('движение', () => {
  it('в стену нельзя: команда отклоняется, ход не тратится', () => {
    const s = newTestGame(42)
    const p = player(s)
    const level = s.levels[1]!
    setTile(level, p.x + 1, p.y, TILE.wall)
    const r = applyCommand(s, { type: 'move', dir: 'e' })
    expect(r.events).toEqual([{ type: 'commandRejected', reason: 'blocked' }])
    expect(r.state).toBe(s)
    expect(r.state.turn).toBe(0)
  })

  it('дверь открывается движением, игрок остаётся на месте', () => {
    const s = newTestGame(42)
    const p = player(s)
    const level = s.levels[1]!
    setTile(level, p.x + 1, p.y, TILE.doorClosed)
    const r = applyCommand(s, { type: 'move', dir: 'e' })
    expect(r.events).toContainEqual({ type: 'doorOpened' })
    expect(tileAt(r.state.levels[1]!, p.x + 1, p.y)).toBe(TILE.doorOpen)
    expect(player(r.state).x).toBe(p.x)
    const r2 = applyCommand(r.state, { type: 'move', dir: 'e' })
    expect(player(r2.state).x).toBe(p.x + 1)
  })

  it('лестница вниз не там, где её нет', () => {
    const s = newTestGame(42)
    const r = applyCommand(s, { type: 'stairsDown' })
    expect(r.events).toEqual([{ type: 'commandRejected', reason: 'noStairs' }])
  })
})

describe('валидация команд', () => {
  it('некорректные и враждебные команды отклоняются, состояние не меняется', () => {
    const s = newTestGame(77)
    const bad = [
      { type: 'move', dir: '__proto__' },
      { type: 'move', dir: 'toString' },
      { type: 'move', dir: 42 },
      { type: 'move' },
      { type: 'unequip', slot: '__proto__' },
      { type: 'unequip', slot: 'constructor' },
      { type: 'equip', itemId: '__proto__', slot: 'weapon' },
      { type: 'use', itemId: { x: 1 } },
      { type: 'drop', itemId: 'nope' },
      { type: 'disassemble' },
      { type: 'teleport' },
      null,
      'move',
    ] as unknown as Command[]
    const before = JSON.stringify(s)
    for (const cmd of bad) {
      const r = applyCommand(s, cmd)
      expect(r.state).toBe(s)
      expect(r.events[0]).toMatchObject({ type: 'commandRejected' })
    }
    expect(JSON.stringify(s)).toBe(before)
  })
})

describe('уровни', () => {
  it('спуск на 4 уровня, подъём обратно и вход в портал', () => {
    let s = newTestGame(2024)
    // Монстров убираем, чтобы проверять только перемещение.
    const clear = (): void => {
      for (const id of Object.keys(s.creatures)) if (id !== s.playerId) delete s.creatures[id]
    }
    clear()
    s = walkTo(s, stairsPos(s, TILE.stairsDown)).state
    s = applyCommand(s, { type: 'stairsDown' }).state
    expect(player(s).depth).toBe(2)
    expect(s.levels[2]).toBeDefined()
    expect(tileAt(s.levels[2]!, player(s).x, player(s).y)).toBe(TILE.stairsUp)

    // Подъём — тот же сохранённый уровень 1, игрок на лестнице вниз.
    const level1 = s.levels[1]!.tiles
    const up = applyCommand(s, { type: 'stairsUp' }).state
    expect(player(up).depth).toBe(1)
    expect(up.levels[1]!.tiles).toBe(level1)
    expect(tileAt(up.levels[1]!, player(up).x, player(up).y)).toBe(TILE.stairsDown)

    clear()
    s = walkTo(s, stairsPos(s, TILE.stairsDown)).state
    s = applyCommand(s, { type: 'stairsDown' }).state
    expect(player(s).depth).toBe(3)
    clear()
    s = walkTo(s, stairsPos(s, TILE.stairsDown)).state
    s = applyCommand(s, { type: 'stairsDown' }).state
    expect(player(s).depth).toBe(4)
    clear()
    s = walkTo(s, stairsPos(s, TILE.portal)).state
    const won = applyCommand(s, { type: 'stairsDown' })
    expect(won.state.status).toBe('won')
    expect(won.events).toContainEqual({ type: 'gameWon' })
    const after = applyCommand(won.state, { type: 'wait' })
    expect(after.events).toEqual([{ type: 'commandRejected', reason: 'gameOver' }])
  })
})

describe('поле зрения', () => {
  it('view содержит только видимые и запомненные клетки', () => {
    const s = newTestGame(7)
    const v = buildView(s)
    const p = player(s)
    expect(v.map.vis[p.y * v.map.width + p.x]).toBe('2')
    const level = s.levels[1]!
    for (let i = 0; i < v.map.vis.length; i++) {
      if (v.map.vis[i] === '0') expect(v.map.tiles[i]).toBe(' ')
      else expect(v.map.tiles[i]).toBe(level.tiles[i])
    }
    // Не всё видно сразу.
    expect(v.map.vis.split('').filter((c) => c === '0').length).toBeGreaterThan(1000)
  })

  it('пройденные клетки запоминаются', () => {
    let s = newTestGame(7)
    s = walkTo(s, stairsPos(s, TILE.stairsDown)).state
    const remembered = s.levels[1]!.memory.split('').filter((c) => c !== ' ').length
    expect(remembered).toBeGreaterThan(100)
  })
})
