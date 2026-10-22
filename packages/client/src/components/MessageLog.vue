<script setup lang="ts">
// Панель журнала: без прокрутки, всегда видны последние записи; весь журнал — кнопкой или клавишей p.
import { nextTick, ref, watch } from 'vue'
import { store } from '../store'
import MessageList from './MessageList.vue'

const box = ref<HTMLElement | null>(null)
watch(
  () => {
    const last = store.log[store.log.length - 1]
    return last && `${last.id}:${last.count}`
  },
  async () => {
    await nextTick()
    if (box.value) box.value.scrollTop = box.value.scrollHeight
  },
)
</script>

<template>
  <div class="log">
    <div ref="box" class="lines"><MessageList /></div>
    <button class="expand" tabindex="-1" title="Весь журнал (p)" @mousedown.prevent @click="store.modal = 'log'">⤢ p</button>
  </div>
</template>

<style scoped>
.log {
  position: relative;
  height: 150px;
  border-top: 1px solid #1f3a44;
  background: #050708;
}
.lines {
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  padding: 4px 8px;
  font-size: 14px;
  line-height: 1.35;
}
.expand {
  position: absolute;
  top: 4px;
  right: 6px;
  padding: 0 6px;
  background: #061015;
  border: 1px solid #1f3a44;
  color: #2f8f9e;
  font-family: Consolas, 'DejaVu Sans Mono', monospace;
  font-size: 12px;
  cursor: pointer;
}
.expand:hover {
  color: #5ff0ff;
  border-color: #2fb7c9;
}
</style>
