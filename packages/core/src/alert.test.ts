import { describe, expect, it } from 'vitest'
import { updateAlert } from './alert'
import type { Ctx } from './context'
import { newTestGame } from './testing'
import { player } from './state'
import { applyCommand } from './game'
import { buildView } from './view'
import { resolveAttack } from './combat/attack'
import { spawnMonster } from './monsters'
import type { AlertStage } from './combat/formulas'
import type { GameEvent } from './events'

function setup(): { ctx: Ctx; setPercent: (pct: number) => void } {
  const state = newTestGame(3)
  const p = player(state)
  p.maxHp = 100
  p.hp = 100
  const ctx: Ctx = { state, events: [] }
  return {
    ctx,
    setPercent: (pct) => {
      p.hp = pct
      updateAlert(ctx, p)
    },
  }
}

const alertEvents = (ctx: Ctx) => ctx.events.filter((e) => e.type === 'alertChanged')

describe('ступени тревоги', () => {
  it('гистерезис: целостность колеблется между 24% и 28% — вход в критическое состояние один раз', () => {
    const { ctx, setPercent } = setup()
    for (let i = 0; i < 5; i++) {
      setPercent(24)
      setPercent(28)
    }
    expect(alertEvents(ctx)).toEqual([{ type: 'alertChanged', from: 'none', to: 'critical', integrity: 24 }])
    expect(player(ctx.state).alert).toBe('critical')
  })

  it('пороги: вход при ≤ 50% и ≤ 25%, выход при > 55% и > 30%', () => {
    const { ctx, setPercent } = setup()
    for (const pct of [51, 50, 55, 25, 30, 31, 55, 56]) setPercent(pct)
    expect(alertEvents(ctx)).toEqual([
      { type: 'alertChanged', from: 'none', to: 'danger', integrity: 50 },
      { type: 'alertChanged', from: 'danger', to: 'critical', integrity: 25 },
      { type: 'alertChanged', from: 'critical', to: 'danger', integrity: 31 },
      { type: 'alertChanged', from: 'danger', to: 'none', integrity: 56 },
    ])
  })

  it('сильное лечение из критического состояния — сразу в none', () => {
    const { ctx, setPercent } = setup()
    setPercent(10)
    setPercent(90)
    expect(alertEvents(ctx).map((e) => e.type === 'alertChanged' && e.to)).toEqual(['critical', 'none'])
  })

  it('лечение зельем пересчитывает ступень', () => {
    const state = newTestGame(3)
    const p = player(state)
    p.hp = Math.floor(p.maxHp * 0.2)
    p.alert = 'critical'
    const potion = p.inventory.find((id) => state.items[id]?.defId === 'heal_potion')
    expect(potion).toBeDefined()
    const r = applyCommand(state, { type: 'use', itemId: potion! })
    const changes = r.events.filter((e) => e.type === 'alertChanged')
    expect(changes.length).toBeGreaterThan(0)
    expect(changes[0]).toMatchObject({ from: 'critical' })
    expect(player(r.state).alert).not.toBe('critical')
  })

  it('ступень видна клиенту в PlayerView', () => {
    const { ctx, setPercent } = setup()
    expect(buildView(ctx.state).player.alert).toBe('none')
    setPercent(40)
    expect(buildView(ctx.state).player.alert).toBe('danger')
    setPercent(20)
    expect(buildView(ctx.state).player.alert).toBe('critical')
  })

  it('у монстров ступени нет', () => {
    const { ctx } = setup()
    const m = Object.values(ctx.state.creatures).find((c) => c.kind !== 'player')!
    m.hp = 1
    updateAlert(ctx, m)
    expect(ctx.events).toEqual([])
    expect(m.alert).toBeUndefined()
  })
})

describe('вспышка при ударе', () => {
  /** Игрок с целостностью pct% (из 100) под ударами гиены; части тела крепкие, чтобы удар не убил. */
  function hitPlayer(pct: number, stage: AlertStage | undefined): GameEvent[] {
    const state = newTestGame(5)
    const p = player(state)
    p.maxHp = 100
    p.hp = pct
    if (stage) p.alert = stage
    for (const part of p.parts) part.hp = part.maxHp = 1000
    const m = spawnMonster(state, 'hyena', p.depth, p.x + 1, p.y)
    const ctx: Ctx = { state, events: [] }
    for (let i = 0; i < 200; i++) {
      ctx.events = []
      p.hp = pct
      if (resolveAttack(ctx, m, p) && ctx.events.some((e) => e.type === 'attackHit' && e.damage >= 2)) return ctx.events
    }
    throw new Error('гиена ни разу не попала')
  }
  const hit = (events: GameEvent[]) => events.find((e) => e.type === 'attackHit')!

  it('удар, вводящий в критическое состояние, — с флагом вспышки; событие ступени идёт после удара', () => {
    const events = hitPlayer(26, 'danger')
    expect(hit(events)).toMatchObject({ criticalFlash: true })
    const types = events.map((e) => e.type)
    expect(types.indexOf('alertChanged')).toBeGreaterThan(types.indexOf('attackHit'))
    expect(events.find((e) => e.type === 'alertChanged')).toMatchObject({ from: 'danger', to: 'critical' })
  })

  it('удар уже в критическом состоянии — с флагом, без нового события ступени', () => {
    const events = hitPlayer(20, 'critical')
    expect(hit(events)).toMatchObject({ criticalFlash: true })
    expect(events.some((e) => e.type === 'alertChanged')).toBe(false)
  })

  it('прочие удары — без вспышки', () => {
    expect(hit(hitPlayer(90, undefined))).not.toHaveProperty('criticalFlash')
    expect(hit(hitPlayer(45, 'danger'))).not.toHaveProperty('criticalFlash')
  })
})
