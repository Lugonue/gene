import { describe, expect, it } from 'vitest'
import { ATTACKS, BODY_PLANS, ITEMS, MONSTERS, PLAYER_WORDS, TEMPLATES, type Material, type WoundStage } from '@gene/data'
import type { ActorRef, AttackRef, GameEvent, HitSeverity } from '@gene/core'
import { fill, partWords, renderEvents } from './index'

const PLAYER: ActorRef = { id: 'p', kind: 'player' }
const mon = (kind: string): ActorRef => ({ id: `m-${kind}`, kind })

const WEAPONS = Object.values(ITEMS).filter((i) => i.category === 'weapon')
const ARMOURS = Object.values(ITEMS).filter((i) => i.category === 'armour')
const SEVERITIES: HitSeverity[] = ['light', 'medium', 'heavy', 'absorbed']
const STAGES: WoundStage[] = ['bruised', 'wounded', 'crippled']

function weaponAttack(defId: string): AttackRef {
  const def = ITEMS[defId]!
  if (def.category !== 'weapon') throw new Error()
  return { kind: 'weapon', itemDefId: defId, damageType: def.damageType }
}
const natural = (id: string): AttackRef => ({ kind: 'natural', attackId: id, damageType: ATTACKS[id]!.damageType })

/** Все атаки монстра: естественные + любое оружие (если у вида есть руки). */
function monsterAttacks(kind: string): AttackRef[] {
  const def = MONSTERS[kind]!
  const list = def.attacks.map((a) => natural(a.id))
  if (BODY_PLANS[def.bodyPlan]!.mainHand) list.push(...WEAPONS.map((w) => weaponAttack(w.id)))
  return list
}

function combatEvents(attacker: ActorRef, target: ActorRef, attack: AttackRef, partId: string, material: Material): GameEvent[] {
  const events: GameEvent[] = [{ type: 'attackMissed', attacker, target, attack, partId }]
  for (const severity of SEVERITIES) {
    const base = { type: 'attackHit' as const, attacker, target, attack, partId, partMaterial: material, severity }
    events.push({ ...base, damage: severity === 'absorbed' ? 0 : 5, absorbed: 0 })
    for (const armour of ARMOURS)
      events.push({ ...base, damage: severity === 'absorbed' ? 0 : 5, absorbed: 3, armourDefId: armour.id })
  }
  for (const to of STAGES) {
    events.push({ type: 'woundChanged', creature: target, partId, material, from: 'none', to, hp: 3, maxHp: 10 })
    events.push({ type: 'woundChanged', creature: target, partId, material, from: to, to: 'none', hp: 9, maxHp: 10 })
  }
  events.push({ type: 'creatureDied', creature: target, killer: attacker, cause: 'vital', partId })
  events.push({ type: 'creatureDied', creature: target, killer: attacker, cause: 'hp' })
  return events
}

function expectClean(events: GameEvent[]): void {
  for (let turn = 0; turn < 6; turn++) {
    const out = renderEvents(events, 'p', { seed: 1, turn })
    for (const m of out) {
      expect(m.text, m.text).not.toMatch(/[{}]/)
      expect(m.text, m.text).not.toMatch(/undefined|NaN/)
      expect(m.text.trim().length).toBeGreaterThan(3)
    }
  }
}

describe('сообщения: перебор комбинаций', () => {
  it('монстр атакует игрока: все монстры × части игрока (обе формации, оба материала) × атаки × исходы', () => {
    for (const kind of Object.keys(MONSTERS)) {
      for (const plan of ['humanoid', 'humanoid_fourarmed']) {
        for (const part of BODY_PLANS[plan]!.parts) {
          for (const material of ['organic', 'bionic'] as Material[]) {
            for (const attack of monsterAttacks(kind)) expectClean(combatEvents(mon(kind), PLAYER, attack, part.id, material))
          }
        }
      }
    }
  })

  it('игрок атакует монстра: все монстры × все их части × оружие и кулак × исходы', () => {
    for (const kind of Object.keys(MONSTERS)) {
      for (const part of BODY_PLANS[MONSTERS[kind]!.bodyPlan]!.parts) {
        for (const attack of [...WEAPONS.map((w) => weaponAttack(w.id)), natural('fist')])
          expectClean(combatEvents(PLAYER, mon(kind), attack, part.id, 'organic'))
      }
    }
  })

  it('снаряжение, предметы, система', () => {
    const events: GameEvent[] = []
    for (const item of Object.values(ITEMS)) {
      for (const owner of [PLAYER, ...Object.keys(MONSTERS).map(mon)]) {
        events.push({ type: 'itemDamaged', owner, itemDefId: item.id, durability: 10, maxDurability: 40, efficiency: 0.65 })
        events.push({ type: 'itemBroken', owner, itemDefId: item.id })
        events.push({ type: 'itemDropped', owner, itemDefId: item.id, count: 2 })
      }
      events.push({ type: 'itemPickedUp', itemDefId: item.id, count: 1 })
      events.push({ type: 'newItemType', itemDefId: item.id })
      events.push({ type: 'studyChanged', itemDefId: item.id, status: 'partial' })
      events.push({ type: 'studyChanged', itemDefId: item.id, status: 'known' })
      events.push({ type: 'itemRepaired', itemDefId: item.id, durability: 30, maxDurability: 40 })
      events.push({ type: 'itemDisassembled', itemDefId: item.id, skill: 'axes' })
      events.push({ type: 'itemEquipped', itemDefId: item.id, slot: item.category === 'weapon' ? 'weapon' : 'body' })
      events.push({ type: 'itemUnequipped', itemDefId: item.id, slot: item.category === 'weapon' ? 'weapon' : 'body' })
    }
    for (const kind of Object.keys(MONSTERS)) {
      events.push({ type: 'monsterNoticed', creature: mon(kind) })
      events.push({ type: 'monsterFlees', creature: mon(kind) })
    }
    events.push(
      { type: 'itemsHere', itemDefIds: ['dagger', 'bandage', 'bandage'] },
      { type: 'bandageApplied', partId: 'head', from: 'crippled', to: 'wounded' },
      { type: 'partRepaired', partId: 'left_lower_arm', from: 'wounded', to: 'bruised' },
      { type: 'potionDrunk', healed: 10 },
      { type: 'skillUp', skill: 'long_blades', level: 3 },
      { type: 'levelChanged', depth: 2, dir: 'down' },
      { type: 'levelChanged', depth: 1, dir: 'up' },
      { type: 'doorOpened' },
      { type: 'restInterrupted' },
      { type: 'restFinished' },
      { type: 'gameWon' },
      { type: 'commandRejected', reason: 'bandageOnBionic' },
    )
    expectClean(events)
    // Каждое событие дало сообщение.
    expect(renderEvents(events, 'p').length).toBeGreaterThanOrEqual(events.length)
  })

  it('минимум 2 варианта на каждую комбинацию «событие × тип урона»', () => {
    for (const fam of ['weapon.slash', 'weapon.pierce', 'weapon.blunt', 'bite', 'claws', 'fist'])
      expect(TEMPLATES[`miss.${fam}`]!.length).toBeGreaterThanOrEqual(2)
    for (const fam of ['weapon.slash', 'weapon.pierce', 'weapon.blunt', 'bite.pierce', 'claws.slash', 'fist.blunt'])
      for (const sev of ['light', 'medium', 'heavy']) expect(TEMPLATES[`hit.${fam}.${sev}`]!.length).toBeGreaterThanOrEqual(2)
  })
})

describe('сообщения: падежи и род (контрольные примеры)', () => {
  const goblin = { words: MONSTERS.goblin!.name, person: 3 as const }
  const orc = { words: MONSTERS.orc_warrior!.name, person: 3 as const }
  const rat = { words: MONSTERS.rat!.name, person: 3 as const }
  const wolf = { words: MONSTERS.wolf!.name, person: 3 as const }
  const you = { words: PLAYER_WORDS, person: 2 as const }
  const item = (id: string, owner?: typeof you) => ({ words: ITEMS[id]!.name, person: 3 as const, ...(owner ? { owner } : {}) })
  const part = (kind: string, id: string, owner?: typeof you) => ({
    words: partWords(kind, id),
    person: 3 as const,
    ...(owner ? { owner } : {}),
  })

  it('пример из ТЗ', () => {
    const t = '{attacker.nom} {verb:бить} {target.acc} по {part.dat} {weapon.ins}.'
    expect(fill(t, { subject: 'attacker', roles: { attacker: goblin, target: you, part: part('player', 'left_arm'), weapon: item('dagger') } })).toBe(
      'Гоблин бьёт тебя по левой руке кинжалом.',
    )
    expect(fill(t, { subject: 'attacker', roles: { attacker: you, target: rat, part: part('rat', 'head'), weapon: item('mace') } })).toBe(
      'Ты бьёшь крысу по голове булавой.',
    )
  })

  it('глагол по лицу: ты промахиваешься / волк промахивается', () => {
    const t = '{attacker.nom} {verb:промахиваться}.'
    expect(fill(t, { subject: 'attacker', roles: { attacker: you } })).toBe('Ты промахиваешься.')
    expect(fill(t, { subject: 'attacker', roles: { attacker: wolf } })).toBe('Волк промахивается.')
  })

  it('притяжательные обороты и род частей тела', () => {
    const t = '{tpart.nom} {adj:искалечен@part}!'
    expect(fill(t, { roles: { part: part('player', 'left_arm'), tpart: part('player', 'left_arm', you) } })).toBe(
      'Твоя левая рука искалечена!',
    )
    expect(fill(t, { roles: { part: part('orc_warrior', 'torso'), tpart: part('orc_warrior', 'torso', orc) } })).toBe(
      'Торс орка-воина искалечен!',
    )
    expect(
      fill('{attacker.nom} {verb:вонзать} {weapon.acc} в {tpart.acc}.', {
        subject: 'attacker',
        roles: { attacker: goblin, weapon: item('dagger'), tpart: part('player', 'left_lower_arm', you) },
      }),
    ).toBe('Гоблин вонзает кинжал в твою левую нижнюю руку.')
    expect(
      fill('{attacker.nom} {verb:впиваться} зубами в {tpart.acc}.', {
        subject: 'attacker',
        roles: { attacker: wolf, tpart: part('jackal', 'front_left_leg', { words: MONSTERS.jackal!.name, person: 3 }) },
      }),
    ).toBe('Волк впивается зубами в левую переднюю лапу шакала.')
  })

  it('оружие владельца в родительном падеже: «от твоей булавы», «от когтей волка»', () => {
    const t = '{target.nom} {verb:уворачиваться@target} от {aweapon.gen}.'
    expect(fill(t, { roles: { target: goblin, aweapon: item('mace', you) } })).toBe('Гоблин уворачивается от твоей булавы.')
    expect(fill(t, { roles: { target: goblin, aweapon: item('short_sword', you) } })).toBe(
      'Гоблин уворачивается от твоего короткого меча.',
    )
    expect(
      fill(t, { roles: { target: you, aweapon: { words: ATTACKS.claws!.name, person: 3, owner: wolf } } }),
    ).toBe('Ты уворачиваешься от когтей волка.')
  })

  it('множественное число предметов: «Кожаные перчатки гоблина ломаются!»', () => {
    expect(
      fill('{oitem.nom} {verb:ломаться@item}!', { roles: { item: item('leather_gloves'), oitem: item('leather_gloves', goblin as never) } }),
    ).toBe('Кожаные перчатки гоблина ломаются!')
    expect(fill('[ЯДРО] {^item.nom} {adj:разобран@item}.', { roles: { item: item('heal_potion') } })).toBe(
      '[ЯДРО] Зелье лечения разобрано.',
    )
  })

  it('одушевлённый винительный: «Ты замечаешь волка / крысу»', () => {
    const t = 'Ты замечаешь {creature.acc}.'
    expect(fill(t, { roles: { creature: wolf } })).toBe('Ты замечаешь волка.')
    expect(fill(t, { roles: { creature: rat } })).toBe('Ты замечаешь крысу.')
  })

  it('выбор варианта детерминирован (сид + ход)', () => {
    const e: GameEvent[] = [{ type: 'attackMissed', attacker: mon('goblin'), target: PLAYER, attack: weaponAttack('dagger'), partId: 'head' }]
    expect(renderEvents(e, 'p', { seed: 9, turn: 3 })).toEqual(renderEvents(e, 'p', { seed: 9, turn: 3 }))
  })

  it('системные сообщения ядра помечены как system', () => {
    const out = renderEvents([{ type: 'newItemType', itemDefId: 'mace' }], 'p')
    expect(out[0]).toMatchObject({ kind: 'system', text: '[ЯДРО] Новый тип оружия: булава. Анализ начат.' })
  })
})
