# Исправления по ревью ветки factions

Status: resolved
Type: task

Спека: `../spec.md`. Ревью: `git diff 49b1c68...b805a0f`. Каждое отклонение от спеки, которое остаётся, — в `DECISIONS.md`.

## Что сделать

Поведение (спека):

1. Орден (`relentless`, `core/src/ai.ts:26-29`): сейчас монстр 200 aut получает **текущую** позицию игрока — видит сквозь стены. По спеке — «дольше преследуют, идут к последнему месту, где видели игрока». Сделать: обычный `lastSeen`, но Орден дольше не бросает поиск (дольше держит цель/доходит до `lastSeen` и осматривается), без знания текущей позиции. Обновить запись в `DECISIONS.md`.
2. Кобольды (`ai.ts:233-241`, `nearestAlly`): отступать к вожаку, если он жив на уровне, иначе к ближайшему **не убегающему** союзнику фракции.
3. Вожак (`core/src/world/populate.ts:26-28`): на уровне ровно один вожак — если в последней комнате нет места, ставить его в другую комнату; урезание свиты не должно убирать последнего воина/зверя.
4. Угроза (`core/src/world/squads.ts:78-98`): учитывать заклинания вида (формула в модуле формул).
5. Тест приёмки 02: проверять суммарную угрозу реально **поставленных** монстров, а не план `planSquads`.

Стандарты (DECISIONS «игровые числа — только в `time` и `combat/formulas`», GLOSSARY):

6. `MAX_MISSES`, доля стрелков (`squads.ts:43,123`), `armourChance`/`RANGED_SUPPLY` (`data/src/factions.ts`) — по правилу о числах: генерационные доли/шансы в формулы (данные-контент могут остаться в `data`, решить и записать).
7. `BoltSpellDef` / `effect: 'bolt'` → `ProjectileSpellDef` / `'projectile'` (коллизия с боеприпасом `bolt`).
8. «Ядро» с заглавной в комментариях/текстах: `core/src/knowledge.ts`, `core/src/combat/spells.ts`, `client/src/components/SkillsModal.vue`.

Дубли и типы:

9. Одна функция `traceProjectile` вместо цепочки `projectilePath → firstCreatureOnPath → slice` в `combat/ranged.ts`, `combat/spells.ts`, `ai.ts` (`hasLineOfFire`).
10. `allies(ctx, c)` вместо двух копий фильтра в `ai.ts`; хелпер для `spendTime(c, actionCost(c,'attack'))`.
11. `cellIndex` вместо ручного `y * width + x` (`actions/fire.ts`, `spells.ts`, `ranged.ts`, `ai.ts`); объединить проверку «игрок видит клетку» (`spells.ts` `playerSees` и `ranged.ts`).
12. `distance` перенести из `combat/ranged.ts` к `Pos` (`state.ts`).
13. `ProjectileTrail` — размеченное объединение вместо двух необязательных `itemDefId?`/`spellId?`; тип `SpellId` для `SPELLS` и `MonsterDef.spells`.
14. Хелпер `speciesOf(c)` вместо разбросанных `MONSTERS[c.kind]?.…`.

## Приёмка

- Орден не узнаёт позицию игрока вне поля зрения (тест).
- Кобольд бежит к вожаку, если он жив (тест).
- На каждом сгенерированном уровне ровно один вожак (тест по многим сидам).
- `pnpm test`, `pnpm typecheck`, `pnpm lint` зелёные.

## Comments

- 2026-10-22: сделаны все 14 пунктов. Орден больше не знает позицию невидимого игрока: идёт к `lastSeen`, а дойдя, ещё `TRACK_TIME` осматривает случайные клетки в пределах `SEARCH_RADIUS` от него (`searchFrom` в `Creature.ai`). Кобольды бегут к живому вожаку, иначе к ближайшему не убегающему союзнику (`rallyPoint`, `allies`). Вожак встаёт в другую комнату, если в последней не помещаются он и воин/зверь (`leaderCells`). Угроза учитывает заклинания (`monsterThreat`, вход `spells`/`spellPower`). Бюджет проверяется по поставленным монстрам (`world.test.ts`, 50 сидов); проверка плана из `squads.test.ts` убрана. Числа генерации (`ROLE_ARMOUR_CHANCE`, `RANGED_SUPPLY`, `MAX_ARCHER_SHARE`, `SQUAD_FILL_MAX_MISSES`) — в `combat/formulas`; `ROLE_GEAR` (навыки), `SQUAD_SIZE`, `LEADER_RETINUE` остались в `data` как содержание — записано в `DECISIONS.md`. Переименования: `ProjectileSpellDef`/`'projectile'`, ключ шаблона `spellCast.projectile`; тип `SpellId`; `ProjectileTrail` — объединение по `kind`. Хелперы: `traceProjectile`, `playerSeesAny`, `cellIndex`, `distance` и `speciesOf` (в `state.ts`), `spendAttack`. «Ядро» с заглавной — заодно и в подсказках клиента. Не сделано: ручной `y * width + x` вне перечисленных в задаче файлов (`game.ts`, `view.ts`, `notice.ts`, `explore.ts`, `mapgen.ts`, клиент) оставлен.
