<script setup lang="ts">
// «База знаний ядра»: навыки и изученность встреченных типов снаряжения. Только просмотр.
import { computed } from 'vue'
import { store } from '../store'
import { STATUS_LABEL } from '../actions'
import Modal from './Modal.vue'

const groups = [
  { id: 'weapon', name: 'Классы оружия' },
  { id: 'armour', name: 'Классы брони' },
  { id: 'general', name: 'Боевые алгоритмы' },
] as const

const skills = computed(() => store.view?.skills ?? [])
const types = computed(() => store.view?.itemTypes ?? [])
</script>

<template>
  <Modal title="[ЯДРО] База знаний" wide>
    <div class="cols">
      <div class="col">
        <template v-for="g in groups" :key="g.id">
          <div class="group">{{ g.name }}</div>
          <div v-for="s in skills.filter((x) => x.group === g.id)" :key="s.id" class="skill">
            <span class="nm">{{ s.name }}</span>
            <span class="lvl">{{ s.level }}</span>
            <div class="bar"><div class="fill" :style="{ width: Math.round(s.progress * 100) + '%' }" /></div>
          </div>
        </template>
      </div>
      <div class="col">
        <div class="group">Изученные типы снаряжения</div>
        <div v-if="!types.length" class="empty">Пока ничего не встречено.</div>
        <div v-for="t in types" :key="t.defId" class="skill">
          <span class="nm">{{ t.name }}</span>
          <span class="st" :class="t.status">{{ STATUS_LABEL[t.status] }}</span>
          <div class="bar"><div class="fill" :class="t.status" :style="{ width: Math.round(t.progress * 100) + '%' }" /></div>
        </div>
      </div>
    </div>
    <div class="note">
      Данные поступают по факту использования: атаки оружием, удары в броню, уклонения, ношение и разборка предметов.
    </div>
  </Modal>
</template>

<style scoped>
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
