<script setup lang="ts">
// «База знаний ядра»: навыки и изученность снаряжения, явления, бестиарий. Только просмотр.
// Вкладки: 1–3, ←/→ или Tab.
import { computed, ref } from 'vue'
import { store } from '../store'
import { STATUS_LABEL } from '../actions'
import { useKeys } from '../keys'
import Modal from './Modal.vue'

const tabs = [
  { id: 'skills', name: 'Навыки и снаряжение' },
  { id: 'phenomena', name: 'Явления' },
  { id: 'bestiary', name: 'Бестиарий' },
] as const
const tabIdx = ref(0)
const tab = computed(() => tabs[tabIdx.value]!.id)

useKeys((ev) => {
  const n = Number(ev.key)
  if (n >= 1 && n <= tabs.length) tabIdx.value = n - 1
  else if (ev.key === 'ArrowRight' || (ev.key === 'Tab' && !ev.shiftKey))
    tabIdx.value = (tabIdx.value + 1) % tabs.length
  else if (ev.key === 'ArrowLeft' || ev.key === 'Tab')
    tabIdx.value = (tabIdx.value + tabs.length - 1) % tabs.length
  else return
  return true
})

const groups = [
  { id: 'weapon', name: 'Классы оружия' },
  { id: 'armour', name: 'Классы брони' },
  { id: 'general', name: 'Боевые алгоритмы' },
] as const

const skills = computed(() => store.view?.skills ?? [])
const types = computed(() => store.view?.itemTypes ?? [])
const phenomena = computed(() => store.view?.phenomena ?? [])
const bestiary = computed(() => store.view?.bestiary ?? [])
const pct = (v: number): number => Math.round(v * 100)
</script>

<template>
  <Modal title="[ЯДРО] База знаний" wide>
    <div class="tabs">
      <span
        v-for="(t, i) in tabs"
        :key="t.id"
        class="tab"
        :class="{ active: tabIdx === i }"
        @click="tabIdx = i"
      >
        <span class="key">{{ i + 1 }}</span> {{ t.name }}
      </span>
    </div>

    <template v-if="tab === 'skills'">
      <div class="cols">
        <div class="col">
          <template v-for="g in groups" :key="g.id">
            <div class="group">{{ g.name }}</div>
            <div v-for="s in skills.filter((x) => x.group === g.id)" :key="s.id" class="skill">
              <span class="nm">{{ s.name }}</span>
              <span class="lvl">{{ s.level }}</span>
              <div class="bar"><div class="fill" :style="{ width: pct(s.progress) + '%' }" /></div>
            </div>
          </template>
        </div>
        <div class="col">
          <div class="group">Изученные типы снаряжения</div>
          <div v-if="!types.length" class="empty">Пока ничего не встречено.</div>
          <div v-for="t in types" :key="t.defId" class="skill">
            <span class="nm">{{ t.name }}</span>
            <span class="st" :class="t.status">{{ STATUS_LABEL[t.status] }}</span>
            <div class="bar">
              <div class="fill" :class="t.status" :style="{ width: pct(t.progress) + '%' }" />
            </div>
          </div>
        </div>
      </div>
      <div class="note">
        Данные поступают по факту использования: атаки оружием, удары в броню, уклонения, ношение и разборка
        предметов.
      </div>
    </template>

    <template v-else-if="tab === 'phenomena'">
      <div v-if="!phenomena.length" class="empty">Явления пока не зафиксированы.</div>
      <div v-for="ph in phenomena" :key="ph.n" class="entry">
        <div class="skill">
          <span class="nm">{{ ph.name }}</span>
          <span class="st" :class="ph.status">{{ STATUS_LABEL[ph.status] }} · {{ pct(ph.progress) }}%</span>
          <div class="bar">
            <div class="fill" :class="ph.status" :style="{ width: pct(ph.progress) + '%' }" />
          </div>
        </div>
        <div v-if="ph.recipe" class="recipe">
          <span class="rname">Рецепт: {{ ph.recipe.name }}</span> — {{ ph.recipe.description }}
        </div>
      </div>
      <div class="note">
        Данные поступают от наблюдения за явлением, попаданий по киборгу и сорвавшихся заклинаний. Процент —
        до открытия рецепта. Применять рецепты пока нельзя.
      </div>
    </template>

    <template v-else>
      <div v-if="!bestiary.length" class="empty">Пока никто не встречен.</div>
      <template v-for="f in bestiary" :key="f.faction">
        <div class="group">{{ f.faction }}</div>
        <div v-for="sp in f.species" :key="sp.kind" class="species">
          <b :style="{ color: sp.color }">{{ sp.glyph }}</b>
          <span class="nm">{{ sp.name }}</span>
          <span class="st">{{ sp.role }}</span>
        </div>
      </template>
    </template>
  </Modal>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 16px;
  margin-bottom: 6px;
  border-bottom: 1px solid #1f3a44;
  padding-bottom: 4px;
}
.tab {
  color: #5f7d86;
  cursor: pointer;
}
.tab.active {
  color: #5ff0ff;
}
.tab .key {
  color: #ffd24a;
}
.cols {
  display: flex;
  gap: 24px;
}
.col {
  flex: 1;
}
.group {
  color: #2fb7c9;
  margin: 8px 0 4px;
}
.skill {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 10px;
  margin-bottom: 4px;
}
.entry {
  margin: 6px 0 8px;
}
.recipe {
  color: #cfe9ee;
}
.rname {
  color: #5ff0ff;
}
.species {
  display: grid;
  grid-template-columns: 14px 1fr auto;
  gap: 10px;
  margin-bottom: 2px;
}
.lvl {
  color: #5ff0ff;
  text-align: right;
}
.bar {
  grid-column: 1 / span 2;
  height: 3px;
  background: #1a2a30;
}
.fill {
  height: 100%;
  background: #2fb7c9;
}
.fill.known {
  background: #5ff0ff;
}
.st {
  color: #5f7d86;
}
.st.partial {
  color: #2fb7c9;
}
.st.known {
  color: #5ff0ff;
}
.note {
  margin-top: 12px;
  color: #5f7d86;
}
</style>
