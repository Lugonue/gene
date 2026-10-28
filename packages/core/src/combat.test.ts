import { describe, expect, it } from 'vitest'
import { BODY_PLANS } from '@gene/data'
import { createRng } from './rng'
import { applyCommand } from './game'
import { chooseHitPart, hitChance, woundStageFor, type AttackContext } from './combat/formulas'
import { resolveAttack } from './combat/attack'
import { spawnMonster } from './monsters'
import { mainHand, findPart } from './body'
import { newTestGame } from './testing'
import { buildView } from './view'
import { cellIndex, player, type BodyPartState, type Creature, type GameState } from './state'
import type { Ctx } from './context'

function freshMonster(state: GameState, kind: string): Creature {
  const p = player(state)
  return spawnMonster(state, kind, p.depth, p.x + 1, p.y)
}

function ctxFor(attacker: Creature, target: Creature, tag: 'grasp' | 'bite' | 'claw' = 'grasp'): AttackContext {
  return {
    attacker,
    target,
    attack: { damage: 5, accuracy: 2, damageType: 'slash', skill: 'fighting', partTag: tag },
    attackerSkill: 2,
    attackerFighting: 2,
    targetDodging: 2,
    targetEvasion: 3,
  }
}

function cripple(part: BodyPartState): void {
  part.hp = Math.floor(part.maxHp * 0.1)
  part.wound = woundStageFor(part)
}

describe('выбор части тела', () => {
  it('распределён согласно hitWeight (навык 0)', () => {
    const s = newTestGame(1)
    const target = freshMonster(s, 'goblin_brute')
    const rng = createRng(77)
    const counts: Record<string, number> = {}
    const N = 40000
    const ctx = { ...ctxFor(player(s), target), attackerSkill: 0 }
    for (let i = 0; i < N; i++) {
      const part = chooseHitPart(rng, ctx)
      counts[part.defId] = (counts[part.defId] ?? 0) + 1
    }
    const parts = BODY_PLANS.humanoid!.parts
    const total = parts.reduce((s, p) => s + p.hitWeight, 0)
    for (const p of parts) expect(counts[p.id]! / N).toBeCloseTo(p.hitWeight / total, 1)
  })

  it('навык смещает распределение к vital-частям', () => {
    const s = newTestGame(1)
    const target = freshMonster(s, 'goblin_brute')
    const vitalShare = (skill: number): number => {
      const rng = createRng(5)
      let vital = 0
      for (let i = 0; i < 20000; i++) {
        const id = chooseHitPart(rng, { ...ctxFor(player(s), target), attackerSkill: skill }).defId
        if (id === 'head' || id === 'torso') vital++
      }
      return vital / 20000
    }
    expect(vitalShare(20)).toBeGreaterThan(vitalShare(0) + 0.05)
  })
})

describe('влияние ран по тегам', () => {
  it('искалеченная grasp-часть (основная рука) снижает точность — у игрока и у монстра', () => {
    const s = newTestGame(2)
    const goblin = freshMonster(s, 'goblin_brute')
    const p = player(s)
    for (const [att, def] of [
      [p, goblin],
      [goblin, p],
    ] as const) {
      const before = hitChance(ctxFor(att, def))
      cripple(mainHand(att)!)
      expect(hitChance(ctxFor(att, def))).toBeLessThan(before)
    }
  })

  it('искалеченная stance-часть снижает уклонение — у игрока и у монстра', () => {
    const s = newTestGame(3)
    const goblin = freshMonster(s, 'goblin_brute')
    const p = player(s)
    for (const [att, def, leg] of [
      [p, goblin, 'left_leg'],
      [goblin, p, 'right_leg'],
    ] as const) {
      const before = hitChance(ctxFor(att, def))
      cripple(findPart(def, leg)!)
      expect(hitChance(ctxFor(att, def))).toBeGreaterThan(before)
    }
  })

  it('искалеченные лапы с когтями ослабляют атаку когтями, но не укус', () => {
    const s = newTestGame(4)
    const wolf = freshMonster(s, 'warg')
    const p = player(s)
    const claw0 = hitChance(ctxFor(wolf, p, 'claw'))
    const bite0 = hitChance(ctxFor(wolf, p, 'bite'))
    cripple(findPart(wolf, 'front_left_leg')!)
    cripple(findPart(wolf, 'front_right_leg')!)
    expect(hitChance(ctxFor(wolf, p, 'claw'))).toBeLessThan(claw0)
    expect(hitChance(ctxFor(wolf, p, 'bite'))).toBe(bite0)
  })

  it('четырёхрукий: потеря руки, не держащей оружие, не снижает точность', () => {
    const s = newTestGame(5, { bodyPlan: 'humanoid_fourarmed' })
    const goblin = freshMonster(s, 'goblin_brute')
    const p = player(s)
    const before = hitChance(ctxFor(p, goblin))
    cripple(findPart(p, 'left_lower_arm')!)
    cripple(findPart(p, 'left_upper_arm')!)
    expect(hitChance(ctxFor(p, goblin))).toBe(before)
    cripple(findPart(p, 'right_upper_arm')!) // основная рука
    expect(hitChance(ctxFor(p, goblin))).toBeLessThan(before)
  })

  it('двуручное оружие: искалеченная вторая рука снижает точность, одноручному она не мешает', () => {
    const s = newTestGame(6)
    const goblin = freshMonster(s, 'goblin_brute')
    const p = player(s)
    const twoHanded = (): AttackContext => {
      const c = ctxFor(p, goblin)
      return { ...c, attack: { ...c.attack, twoHanded: true } }
    }
    const one0 = hitChance(ctxFor(p, goblin))
    const two0 = hitChance(twoHanded())
    expect(two0).toBe(one0)
    cripple(findPart(p, 'left_arm')!)
    expect(hitChance(ctxFor(p, goblin))).toBe(one0)
    expect(hitChance(twoHanded())).toBeLessThan(two0)
  })

  it('двуручное оружие у четырёхрукого: хватает любой здоровой второй руки', () => {
    const s = newTestGame(7, { bodyPlan: 'humanoid_fourarmed' })
    const goblin = freshMonster(s, 'goblin_brute')
    const p = player(s)
    const c = ctxFor(p, goblin)
    const ctx: AttackContext = { ...c, attack: { ...c.attack, twoHanded: true } }
    const before = hitChance(ctx)
    cripple(findPart(p, 'left_upper_arm')!)
    expect(hitChance(ctx)).toBe(before)
    cripple(findPart(p, 'left_lower_arm')!)
    cripple(findPart(p, 'right_lower_arm')!)
    expect(hitChance(ctx)).toBeLessThan(before)
  })

  it('ранение головы уменьшает радиус обзора', () => {
    const s = newTestGame(6)
    const before = buildView(s).player.fovRadius
    cripple(findPart(player(s), 'head')!)
    expect(buildView(s).player.fovRadius).toBeLessThan(before)
  })
})

describe('голова и торс киборга на 0 hp', () => {
  it('органическая — «разрушена», бионическая — «отказ»; голова на 0 hp действует на зрение как искалеченная', () => {
    const s = newTestGame(6)
    const p = player(s)
    const head = findPart(p, 'head')!
    cripple(head)
    const crippledFov = buildView(s).player.fovRadius
    head.hp = 0
    head.wound = woundStageFor(head)
    expect(head.wound).toBe('crippled')
    const view = buildView(s)
    expect(view.player.fovRadius).toBe(crippledFov)
    const label = view.player.parts.find((v) => v.id === 'head')!.label
    expect(label).toBe(head.material === 'organic' ? 'разрушена' : 'отказ')

    const torso = findPart(p, 'torso')!
    torso.hp = 0
    torso.wound = woundStageFor(torso)
    expect(torso.wound).toBe('crippled')
    for (const material of ['organic', 'bionic'] as const) {
      torso.material = material
      expect(buildView(s).player.parts.find((v) => v.id === 'torso')!.label).toBe(
        material === 'organic' ? 'разрушена' : 'отказ',
      )
    }
  })
})

describe('смерть', () => {
  function hitUntil(s: GameState, attacker: Creature, target: Creature, done: () => boolean): Ctx {
    const ctx: Ctx = { state: s, events: [] }
    for (let i = 0; i < 2000 && !done(); i++) resolveAttack(ctx, attacker, target)
    return ctx
  }

  it('при обнулении vital-части — даже при большом общем HP', () => {
    const s = newTestGame(7)
    const goblin = freshMonster(s, 'goblin_brute')
    goblin.hp = goblin.maxHp = 10_000
    // Все части, кроме головы, «не попадаются».
    for (const part of goblin.parts) if (part.defId !== 'head') part.wound = 'severed'
    const ctx = hitUntil(s, player(s), goblin, () => !s.creatures[goblin.id])
    const died = ctx.events.find((e) => e.type === 'creatureDied')
    expect(died).toMatchObject({ type: 'creatureDied', cause: 'vital', partId: 'head' })
  })

  it('киборг с разрушенной головой жив, пока есть целостность; монстр в той же ситуации гибнет', () => {
    const s = newTestGame(7)
    const goblin = freshMonster(s, 'goblin_brute')
    const p = player(s)
    for (const c of [p, goblin]) {
      c.hp = c.maxHp = 10_000
      for (const part of c.parts) if (part.defId !== 'head') part.wound = 'severed'
      const head = findPart(c, 'head')!
      head.hp = 0
      head.wound = woundStageFor(head)
    }
    // Бьём по игроку, пока не будет попадания.
    const ctx: Ctx = { state: s, events: [] }
    for (let i = 0; i < 200 && !ctx.events.some((e) => e.type === 'attackHit'); i++) resolveAttack(ctx, goblin, p)
    expect(ctx.events.some((e) => e.type === 'attackHit')).toBe(true)
    expect(s.status).toBe('active')
    expect(ctx.events.find((e) => e.type === 'creatureDied')).toBeUndefined()
    expect(findPart(p, 'head')!.wound).toBe('crippled')

    const ctx2 = hitUntil(s, p, goblin, () => !s.creatures[goblin.id])
    expect(ctx2.events.find((e) => e.type === 'creatureDied')).toMatchObject({ cause: 'vital', partId: 'head' })
  })

  it('удар по искалеченному торсу снимает с целостности в 1.5 раза больше, чем по здоровому', () => {
    // Одинаковое зерно — одинаковые броски; различается только стадия торса цели.
    const losses = (torsoFrac: number): number[] => {
      const s = newTestGame(21)
      const goblin = freshMonster(s, 'goblin_brute')
      const p = player(s)
      for (const part of goblin.parts) if (part.defId !== 'torso') part.wound = 'severed'
      const torso = findPart(goblin, 'torso')!
      const ctx: Ctx = { state: s, events: [] }
      const out: number[] = []
      for (let i = 0; i < 300; i++) {
        goblin.hp = goblin.maxHp = 100_000
        torso.maxHp = 10_000
        torso.hp = Math.ceil(torso.maxHp * torsoFrac)
        torso.wound = woundStageFor(torso)
        resolveAttack(ctx, p, goblin)
        out.push(100_000 - goblin.hp)
      }
      return out
    }
    const healthy = losses(1)
    const crippled = losses(0.2)
    expect(healthy.filter((d) => d > 0).length).toBeGreaterThan(10)
    // С точностью до округления до целого.
    healthy.forEach((d, i) => expect(Math.abs(crippled[i]! - d * 1.5)).toBeLessThanOrEqual(0.5))
  })

  it('при обнулении общего HP', () => {
    const s = newTestGame(8)
    const goblin = freshMonster(s, 'goblin_brute')
    goblin.hp = 1
    for (const part of goblin.parts) if (part.defId !== 'left_arm') part.wound = 'severed'
    const ctx = hitUntil(s, player(s), goblin, () => !s.creatures[goblin.id])
    expect(ctx.events.find((e) => e.type === 'creatureDied')).toMatchObject({ cause: 'hp' })
    // Снаряжение гоблина выпало на пол.
    expect(Object.values(s.items).filter((i) => i.loc.kind === 'floor' && i.defId === 'dagger').length).toBeGreaterThan(0)
  })

  it('смерть игрока завершает партию', () => {
    let s = newTestGame(9)
    const orc = freshMonster(s, 'orc_warrior')
    const p = player(s)
    p.hp = 1
    void orc
    for (let i = 0; i < 200 && s.status === 'active'; i++) s = applyCommand(s, { type: 'wait' }).state
    expect(s.status).toBe('dead')
    expect(s.killedBy).toBe('orc_warrior')
    expect(applyCommand(s, { type: 'wait' }).events).toEqual([{ type: 'commandRejected', reason: 'gameOver' }])
  })
})

describe('монстры и ИИ', () => {
  it('монстр, видящий игрока, подходит и атакует', () => {
    let s = newTestGame(12)
    for (const id of Object.keys(s.creatures)) if (id !== s.playerId) delete s.creatures[id]
    const p = player(s)
    // Ставим гоблина в 3 клетках по свободной линии.
    const level = s.levels[1]!
    let spot: { x: number; y: number } | undefined
    for (const [dx, dy] of [[3, 0], [-3, 0], [0, 2], [0, -2]] as const) {
      const ok = [1, 2, 3].slice(0, Math.max(Math.abs(dx), Math.abs(dy))).every((k) => {
        const x = p.x + Math.sign(dx) * k
        const y = p.y + Math.sign(dy) * k
        return level.tiles[cellIndex(level, { x, y })] === '.'
      })
      if (ok) {
        spot = { x: p.x + dx, y: p.y + dy }
        break
      }
    }
    expect(spot).toBeDefined()
    spawnMonster(s, 'goblin_brute', 1, spot!.x, spot!.y)
    const events = []
    for (let i = 0; i < 10; i++) {
      const r = applyCommand(s, { type: 'wait' })
      s = r.state
      events.push(...r.events)
    }
    expect(events.some((e) => e.type === 'attackHit' || e.type === 'attackMissed')).toBe(true)
  })

  it('PlayerView не содержит невидимых монстров', () => {
    const s = newTestGame(13)
    const view = buildView(s)
    const all = Object.values(s.creatures).filter((c) => c.kind !== 'player' && c.depth === 1)
    expect(all.length).toBeGreaterThan(view.monsters.length)
    const level = s.levels[1]!
    for (const m of view.monsters) expect(view.map.vis[cellIndex(level, m)]).toBe('2')
    // Монстры других уровней — тоже нет: в view нет никаких id, кроме видимых.
    const json = JSON.stringify(view)
    for (const c of all) {
      const visible = view.monsters.some((m) => m.id === c.id)
      expect(json.includes(`"${c.id}"`)).toBe(visible)
    }
  })

  it('раненые монстры с искалеченными ногами двигаются медленнее', async () => {
    const s = newTestGame(14)
    const wolf = freshMonster(s, 'warg')
    const { actionCost } = await import('./time')
    const base = actionCost(wolf, 'move')
    for (const id of ['hind_left_leg', 'hind_right_leg']) cripple(findPart(wolf, id)!)
    expect(actionCost(wolf, 'move')).toBeGreaterThan(base)
  })
})

describe('цифры входящего урона', () => {
  it('удар по игроку несёт целостность и hp задетой части после удара; удар по монстру — нет', () => {
    const s = newTestGame(5)
    const p = player(s)
    p.hp = p.maxHp = 100_000
    for (const part of p.parts) part.hp = part.maxHp = 100_000
    const g = freshMonster(s, 'goblin_brute')
    g.hp = g.maxHp = 100_000
    for (const part of g.parts) part.hp = part.maxHp = 100_000

    const ctx: Ctx = { state: s, events: [] }
    for (let i = 0; i < 100 && !ctx.events.some((e) => e.type === 'attackHit'); i++) resolveAttack(ctx, g, p)
    const hit = ctx.events.find((e) => e.type === 'attackHit')
    if (hit?.type !== 'attackHit') throw new Error('нет попадания')
    const part = findPart(p, hit.partId)!
    expect(hit.readout).toEqual({ integrityLoss: 100_000 - p.hp, integrity: p.hp, maxIntegrity: 100_000, partHp: part.hp, partMaxHp: 100_000 })

    ctx.events = []
    for (let i = 0; i < 100 && !ctx.events.some((e) => e.type === 'attackHit'); i++) resolveAttack(ctx, p, g)
    const back = ctx.events.find((e) => e.type === 'attackHit')
    if (back?.type !== 'attackHit') throw new Error('нет попадания')
    expect(back.readout).toBeUndefined()
  })

  it('по искалеченному торсу убыль целостности в пометке — фактическая, больше урона по части', () => {
    const s = newTestGame(5)
    const p = player(s)
    p.hp = p.maxHp = 100_000
    for (const part of p.parts) part.hp = part.maxHp = 100_000
    const torso = findPart(p, 'torso')!
    torso.hp = 10_000
    torso.wound = woundStageFor(torso)
    expect(torso.wound).toBe('crippled')
    const g = freshMonster(s, 'goblin_brute')

    const ctx: Ctx = { state: s, events: [] }
    let before = p.hp
    for (let i = 0; i < 100 && !ctx.events.some((e) => e.type === 'attackHit' && e.damage > 1); i++) {
      ctx.events = []
      before = p.hp
      resolveAttack(ctx, g, p)
    }
    const hit = ctx.events.find((e) => e.type === 'attackHit')
    if (hit?.type !== 'attackHit' || !hit.readout) throw new Error('нет попадания')
    expect(hit.readout.integrityLoss).toBe(before - p.hp)
    expect(hit.readout.integrityLoss).toBeGreaterThan(hit.damage)
  })
})
