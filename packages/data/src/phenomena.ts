import type { PhenomenonId } from './types'

// Явления, как их видит Ядро (спека factions, «Явления и база знаний»; рецепты — по таблице docs/lore.md).
export interface PhenomenonDef {
  id: PhenomenonId
  /** Условное имя до изучения, к нему добавляется номер: «термическая аномалия №1». */
  codeName: string
  /** Предварительная оценка на стадии «частично». */
  partialName: string
  /** Настоящее название — только после изучения. */
  name: string
  /** Рецепт: технологическое воспроизведение эффекта. Пока только описание. */
  recipe: { name: string; description: string }
}

export const PHENOMENA: Record<PhenomenonId, PhenomenonDef> = {
  fireball: {
    id: 'fireball',
    codeName: 'термическая аномалия',
    partialName: 'направленный тепловой снаряд',
    name: 'огненный шар',
    recipe: { name: 'Поджог оружия', description: 'Удары оружием наносят ожоги.' },
  },
  frost_bolt: {
    id: 'frost_bolt',
    codeName: 'криогенная аномалия',
    partialName: 'охлаждающий снаряд',
    name: 'ледяная стрела',
    recipe: { name: 'Охлаждение', description: 'Удары оружием замедляют цель.' },
  },
  lightning: {
    id: 'lightning',
    codeName: 'электромагнитная аномалия',
    partialName: 'направленный электрический разряд',
    name: 'молния',
    recipe: { name: 'Разряд через оружие', description: 'Удары оружием бьют током и оглушают цель.' },
  },
  heal: {
    id: 'heal',
    codeName: 'биологическая аномалия',
    partialName: 'ускорение роста тканей',
    name: 'лечение',
    recipe: {
      name: 'Ускоренная регенерация органики',
      description: 'Органические части тела заживают быстрее.',
    },
  },
}

/** Условное имя явления с номером. */
export function phenomenonCodeName(id: PhenomenonId, n: number): string {
  return `${PHENOMENA[id].codeName} №${n}`
}

/** Имя явления по стадии изученности: неизвестно — условное, частично — с оценкой, изучено — настоящее. */
export function phenomenonName(id: PhenomenonId, n: number, status: 'unknown' | 'partial' | 'known'): string {
  if (status === 'known') return PHENOMENA[id].name
  const code = phenomenonCodeName(id, n)
  return status === 'partial' ? `${code}: ${PHENOMENA[id].partialName}` : code
}
