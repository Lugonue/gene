<script setup lang="ts">
import { computed, ref } from 'vue'
import { store } from '../store'
import { useKeys } from '../keys'
import { consumableEffect, disassembleItem, dropItem, toggleEquip, useItem } from '../actions'
import { EFF_COLORS } from '../colors'
import ItemDetails from './ItemDetails.vue'
import Modal from './Modal.vue'

const selectedId = ref<string | null>(null)
const confirmDisassemble = ref(false)
const items = computed(() => store.view?.inventory ?? [])
const selected = computed(() => items.value.find((i) => i.id === selectedId.value) ?? null)

function select(id: string): void {
  selectedId.value = id
  confirmDisassemble.value = false
}

function disassemble(): void {
  if (!selected.value) return
  if (!confirmDisassemble.value) {
    confirmDisassemble.value = true
    return
  }
  disassembleItem(selected.value)
}

useKeys((ev) => {
  const item = items.value.find((i) => i.letter === ev.key)
  if (item) {
    select(item.id)
    return true
  }
  const s = selected.value
  if (!s) return
  if (ev.key === '1' && s.category !== 'consumable') toggleEquip(s)
  else if (ev.key === '2' && consumableEffect(s)) useItem(s)
  else if (ev.key === '3') dropItem(s)
  else if (ev.key === '4' && s.category !== 'consumable') disassemble()
  else return
  return true
})
</script>

<template>
  <Modal :title="`Инвентарь (${items.length}/20)`" wide>
    <div class="cols">
      <div class="list">
        <div v-if="!items.length" class="empty">Пусто.</div>
        <div
          v-for="it in items"
          :key="it.id"
          class="list-row"
          :class="{ selected: it.id === selectedId }"
          @click="select(it.id)"
        >
          <span class="key">{{ it.letter }}</span>
          <span :style="{ color: it.color }">{{ it.glyph }}</span>
          <span class="nm">{{ it.name }}<span v-if="it.count"> ×{{ it.count }}</span></span>
          <span v-if="it.equippedSlot" class="muted">(надет)</span>
          <span v-if="it.durabilityText" :style="{ color: EFF_COLORS[it.effTier ?? 4] }">{{ it.durabilityText }}</span>
        </div>
      </div>
      <div class="side">
        <template v-if="selected">
          <ItemDetails :item="selected" />
          <div class="actions">
            <button v-if="selected.category !== 'consumable'" class="btn" @click="toggleEquip(selected)">
              1 {{ selected.equippedSlot ? 'Снять' : selected.category === 'weapon' ? 'Взять в руку' : 'Надеть' }}
            </button>
            <button v-if="consumableEffect(selected)" class="btn" @click="useItem(selected)">2 Применить</button>
            <button class="btn" @click="dropItem(selected)">3 Выбросить</button>
            <button v-if="selected.category !== 'consumable'" class="btn danger" @click="disassemble">
              4 {{ confirmDisassemble ? 'Точно разобрать?' : 'Разобрать' }}
            </button>
          </div>
        </template>
        <div v-else class="empty">Выбери предмет буквой.</div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.cols {
  display: flex;
  gap: 16px;
}
.list {
  flex: 1;
  min-width: 330px;
}
.nm {
  flex: 1;
}
.side {
  width: 280px;
  border-left: 1px solid #1f3a44;
  padding-left: 12px;
}
.actions {
  margin-top: 8px;
}
</style>
