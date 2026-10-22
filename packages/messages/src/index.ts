// Модуль сообщений (ТЗ 6.3): события core → русский текст.
// Код отвечает только за выбор шаблона, склонение и подстановку; шаблоны и словоформы — в @gene/data.
import {
  ADJECTIVES,
  ATTACKS,
  BODY_PLANS,
  CATEGORY_GEN,
  DAMAGE_READOUT,
  ITEMS,
  MAGIC_DAMAGE_TYPES,
  MATERIAL_NAMES,
  MONSTERS,
  PHENOMENA,
  PLAYER_WORDS,
  POSSESSIVE,
  REJECT_TEXT,
  SKILLS,
  SPELLS,
  TEMPLATES,
  VERBS,
  WOUND_LABELS,
  phenomenonCodeName,
  type Case,
  type DamageType,
  type RejectReasonKey,
  type SpellId,
  type WordForms,
} from '@gene/data'
import {
  createRng,
  pick,
  type ActorRef,
  type AlertStage,
  type AttackRef,
  type GameEvent,
  type HitReadout,
  type LogMessage,
  type RngState,
} from '@gene/core'

export interface RenderOptions {
  /** Номер хода — попадает в LogMessage и в сид выбора вариантов. */
  turn?: number
  /** Сид партии: варианты шаблонов выбираются детерминированно. */
  seed?: number
}

// ---------------------------------------------------------------------------
// Роли и подстановка
// ---------------------------------------------------------------------------

interface Role {
  words: WordForms
  /** 2 — игрок («ты»), 3 — все остальные. */
  person: 2 | 3
  /** Владелец — для притяжательных оборотов («твоя левая рука» / «левая рука гоблина»). */
  owner?: Role
}

export interface Bindings {
  roles: Record<string, Role>
  vars?: Record<string, string>
  /** Роль-подлежащее по умолчанию для {verb:…}. */
  subject?: string
}

const CASES = new Set<Case>(['nom', 'gen', 'dat', 'acc', 'ins', 'prep'])

function phrase(role: Role, c: Case): string {
  const own = role.owner
  if (!own) return role.words[c]
  if (own.person === 2) return `${POSSESSIVE[role.words.gender][c]} ${role.words[c]}`
  return `${role.words[c]} ${own.words.gen}`
}

function conjugate(key: string, role: Role | undefined): string | undefined {
  const forms = VERBS[key]
  if (!forms || !role) return undefined
  if (role.person === 2) return forms[0]
  return role.words.gender === 'pl' ? forms[2] : forms[1]
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1)
}

/** Подставить роли и переменные в шаблон. Неизвестные плейсхолдеры остаются как есть (их ловят тесты). */
export function fill(template: string, b: Bindings): string {
  const text = template.replace(/\{(\^?)([^{}]+)\}/g, (whole, cap: string, body: string) => {
    let out: string | undefined
    if (body.startsWith('verb:') || body.startsWith('adj:')) {
      const [kind, rest] = [body.slice(0, body.indexOf(':')), body.slice(body.indexOf(':') + 1)]
      const [key, roleName] = rest.split('@') as [string, string | undefined]
      const role = b.roles[roleName ?? b.subject ?? '']
      if (kind === 'verb') out = conjugate(key, role)
      else if (role) out = ADJECTIVES[key]?.[role.words.gender]
    } else if (body.includes('.')) {
      const [roleName, c] = body.split('.') as [string, string]
      const role = b.roles[roleName]
      if (role && CASES.has(c as Case)) out = phrase(role, c as Case)
    } else if (b.vars && body in b.vars) {
      out = b.vars[body]
    }
    if (out === undefined) return whole
    return cap ? capitalize(out) : out
  })
  return capitalize(text)
}

// ---------------------------------------------------------------------------
// Слова сущностей
// ---------------------------------------------------------------------------

function creatureRole(ref: ActorRef, viewerId: string): Role {
  if (ref.id === viewerId || ref.kind === 'player') return { words: PLAYER_WORDS, person: 2 }
  const def = MONSTERS[ref.kind]
  if (!def) throw new Error(`messages: неизвестный монстр ${ref.kind}`)
  return { words: def.name, person: 3 }
}

export function partWords(kind: string, partId: string): WordForms {
  const planId = kind === 'player' ? undefined : MONSTERS[kind]?.bodyPlan
  const plans = planId ? [BODY_PLANS[planId]!] : Object.values(BODY_PLANS)
  for (const plan of plans) {
    const part = plan.parts.find((p) => p.id === partId)
    if (part) return part.name
  }
  throw new Error(`messages: неизвестная часть тела ${partId} у ${kind}`)
}

function itemWords(defId: string): WordForms {
  const def = ITEMS[defId]
  if (!def) throw new Error(`messages: неизвестный предмет ${defId}`)
  return def.name
}

function spellWords(spellId: SpellId): WordForms {
  return SPELLS[spellId].name
}

/** Чем нанесён удар: оружие, снаряд, заклинание или естественная атака. */
function attackWords(attack: AttackRef): WordForms {
  if (attack.kind === 'weapon') return itemWords(attack.itemDefId)
  if (attack.kind === 'ranged') return itemWords(attack.projectileDefId)
  if (attack.kind === 'spell') return spellWords(attack.spellId)
  const def = ATTACKS[attack.attackId]
  if (!def) throw new Error(`messages: неизвестная атака ${attack.attackId}`)
  return def.name
}

const MAGIC_DAMAGE = new Set<DamageType>(MAGIC_DAMAGE_TYPES)

/** Сегменты ключа шаблона после hit/miss: магия описывается по стихии, остальное — по семейству и типу урона. */
function attackKey(attack: AttackRef): string[] {
  return MAGIC_DAMAGE.has(attack.damageType) ? [attack.damageType] : [attackFamily(attack), attack.damageType]
}

/** Семейство шаблонов атаки: weapon, ranged, spell, bite, claws, fist. */
export function attackFamily(attack: AttackRef): string {
  if (attack.kind !== 'natural') return attack.kind
  const tag = ATTACKS[attack.attackId]?.partTag
  return tag === 'bite' ? 'bite' : tag === 'claw' ? 'claws' : 'fist'
}

// ---------------------------------------------------------------------------
// Выбор шаблона
// ---------------------------------------------------------------------------

/** Первый существующий ключ из списка (от точного к общему). */
export function findTemplates(keys: string[]): string[] | undefined {
  for (const k of keys) if (TEMPLATES[k]?.length) return TEMPLATES[k]
  return undefined
}

/** Цепочка ключей: a.b.c.d → [a.b.c.d, a.b.c, a.b, a]. */
function chain(...parts: string[]): string[] {
  const out: string[] = []
  for (let i = parts.length; i > 0; i--) out.push(parts.slice(0, i).join('.'))
  return out
}

function choose(rng: RngState, keys: string[], b: Bindings): string | undefined {
  const list = findTemplates(keys)
  if (!list) return undefined
  return fill(pick(rng, list), b)
}

function msg(text: string | undefined, turn: number, kind?: LogMessage['kind']): LogMessage | undefined {
  if (!text) return undefined
  return { text, kind: kind ?? (text.startsWith('[') ? 'system' : 'narrative'), turn }
}

function countSuffix(count: number): string {
  return count > 1 ? ` (×${count})` : ''
}

// ---------------------------------------------------------------------------
// События → сообщения
// ---------------------------------------------------------------------------

export function renderEvents(events: GameEvent[], viewerId: string, opts: RenderOptions = {}): LogMessage[] {
  const turn = opts.turn ?? 0
  const rng = createRng(((opts.seed ?? 0) ^ Math.imul(turn + 1, 2654435761)) >>> 0)
  const out: LogMessage[] = []
  const push = (m: LogMessage | undefined): void => {
    if (m) out.push(m)
  }

  for (const e of events) {
    switch (e.type) {
      case 'attackMissed': {
        const attacker = creatureRole(e.attacker, viewerId)
        const target = creatureRole(e.target, viewerId)
        const words = attackWords(e.attack)
        const b: Bindings = {
          subject: 'attacker',
          roles: {
            attacker,
            target,
            weapon: { words, person: 3 },
            aweapon: { words, person: 3, owner: attacker },
            part: { words: partWords(e.target.kind, e.partId), person: 3 },
            tpart: { words: partWords(e.target.kind, e.partId), person: 3, owner: target },
          },
        }
        push(msg(choose(rng, chain('miss', ...attackKey(e.attack)), b), turn))
        break
      }

      case 'attackHit': {
        const attacker = creatureRole(e.attacker, viewerId)
        const target = creatureRole(e.target, viewerId)
        const words = attackWords(e.attack)
        const pw = partWords(e.target.kind, e.partId)
        const roles: Record<string, Role> = {
          attacker,
          target,
          weapon: { words, person: 3 },
          aweapon: { words, person: 3, owner: attacker },
          part: { words: pw, person: 3 },
          tpart: { words: pw, person: 3, owner: target },
        }
        if (e.armourDefId) {
          const aw = itemWords(e.armourDefId)
          roles.armour = { words: aw, person: 3 }
          roles.tarmour = { words: aw, person: 3, owner: target }
        }
        const b: Bindings = { subject: 'attacker', roles }
        let text: string | undefined
        if (e.severity === 'absorbed' && (e.armourDefId || e.partMaterial === 'bionic')) {
          const by = e.armourDefId ? 'absorbed.armour' : 'absorbed.bionic'
          text = choose(rng, [`${by}.${e.attack.damageType}`, by], b)
        } else {
          const sev = e.severity === 'absorbed' ? 'light' : e.severity
          text = choose(rng, chain('hit', ...attackKey(e.attack), sev, e.partMaterial), b)
          if (e.absorbed > 0 && e.armourDefId) text += ' ' + choose(rng, ['absorb'], b)
          if (e.severity === 'heavy') {
            const flavor = choose(rng, chain('flavor', e.partMaterial, e.attack.damageType), b)
            if (flavor) text += ' ' + flavor
          }
        }
        const m = msg(text, turn, 'narrative')
        if (m && e.readout && target.person === 2) m.note = damageNote(e, e.readout, pw)
        push(m)
        break
      }

      case 'woundChanged': {
        const owner = creatureRole(e.creature, viewerId)
        const pw = partWords(e.creature.kind, e.partId)
        const b: Bindings = {
          subject: 'part',
          roles: { target: owner, part: { words: pw, person: 3 }, tpart: { words: pw, person: 3, owner } },
          vars: {
            label: WOUND_LABELS[e.material][e.to],
            material: MATERIAL_NAMES[e.material],
            pct: String(Math.round(100 - (e.hp / Math.max(1, e.maxHp)) * 100)),
          },
        }
        const worse = stageRank(e.to) > stageRank(e.from)
        if (worse) push(msg(choose(rng, chain('wound', e.material, e.to), b), turn, 'narrative'))
        if (owner.person === 2) push(msg(choose(rng, [worse ? 'diag' : 'diag.heal'], b), turn, 'system'))
        break
      }

      case 'creatureDied': {
        const victim = creatureRole(e.creature, viewerId)
        const b: Bindings = {
          subject: 'victim',
          roles: { victim, ...(e.partId ? { part: { words: partWords(e.creature.kind, e.partId), person: 3 } } : {}) },
        }
        const who = victim.person === 2 ? 'player' : 'monster'
        push(msg(choose(rng, [`death.${who}.${e.cause}`, `death.${who}.hp`], b), turn, 'narrative'))
        break
      }

      case 'itemDamaged':
      case 'itemBroken': {
        const owner = creatureRole(e.owner, viewerId)
        const iw = itemWords(e.itemDefId)
        const b: Bindings = {
          subject: 'item',
          roles: { item: { words: iw, person: 3 }, oitem: { words: iw, person: 3, owner } },
          vars: { eff: e.type === 'itemDamaged' ? String(Math.round(e.efficiency * 100)) : '0' },
        }
        push(msg(choose(rng, [`${e.type}.${owner.person === 2 ? 'player' : 'monster'}`], b), turn))
        break
      }

      case 'monsterNoticed':
      case 'monsterFlees': {
        const b: Bindings = { subject: 'creature', roles: { creature: creatureRole(e.creature, viewerId) } }
        push(msg(choose(rng, [e.type], b), turn, 'narrative'))
        break
      }

      case 'creatureSlowed':
      case 'slowEnded': {
        const creature = creatureRole(e.creature, viewerId)
        const b: Bindings = { subject: 'creature', roles: { creature } }
        push(msg(choose(rng, [`${e.type}.${creature.person === 2 ? 'player' : 'monster'}`], b), turn, 'narrative'))
        break
      }

      case 'shotFired': {
        const b: Bindings = {
          subject: 'attacker',
          roles: {
            attacker: creatureRole(e.attacker, viewerId),
            weapon: { words: itemWords(e.weaponDefId), person: 3 },
            projectile: { words: itemWords(e.projectileDefId), person: 3 },
          },
        }
        const how = e.projectileDefId === e.weaponDefId ? 'thrown' : 'launcher'
        push(msg(choose(rng, [`shotFired.${how}`], b), turn, 'narrative'))
        break
      }

      case 'projectileBroken':
      case 'projectileLanded': {
        const b: Bindings = { roles: { projectile: { words: itemWords(e.projectileDefId), person: 3 } } }
        const keys =
          e.type === 'projectileBroken'
            ? [`projectileBroken.${e.projectileDefId}`, 'projectileBroken']
            : [`projectileLanded.${e.wall ? 'wall' : 'floor'}`]
        push(msg(choose(rng, keys, b), turn, 'narrative'))
        break
      }

      case 'spellCast':
      case 'spellFizzled': {
        const roles: Record<string, Role> = {
          caster: creatureRole(e.caster, viewerId),
          spell: { words: spellWords(e.spellId), person: 3 },
        }
        let keys = ['spellFizzled']
        if (e.type === 'spellCast') {
          roles.target = creatureRole(e.target, viewerId)
          keys = [`spellCast.${e.spellId}`, `spellCast.${SPELLS[e.spellId].effect}`]
        }
        push(msg(choose(rng, keys, { subject: 'caster', roles }), turn, 'narrative'))
        break
      }

      case 'casterTired': {
        const b: Bindings = { subject: 'caster', roles: { caster: creatureRole(e.caster, viewerId) } }
        push(msg(choose(rng, [`casterTired.${e.stage}`], b), turn, 'narrative'))
        break
      }

      case 'itemsHere':
      case 'itemsNoticed': {
        const counts = new Map<string, number>()
        for (const id of e.itemDefIds) counts.set(id, (counts.get(id) ?? 0) + 1)
        const list = [...counts].map(([id, n]) => itemWords(id).nom + countSuffix(n)).join(', ')
        const kind = e.type === 'itemsHere' ? 'narrative' : 'system'
        push(msg(choose(rng, [e.type], { roles: {}, vars: { list } }), turn, kind))
        break
      }

      case 'featureNoticed':
        push(msg(choose(rng, [`featureNoticed.${e.feature}`], { roles: {} }), turn, 'system'))
        break

      case 'itemPickedUp':
      case 'itemDropped': {
        const who = e.type === 'itemDropped' ? (creatureRole(e.owner, viewerId).person === 2 ? '.player' : '.monster') : ''
        const b: Bindings = {
          subject: 'item',
          roles: { item: { words: itemWords(e.itemDefId), person: 3 } },
          vars: { count: countSuffix(e.count) },
        }
        push(msg(choose(rng, [e.type + who], b), turn, 'narrative'))
        break
      }

      case 'itemEquipped':
      case 'itemUnequipped': {
        const b: Bindings = { roles: { item: { words: itemWords(e.itemDefId), person: 3 } } }
        push(msg(choose(rng, [`${e.type}.${e.slot === 'weapon' ? 'weapon' : 'armour'}`], b), turn, 'narrative'))
        break
      }

      case 'bandageApplied':
      case 'partRepaired': {
        const b: Bindings = {
          roles: { part: { words: partWords('player', e.partId), person: 3 } },
          vars: { label: WOUND_LABELS[e.type === 'bandageApplied' ? 'organic' : 'bionic'][e.to] },
        }
        push(msg(choose(rng, [e.type], b), turn))
        break
      }

      case 'potionDrunk':
      case 'doorOpened':
      case 'restInterrupted':
      case 'restFinished':
      case 'exploreFinished':
      case 'autoLimitReached':
      case 'gameWon':
        push(msg(choose(rng, [e.type], { roles: {} }), turn))
        break

      case 'levelChanged':
        push(msg(choose(rng, [`levelChanged.${e.dir}`], { roles: {}, vars: { level: String(e.depth) } }), turn))
        break

      case 'itemRepaired':
      case 'itemDisassembled':
      case 'newItemType':
      case 'studyChanged': {
        const def = ITEMS[e.itemDefId]
        const b: Bindings = {
          subject: 'item',
          roles: { item: { words: itemWords(e.itemDefId), person: 3 } },
          vars: {
            skill: e.type === 'itemDisassembled' ? SKILLS[e.skill].name : '',
            category: def ? CATEGORY_GEN[def.category] : '',
          },
        }
        const key = e.type === 'studyChanged' ? `studyChanged.${e.status}` : e.type
        push(msg(choose(rng, [key], b), turn, 'system'))
        break
      }

      case 'phenomenonDiscovered':
      case 'phenomenonStudyChanged': {
        const def = PHENOMENA[e.phenomenon]
        const vars = { code: phenomenonCodeName(e.phenomenon, e.n), partial: def.partialName, name: def.name }
        const key = e.type === 'phenomenonStudyChanged' ? `${e.type}.${e.status}` : e.type
        push(msg(choose(rng, [key], { roles: {}, vars }), turn, 'system'))
        break
      }

      case 'recipeUnlocked': {
        const { recipe } = PHENOMENA[e.phenomenon]
        const vars = { recipe: recipe.name, description: recipe.description }
        push(msg(choose(rng, [e.type], { roles: {}, vars }), turn, 'system'))
        break
      }

      case 'skillUp':
        push(
          msg(
            choose(rng, ['skillUp'], { roles: {}, vars: { skill: SKILLS[e.skill].name, level: String(e.level) } }),
            turn,
            'system',
          ),
        )
        break

      case 'alertChanged': {
        const raised = ALERT_ORDER.indexOf(e.to) > ALERT_ORDER.indexOf(e.from)
        const key = raised ? `alertChanged.${e.to}` : 'alertChanged.stable'
        push(msg(choose(rng, [key], { roles: {}, vars: { integrity: String(e.integrity) } }), turn, 'system'))
        break
      }

      case 'commandRejected':
        push({ text: rejectText(e.reason), kind: 'warning', turn })
        break

      case 'gameStarted':
      case 'blocked':
        break
    }
  }
  return out
}

const ALERT_ORDER: AlertStage[] = ['none', 'danger', 'critical']

/** «−7 · броня −3 · Целостность 18/40 · голова 3/12»; при полном поглощении — «урон заблокирован». */
function damageNote(e: { damage: number; absorbed: number }, r: HitReadout, part: WordForms): string {
  if (e.damage <= 0) return DAMAGE_READOUT.blocked
  const parts = [`−${e.damage}`]
  if (e.absorbed > 0) parts.push(`${DAMAGE_READOUT.armour} −${e.absorbed}`)
  parts.push(`${DAMAGE_READOUT.integrity} ${r.integrity}/${r.maxIntegrity}`, `${part.nom} ${r.partHp}/${r.partMaxHp}`)
  return parts.join(' · ')
}

function stageRank(s: string): number {
  return ['none', 'bruised', 'wounded', 'crippled', 'severed'].indexOf(s)
}

export function rejectText(reason: string): string {
  return REJECT_TEXT[reason as RejectReasonKey] ?? 'Нельзя.'
}
