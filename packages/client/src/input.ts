// Клавиатура → команды и окна. Движение: стрелки, numpad, vi-клавиши.
import type { Command, Dir } from '@gene/core'

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
  | { kind: 'open'; what: 'inventory' | 'equipment' | 'skills' | 'help' | 'use' | 'drop' | 'disassemble' }
  | { kind: 'look' }
  | { kind: 'escape' }

export function directionFor(ev: KeyboardEvent): Dir | undefined {
  if (ev.code in NUMPAD_DIRS) return NUMPAD_DIRS[ev.code]
  return KEY_DIRS[ev.key]
}

export function keyAction(ev: KeyboardEvent): KeyAction | undefined {
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return undefined
  if (ev.key === 'Escape') return { kind: 'escape' }
  const dir = directionFor(ev)
  if (dir) return { kind: 'dir', dir }
  if (ev.code === 'Numpad5' || ev.key === '.' || ev.key === '5' || ev.key === 'Clear') return { kind: 'command', cmd: { type: 'wait' } }
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
    case 'i':
      return { kind: 'open', what: 'inventory' }
    case 'e':
      return { kind: 'open', what: 'equipment' }
    case 'm':
      return { kind: 'open', what: 'skills' }
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
  }
  return undefined
}
