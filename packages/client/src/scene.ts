// Окно-сцена: выбор яркого момента хода, ASCII-кадры для него и переключатель панели.
import type { SceneMoment } from '@gene/core'
import { MONSTERS } from '@gene/data'

/** Кадр сцены: строки моноширинного текста одного цвета. */
export interface SceneFrame {
  lines: string[]
  color: string
}

/** Пауза между кадрами, мс. */
export const SCENE_FRAME_MS = 220

/** Сколько держится последний кадр сцены перед возвратом к заставке, мс. */
export const SCENE_HOLD_MS = 2500

/** Тихая заставка панели в покое. */
export const SCENE_IDLE: SceneFrame = { lines: ['', '', '        · · ·', '', '', ''], color: '#1f3a44' }

/** Приоритет моментов: смерть > сильный удар > встреча. */
const PRIORITY: Record<SceneMoment['kind'], number> = { death: 3, strongHit: 2, encounter: 1 }

/** Сцена для хода: самый важный момент (при равенстве — первый). */
export function pickScene(moments: SceneMoment[] | undefined): SceneMoment | undefined {
  let best: SceneMoment | undefined
  for (const m of moments ?? []) if (!best || PRIORITY[m.kind] > PRIORITY[best.kind]) best = m
  return best
}

/** Состояние панели: текущий момент (null — заставка) и монотонный счётчик смен сцены. */
export interface SceneState {
  moment: SceneMoment | null
  seq: number
}

/**
 * Состояние после хода. Новый момент — новая сцена; полное обновление без моментов — заставка.
 * Счётчик только растёт (в том числе при переподключении), чтобы панель всегда видела смену.
 */
export function nextScene(prev: SceneState, moments: SceneMoment[] | undefined, fresh: boolean): SceneState {
  const moment = pickScene(moments)
  if (moment) return { moment, seq: prev.seq + 1 }
  if (fresh) return { moment: null, seq: prev.seq + 1 }
  return prev
}

const WIDTH = 22

function center(s: string): string {
  const pad = Math.max(0, Math.floor((WIDTH - [...s].length) / 2))
  return ' '.repeat(pad) + s
}

function species(kind: string): { glyph: string; color: string; name: string } {
  const def = Object.hasOwn(MONSTERS, kind) ? MONSTERS[kind] : undefined
  return def ? { glyph: def.glyph, color: def.color, name: def.name.nom } : { glyph: '?', color: '#cccccc', name: kind }
}

/** Подставить глиф монстра вместо «M» в шаблоне кадра. */
function fill(rows: string[], glyph: string): string[] {
  return rows.map((r) => r.replaceAll('M', glyph))
}

const WHITE = '#ffffff'
const RED = '#ef4b4b'
const GOLD = '#ffd24a'
const CYAN = '#5ff0ff'

function deathFrames(kind: string): SceneFrame[] {
  const s = species(kind)
  const rows: [string[], string][] = [
    [['', '   @         M', '', '', ''], WHITE],
    [['', '      @ ---> M', '', '', ''], WHITE],
    [['          \\ | /', '      @ -- *M* --', '          / | \\', '', ''], RED],
    [['          .  :  .', '      @   . % .', '          .  :  .', '', ''], RED],
    [['', '      @     %', '', '', center(`${s.name} повержен`)], s.color],
  ]
  return rows.map(([lines, color]) => ({ lines: fill(lines, s.glyph), color }))
}

function strongHitFrames(kind: string, byPlayer: boolean): SceneFrame[] {
  const s = species(kind)
  const caption = center(byPlayer ? 'СОКРУШИТЕЛЬНЫЙ УДАР' : 'ТЯЖЁЛЫЙ УДАР ПО ТЕБЕ')
  const from = byPlayer ? '@' : 'M'
  const to = byPlayer ? 'M' : '@'
  const rows: [string[], string][] = [
    [['', `   ${from}         ${to}`, '', '', ''], WHITE],
    [['', `        ${from}  ${to}`, '', '', ''], WHITE],
    [['          \\\\ //', `        ${from}=>#${to}#`, '          // \\\\', '', caption], GOLD],
    [['         \\  |  /', `        ${from}  ${to}!!`, '         /  |  \\', '', caption], byPlayer ? GOLD : RED],
    [['', `        ${from}    ${to}`, '', '', caption], byPlayer ? s.color : RED],
  ]
  return rows.map(([lines, color]) => ({ lines: fill(lines, s.glyph), color }))
}

function encounterFrames(kind: string): SceneFrame[] {
  const s = species(kind)
  const box = ['  +----------------+', '  |                |', '  |       M        |', '  |                |', '  +----------------+']
  const scan = (row: number): string[] =>
    box.map((r, i) => (i === row ? '  |' + '-'.repeat(16) + '|' : r.replace('M', i === 2 ? '?' : 'M')))
  return [
    { lines: [...scan(1), center('[ЯДРО] сканирование')], color: CYAN },
    { lines: [...scan(2), center('[ЯДРО] сканирование')], color: CYAN },
    { lines: [...scan(3), center('[ЯДРО] сканирование')], color: CYAN },
    { lines: [...fill(box, s.glyph), center('НОВЫЙ ВИД')], color: s.color },
    { lines: [...fill(box, s.glyph), center(s.name)], color: s.color },
  ]
}

/** Кадры сцены для момента; последний держится SCENE_HOLD_MS, потом заставка. */
export function sceneFrames(m: SceneMoment): SceneFrame[] {
  switch (m.kind) {
    case 'death':
      return deathFrames(m.species)
    case 'strongHit':
      return strongHitFrames(m.species, m.byPlayer)
    case 'encounter':
      return encounterFrames(m.species)
  }
}

// ---------------------------------------------------------------------------
// Переключатель панели (помнится в localStorage)
// ---------------------------------------------------------------------------

export const SCENE_KEY = 'gene.scene'

type KeyValue = Pick<Storage, 'getItem' | 'setItem'>

export function loadSceneEnabled(storage: KeyValue): boolean {
  try {
    return storage.getItem(SCENE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function saveSceneEnabled(storage: KeyValue, on: boolean): void {
  try {
    storage.setItem(SCENE_KEY, on ? 'on' : 'off')
  } catch {
    /* приватный режим — выбор живёт до закрытия вкладки */
  }
}
