<script setup lang="ts">
// Выбор цели: бинт — органическая часть тела; ремкомплект — предмет снаряжения или бионическая часть тела.
import { computed } from 'vue'
import type { Command } from '@gene/core'
import { store } from '../store'
import { sendCommand } from '../net'
import { useKeys } from '../keys'
import { EFF_COLORS, WOUND_COLORS } from '../colors'
import Modal from './Modal.vue'

const props = defineProps<{ mode: 'bandage' | 'repair' }>()

interface Target {
  key: string
  label: string
  detail: string
  color: string
  cmd: Command
}

const targets = computed<Target[]>(() => {
  const view = store.view
  const itemId = store.usingItemId
  if (!view || !itemId) return []
  const list: Target[] = []
  const material = props.mode === 'bandage' ? 'organic' : 'bionic'
  for (const part of view.player.parts.filter((p) => p.material === material)) {
    list.push({
      key: String(list.length + 1),
      label: `${part.material === 'bionic' ? '[Б]' : '[О]'} ${part.name}`,
      detail: `${part.label} ${part.hp}/${part.maxHp}`,
      color: WOUND_COLORS[part.wound],
      cmd: { type: 'use', itemId, targetPartId: part.id },
    })
  }
  if (props.mode === 'repair') {
    for (const it of view.inventory.filter((i) => i.category !== 'consumable')) {
      list.push({
        key: it.letter ?? '',
        label: `${it.name}${it.equippedSlot ? ' (надет)' : ''}`,
        detail: it.durabilityText ?? '',
        color: EFF_COLORS[it.effTier ?? 4]!,
        cmd: { type: 'use', itemId, targetItemId: it.id },
      })
    }
  }
  return list
})

function choose(t: Target): void {
  store.modal = null
  store.usingItemId = null
  sendCommand(t.cmd)
}

useKeys((ev) => {
  const t = targets.value.find((x) => x.key === ev.key)
  if (!t) return
  choose(t)
  return true
})
</script>

<template>
  <Modal :title="mode === 'bandage' ? 'Бинт: какую часть тела перевязать?' : 'Ремкомплект: что чинить?'">
    <div v-if="mode === 'repair'" class="muted hint">Цифры — бионические части тела, буквы — снаряжение.</div>
    <div v-for="t in targets" :key="t.key + t.label" class="list-row" @click="choose(t)">
      <span class="key">{{ t.key }}</span>
      <span class="nm">{{ t.label }}</span>
      <span :style="{ color: t.color }">{{ t.detail }}</span>
    </div>
  </Modal>
</template>

<style scoped>
.nm {
  flex: 1;
}
.hint {
  margin-bottom: 6px;
  color: #5f7d86;
}
</style>
