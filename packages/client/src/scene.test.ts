import { describe, expect, it } from 'vitest'
import type { SceneMoment } from '@gene/core'
import { loadSceneEnabled, nextScene, pickScene, saveSceneEnabled, sceneFrames, type SceneState } from './scene'

const encounter: SceneMoment = { kind: 'encounter', species: 'hyena' }
const strong: SceneMoment = { kind: 'strongHit', species: 'goblin_brute', byPlayer: true }
const death: SceneMoment = { kind: 'death', species: 'goblin_brute' }

describe('выбор сцены по моментам хода', () => {
  it('смерть важнее сильного удара, удар важнее встречи', () => {
    expect(pickScene([encounter, strong, death])).toEqual(death)
    expect(pickScene([encounter, strong])).toEqual(strong)
    expect(pickScene([encounter])).toEqual(encounter)
  })

  it('без моментов сцены нет', () => {
    expect(pickScene([])).toBeUndefined()
    expect(pickScene(undefined)).toBeUndefined()
  })

  it('у каждого момента есть кадры; встреча показывает имя вида', () => {
    for (const m of [encounter, strong, death, { ...strong, byPlayer: false }]) expect(sceneFrames(m).length).toBeGreaterThan(1)
    expect(sceneFrames(encounter).some((f) => f.lines.join('\n').includes('гиена'))).toBe(true)
  })
})

describe('смена сцены после хода', () => {
  const start: SceneState = { moment: null, seq: 0 }

  it('новый момент запускает новую сцену', () => {
    const s1 = nextScene(start, [encounter], false)
    expect(s1).toEqual({ moment: encounter, seq: 1 })
    expect(nextScene(s1, [death], false)).toEqual({ moment: death, seq: 2 })
  })

  it('ход без моментов оставляет сцену как есть', () => {
    const s1 = nextScene(start, [encounter], false)
    expect(nextScene(s1, [], false)).toBe(s1)
  })

  it('полное обновление (переподключение) не обнуляет счётчик: новая сцена всё равно сменяет старую', () => {
    const s1 = nextScene(start, [encounter], false)
    const s2 = nextScene(s1, [death], true)
    expect(s2.moment).toEqual(death)
    expect(s2.seq).toBeGreaterThan(s1.seq)
  })

  it('полное обновление без моментов возвращает панель к заставке и тоже сменяет сцену', () => {
    const s1 = nextScene(start, [encounter], false)
    const s2 = nextScene(s1, undefined, true)
    expect(s2.moment).toBeNull()
    expect(s2.seq).toBeGreaterThan(s1.seq)
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
