<script setup lang="ts">
import { store } from '../store'
import { backToCreate } from '../net'
</script>

<template>
  <div v-if="store.summary" class="over">
    <h1 :class="store.summary.status">
      {{ store.summary.status === 'won' ? '[ЯДРО] ПОРТАЛ ДОСТИГНУТ. ВОЗВРАТ.' : '[ЯДРО] КРИТИЧЕСКИЙ ОТКАЗ. СВЯЗЬ ПОТЕРЯНА.' }}
    </h1>
    <table>
      <tbody>
        <tr><td>Киборг</td><td>{{ store.summary.name }}</td></tr>
        <tr><td>Глубина</td><td>{{ store.summary.depth }} (макс. {{ store.summary.maxDepth }})</td></tr>
        <tr v-if="store.summary.killedBy"><td>Убит</td><td>{{ store.summary.killedBy }}</td></tr>
        <tr><td>Ходов</td><td>{{ store.summary.turns }}</td></tr>
      </tbody>
    </table>
    <h2>Последние записи журнала</h2>
    <div v-for="(m, i) in store.summary.lastMessages" :key="i" class="msg" :class="m.kind">{{ m.text }}</div>
    <button @click="backToCreate">Новая игра</button>
  </div>
</template>

<style scoped>
.over {
  max-width: 720px;
  margin: 40px auto;
  font-family: Consolas, 'DejaVu Sans Mono', monospace;
  color: #cfe9ee;
}
h1.dead {
  color: #ef4b4b;
}
h1.won {
  color: #5ff0ff;
}
h2 {
  font-size: 15px;
  color: #2fb7c9;
  margin-top: 20px;
}
td:first-child {
  color: #5f7d86;
  padding-right: 20px;
}
.msg {
  color: #b8c4c8;
}
.msg.system {
  color: #5ff0ff;
}
button {
  margin-top: 20px;
  background: #0f3a44;
  color: #5ff0ff;
  border: 1px solid #2fb7c9;
  padding: 6px 18px;
  font: inherit;
  cursor: pointer;
}
</style>
