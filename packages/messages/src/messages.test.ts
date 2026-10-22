import { describe, expect, it } from 'vitest'
import {
  ATTACKS,
  BODY_PLANS,
  ITEMS,
  MAGIC_DAMAGE_TYPES,
  MONSTERS,
  PLAYER_WORDS,
  SPELLS,
  TEMPLATES,
  type DamageType,
  type Material,
  type WordForms,
  type WoundStage,
} from '@gene/data'
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
  const goblin = { words: MONSTERS.goblin_brute!.name, person: 3 as const }
  const orc = { words: MONSTERS.orc_warrior!.name, person: 3 as const }
  const rat = { words: MONSTERS.hyena!.name, person: 3 as const }
  const wolf = { words: MONSTERS.warg!.name, person: 3 as const }
  type Owner = { words: WordForms; person: 2 | 3 }
  const you: Owner = { words: PLAYER_WORDS, person: 2 }
  const item = (id: string, owner?: Owner) => ({ words: ITEMS[id]!.name, person: 3 as const, ...(owner ? { owner } : {}) })
  const part = (kind: string, id: string, owner?: Owner) => ({
    words: partWords(kind, id),
    person: 3 as const,
    ...(owner ? { owner } : {}),
  })

  it('пример из ТЗ', () => {
    const t = '{attacker.nom} {verb:бить} {target.acc} по {part.dat} {weapon.ins}.'
    expect(fill(t, { subject: 'attacker', roles: { attacker: goblin, target: you, part: part('player', 'left_arm'), weapon: item('dagger') } })).toBe(
      'Гоблин-громила бьёт тебя по левой руке кинжалом.',
    )
    expect(fill(t, { subject: 'attacker', roles: { attacker: you, target: rat, part: part('hyena', 'head'), weapon: item('mace') } })).toBe(
      'Ты бьёшь гиену по голове булавой.',
    )
  })

  it('глагол по лицу: ты промахиваешься / волк промахивается', () => {
    const t = '{attacker.nom} {verb:промахиваться}.'
    expect(fill(t, { subject: 'attacker', roles: { attacker: you } })).toBe('Ты промахиваешься.')
    expect(fill(t, { subject: 'attacker', roles: { attacker: wolf } })).toBe('Варг промахивается.')
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
    ).toBe('Гоблин-громила вонзает кинжал в твою левую нижнюю руку.')
    expect(
      fill('{attacker.nom} {verb:впиваться} зубами в {tpart.acc}.', {
        subject: 'attacker',
        roles: { attacker: wolf, tpart: part('hyena', 'front_left_leg', { words: MONSTERS.hyena!.name, person: 3 }) },
      }),
    ).toBe('Варг впивается зубами в левую переднюю лапу гиены.')
  })

  it('оружие владельца в родительном падеже: «от твоей булавы», «от когтей волка»', () => {
    const t = '{target.nom} {verb:уворачиваться@target} от {aweapon.gen}.'
    expect(fill(t, { roles: { target: goblin, aweapon: item('mace', you) } })).toBe('Гоблин-громила уворачивается от твоей булавы.')
    expect(fill(t, { roles: { target: goblin, aweapon: item('short_sword', you) } })).toBe(
      'Гоблин-громила уворачивается от твоего короткого меча.',
    )
    expect(
      fill(t, { roles: { target: you, aweapon: { words: ATTACKS.claws!.name, person: 3, owner: wolf } } }),
    ).toBe('Ты уворачиваешься от когтей варга.')
  })

  it('множественное число предметов: «Кожаные перчатки гоблина ломаются!»', () => {
    expect(
      fill('{oitem.nom} {verb:ломаться@item}!', { roles: { item: item('leather_gloves'), oitem: item('leather_gloves', goblin) } }),
    ).toBe('Кожаные перчатки гоблина-громилы ломаются!')
    expect(fill('[ЯДРО] {^item.nom} {adj:разобран@item}.', { roles: { item: item('heal_potion') } })).toBe(
      '[ЯДРО] Зелье лечения разобрано.',
    )
  })

  it('одушевлённый винительный: «Ты замечаешь волка / крысу»', () => {
    const t = 'Ты замечаешь {creature.acc}.'
    expect(fill(t, { roles: { creature: wolf } })).toBe('Ты замечаешь варга.')
    expect(fill(t, { roles: { creature: rat } })).toBe('Ты замечаешь гиену.')
  })

  it('выбор варианта детерминирован (сид + ход)', () => {
    const e: GameEvent[] = [{ type: 'attackMissed', attacker: mon('goblin_brute'), target: PLAYER, attack: weaponAttack('dagger'), partId: 'head' }]
    expect(renderEvents(e, 'p', { seed: 9, turn: 3 })).toEqual(renderEvents(e, 'p', { seed: 9, turn: 3 }))
  })

  it('системные сообщения ядра помечены как system', () => {
    const out = renderEvents([{ type: 'newItemType', itemDefId: 'mace' }], 'p')
    expect(out[0]).toMatchObject({ kind: 'system', text: '[ЯДРО] Новый тип оружия: булава. Анализ начат.' })
  })
})

describe('сообщения автоисследования и бега', () => {
  it('замеченные объекты и окончание — голосом ядра', () => {
    const events: GameEvent[] = [
      { type: 'itemsNoticed', itemDefIds: ['bandage', 'bandage', 'short_sword'] },
      { type: 'featureNoticed', feature: 'stairsDown' },
      { type: 'featureNoticed', feature: 'stairsUp' },
      { type: 'featureNoticed', feature: 'portal' },
      { type: 'exploreFinished' },
      { type: 'autoLimitReached' },
    ]
    const out = renderEvents(events, 'p')
    expect(out).toHaveLength(events.length)
    for (const m of out) {
      expect(m.kind).toBe('system')
      expect(m.text).toMatch(/^\[ЯДРО\] /)
    }
    expect(out[0]!.text).toContain('(×2)')
  })
})

describe('сообщения дальнего боя', () => {
  const RANGED = WEAPONS.filter((w) => w.category === 'weapon' && w.ranged)
  const shots: AttackRef[] = RANGED.map((w) => {
    if (w.category !== 'weapon') throw new Error()
    return { kind: 'ranged', itemDefId: w.id, projectileDefId: w.ranged!.ammo ?? w.id, damageType: w.damageType }
  })

  it('выстрел, попадание, промах, поломка и падение снаряда — без плейсхолдеров, в обе стороны', () => {
    for (const kind of Object.keys(MONSTERS)) {
      for (const attack of shots) {
        if (attack.kind !== 'ranged') continue
        const events: GameEvent[] = [
          { type: 'shotFired', attacker: mon(kind), weaponDefId: attack.itemDefId, projectileDefId: attack.projectileDefId },
          { type: 'shotFired', attacker: PLAYER, weaponDefId: attack.itemDefId, projectileDefId: attack.projectileDefId },
          { type: 'projectileBroken', projectileDefId: attack.projectileDefId },
          { type: 'projectileLanded', projectileDefId: attack.projectileDefId, wall: true },
          { type: 'projectileLanded', projectileDefId: attack.projectileDefId, wall: false },
        ]
        expectClean(events)
        for (const part of BODY_PLANS.humanoid!.parts) expectClean(combatEvents(mon(kind), PLAYER, attack, part.id, 'bionic'))
        for (const part of BODY_PLANS[MONSTERS[kind]!.bodyPlan]!.parts)
          expectClean(combatEvents(PLAYER, mon(kind), attack, part.id, 'organic'))
      }
    }
  })

  it('минимум 2 варианта попадания на каждую тяжесть', () => {
    expect(TEMPLATES['miss.ranged']!.length).toBeGreaterThanOrEqual(2)
    for (const type of new Set(RANGED.map((w) => w.category === 'weapon' && w.damageType)))
      for (const sev of ['light', 'medium', 'heavy'])
        expect(TEMPLATES[`hit.ranged.${type}.${sev}`]!.length).toBeGreaterThanOrEqual(2)
  })

  it('контрольные примеры', () => {
    const text = (e: GameEvent): string => renderEvents([e], 'p')[0]!.text
    expect(text({ type: 'shotFired', attacker: mon('orc_archer'), weaponDefId: 'bow', projectileDefId: 'arrow' })).toBe(
      'Орк-лучник стреляет из лука.',
    )
    expect(text({ type: 'shotFired', attacker: PLAYER, weaponDefId: 'javelin', projectileDefId: 'javelin' })).toBe(
      'Ты метаешь метательное копьё.',
    )
    expect(text({ type: 'projectileBroken', projectileDefId: 'arrow' })).toBe('Стрела ломается.')
    expect(text({ type: 'projectileBroken', projectileDefId: 'stone' })).toBe('Камень раскалывается.')
    expect(text({ type: 'projectileLanded', projectileDefId: 'bolt', wall: true })).toBe('Болт ударяется о стену.')
    const hit = text({
      type: 'attackHit',
      attacker: mon('orc_archer'),
      target: PLAYER,
      attack: { kind: 'ranged', itemDefId: 'bow', projectileDefId: 'arrow', damageType: 'pierce' },
      partId: 'left_arm',
      partMaterial: 'organic',
      damage: 3,
      absorbed: 0,
      severity: 'medium',
    })
    expect(hit).toMatch(/^Стрела /)
    expect(hit).toContain('лев')
  })
})


describe('сообщения магических типов урона', () => {
  const MAGIC = MAGIC_DAMAGE_TYPES
  /** Текст магии не зависит от того, каким заклинанием нанесён удар. */
  const magic = (damageType: DamageType): AttackRef => ({ kind: 'spell', spellId: 'fireball', damageType })

  it('все части тела × новые типы × исходы — без плейсхолдеров, в обе стороны', () => {
    for (const damageType of MAGIC) {
      for (const kind of Object.keys(MONSTERS)) {
        for (const plan of ['humanoid', 'humanoid_fourarmed'])
          for (const part of BODY_PLANS[plan]!.parts)
            for (const material of ['organic', 'bionic'] as Material[])
              expectClean(combatEvents(mon(kind), PLAYER, magic(damageType), part.id, material))
        for (const part of BODY_PLANS[MONSTERS[kind]!.bodyPlan]!.parts)
          expectClean(combatEvents(PLAYER, mon(kind), magic(damageType), part.id, 'organic'))
      }
    }
  })

  it('минимум 2 варианта на каждый тип × тяжесть × материал и на промах', () => {
    for (const type of MAGIC) {
      expect(TEMPLATES[`miss.${type}`]!.length).toBeGreaterThanOrEqual(2)
      for (const sev of ['light', 'medium', 'heavy'])
        for (const material of ['organic', 'bionic'])
          expect(TEMPLATES[`hit.${type}.${sev}.${material}`]!.length).toBeGreaterThanOrEqual(2)
    }
  })

  const hit = (damageType: DamageType, material: Material, severity: HitSeverity): string[] => {
    const texts = new Set<string>()
    for (let turn = 0; turn < 20; turn++) {
      const e: GameEvent = {
        type: 'attackHit',
        attacker: mon('goblin_shaman'),
        target: PLAYER,
        attack: magic(damageType),
        partId: 'left_arm',
        partMaterial: material,
        damage: 4,
        absorbed: 0,
        severity,
      }
      texts.add(renderEvents([e], 'p', { turn })[0]!.text)
    }
    return [...texts]
  }

  it('ожог, обморожение, разряд и сбой бионики', () => {
    for (const sev of ['medium', 'heavy'] as HitSeverity[]) {
      expect(hit('fire', 'organic', sev).some((t) => /ожог/.test(t))).toBe(true)
      expect(hit('cold', 'organic', sev).some((t) => /обморожени/.test(t))).toBe(true)
      expect(hit('lightning', 'organic', sev).some((t) => /разряд/i.test(t))).toBe(true)
      expect(hit('lightning', 'bionic', sev).every((t) => /сбой|замыкани/i.test(t))).toBe(true)
    }
    for (const type of MAGIC) for (const t of hit(type, 'organic', 'medium')) expect(t).not.toMatch(/кулак/)
  })

  it('замедление и его конец — для игрока и монстра', () => {
    const text = (e: GameEvent): string => renderEvents([e], 'p')[0]!.text
    expect(text({ type: 'creatureSlowed', creature: PLAYER })).toMatch(/ты|твои/i)
    expect(text({ type: 'slowEnded', creature: PLAYER })).toMatch(/ты/i)
    const events: GameEvent[] = []
    for (const kind of Object.keys(MONSTERS))
      events.push({ type: 'creatureSlowed', creature: mon(kind) }, { type: 'slowEnded', creature: mon(kind) })
    expectClean(events)
    expect(renderEvents(events, 'p').length).toBe(events.length)
    expect(text({ type: 'creatureSlowed', creature: mon('goblin_shaman') })).toContain('шаман')
  })
})

describe('сообщения заклинаний монстров', () => {
  const casters = Object.values(MONSTERS).filter((m) => m.spells?.length)
  const text = (e: GameEvent): string => renderEvents([e], 'p')[0]!.text

  it('колдовство, срыв и усталость — у всех заклинателей, без плейсхолдеров', () => {
    const events: GameEvent[] = []
    for (const m of casters) {
      const caster = mon(m.id)
      for (const spellId of m.spells!) {
        const target = SPELLS[spellId]!.effect === 'heal' ? mon(casters[0]!.id) : PLAYER
        events.push({ type: 'spellCast', caster, spellId, target }, { type: 'spellFizzled', caster, spellId })
      }
      events.push({ type: 'casterTired', caster, stage: 'tired' }, { type: 'casterTired', caster, stage: 'exhausted' })
    }
    expectClean(events)
    expect(renderEvents(events, 'p').length).toBe(events.length)
  })

  it('попадание снарядом заклинания — в обе стороны, по всем частям', () => {
    for (const spell of Object.values(SPELLS)) {
      if (spell.effect !== 'bolt') continue
      const attack: AttackRef = { kind: 'spell', spellId: spell.id, damageType: spell.damageType }
      for (const part of BODY_PLANS.humanoid!.parts) {
        expectClean(combatEvents(mon('dragon_priest'), PLAYER, attack, part.id, 'bionic'))
        expectClean(combatEvents(PLAYER, mon('templar'), attack, part.id, 'organic'))
      }
    }
  })

  it('контрольные примеры', () => {
    expect(text({ type: 'spellCast', caster: mon('goblin_shaman'), spellId: 'fireball', target: PLAYER })).toContain(
      'огненный шар',
    )
    expect(text({ type: 'spellCast', caster: mon('sorcerer'), spellId: 'heal', target: mon('templar') })).toMatch(
      /храмовник/,
    )
    expect(text({ type: 'spellFizzled', caster: mon('goblin_shaman'), spellId: 'fireball' })).toMatch(/шамана/)
    const tired = new Set<string>()
    for (let turn = 0; turn < 20; turn++)
      tired.add(
        renderEvents([{ type: 'casterTired', caster: mon('goblin_shaman'), stage: 'exhausted' }], 'p', { turn })[0]!.text,
      )
    expect([...tired].some((t) => t === 'Гоблин-шаман выдохся.')).toBe(true)
    // Усталость — словами, без технических терминов.
    for (const t of tired) expect(t).not.toMatch(/усталост|перезаряд|%/i)
  })
})

describe('сообщения ядра о явлениях', () => {
  const text = (e: GameEvent): string => renderEvents([e], 'p')[0]!.text

  it('первое наблюдение — условное имя без настоящего названия', () => {
    const out = renderEvents([{ type: 'phenomenonDiscovered', phenomenon: 'fireball', n: 1 }], 'p')
    expect(out[0]).toMatchObject({
      kind: 'system',
      text: '[ЯДРО] Зафиксировано неизвестное явление: термическая аномалия №1.',
    })
  })

  it('переходы стадий и открытый рецепт — голосом ядра', () => {
    const partial = text({ type: 'phenomenonStudyChanged', phenomenon: 'frost_bolt', n: 2, status: 'partial' })
    expect(partial).toMatch(/^\[ЯДРО\] .*криогенная аномалия №2/)
    expect(partial).not.toMatch(/ледян/)
    expect(text({ type: 'phenomenonStudyChanged', phenomenon: 'frost_bolt', n: 2, status: 'known' })).toMatch(
      /^\[ЯДРО\] .*криогенная аномалия №2.*ледяная стрела/,
    )
    const recipe = renderEvents([{ type: 'recipeUnlocked', phenomenon: 'heal' }], 'p')[0]!
    expect(recipe.kind).toBe('system')
    expect(recipe.text).toMatch(/^\[ЯДРО\] Рецепт открыт: Ускоренная регенерация органики\. Органические части тела заживают быстрее\./)
  })
})
