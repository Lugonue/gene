// Подписи для интерфейса (не шаблоны сообщений — те в messages.ts).
import type { DamageType, ItemCategory, Material, WoundStage } from './types'

/** Название стадии раны с учётом материала части тела. */
export const WOUND_LABELS: Record<Material, Record<WoundStage, string>> = {
  organic: {
    none: 'цела',
    bruised: 'ушиб',
    wounded: 'рана',
    crippled: 'тяжёлая рана',
    severed: 'отсечена',
  },
  bionic: {
    none: 'исправна',
    bruised: 'царапины',
    wounded: 'повреждена',
    crippled: 'сильно повреждена',
    severed: 'утрачена',
  },
}

/** Бионическая часть с нулевым hp — «отказ». */
export const BIONIC_FAILURE_LABEL = 'отказ'

export const MATERIAL_MARK: Record<Material, string> = { organic: '[О]', bionic: '[Б]' }

export const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  slash: 'рубящий',
  pierce: 'колющий',
  blunt: 'дробящий',
}

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  weapon: 'оружие',
  armour: 'броня',
  consumable: 'расходник',
}

export const STUDY_LABELS = { unknown: 'не изучен', partial: 'частично изучен', known: 'изучен' } as const
