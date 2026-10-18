<script setup lang="ts">
// Осмотр клетки: монстр (название и видимое состояние частей тела), предмет или клетка карты.
import { computed } from 'vue'
import { store } from '../store'
import { WOUND_COLORS } from '../colors'

const TILE_NAMES: Record<string, string> = {
  '#': 'стена',
  '.': 'пол',
  '+': 'закрытая дверь',
  "'": 'открытая дверь',
  '<': 'лестница вверх',
  '>': 'лестница вниз',
  Ω: 'портал — путь домой',
}
const HEALTH = ['при смерти', 'тяжело ранен', 'ранен', 'легко ранен', 'невредим']

const info = computed(() => {
  const view = store.view
  const pos = store.inspect
  if (!view || !pos) return null
  const i = pos.y * view.map.width + pos.x
  const vis = view.map.vis[i]
  const isPlayer = view.player.x === pos.x && view.player.y === pos.y
  return {
    vis,
    isPlayer,
    tile: vis === '0' ? 'неизвестно' : (TILE_NAMES[view.map.tiles[i] ?? ''] ?? '?'),
    monster: vis === '2' ? view.monsters.find((m) => m.x === pos.x && m.y === pos.y) : undefined,
    item: vis === '2' ? view.floorItems.find((it) => it.x === pos.x && it.y === pos.y) : undefined,
  }
})
</script>

<template>
  <div v-if="info" class="inspect">
    <div v-if="store.lookMode" class="mode">[ОСМОТР] стрелки — двигать курсор, x/Esc — выход</div>
    <template v-if="info.monster">
      <div class="title">
        <span :style="{ color: info.monster.color }">{{ info.monster.glyph }}</span> {{ info.monster.name }}
        <span class="dim">— {{ HEALTH[info.monster.health] }}{{ info.monster.fleeing ? ', отступает' : '' }}</span>
      </div>
      <div class="parts">
        <span v-for="p in info.monster.parts" :key="p.id" class="part">
          {{ p.name }}: <span :style="{ color: WOUND_COLORS[p.wound] }">{{ p.label }}</span>
        </span>
      </div>
    </template>
    <div v-else-if="info.isPlayer" class="title">@ это ты</div>
    <div v-if="info.item" class="row">
      <span :style="{ color: info.item.color }">{{ info.item.glyph }}</span> {{ info.item.name
      }}<span v-if="info.item.count > 1"> ×{{ info.item.count }}</span>
    </div>
    <div class="row dim">{{ info.tile }}{{ info.vis === '1' ? ' (по памяти)' : '' }}</div>
  </div>
</template>

<style scoped>
.inspect {
  padding: 4px 8px;
  border-top: 1px solid #1f3a44;
  font-family: Consolas, 'DejaVu Sans Mono', monospace;
  font-size: 13px;
  color: #cfe9ee;
  background: #061015;
  min-height: 22px;
}
.mode {
  color: #ffd24a;
}
.title {
  color: #fff;
}
.dim {
  color: #5f7d86;
}
.parts {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
}
</style>
