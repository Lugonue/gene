<script setup lang="ts">
// Выбор цели: только цели, к которым предмет применим (список — в targets.ts).
import { computed } from 'vue'
import { store } from '../store'
import { sendCommand } from '../net'
import { useKeys } from '../keys'
import { useTargets, type Target, type TargetMode } from '../targets'
import Modal from './Modal.vue'

const props = defineProps<{ mode: TargetMode }>()

const targets = computed<Target[]>(() => {
  const view = store.view
  const itemId = store.usingItemId
  if (!view || !itemId) return []
  return useTargets(view, itemId, props.mode)
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
