// Окно-сцена: очередь ярких моментов, ASCII-кадры для них и переключатель панели.
import type { EncounterSpecies, SceneMoment } from '@gene/core'
import { MONSTERS } from '@gene/data'

/** Кадр сцены: строки моноширинного текста; цвет — общий или свой у строки. */
export interface SceneFrame {
  lines: string[]
  color: string
  lineColors?: (string | undefined)[]
}

/** Размер окна в символах: все кадры дополняются до него, чтобы окно не меняло размер. */
export const SCENE_WIDTH = 30
export const SCENE_HEIGHT = 7

/** Пауза между кадрами, мс. */
export const SCENE_FRAME_MS = 220

/** Сколько сцена держится на экране как минимум (от первого кадра), прежде чем уступить следующей, мс. */
export const SCENE_MIN_MS: Record<SceneMoment['kind'], number> = { death: 1800, strongHit: 1800, encounter: 3500 }

/** Сколько держится последний кадр, если очередь пуста, перед возвратом к заставке, мс. */
export const SCENE_HOLD_MS = 2500

/** Сколько сцен ждёт в очереди; при переполнении первыми выпадают старые боевые сцены. */
export const SCENE_QUEUE_MAX = 3

/** Приоритет боевых моментов хода: смерть > сильный удар. */
const PRIORITY: Record<SceneMoment['kind'], number> = { death: 3, strongHit: 2, encounter: 1 }

/**
 * Сцены хода: самый важный боевой момент (смерть или сильный удар; при равенстве — первый),
 * затем встреча с новыми видами — она не теряется за боем.
 */
export function turnScenes(moments: SceneMoment[] | undefined): SceneMoment[] {
  let combat: SceneMoment | undefined
  let encounter: SceneMoment | undefined
  for (const m of moments ?? []) {
    if (m.kind === 'encounter') encounter ??= m
    else if (!combat || PRIORITY[m.kind] > PRIORITY[combat.kind]) combat = m
  }
  return [combat, encounter].filter((m): m is SceneMoment => m !== undefined)
}

/** Добавить сцены в очередь; лишние выпадают — сначала самые старые боевые, потом самые старые вообще. */
export function enqueueScenes(queue: SceneMoment[], scenes: SceneMoment[]): SceneMoment[] {
  const out = [...queue, ...scenes]
  while (out.length > SCENE_QUEUE_MAX) {
    const combat = out.findIndex((m) => m.kind !== 'encounter')
    out.splice(combat >= 0 ? combat : 0, 1)
  }
  return out
}

/**
 * Состояние панели: очередь сцен; seq растёт при каждом изменении очереди после хода,
 * epoch — при полном обновлении (переподключение), которое сбрасывает текущую сцену.
 */
export interface SceneState {
  queue: SceneMoment[]
  seq: number
  epoch: number
}

/** Состояние после хода. Счётчики только растут (в том числе при переподключении), чтобы панель всегда видела смену. */
export function nextScene(prev: SceneState, moments: SceneMoment[] | undefined, fresh: boolean): SceneState {
  const scenes = turnScenes(moments)
  if (fresh) return { queue: enqueueScenes([], scenes), seq: prev.seq + 1, epoch: prev.epoch + 1 }
  if (scenes.length === 0) return prev
  return { ...prev, queue: enqueueScenes(prev.queue, scenes), seq: prev.seq + 1 }
}

// ---------------------------------------------------------------------------
// Кадры
// ---------------------------------------------------------------------------

function center(s: string): string {
  const pad = Math.max(0, Math.floor((SCENE_WIDTH - [...s].length) / 2))
  return ' '.repeat(pad) + s
}

/** Дополнить кадр пустыми строками до SCENE_HEIGHT и обрезать строки по SCENE_WIDTH. */
function fit(frame: SceneFrame): SceneFrame {
  const lines = frame.lines.slice(0, SCENE_HEIGHT).map((l) => [...l].slice(0, SCENE_WIDTH).join(''))
  while (lines.length < SCENE_HEIGHT) lines.push('')
  return { ...frame, lines }
}

/** Тихая заставка панели в покое. */
export const SCENE_IDLE: SceneFrame = fit({ lines: ['', '', '', center('· · ·')], color: '#1f3a44' })

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

/** Угроза вида относительно игрока: подпись и цвет по уровню 1–5. */
export const THREAT_LABELS: Record<EncounterSpecies['threat'], { label: string; color: string }> = {
  1: { label: 'слабый', color: '#8d949a' },
  2: { label: 'слабее тебя', color: '#7bd88f' },
  3: { label: 'равный', color: '#ffd24a' },
  4: { label: 'опасный', color: '#ffb057' },
  5: { label: 'смертельный', color: '#ef4b4b' },
}

/** Шкала угрозы: ▮ на каждый уровень из пяти. */
export function threatBar(threat: EncounterSpecies['threat']): string {
  return '▮'.repeat(threat) + '▯'.repeat(5 - threat)
}

function deathFrames(kind: string): SceneFrame[] {
  const s = species(kind)
  const rows: [string[], string][] = [
    [['', '', '     @          M'], WHITE],
    [['', '', '        @ ---> M'], WHITE],
    [['', '            \\ | /', '        @ -- *M* --', '            / | \\'], RED],
    [['', '            .  :  .', '        @   . % .', '            .  :  .'], RED],
    [['', '', '        @     %', '', '', center(`${s.name} повержен`)], s.color],
  ]
  return rows.map(([lines, color]) => fit({ lines: fill(lines, s.glyph), color }))
}

function strongHitFrames(kind: string, byPlayer: boolean): SceneFrame[] {
  const s = species(kind)
  const caption = center(byPlayer ? 'СОКРУШИТЕЛЬНЫЙ УДАР' : 'ТЯЖЁЛЫЙ УДАР ПО ТЕБЕ')
  const from = byPlayer ? '@' : 'M'
  const to = byPlayer ? 'M' : '@'
  const rows: [string[], string][] = [
    [['', '', `     ${from}          ${to}`], WHITE],
    [['', '', `          ${from}  ${to}`], WHITE],
    [['', '            \\\\ //', `          ${from}=>#${to}#`, '            // \\\\', '', caption], GOLD],
    [['', '           \\  |  /', `          ${from}  ${to}!!`, '           /  |  \\', '', caption], byPlayer ? GOLD : RED],
    [['', '', `          ${from}    ${to}`, '', '', caption], byPlayer ? s.color : RED],
  ]
  return rows.map(([lines, color]) => fit({ lines: fill(lines, s.glyph), color }))
}

/** Сканирование Ядром: полоса проходит по рамке, внутри — знаки вопроса по числу видов. */
function scanFrames(count: number): SceneFrame[] {
  const inner = SCENE_WIDTH - 8
  const marks = Array<string>(Math.min(count, 5)).fill('?').join('  ')
  const box = [
    '   +' + '-'.repeat(inner) + '+',
    '   |' + ' '.repeat(inner) + '|',
    '   |' + (' '.repeat(Math.floor((inner - marks.length) / 2)) + marks).padEnd(inner) + '|',
    '   |' + ' '.repeat(inner) + '|',
    '   +' + '-'.repeat(inner) + '+',
  ]
  return [1, 2, 3].map((row) =>
    fit({
      lines: [...box.map((r, i) => (i === row ? '   |' + '-'.repeat(inner) + '|' : r)), '', center('[ЯДРО] сканирование')],
      color: CYAN,
    }),
  )
}

/** Карточка одного нового вида: глиф в рамке, имя и угроза. */
function singleCard(seen: EncounterSpecies): SceneFrame[] {
  const s = species(seen.species)
  const t = THREAT_LABELS[seen.threat]
  const box = ['        +----------+', '        |          |', '        |    M     |', '        |          |', '        +----------+']
  const threat = center(`УГРОЗА ${threatBar(seen.threat)} ${t.label}`)
  return [
    fit({ lines: [...fill(box, s.glyph), '', center('НОВЫЙ ВИД')], color: s.color }),
    fit({
      lines: [...fill(box, s.glyph), center(s.name), threat],
      color: s.color,
      lineColors: [...Array<undefined>(SCENE_HEIGHT - 1), t.color],
    }),
  ]
}

/** Карточка группы новых видов: по строке на вид — глиф, имя, шкала угрозы. */
function groupCard(seen: EncounterSpecies[]): SceneFrame[] {
  const rows = SCENE_HEIGHT - 1
  const shown = seen.length > rows ? seen.slice(0, rows - 1) : seen
  const lines = [center(`НОВЫЕ ВИДЫ: ${seen.length}`)]
  const lineColors: (string | undefined)[] = [CYAN]
  for (const x of shown) {
    const s = species(x.species)
    const name = [...s.name].slice(0, SCENE_WIDTH - 11).join('').padEnd(SCENE_WIDTH - 11)
    lines.push(` ${s.glyph}  ${name} ${threatBar(x.threat)}`)
    lineColors.push(THREAT_LABELS[x.threat].color)
  }
  if (shown.length < seen.length) {
    lines.push(center(`…и ещё ${seen.length - shown.length}`))
    lineColors.push(CYAN)
  }
  return [fit({ lines, color: CYAN, lineColors })]
}

function encounterFrames(seen: EncounterSpecies[]): SceneFrame[] {
  return [...scanFrames(seen.length), ...(seen.length === 1 ? singleCard(seen[0]!) : groupCard(seen))]
}

/** Кадры сцены для момента; последний держится, пока не придёт очередь следующей сцены или заставки. */
export function sceneFrames(m: SceneMoment): SceneFrame[] {
  switch (m.kind) {
    case 'death':
      return deathFrames(m.species)
    case 'strongHit':
      return strongHitFrames(m.species, m.byPlayer)
    case 'encounter':
      return encounterFrames(m.seen)
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
