<script setup lang="ts">
// Журнал на весь экран: все сохранённые записи с прокруткой; открывается на последних.
import { nextTick, onMounted, ref } from 'vue'
import { store } from '../store'
import { useKeys } from '../keys'
import MessageList from './MessageList.vue'

const box = ref<HTMLElement | null>(null)

onMounted(async () => {
  await nextTick()
  if (box.value) box.value.scrollTop = box.value.scrollHeight
})

useKeys((ev) => {
  if (ev.key === 'p') {
    store.modal = null
    return true
  }
})
</script>

<template>
  <div class="full">
    <div class="head">
      <span>Журнал — {{ store.log.length }} записей</span>
      <span class="close" @click="store.modal = null">p / Esc ✕</span>
    </div>
    <div ref="box" class="body"><MessageList /></div>
  </div>
</template>

<style scoped>
.full {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  background: #050708;
}
.head {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid #1f3a44;
  color: #5ff0ff;
  font-family: Consolas, 'DejaVu Sans Mono', monospace;
  font-size: 13px;
}
.close {
  cursor: pointer;
  color: #8d949a;
}
.body {
  flex: 1;
  overflow-y: auto;
  padding: 6px 12px;
  font-size: 14px;
  line-height: 1.35;
}
</style>
