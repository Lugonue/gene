<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { store } from './store'
import { connect, sendCommand } from './net'
import { skipAnimation } from './anim'
import { keyAction } from './input'
import MapCanvas from './components/MapCanvas.vue'
import HudPanel from './components/HudPanel.vue'
import ScenePanel from './components/ScenePanel.vue'
import { loadSceneEnabled, saveSceneEnabled } from './scene'
import MessageLog from './components/MessageLog.vue'
import CreateCharacter from './components/CreateCharacter.vue'
import GameOver from './components/GameOver.vue'
import InventoryModal from './components/InventoryModal.vue'
import EquipmentModal from './components/EquipmentModal.vue'
import PickItemModal from './components/PickItemModal.vue'
import TargetModal from './components/TargetModal.vue'
import SkillsModal from './components/SkillsModal.vue'
import HelpModal from './components/HelpModal.vue'
import InspectPanel from './components/InspectPanel.vue'
import { DIR_DELTAS as DIRS } from './input'
import { cancelAim, confirmAim, cycleAim, moveAim, startAim } from './aim'

function onHover(pos: { x: number; y: number } | null): void {
  if (!store.lookMode && !store.aim) store.inspect = pos
}

function onPick(pos: { x: number; y: number }): void {
  if (store.aim) store.aim = pos
  store.inspect = pos
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta'])

function onKey(ev: KeyboardEvent): void {
  if (store.screen !== 'game') return
  const target = ev.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
  // Любая клавиша во время анимации доматывает её; сама клавиша не выполняется.
  if (store.anim || store.projectile) {
    if (!ev.repeat && !MODIFIER_KEYS.has(ev.key)) skipAnimation()
    ev.preventDefault()
    return
  }
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
  // Tab и Enter нужны только прицелу; иначе остаются браузеру.
  if (!store.aim && (action.kind === 'nextTarget' || action.kind === 'confirm')) return
  ev.preventDefault()

  // Прицел: стрелки двигают курсор, Tab — следующая цель, Enter/f — выстрел, Esc — отмена.
  if (store.aim) {
    if (action.kind === 'dir') moveAim(DIRS[action.dir])
    else if (action.kind === 'nextTarget') cycleAim(action.back)
    else if (action.kind === 'fire' || action.kind === 'confirm') confirmAim()
    else if (action.kind === 'escape') cancelAim()
    return
  }

  // Режим осмотра: направления двигают курсор, x/Esc — выход.
  if (store.lookMode) {
    if (action.kind === 'dir' && store.inspect && store.view) {
      const d = DIRS[action.dir]
      store.inspect = {
        x: Math.min(store.view.map.width - 1, Math.max(0, store.inspect.x + d.x)),
        y: Math.min(store.view.map.height - 1, Math.max(0, store.inspect.y + d.y)),
      }
    } else if (action.kind === 'look' || action.kind === 'escape') {
      store.lookMode = false
      store.inspect = null
    }
    return
  }

  switch (action.kind) {
    case 'dir':
      sendCommand({ type: 'move', dir: action.dir })
      break
    case 'run':
      sendCommand({ type: 'run', dir: action.dir })
      break
    case 'look':
      if (store.view) {
        store.lookMode = true
        store.inspect = { x: store.view.player.x, y: store.view.player.y }
      }
      break
    case 'fire':
      startAim()
      break
    case 'command':
      sendCommand(action.cmd)
      break
    case 'open':
      store.modal = action.what
      break
    case 'toggleScene':
      store.sceneEnabled = !store.sceneEnabled
      saveSceneEnabled(localStorage, store.sceneEnabled)
      break
  }
}

onMounted(() => {
  store.sceneEnabled = loadSceneEnabled(localStorage)
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
        <div class="map-wrap"><MapCanvas @hover="onHover" @pick="onPick" /></div>
        <InspectPanel />
        <MessageLog />
      </div>
      <div class="side">
        <ScenePanel v-if="store.sceneEnabled" />
        <HudPanel />
      </div>
      <InventoryModal v-if="store.modal === 'inventory'" />
      <EquipmentModal v-else-if="store.modal === 'equipment'" />
      <PickItemModal v-else-if="store.modal === 'use'" mode="use" />
      <PickItemModal v-else-if="store.modal === 'drop'" mode="drop" />
      <PickItemModal v-else-if="store.modal === 'disassemble'" mode="disassemble" />
      <TargetModal v-else-if="store.modal === 'bandageTarget'" mode="bandage" />
      <TargetModal v-else-if="store.modal === 'repairTarget'" mode="repair" />
      <SkillsModal v-else-if="store.modal === 'skills'" />
      <HelpModal v-else-if="store.modal === 'help'" />
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
.side {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.side > .hud {
  flex: 1;
  min-height: 0;
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
