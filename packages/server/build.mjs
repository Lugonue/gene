// Сборка сервера в один файл: workspace-пакеты (core, data, messages) и rot-js встраиваются,
// нативные и серверные зависимости остаются внешними.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['better-sqlite3', 'ws'],
  sourcemap: true,
  logLevel: 'info',
})
