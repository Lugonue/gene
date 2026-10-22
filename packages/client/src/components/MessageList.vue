<script setup lang="ts">
// Записи журнала: общий вид для панели журнала и полноэкранного журнала.
import { store } from '../store'
</script>

<template>
  <div v-for="m in store.log" :key="m.id" class="msg" :class="[m.kind, { fresh: m.fresh }]">
    {{ m.text }}<span v-if="m.count > 1" class="count">&nbsp;×{{ m.count }}</span>
  </div>
</template>

<style scoped>
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
