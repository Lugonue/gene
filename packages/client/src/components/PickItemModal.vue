<script setup lang="ts">
// Быстрый выбор предмета для действия: применить (a), выбросить (d), разобрать (D).
import { computed, ref } from 'vue'
import type { ItemView } from '@gene/core'
import { store } from '../store'
import { useKeys } from '../keys'
import { consumableEffect, disassembleItem, dropItem, useItem } from '../actions'
import { EFF_COLORS } from '../colors'
import Modal from './Modal.vue'

const props = defineProps<{ mode: 'use' | 'drop' | 'disassemble' }>()
const confirmId = ref<string | null>(null)

const titles = { use: 'Применить', drop: 'Выбросить', disassemble: 'Разобрать (Ядро получит данные о типе)' }
const items = computed(() =>
  (store.view?.inventory ?? []).filter((it) =>
    props.mode === 'use' ? !!consumableEffect(it) : props.mode === 'disassemble' ? it.category !== 'consumable' : true,
  ),
)

function choose(it: ItemView): void {
  if (props.mode === 'use') useItem(it)
  else if (props.mode === 'drop') dropItem(it)
  else if (confirmId.value === it.id) disassembleItem(it)
  else confirmId.value = it.id
}

useKeys((ev) => {
  const it = items.value.find((i) => i.letter === ev.key)
  if (!it) return
  choose(it)
  return true
})
</script>

<template>
  <Modal :title="titles[mode]">
    <div v-if="!items.length" class="empty">Подходящих предметов нет.</div>
    <div v-for="it in items" :key="it.id" class="list-row" @click="choose(it)">
      <span class="key">{{ it.letter }}</span>
      <span :style="{ color: it.color }">{{ it.glyph }}</span>
      <span class="nm">{{ it.name }}<span v-if="it.count"> ×{{ it.count }}</span></span>
      <span v-if="it.equippedSlot" class="muted">(надет)</span>
      <span v-if="it.durabilityText" :style="{ color: EFF_COLORS[it.effTier ?? 4] }">{{ it.durabilityText }}</span>
      <span v-if="confirmId === it.id" class="warn">ещё раз — подтвердить</span>
    </div>
  </Modal>
</template>

<style scoped>
.nm {
  flex: 1;
}
.warn {
  color: #ffb057;
}
</style>
