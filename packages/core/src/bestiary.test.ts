import { describe, expect, it } from 'vitest'
import { spawnMonster } from './monsters'
import { arenaGame, run } from './testing'
import { buildView } from './view'

const kinds = (s: Parameters<typeof buildView>[0]): string[] =>
  buildView(s).bestiary.flatMap((f) => f.species.map((x) => x.kind))

describe('бестиарий', () => {
  it('вид попадает в бестиарий при первом появлении в поле зрения, невидимый — нет', () => {
    const s = arenaGame(1)
    spawnMonster(s, 'goblin_brute', 1, 23, 20)
    spawnMonster(s, 'sorcerer', 1, 70, 35)
    const { state } = run(s, [{ type: 'wait' }])
    expect(kinds(state)).toEqual(['goblin_brute'])
  })

  it('виды сгруппированы по фракциям в порядке глубины, с ролью; вид остаётся после смерти монстра', () => {
    const s = arenaGame(1)
    const dog = spawnMonster(s, 'war_dog', 1, 23, 20)
    spawnMonster(s, 'hyena', 1, 17, 20)
    spawnMonster(s, 'goblin_shaman', 1, 20, 23)
    let { state } = run(s, [{ type: 'wait' }])
    delete state.creatures[dog.id]
    ;({ state } = run(state, [{ type: 'wait' }]))
    expect(buildView(state).bestiary).toEqual([
      {
        faction: 'Гоблины',
        species: [
          expect.objectContaining({ kind: 'hyena', name: 'гиена', role: 'зверь' }),
          expect.objectContaining({ kind: 'goblin_shaman', role: 'маг' }),
        ],
      },
      { faction: 'Орден', species: [expect.objectContaining({ kind: 'war_dog', role: 'зверь' })] },
    ])
  })
})
