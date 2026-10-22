// Клавиатура → команды и окна. Движение: стрелки, numpad, vi-клавиши; с Shift — бег.
import type { Command, Dir } from '@gene/core'

/** Смещения направлений (для курсора осмотра; игровое движение считает сервер). */
export const DIR_DELTAS: Record<Dir, { x: number; y: number }> = {
  n: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
  ne: { x: 1, y: -1 },
  nw: { x: -1, y: -1 },
  se: { x: 1, y: 1 },
  sw: { x: -1, y: 1 },
}

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'n',
  ArrowDown: 's',
  ArrowLeft: 'w',
  ArrowRight: 'e',
  k: 'n',
  j: 's',
  h: 'w',
  l: 'e',
  y: 'nw',
  u: 'ne',
  b: 'sw',
  n: 'se',
  Home: 'nw',
  PageUp: 'ne',
  End: 'sw',
  PageDown: 'se',
}

/** Заглавные vi-клавиши (Shift+буква) — бег. */
const RUN_LETTERS: Record<string, Dir> = {
  K: 'n',
  J: 's',
  H: 'w',
  L: 'e',
  Y: 'nw',
  U: 'ne',
  B: 'sw',
  N: 'se',
}

const NUMPAD_DIRS: Record<string, Dir> = {
  Numpad8: 'n',
  Numpad2: 's',
  Numpad4: 'w',
  Numpad6: 'e',
  Numpad7: 'nw',
  Numpad9: 'ne',
  Numpad1: 'sw',
  Numpad3: 'se',
}

export type KeyAction =
  | { kind: 'command'; cmd: Command }
  | { kind: 'dir'; dir: Dir }
  | { kind: 'run'; dir: Dir }
  | { kind: 'open'; what: 'inventory' | 'equipment' | 'skills' | 'help' | 'use' | 'drop' | 'disassemble' | 'log' }
  | { kind: 'look' }
  | { kind: 'fire' }
  | { kind: 'toggleScene' }
  | { kind: 'nextTarget'; back: boolean }
  | { kind: 'confirm' }
  | { kind: 'escape' }

export function directionFor(ev: KeyboardEvent): Dir | undefined {
  if (ev.code in NUMPAD_DIRS) return NUMPAD_DIRS[ev.code]
  return KEY_DIRS[ev.key]
}

export function keyAction(ev: KeyboardEvent): KeyAction | undefined {
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return undefined
  if (ev.key === 'Escape') return { kind: 'escape' }
  if (ev.key === 'Tab') return { kind: 'nextTarget', back: ev.shiftKey }
  if (ev.key === 'Enter') return { kind: 'confirm' }
  if (ev.key in RUN_LETTERS) return { kind: 'run', dir: RUN_LETTERS[ev.key]! }
  const dir = directionFor(ev)
  if (dir) return ev.shiftKey ? { kind: 'run', dir } : { kind: 'dir', dir }
  if (ev.code === 'Numpad5' || ev.key === '.' || ev.key === '5' || ev.key === 's' || ev.key === 'Clear') return { kind: 'command', cmd: { type: 'wait' } }
  switch (ev.key) {
    case '>':
      return { kind: 'command', cmd: { type: 'stairsDown' } }
    case '<':
      return { kind: 'command', cmd: { type: 'stairsUp' } }
    case 'g':
    case ',':
      return { kind: 'command', cmd: { type: 'pickup' } }
    case 'R':
      return { kind: 'command', cmd: { type: 'rest' } }
    case 'o':
      return { kind: 'command', cmd: { type: 'explore' } }
    case 'i':
      return { kind: 'open', what: 'inventory' }
    case 'e':
      return { kind: 'open', what: 'equipment' }
    case 'm':
      return { kind: 'open', what: 'skills' }
    case 'p':
      return { kind: 'open', what: 'log' }
    case '?':
      return { kind: 'open', what: 'help' }
    case 'a':
    case 'q':
      return { kind: 'open', what: 'use' }
    case 'd':
      return { kind: 'open', what: 'drop' }
    case 'D':
      return { kind: 'open', what: 'disassemble' }
    case 'x':
      return { kind: 'look' }
    case 'f':
      return { kind: 'fire' }
    case 'c':
      return { kind: 'toggleScene' }
  }
  return undefined
}
