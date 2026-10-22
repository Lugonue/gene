<script setup lang="ts">
// Окно-сцена: ASCII-анимация яркого момента хода. Играет фоном по таймеру, ввод не блокирует.
import { onBeforeUnmount, ref, watch } from 'vue'
import { store } from '../store'
import { SCENE_FRAME_MS, sceneFrames, type SceneFrame } from '../scene'

const IDLE: SceneFrame = { lines: ['', '', '        · · ·', '', '', ''], color: '#1f3a44' }

const frame = ref<SceneFrame>(IDLE)
let timer: ReturnType<typeof setInterval> | null = null

function stop(): void {
  if (timer) clearInterval(timer)
  timer = null
}

function play(): void {
  stop()
  if (!store.scene) {
    frame.value = IDLE
    return
  }
  const frames = sceneFrames(store.scene.moment)
  let i = 0
  frame.value = frames[0]!
  timer = setInterval(() => {
    i++
    if (i >= frames.length) return stop()
    frame.value = frames[i]!
  }, SCENE_FRAME_MS)
}

watch(() => store.scene?.seq, play, { immediate: true })
onBeforeUnmount(stop)
</script>

<template>
  <div class="scene">
    <pre :style="{ color: frame.color }">{{ frame.lines.join('\n') }}</pre>
  </div>
</template>

<style scoped>
.scene {
  padding: 6px 10px;
  background: #02080b;
  border-left: 1px solid #1f3a44;
  border-bottom: 1px solid #1f3a44;
}
pre {
  margin: 0;
  height: 7.5em;
  overflow: hidden;
  font-family: Consolas, 'DejaVu Sans Mono', monospace;
  font-size: 14px;
  line-height: 1.25;
}
</style>
