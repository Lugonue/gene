<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { store } from './store'
import { connect, sendCommand } from './net'
import { keyAction } from './input'
import MapCanvas from './components/MapCanvas.vue'
import HudPanel from './components/HudPanel.vue'
import MessageLog from './components/MessageLog.vue'
import CreateCharacter from './components/CreateCharacter.vue'
import GameOver from './components/GameOver.vue'
import InventoryModal from './components/InventoryModal.vue'
import EquipmentModal from './components/EquipmentModal.vue'
import PickItemModal from './components/PickItemModal.vue'
import TargetModal from './components/TargetModal.vue'
import SkillsModal from './components/SkillsModal.vue'

function onKey(ev: KeyboardEvent): void {
  if (store.screen !== 'game') return
  const target = ev.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
  if (store.modal !== null) {
    if (ev.key === 'Escape') {
      store.modal = null
      store.usingItemId = null
      ev.preventDefault()
    }
    return
  }
  const action = keyAction(ev)
  if (!action) return
  ev.preventDefault()
  switch (action.kind) {
    case 'dir':
      sendCommand({ type: 'move', dir: action.dir })
      break
    case 'command':
      sendCommand(action.cmd)
      break
    case 'open':
      store.modal = action.what
      break
  }
}

onMounted(() => {
  connect()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="app">
    <div v-if="!store.connected" class="banner">Нет связи с сервером… переподключение</div>
    <div v-if="store.screen === 'connecting'" class="center">Подключение…</div>
    <CreateCharacter v-else-if="store.screen === 'create'" />
    <GameOver v-else-if="store.screen === 'over'" />
    <div v-else-if="store.screen === 'game' && store.view" class="game">
      <div class="main">
        <div class="map-wrap"><MapCanvas /></div>
        <MessageLog />
      </div>
      <HudPanel />
      <InventoryModal v-if="store.modal === 'inventory'" />
      <EquipmentModal v-else-if="store.modal === 'equipment'" />
      <PickItemModal v-else-if="store.modal === 'use'" mode="use" />
      <PickItemModal v-else-if="store.modal === 'drop'" mode="drop" />
      <PickItemModal v-else-if="store.modal === 'disassemble'" mode="disassemble" />
      <TargetModal v-else-if="store.modal === 'bandageTarget'" mode="bandage" />
      <TargetModal v-else-if="store.modal === 'repairTarget'" mode="repair" />
      <SkillsModal v-else-if="store.modal === 'skills'" />
    </div>
  </div>
</template>

<style>
html,
body {
  margin: 0;
  background: #000;
  color: #ddd;
  font-family: 'Segoe UI', system-ui, sans-serif;
}
.app {
  min-height: 100vh;
}
.banner {
  background: #5a1d1d;
  color: #ffd0d0;
  padding: 4px 10px;
  font-size: 13px;
}
.center {
  text-align: center;
  margin-top: 30vh;
  color: #5ff0ff;
  font-family: Consolas, monospace;
}
.game {
  display: flex;
  height: 100vh;
}
.main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.map-wrap {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 6px;
}
</style>
