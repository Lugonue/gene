# gene — браузерный ASCII-рогалик (MVP)

Пошаговый рогалик в духе DCSS: киборг из будущего в средневековом подземелье. Спецификация — `TZ.md`, журнал решений — `DECISIONS.md`.

## Требования

- Node.js 20+ (разрабатывается на 24 LTS)
- pnpm 10 (`npm i -g pnpm` или `corepack enable`)

## Запуск

```sh
pnpm install
pnpm dev        # сервер (порт 3000) + клиент Vite (http://localhost:5173)
```

Prod:

```sh
pnpm build      # проверка типов + сборка клиента и сервера
pnpm start      # http://localhost:3000 — сервер раздаёт собранный клиент
```

Порт сервера задаётся переменной `GENE_PORT`, путь к базе — `GENE_DB` (по умолчанию `gene.db` в корне сервера).

## Тесты

```sh
pnpm test       # Vitest по всем пакетам
pnpm lint
```

## Структура

```
packages/
  core/      игровая логика: чистый TS, без сети/БД/DOM/таймеров/Math.random
  data/      данные: планы тел, монстры, предметы, навыки, словоформы, шаблоны сообщений
  messages/  превращение событий core в русский текст
  server/    Node: WebSocket, сессии, SQLite, запуск core
  client/    Vite + Vue 3: карта на canvas, панели, ввод
```
