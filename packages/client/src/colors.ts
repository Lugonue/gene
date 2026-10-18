// Цвета карты и интерфейса.
import type { WoundStage } from '@gene/data'

export const TILE_COLORS: Record<string, { lit: string; dim: string }> = {
  '#': { lit: '#9a9a9a', dim: '#3c3c3c' },
  '.': { lit: '#5a5a5a', dim: '#2a2a2a' },
  '+': { lit: '#c08a42', dim: '#5a4320' },
  "'": { lit: '#c08a42', dim: '#5a4320' },
  '<': { lit: '#f0e08a', dim: '#6b6340' },
  '>': { lit: '#f0e08a', dim: '#6b6340' },
  Ω: { lit: '#3ef0ff', dim: '#1d6f78' },
}

export const PLAYER_COLOR = '#ffffff'

export const WOUND_COLORS: Record<WoundStage, string> = {
  none: '#5fd068',
  bruised: '#e8d44d',
  wounded: '#f0953a',
  crippled: '#ef4b4b',
  severed: '#a03030',
}

/** Цвет по ступени эффективности прочности (4 — 100% … 0 — сломан). */
export const EFF_COLORS = ['#ef4b4b', '#f0953a', '#e8d44d', '#a8d86a', '#5fd068']
