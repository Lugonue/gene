<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../store'
import { EFF_COLORS, WOUND_COLORS } from '../colors'

const view = computed(() => store.view)
const hpPct = computed(() => (view.value ? Math.max(0, (view.value.player.hp / view.value.player.maxHp) * 100) : 0))
const hpColor = computed(() => (hpPct.value > 60 ? '#5fd068' : hpPct.value > 30 ? '#e8d44d' : '#ef4b4b'))
</script>

<template>
  <aside v-if="view" class="hud">
    <div class="title">
      <span class="name">{{ view.player.name }}</span>
      <span class="dim">КИБОРГ</span>
    </div>
    <div class="row"><span class="dim">Глубина</span> {{ view.depth }} / 4</div>
    <div class="row"><span class="dim">Ход</span> {{ view.turn }}</div>
    <div class="row hp">
      <span class="dim">Целостность</span> {{ view.player.hp }}/{{ view.player.maxHp }}
      <div class="bar"><div class="fill" :style="{ width: hpPct + '%', background: hpColor }" /></div>
    </div>

    <div class="section">[ДИАГНОСТИКА]</div>
    <div v-for="part in view.player.parts" :key="part.id" class="part">
      <span class="mat" :class="part.material">{{ part.material === 'bionic' ? '[Б]' : '[О]' }}</span>
      <span class="pname">{{ part.name }}</span>
      <span class="stage" :style="{ color: WOUND_COLORS[part.wound] }">{{ part.label }}</span>
      <span class="php dim">{{ part.hp }}/{{ part.maxHp }}</span>
    </div>

    <div class="section">[СНАРЯЖЕНИЕ]</div>
    <div v-for="slot in view.equipment" :key="slot.slot" class="equip">
      <span class="dim slot">{{ slot.slotName }}:</span>
      <template v-if="slot.item">
        <span class="iname">{{ slot.item.name }}</span>
        <span class="dur" :style="{ color: EFF_COLORS[slot.item.effTier ?? 4] }">{{ slot.item.durabilityText }}</span>
      </template>
      <span v-else class="dim">—</span>
    </div>

    <div v-if="view.here.length" class="section">[ЗДЕСЬ]</div>
    <div v-for="it in view.here" :key="it.id" class="here">
      <span :style="{ color: it.color }">{{ it.glyph }}</span> {{ it.name }}<span v-if="it.count"> ×{{ it.count }}</span>
    </div>

    <div v-if="view.monsters.length" class="section">[В ПОЛЕ ЗРЕНИЯ]</div>
    <div v-for="m in view.monsters" :key="m.id" class="mon">
      <span :style="{ color: m.color }">{{ m.glyph }}</span> {{ m.name }}
      <span v-if="m.fleeing" class="dim">(отступает)</span>
      <div v-for="part in m.parts.filter((p) => p.wound !== 'none')" :key="part.id" class="mpart">
        {{ part.name }}: <span :style="{ color: WOUND_COLORS[part.wound] }">{{ part.label }}</span>
      </div>
    </div>

    <div class="hint dim">? — подсказка по клавишам</div>
  </aside>
</template>

<style scoped>
.hud {
  width: 300px;
  padding: 8px 10px;
  font-family: Consolas, 'DejaVu Sans Mono', monospace;
  font-size: 13px;
  color: #cfe9ee;
  background: #061015;
  border-left: 1px solid #1f3a44;
  overflow-y: auto;
}
.title {
  display: flex;
  justify-content: space-between;
  font-size: 15px;
  margin-bottom: 4px;
}
.name {
  color: #5ff0ff;
}
.dim {
  color: #5f7d86;
}
.row {
  margin: 2px 0;
}
.bar {
  height: 6px;
  background: #1a2a30;
  margin-top: 2px;
}
.fill {
  height: 100%;
}
.section {
  margin-top: 10px;
  color: #2fb7c9;
}
.part,
.equip {
  display: flex;
  gap: 6px;
  margin: 1px 0;
}
.mat.bionic {
  color: #5ff0ff;
}
.mat.organic {
  color: #e08a8a;
}
.pname {
  flex: 1;
}
.php {
  width: 44px;
  text-align: right;
}
.slot {
  width: 90px;
}
.iname {
  flex: 1;
}
.hint {
  margin-top: 14px;
}
.mpart {
  padding-left: 18px;
  font-size: 12px;
  color: #8fa5ab;
}
</style>
