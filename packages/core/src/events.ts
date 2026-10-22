// Структурированные события, которые возвращает core. Превращение в текст — в @gene/messages.
import type { DamageType, Material, PhenomenonId, RejectReasonKey, SkillId, SlotId, WoundStage } from '@gene/data'
import type { StudyStatus } from './state'
import type { FeatureKind } from './world/notice'
import type { FatigueStage } from './combat/formulas'

/** Ссылка на существо в событии: id и вид ('player' или id монстра). */
export interface ActorRef {
  id: string
  kind: string
}

export type AttackRef =
  | { kind: 'weapon'; itemDefId: string; damageType: DamageType }
  | { kind: 'natural'; attackId: string; damageType: DamageType }
  /** Выстрел или бросок: itemDefId — оружие, projectileDefId — боеприпас или само метательное оружие. */
  | { kind: 'ranged'; itemDefId: string; projectileDefId: string; damageType: DamageType }
  /** Заклинание-снаряд (id из SPELLS). */
  | { kind: 'spell'; spellId: string; damageType: DamageType }

export type HitSeverity = 'absorbed' | 'light' | 'medium' | 'heavy'

export type RejectReason = RejectReasonKey

export type GameEvent =
  | { type: 'commandRejected'; reason: RejectReason }
  | { type: 'gameStarted'; name: string }
  | { type: 'doorOpened' }
  | { type: 'levelChanged'; depth: number; dir: 'down' | 'up' }
  | { type: 'blocked' }
  | { type: 'monsterNoticed'; creature: ActorRef }
  /** Вид впервые попал в бестиарий (kind — id монстра). */
  | { type: 'speciesDiscovered'; kind: string }
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
      /** Сильный удар (порог — isStrongHit в модуле формул): повод для окна-сцены. */
      strong?: true
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
  /** Холод замедлил существо; slowEnded — замедление прошло. */
  | { type: 'creatureSlowed'; creature: ActorRef }
  | { type: 'slowEnded'; creature: ActorRef }
  | { type: 'shotFired'; attacker: ActorRef; weaponDefId: string; projectileDefId: string }
  | { type: 'projectileBroken'; projectileDefId: string }
  /** Снаряд никого не задел: упал на пол или ударился в стену. */
  | { type: 'projectileLanded'; projectileDefId: string; wall: boolean }
  /** Монстр колдует: снаряд в цель или лечение союзника-цели. */
  | { type: 'spellCast'; caster: ActorRef; spellId: string; target: ActorRef }
  /** Срыв: ход и перезарядка потрачены, эффекта нет. */
  | { type: 'spellFizzled'; caster: ActorRef; spellId: string }
  /** Усталость заклинателя перешла на новую ступень. */
  | { type: 'casterTired'; caster: ActorRef; stage: Exclude<FatigueStage, 'fresh'> }
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
  /** Ядро впервые зафиксировало явление; n — номер в условном имени («термическая аномалия №n»). */
  | { type: 'phenomenonDiscovered'; phenomenon: PhenomenonId; n: number }
  | { type: 'phenomenonStudyChanged'; phenomenon: PhenomenonId; n: number; status: Exclude<StudyStatus, 'unknown'> }
  /** Явление изучено: рецепт открыт (пока только описание). */
  | { type: 'recipeUnlocked'; phenomenon: PhenomenonId }
  | { type: 'restInterrupted' }
  | { type: 'restFinished' }
  | { type: 'itemsNoticed'; itemDefIds: string[] }
  | { type: 'featureNoticed'; feature: FeatureKind }
  | { type: 'exploreFinished' }
  | { type: 'autoLimitReached' }
  | { type: 'gameWon' }
