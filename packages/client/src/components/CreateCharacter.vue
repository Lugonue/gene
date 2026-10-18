<script setup lang="ts">
import { ref } from 'vue'
import { CYBORG_CONFIGS, ITEMS, START_WEAPONS } from '@gene/data'
import { newGame } from '../net'

const name = ref('КБ-7')
const bodyPlan = ref('humanoid')
const weapon = ref<string>('short_sword')
const configs = Object.entries(CYBORG_CONFIGS)

function submit(): void {
  if (!name.value.trim()) return
  newGame(name.value.trim(), bodyPlan.value, weapon.value)
}
</script>

<template>
  <div class="create">
    <h1>[ЯДРО] ИНИЦИАЛИЗАЦИЯ</h1>
    <p class="intro">
      Сбой темпорального переноса. Киборг из будущего очнулся в средневековом подземелье. Оружие из будущего вышло
      из строя. Где-то в глубине — портал домой.
    </p>
    <form @submit.prevent="submit">
      <label>
        Обозначение киборга
        <input v-model="name" maxlength="24" autofocus />
      </label>

      <fieldset>
        <legend>Формация тела</legend>
        <label v-for="[id, c] in configs" :key="id" class="choice">
          <input v-model="bodyPlan" type="radio" :value="id" />
          <b>{{ c.name }}</b> — {{ c.description }}
        </label>
      </fieldset>

      <fieldset>
        <legend>Стартовое оружие (подобрано у входа, ядро успело его изучить)</legend>
        <label v-for="id in START_WEAPONS" :key="id" class="choice">
          <input v-model="weapon" type="radio" :value="id" />
          {{ ITEMS[id]?.name.nom }}
        </label>
      </fieldset>

      <button type="submit">Запуск</button>
    </form>
  </div>
</template>

<style scoped>
.create {
  max-width: 640px;
  margin: 40px auto;
  font-family: Consolas, 'DejaVu Sans Mono', monospace;
  color: #cfe9ee;
}
h1 {
  color: #5ff0ff;
  font-size: 20px;
}
.intro {
  color: #8fb0b8;
}
label {
  display: block;
  margin: 8px 0;
}
input:not([type='radio']) {
  display: block;
  margin-top: 4px;
  background: #0b1a20;
  color: #fff;
  border: 1px solid #2f5f6a;
  padding: 4px 6px;
  font: inherit;
}
fieldset {
  border: 1px solid #1f3a44;
  margin: 12px 0;
}
legend {
  color: #2fb7c9;
}
button {
  background: #0f3a44;
  color: #5ff0ff;
  border: 1px solid #2fb7c9;
  padding: 6px 18px;
  font: inherit;
  cursor: pointer;
}
</style>
