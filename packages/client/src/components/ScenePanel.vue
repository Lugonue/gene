<script setup lang="ts">
// Окно-сцена: ASCII-анимация ярких моментов из очереди. Играет фоном по таймеру, ввод не блокирует.
// Сцена держится не меньше SCENE_MIN_MS и не перебивается новой; когда очередь пуста, последний кадр
// держится SCENE_HOLD_MS, затем панель возвращается к тихой заставке. Размер окна постоянный.
import { onBeforeUnmount, ref, watch } from 'vue'
import { store } from '../store'
import {
  SCENE_FRAME_MS,
  SCENE_HEIGHT,
  SCENE_HOLD_MS,
  SCENE_IDLE,
  SCENE_MIN_MS,
  SCENE_WIDTH,
  sceneFrames,
  type SceneFrame,
} from '../scene'

const frame = ref<SceneFrame>(SCENE_IDLE)
let timer: ReturnType<typeof setInterval> | null = null
let wait: ReturnType<typeof setTimeout> | null = null
/** Идёт сцена (кадры или её минимальное время на экране) — новые ждут в очереди. */
let busy = false
let epoch = store.scene.epoch

function stop(): void {
  if (timer) clearInterval(timer)
  if (wait) clearTimeout(wait)
  timer = null
  wait = null
  busy = false
}

/** Взять следующую сцену из очереди; пустая очередь — заставка после паузы. */
function playNext(): void {
  stop()
  const [moment, ...rest] = store.scene.queue
  if (!moment) {
    frame.value = SCENE_IDLE
    return
  }
  store.scene = { ...store.scene, queue: rest }
  busy = true
  const started = Date.now()
  const frames = sceneFrames(moment)
  let i = 0
  frame.value = frames[0]!
  timer = setInterval(() => {
    i++
    if (i < frames.length) {
      frame.value = frames[i]!
      return
    }
    if (timer) clearInterval(timer)
    timer = null
    const left = Math.max(0, SCENE_MIN_MS[moment.kind] - (Date.now() - started))
    wait = setTimeout(afterScene, left)
  }, SCENE_FRAME_MS)
}

/** Сцена отыграла минимум: следующая из очереди или, если её нет, заставка через SCENE_HOLD_MS. */
function afterScene(): void {
  busy = false
  if (store.scene.queue.length > 0) return playNext()
  wait = setTimeout(() => {
    if (!busy) frame.value = SCENE_IDLE
  }, SCENE_HOLD_MS)
}

watch(
  () => store.scene.seq,
  () => {
    const reset = store.scene.epoch !== epoch
    epoch = store.scene.epoch
    if (reset || !busy) playNext()
  },
  { immediate: true },
)
onBeforeUnmount(stop)
</script>

<template>
  <div class="scene" :style="{ width: `${SCENE_WIDTH}ch`, '--rows': SCENE_HEIGHT }">
    <pre><span
      v-for="(line, i) in frame.lines"
      :key="i"
      :style="{ color: frame.lineColors?.[i] ?? frame.color }"
    >{{ line }}
</span></pre>
  </div>
</template>

<style scoped>
.scene {
  flex: none;
  box-sizing: content-box;
  padding: 6px 10px;
  background: #02080b;
  border-left: 1px solid #1f3a44;
  border-top: 1px solid #1f3a44;
  display: flex;
  align-items: center;
  font-family: Consolas, 'DejaVu Sans Mono', monospace;
  font-size: 14px;
}
pre {
  margin: 0;
  width: 100%;
  height: calc(var(--rows) * 1.25em);
  overflow: hidden;
  font: inherit;
  line-height: 1.25;
}
</style>
