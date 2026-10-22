import { describe, expect, it } from 'vitest'
import type { SceneMoment } from '@gene/core'
import {
  SCENE_HEIGHT,
  SCENE_IDLE,
  SCENE_QUEUE_MAX,
  SCENE_WIDTH,
  enqueueScenes,
  loadSceneEnabled,
  nextScene,
  saveSceneEnabled,
  sceneFrames,
  turnScenes,
  type SceneState,
} from './scene'

const encounter: SceneMoment = { kind: 'encounter', seen: [{ species: 'hyena', threat: 2 }] }
const group: SceneMoment = {
  kind: 'encounter',
  seen: [
    { species: 'hyena', threat: 2 },
    { species: 'goblin_brute', threat: 4 },
    { species: 'goblin_brute', threat: 5 },
  ],
}
const strong: SceneMoment = { kind: 'strongHit', species: 'goblin_brute', byPlayer: true }
const death: SceneMoment = { kind: 'death', species: 'goblin_brute' }

describe('сцены хода', () => {
  it('из боевых моментов — самый важный (смерть > удар), встреча не теряется и идёт после', () => {
    expect(turnScenes([encounter, strong, death])).toEqual([death, encounter])
    expect(turnScenes([strong, encounter])).toEqual([strong, encounter])
    expect(turnScenes([encounter])).toEqual([encounter])
  })

  it('без моментов сцен нет', () => {
    expect(turnScenes([])).toEqual([])
    expect(turnScenes(undefined)).toEqual([])
  })
})

describe('очередь сцен', () => {
  it('новые сцены встают в конец и не перебивают ждущие', () => {
    expect(enqueueScenes([encounter], [death])).toEqual([encounter, death])
  })

  it('при переполнении первыми выпадают старые боевые сцены, встречи остаются', () => {
    const q = enqueueScenes([strong, encounter, death], [group])
    expect(q).toHaveLength(SCENE_QUEUE_MAX)
    expect(q).toEqual([encounter, death, group])
  })
})

describe('кадры', () => {
  it('у каждого момента есть кадры фиксированного размера — окно не скачет', () => {
    for (const m of [encounter, group, strong, death, { ...strong, byPlayer: false }]) {
      const frames = sceneFrames(m)
      expect(frames.length).toBeGreaterThan(1)
      for (const f of [...frames, SCENE_IDLE]) {
        expect(f.lines).toHaveLength(SCENE_HEIGHT)
        for (const l of f.lines) expect([...l].length).toBeLessThanOrEqual(SCENE_WIDTH)
      }
    }
  })

  it('встреча с одним видом показывает имя и угрозу', () => {
    const last = sceneFrames(encounter).at(-1)!.lines.join('\n')
    expect(last).toContain('гиена')
    expect(last).toContain('УГРОЗА ▮▮▯▯▯')
  })

  it('встреча с группой показывает все виды в одной карточке со шкалой угрозы', () => {
    const last = sceneFrames(group).at(-1)!
    const text = last.lines.join('\n')
    expect(text).toContain('НОВЫЕ ВИДЫ: 3')
    expect(text).toContain('гиена')
    expect(text).toContain('▮▮▮▮▮')
    expect(last.lineColors?.length).toBeGreaterThan(1)
  })

  it('слишком большая группа сворачивается в «…и ещё N»', () => {
    const many: SceneMoment = {
      kind: 'encounter',
      seen: Array.from({ length: 10 }, () => ({ species: 'hyena', threat: 1 as const })),
    }
    const last = sceneFrames(many).at(-1)!
    expect(last.lines).toHaveLength(SCENE_HEIGHT)
    expect(last.lines.join('\n')).toMatch(/…и ещё \d+/)
  })
})

describe('смена сцены после хода', () => {
  const start: SceneState = { queue: [], seq: 0, epoch: 0 }

  it('новые моменты добавляются в очередь и меняют seq', () => {
    const s1 = nextScene(start, [encounter], false)
    expect(s1).toEqual({ queue: [encounter], seq: 1, epoch: 0 })
    expect(nextScene(s1, [death], false)).toEqual({ queue: [encounter, death], seq: 2, epoch: 0 })
  })

  it('ход без моментов оставляет состояние как есть', () => {
    const s1 = nextScene(start, [encounter], false)
    expect(nextScene(s1, [], false)).toBe(s1)
  })

  it('полное обновление (переподключение) сбрасывает очередь, но счётчики только растут', () => {
    const s1 = nextScene(start, [encounter], false)
    const s2 = nextScene(s1, [death], true)
    expect(s2.queue).toEqual([death])
    expect(s2.seq).toBeGreaterThan(s1.seq)
    expect(s2.epoch).toBeGreaterThan(s1.epoch)
    const s3 = nextScene(s2, undefined, true)
    expect(s3.queue).toEqual([])
    expect(s3.seq).toBeGreaterThan(s2.seq)
  })
})
describe('переключатель панели', () => {
  function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
    const m = new Map<string, string>()
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }
  }

  it('по умолчанию включена; выключенная остаётся выключенной после перезагрузки', () => {
    const storage = memoryStorage()
    expect(loadSceneEnabled(storage)).toBe(true)
    saveSceneEnabled(storage, false)
    expect(loadSceneEnabled(storage)).toBe(false)
    saveSceneEnabled(storage, true)
    expect(loadSceneEnabled(storage)).toBe(true)
  })

  it('недоступное хранилище не ломает панель', () => {
    const broken = {
      getItem: (): string | null => {
        throw new Error('denied')
      },
      setItem: (): void => {
        throw new Error('denied')
      },
    }
    expect(loadSceneEnabled(broken)).toBe(true)
    expect(() => saveSceneEnabled(broken, false)).not.toThrow()
  })
})
