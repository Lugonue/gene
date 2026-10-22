# Исправления по ревью ветки feat/followups

Status: resolved
Type: task

Ревью: `git diff b805a0f...feat/followups` (задачи factions/08, heal-ux/01, cutscene/01).

## Что сделать

Ошибки:
1. `client/src/net.ts` (~66): при `fresh` `store.scene = null` сбрасывает `seq` → наблюдатель в `ScenePanel.vue` не видит смены (1→1). Счётчик сцен монотонный, не обнулять. Тест.
2. `core/src/ai.ts` `searchSpot`: брать только клетки, видимые/достижимые от `searchFrom` (не за стеной). Тест.
3. `DECISIONS.md:27`: склеились два пункта («…как обычно.- **Явления**») — разделить.

Спеки:
4. heal-ux: клиент сам не шлёт зелье при полном здоровье (по `view`), пишет «Я полностью здоров.»; ядро по-прежнему отказывает. Тест ветки `useItem`, где окно не открывается и в журнал уходит сообщение (бинт без ран).
5. heal-ux: записать решения в `DECISIONS.md` (зелье отказывает по HP и органическим частям; флаг повреждения в представлении).
6. `ItemView.damaged` (`core/src/view.ts`): для неизученного предмета выставлять по показанному проценту (`< 100`), не по точной прочности.
7. Правило «часть повреждена» одно — в ядре: клиентский `isDamaged` (`client/src/targets.ts`) разошёлся с `isDamagedPart` (`core/actions/items.ts`, учитывает `needsTreatment`). Отдавать флаг в представлении части из ядра, клиент только читает.
8. cutscene: по окончании сцены панель возвращается к тихой заставке (спека «В покое — пустая/тихая заставка»); поправить запись в `DECISIONS.md`.

Стандарты:
9. `client/src/targets.test.ts` импортирует логику `@gene/core` (правило DECISIONS: клиент — только типы). Фикстуры представления собирать вручную.
10. `populate.ts` `Math.min(size, 2)` → константа в `combat/formulas`.
11. `useTargets` → имя без `use*` (не composable).
12. `monsterThreat` считает лечение через `spellDamage` — отдельная понятная функция/имя.
13. `world/squads.ts` мёртвая проверка `if (!s) return []` после типа `SpellId` — убрать.
14. `speciesOf` вынести из `core/src/state.ts` (модуль состояния не зависит от данных) в подходящий модуль.
15. `cellIndex` вместо ручного `y * width + x` по всему `core` (`view.ts`, `world/notice.ts`, `game.ts`, `explore.ts`, `mapgen.ts`) и, если есть, в клиенте (свой хелпер, без импорта логики core).

## Приёмка

- Тесты на пп. 1, 2, 4, 6, 7.
- `pnpm test`, `pnpm typecheck`, `pnpm lint` зелёные.

## Comments

2026-10-22 — сделаны все 15 пунктов.
- Сцена: состояние `SceneState` и чистая `nextScene` (`client/src/scene.ts`), счётчик монотонный и при `fresh`; после последнего кадра панель через `SCENE_HOLD_MS` возвращается к заставке `SCENE_IDLE`. Тесты в `scene.test.ts`.
- `searchSpot`: только клетки из поля зрения с `searchFrom` (`computeFov`); тест в `ai.test.ts` (стена с проходом вдали — монстр не уходит в обход).
- Ядро: `isDamagedPart`/`isFullyHealthy` перенесены в `health.ts`; в представлении `PartView.damaged` и `player.fullHealth`; `ItemView.damaged` неизученного — по показанному проценту. Тесты в `items.test.ts`.
- Клиент: `useTargets` → `targetsFor`, читает флаги ядра; зелье при `fullHealth` не отправляется — «Я полностью здоров.». Фикстуры представления вручную (`client/src/testing.ts`), тесты `targets.test.ts`, `actions.test.ts` (в т.ч. бинт без ран).
- Стандарты: `LEADER_ROOM_MIN_SQUAD` в формулах, `spellThreat` вместо `spellDamage` в угрозе, убрана мёртвая проверка в `squads.ts`, `speciesOf` перенесён в `body.ts`, `cellIndex` по всему core (сигнатура принимает `{ width }`), в клиенте свой `client/src/grid.ts`.
- DECISIONS: разделены «ИИ магов»/«Явления», записаны решения heal-ux, поправлена запись об окне-сцене.
