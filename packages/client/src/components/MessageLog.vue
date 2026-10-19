<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { store } from '../store'

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
  <div ref="box" class="log">
    <div v-for="m in store.log" :key="m.id" class="msg" :class="[m.kind, { fresh: m.fresh }]">
      {{ m.text }}<span v-if="m.count > 1" class="count">&nbsp;×{{ m.count }}</span>
    </div>
  </div>
</template>

<style scoped>
.log {
  height: 150px;
  overflow-y: auto;
  padding: 4px 8px;
  border-top: 1px solid #1f3a44;
  font-size: 14px;
  line-height: 1.35;
  background: #050708;
}
.msg {
  color: #8d949a;
}
.msg.fresh {
  color: #f2f2f2;
}
.count {
  opacity: 0.7;
}
.msg.system {
  color: #2f8f9e;
  font-family: Consolas, 'DejaVu Sans Mono', monospace;
}
.msg.system.fresh {
  color: #5ff0ff;
}
.msg.warning {
  color: #9a6a3a;
}
.msg.warning.fresh {
  color: #ffb057;
}
</style>
