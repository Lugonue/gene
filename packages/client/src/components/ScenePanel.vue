<script setup lang="ts">
// Окно-сцена: ASCII-анимация яркого момента хода. Играет фоном по таймеру, ввод не блокирует.
// Последний кадр держится SCENE_HOLD_MS, затем панель возвращается к тихой заставке.
import { onBeforeUnmount, ref, watch } from 'vue'
import { store } from '../store'
import { SCENE_FRAME_MS, SCENE_HOLD_MS, SCENE_IDLE, sceneFrames, type SceneFrame } from '../scene'

const frame = ref<SceneFrame>(SCENE_IDLE)
let timer: ReturnType<typeof setInterval> | null = null
let hold: ReturnType<typeof setTimeout> | null = null

function stop(): void {
  if (timer) clearInterval(timer)
  if (hold) clearTimeout(hold)
  timer = null
  hold = null
}

function play(): void {
  stop()
  const moment = store.scene.moment
  if (!moment) {
    frame.value = SCENE_IDLE
    return
  }
  const frames = sceneFrames(moment)
  let i = 0
  frame.value = frames[0]!
  timer = setInterval(() => {
    i++
    if (i < frames.length) {
      frame.value = frames[i]!
      return
    }
    stop()
    hold = setTimeout(() => (frame.value = SCENE_IDLE), SCENE_HOLD_MS)
  }, SCENE_FRAME_MS)
}

watch(() => store.scene.seq, play, { immediate: true })
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
  border-top: 1px solid #1f3a44;
  box-sizing: border-box;
  height: 150px;
  display: flex;
  align-items: center;
}
pre {
  margin: 0;
  max-height: 100%;
  overflow: hidden;
  font-family: Consolas, 'DejaVu Sans Mono', monospace;
  font-size: 14px;
  line-height: 1.25;
}
</style>
