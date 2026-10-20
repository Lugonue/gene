<script setup lang="ts">
import type { ItemView } from '@gene/core'
import { EFF_COLORS } from '../colors'
import { STATUS_LABEL } from '../actions'

defineProps<{ item: ItemView }>()
const EFF_PCT = ['0%', '40%', '65%', '85%', '100%']
</script>

<template>
  <div class="details">
    <div class="name"><span :style="{ color: item.color }">{{ item.glyph }}</span> {{ item.name }}</div>
    <template v-if="item.category !== 'consumable'">
      <div class="status" :class="item.status">[ЯДРО] {{ STATUS_LABEL[item.status] }}</div>
      <table>
        <tbody>
          <tr v-if="item.stats.damage"><td>Урон</td><td>{{ item.stats.damage }}</td></tr>
          <tr v-if="item.stats.accuracy"><td>Точность</td><td>{{ item.stats.accuracy }}</td></tr>
          <tr v-if="item.stats.damageType"><td>Тип урона</td><td>{{ item.stats.damageType }}</td></tr>
          <tr v-if="item.stats.absorb"><td>Поглощение</td><td>{{ item.stats.absorb }}</td></tr>
          <tr v-if="item.stats.skill"><td>Навык</td><td>{{ item.stats.skill }}</td></tr>
          <tr v-if="item.stats.range"><td>Дальность</td><td>{{ item.stats.range }}</td></tr>
          <tr v-if="item.stats.ammo"><td>Боеприпас</td><td>{{ item.stats.ammo }}</td></tr>
          <tr v-if="item.stats.twoHanded"><td>Хват</td><td>двуручное</td></tr>
          <tr>
            <td>Прочность</td>
            <td :style="{ color: EFF_COLORS[item.effTier ?? 4] }">{{ item.durabilityText }}</td>
          </tr>
          <tr><td>Эффективность</td><td :style="{ color: EFF_COLORS[item.effTier ?? 4] }">{{ EFF_PCT[item.effTier ?? 4] }}{{ item.effTier === 0 ? ' (сломан)' : '' }}</td></tr>
          <tr><td>Макс. прочность</td><td>{{ item.stats.maxDurability }}</td></tr>
        </tbody>
      </table>
    </template>
    <div v-else class="muted">Расходник{{ item.count ? ` ×${item.count}` : '' }}</div>
  </div>
</template>

<style scoped>
.details {
  min-width: 220px;
}
.name {
  font-size: 14px;
  margin-bottom: 4px;
}
.status {
  color: #5f7d86;
  margin-bottom: 4px;
}
.status.known {
  color: #5ff0ff;
}
.status.partial {
  color: #2fb7c9;
}
td:first-child {
  color: #5f7d86;
  padding-right: 14px;
}
.muted {
  color: #5f7d86;
}
</style>
