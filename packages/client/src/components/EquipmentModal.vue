<script setup lang="ts">
import { computed, ref } from 'vue'
import { ITEMS, SLOTS, type SlotId } from '@gene/data'
import { store } from '../store'
import { sendCommand } from '../net'
import { useKeys } from '../keys'
import { EFF_COLORS } from '../colors'
import Modal from './Modal.vue'

const slots = computed(() => store.view?.equipment ?? [])
const selectedSlot = ref<SlotId | null>(null)

/** Предметы инвентаря, подходящие к выбранному слоту. */
const candidates = computed(() => {
  const slot = selectedSlot.value
  if (!slot) return []
  const kind = SLOTS[slot].kind
  return (store.view?.inventory ?? []).filter((it) => {
    const def = ITEMS[it.defId]
    if (!def || def.category === 'consumable') return false
    if (it.equippedSlot === slot) return false
    return kind === 'weapon' ? def.category === 'weapon' : def.category === 'armour' && def.kind === kind
  })
})

function equip(itemId: string): void {
  if (!selectedSlot.value) return
  store.modal = null
  sendCommand({ type: 'equip', itemId, slot: selectedSlot.value })
}

function unequip(): void {
  if (!selectedSlot.value) return
  store.modal = null
  sendCommand({ type: 'unequip', slot: selectedSlot.value })
}

useKeys((ev) => {
  const n = Number(ev.key)
  if (n >= 1 && n <= slots.value.length) {
    selectedSlot.value = slots.value[n - 1]!.slot
    return true
  }
  if (!selectedSlot.value) return
  const item = candidates.value.find((i) => i.letter === ev.key)
  if (item) {
    equip(item.id)
    return true
  }
  if (ev.key === '-') {
    unequip()
    return true
  }
})
</script>

<template>
  <Modal title="Экипировка">
    <div v-for="(s, idx) in slots" :key="s.slot" class="list-row" :class="{ selected: s.slot === selectedSlot }" @click="selectedSlot = s.slot">
      <span class="key">{{ idx + 1 }}</span>
      <span class="slot muted">{{ s.slotName }}</span>
      <template v-if="s.item">
        <span class="nm">{{ s.item.name }}</span>
        <span :style="{ color: EFF_COLORS[s.item.effTier ?? 4] }">{{ s.item.durabilityText }}</span>
      </template>
      <span v-else class="muted nm">—</span>
    </div>
    <div v-if="selectedSlot" class="sub">
      <div class="muted">Надеть в слот «{{ SLOTS[selectedSlot].name }}»:</div>
      <div v-if="!candidates.length" class="empty">Подходящих предметов нет.</div>
      <div v-for="it in candidates" :key="it.id" class="list-row" @click="equip(it.id)">
        <span class="key">{{ it.letter }}</span>
        <span class="nm">{{ it.name }}</span>
        <span v-if="it.equippedSlot" class="muted">(в другом слоте)</span>
        <span :style="{ color: EFF_COLORS[it.effTier ?? 4] }">{{ it.durabilityText }}</span>
      </div>
      <button v-if="slots.find((s) => s.slot === selectedSlot)?.item" class="btn" @click="unequip">- Снять</button>
    </div>
    <div v-else class="empty">Выбери слот цифрой.</div>
  </Modal>
</template>

<style scoped>
.slot {
  width: 110px;
}
.nm {
  flex: 1;
}
.sub {
  margin-top: 10px;
  border-top: 1px solid #1f3a44;
  padding-top: 6px;
}
</style>
