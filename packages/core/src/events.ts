// Структурированные события, которые возвращает core. Превращение в текст — в @gene/messages.
import type { DamageType, Material, RejectReasonKey, SkillId, SlotId, WoundStage } from '@gene/data'
import type { StudyStatus } from './state'

/** Ссылка на существо в событии: id и вид ('player' или id монстра). */
export interface ActorRef {
  id: string
  kind: string
}

export type AttackRef =
  | { kind: 'weapon'; itemDefId: string; damageType: DamageType }
  | { kind: 'natural'; attackId: string; damageType: DamageType }

export type HitSeverity = 'absorbed' | 'light' | 'medium' | 'heavy'

export type RejectReason = RejectReasonKey

export type GameEvent =
  | { type: 'commandRejected'; reason: RejectReason }
  | { type: 'gameStarted'; name: string }
  | { type: 'doorOpened' }
  | { type: 'levelChanged'; depth: number; dir: 'down' | 'up' }
  | { type: 'blocked' }
  | { type: 'monsterNoticed'; creature: ActorRef }
  | {
      type: 'attackMissed'
      attacker: ActorRef
      target: ActorRef
      attack: AttackRef
      partId: string
    }
  | {
      type: 'attackHit'
      attacker: ActorRef
      target: ActorRef
      attack: AttackRef
      partId: string
      partMaterial: Material
      damage: number
      absorbed: number
      armourDefId?: string
      severity: HitSeverity
    }
  | {
      type: 'woundChanged'
      creature: ActorRef
      partId: string
      material: Material
      from: WoundStage
      to: WoundStage
      hp: number
      maxHp: number
    }
  | {
      type: 'itemDamaged'
      owner: ActorRef
      itemDefId: string
      durability: number
      maxDurability: number
      efficiency: number
    }
  | { type: 'itemBroken'; owner: ActorRef; itemDefId: string }
  | {
      type: 'creatureDied'
      creature: ActorRef
      killer?: ActorRef
      cause: 'vital' | 'hp'
      partId?: string
    }
  | { type: 'monsterFlees'; creature: ActorRef }
  | { type: 'itemsHere'; itemDefIds: string[] }
  | { type: 'itemPickedUp'; itemDefId: string; count: number }
  | { type: 'itemDropped'; itemDefId: string; count: number; owner: ActorRef }
  | { type: 'itemEquipped'; itemDefId: string; slot: SlotId }
  | { type: 'itemUnequipped'; itemDefId: string; slot: SlotId }
  | { type: 'bandageApplied'; partId: string; from: WoundStage; to: WoundStage }
  | { type: 'potionDrunk'; healed: number }
  | { type: 'itemRepaired'; itemDefId: string; durability: number; maxDurability: number }
  | { type: 'partRepaired'; partId: string; from: WoundStage; to: WoundStage }
  | { type: 'itemDisassembled'; itemDefId: string; skill: SkillId }
  | { type: 'skillUp'; skill: SkillId; level: number }
  | { type: 'newItemType'; itemDefId: string }
  | { type: 'studyChanged'; itemDefId: string; status: StudyStatus }
  | { type: 'restInterrupted' }
  | { type: 'restFinished' }
  | { type: 'gameWon' }
