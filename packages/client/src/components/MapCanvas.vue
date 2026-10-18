<script setup lang="ts">
// Карта рисуется на canvas: по символу на клетку, без DOM-элемента на клетку.
import { onMounted, ref, watch } from 'vue'
import { store } from '../store'
import { PLAYER_COLOR, TILE_COLORS } from '../colors'

const CELL_W = 12
const CELL_H = 18
const FONT = '15px "DejaVu Sans Mono", Consolas, "Courier New", monospace'

const canvas = ref<HTMLCanvasElement | null>(null)
const emit = defineEmits<{ hover: [pos: { x: number; y: number } | null]; pick: [pos: { x: number; y: number }] }>()

function draw(): void {
  const el = canvas.value
  const view = store.view
  if (!el || !view) return
  const { width, height, tiles, vis } = view.map
  const dpr = window.devicePixelRatio || 1
  const cssW = width * CELL_W
  const cssH = height * CELL_H
  if (el.width !== cssW * dpr) {
    el.width = cssW * dpr
    el.height = cssH * dpr
    el.style.width = `${cssW}px`
    el.style.height = `${cssH}px`
  }
  const g = el.getContext('2d')
  if (!g) return
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.fillStyle = '#000'
  g.fillRect(0, 0, cssW, cssH)
  g.font = FONT
  g.textAlign = 'center'
  g.textBaseline = 'middle'

  const glyph = (x: number, y: number, ch: string, color: string): void => {
    g.fillStyle = color
    g.fillText(ch, x * CELL_W + CELL_W / 2, y * CELL_H + CELL_H / 2 + 1)
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const v = vis[i]
      if (v === '0') continue
      const ch = tiles[i] as string
      const c = TILE_COLORS[ch] ?? { lit: '#cccccc', dim: '#444444' }
      glyph(x, y, ch, v === '2' ? c.lit : c.dim)
    }
  }

  for (const it of view.floorItems) {
    g.fillStyle = '#000'
    g.fillRect(it.x * CELL_W, it.y * CELL_H, CELL_W, CELL_H)
    glyph(it.x, it.y, it.glyph, it.color)
  }
  for (const m of view.monsters) {
    g.fillStyle = '#000'
    g.fillRect(m.x * CELL_W, m.y * CELL_H, CELL_W, CELL_H)
    glyph(m.x, m.y, m.glyph, m.color)
  }
  const p = view.player
  g.fillStyle = '#000'
  g.fillRect(p.x * CELL_W, p.y * CELL_H, CELL_W, CELL_H)
  glyph(p.x, p.y, '@', PLAYER_COLOR)

  if (store.inspect) {
    g.strokeStyle = '#ffd24a'
    g.lineWidth = 1
    g.strokeRect(store.inspect.x * CELL_W + 0.5, store.inspect.y * CELL_H + 0.5, CELL_W - 1, CELL_H - 1)
  }
}

function cellFromEvent(ev: MouseEvent): { x: number; y: number } | null {
  const el = canvas.value
  const view = store.view
  if (!el || !view) return null
  const rect = el.getBoundingClientRect()
  const x = Math.floor((ev.clientX - rect.left) / CELL_W)
  const y = Math.floor((ev.clientY - rect.top) / CELL_H)
  if (x < 0 || y < 0 || x >= view.map.width || y >= view.map.height) return null
  return { x, y }
}

onMounted(draw)
watch(() => [store.view, store.inspect], draw, { deep: false })
</script>

<template>
  <canvas
    ref="canvas"
    class="map"
    @mousemove="emit('hover', cellFromEvent($event))"
    @mouseleave="emit('hover', null)"
    @click="(e) => { const c = cellFromEvent(e); if (c) emit('pick', c) }"
  />
</template>

<style scoped>
.map {
  display: block;
  background: #000;
  image-rendering: pixelated;
}
</style>
