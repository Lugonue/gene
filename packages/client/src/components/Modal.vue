<script setup lang="ts">
import { store } from '../store'
defineProps<{ title: string; wide?: boolean }>()
</script>

<template>
  <div class="overlay" @click.self="store.modal = null">
    <div class="modal" :class="{ wide }">
      <div class="head">
        <span>{{ title }}</span>
        <span class="close" @click="store.modal = null">Esc ✕</span>
      </div>
      <div class="body"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 60px;
  z-index: 10;
}
.modal {
  background: #061015;
  border: 1px solid #2fb7c9;
  min-width: 460px;
  max-width: 760px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  font-family: Consolas, 'DejaVu Sans Mono', monospace;
  font-size: 13px;
  color: #cfe9ee;
  box-shadow: 0 0 24px rgba(47, 183, 201, 0.25);
}
.modal.wide {
  min-width: 720px;
}
.head {
  display: flex;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid #1f3a44;
  color: #5ff0ff;
}
.close {
  color: #5f7d86;
  cursor: pointer;
}
.body {
  padding: 8px 10px;
  overflow-y: auto;
}
</style>

<style>
.list-row {
  display: flex;
  gap: 8px;
  padding: 2px 4px;
  cursor: pointer;
}
.list-row:hover,
.list-row.selected {
  background: #0f2a33;
}
.list-row .key {
  color: #ffd24a;
  width: 14px;
}
.list-row .muted {
  color: #5f7d86;
}
.btn {
  background: #0f3a44;
  color: #5ff0ff;
  border: 1px solid #2fb7c9;
  padding: 3px 10px;
  font: inherit;
  cursor: pointer;
  margin: 4px 6px 0 0;
}
.btn.danger {
  border-color: #c95f2f;
  color: #ffb057;
  background: #3a1d0f;
}
.empty {
  color: #5f7d86;
  padding: 6px;
}
</style>
