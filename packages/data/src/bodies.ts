import type { BodyPartDef, BodyPlanDef, CyborgConfigDef, SlotDef, SlotId } from './types'
import { w } from './words'

const head: BodyPartDef = {
  id: 'head',
  name: w(['голова', 'головы', 'голове', 'голову', 'головой', 'голове'], 'f'),
  tags: ['vision', 'vital'],
  hitWeight: 2,
  maxHp: 10,
  armorSlot: 'head',
}

const torso: BodyPartDef = {
  id: 'torso',
  name: w(['торс', 'торса', 'торсу', 'торс', 'торсом', 'торсе'], 'm'),
  tags: ['vital'],
  hitWeight: 6,
  maxHp: 20,
  armorSlot: 'body',
}

/** «левая рука» → все падежи для прилагательного + существительного женского рода. */
function femPart(adjs: string[], noun: [string, string, string, string, string, string]): string[] {
  // adjs: прилагательные в им. п. ж. р. (напр. ['левая', 'верхняя'])
  const decl = (adj: string, c: number): string => {
    const soft = adj.endsWith('яя')
    const stem = adj.slice(0, -2)
    const endings = soft ? ['яя', 'ей', 'ей', 'юю', 'ей', 'ей'] : ['ая', 'ой', 'ой', 'ую', 'ой', 'ой']
    return stem + endings[c]
  }
  return noun.map((n, c) => [...adjs.map((a) => decl(a, c)), n].join(' '))
}

const RUKA: [string, string, string, string, string, string] = ['рука', 'руки', 'руке', 'руку', 'рукой', 'руке']
const NOGA: [string, string, string, string, string, string] = ['нога', 'ноги', 'ноге', 'ногу', 'ногой', 'ноге']
const LAPA: [string, string, string, string, string, string] = ['лапа', 'лапы', 'лапе', 'лапу', 'лапой', 'лапе']

function part(id: string, adjs: string[], noun: typeof RUKA, rest: Omit<BodyPartDef, 'id' | 'name'>): BodyPartDef {
  const f = femPart(adjs, noun) as [string, string, string, string, string, string]
  return { id, name: w(f, 'f'), ...rest }
}

const arm = (id: string, adjs: string[], slot: 'hands' | 'hands_lower'): BodyPartDef =>
  part(id, adjs, RUKA, { tags: ['grasp'], hitWeight: 2, maxHp: 12, armorSlot: slot, severable: true })
const leg = (id: string, adj: string): BodyPartDef =>
  part(id, [adj], NOGA, { tags: ['stance'], hitWeight: 2, maxHp: 12, armorSlot: 'legs', severable: true })

export const BODY_PLANS: Record<string, BodyPlanDef> = {
  humanoid: {
    id: 'humanoid',
    name: w(['гуманоид', 'гуманоида', 'гуманоиду', 'гуманоида', 'гуманоидом', 'гуманоиде'], 'm'),
    mainHand: 'right_arm',
    parts: [
      head,
      torso,
      arm('left_arm', ['левая'], 'hands'),
      arm('right_arm', ['правая'], 'hands'),
      leg('left_leg', 'левая'),
      leg('right_leg', 'правая'),
    ],
  },
  humanoid_fourarmed: {
    id: 'humanoid_fourarmed',
    name: w(
      ['четырёхрукий', 'четырёхрукого', 'четырёхрукому', 'четырёхрукого', 'четырёхруким', 'четырёхруком'],
      'm',
    ),
    mainHand: 'right_upper_arm',
    parts: [
      head,
      torso,
      arm('left_upper_arm', ['левая', 'верхняя'], 'hands'),
      arm('right_upper_arm', ['правая', 'верхняя'], 'hands'),
      arm('left_lower_arm', ['левая', 'нижняя'], 'hands_lower'),
      arm('right_lower_arm', ['правая', 'нижняя'], 'hands_lower'),
      leg('left_leg', 'левая'),
      leg('right_leg', 'правая'),
    ],
  },
  quadruped: {
    id: 'quadruped',
    name: w(['четвероногий', 'четвероногого', 'четвероногому', 'четвероногого', 'четвероногим', 'четвероногом'], 'm'),
    parts: [
      { ...head, tags: ['vision', 'vital', 'bite'], hitWeight: 3, armorSlot: undefined },
      { ...torso, hitWeight: 5, armorSlot: undefined },
      part('front_left_leg', ['левая', 'передняя'], LAPA, { tags: ['stance', 'claw'], hitWeight: 2, maxHp: 10, severable: true }),
      part('front_right_leg', ['правая', 'передняя'], LAPA, { tags: ['stance', 'claw'], hitWeight: 2, maxHp: 10, severable: true }),
      part('hind_left_leg', ['левая', 'задняя'], LAPA, { tags: ['stance'], hitWeight: 2, maxHp: 10, severable: true }),
      part('hind_right_leg', ['правая', 'задняя'], LAPA, { tags: ['stance'], hitWeight: 2, maxHp: 10, severable: true }),
    ],
  },
}

export const SLOTS: Record<SlotId, SlotDef> = {
  weapon: { id: 'weapon', kind: 'weapon', name: 'оружие' },
  head: { id: 'head', kind: 'head', name: 'голова' },
  body: { id: 'body', kind: 'body', name: 'торс' },
  hands: { id: 'hands', kind: 'hands', name: 'руки' },
  hands_lower: { id: 'hands_lower', kind: 'hands', name: 'нижние руки' },
  legs: { id: 'legs', kind: 'legs', name: 'ноги' },
}

/** Конфигурации киборга, доступные при создании персонажа. */
export const CYBORG_CONFIGS: Record<string, CyborgConfigDef> = {
  humanoid: {
    bodyPlan: 'humanoid',
    name: 'Стандартная формация',
    description: 'Две бионические руки, бионические ноги, органические голова и торс.',
    materials: { left_arm: 'bionic', right_arm: 'bionic', left_leg: 'bionic', right_leg: 'bionic' },
    maxHp: 40,
    partHpScale: 1.2,
  },
  humanoid_fourarmed: {
    bodyPlan: 'humanoid_fourarmed',
    name: 'Четырёхрукая формация',
    description: 'Четыре бионические руки (больше слотов для наручей), бионические ноги.',
    materials: {
      left_upper_arm: 'bionic',
      right_upper_arm: 'bionic',
      left_lower_arm: 'bionic',
      right_lower_arm: 'bionic',
      left_leg: 'bionic',
      right_leg: 'bionic',
    },
    maxHp: 40,
    partHpScale: 1.2,
  },
}
