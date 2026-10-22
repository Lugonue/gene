// Сетка карты в представлении: номер клетки — как в строках map.tiles / map.vis (своя копия, логику core клиент не импортирует).

/** Номер клетки (x, y) в строке карты ширины width. */
export function cellIndex(width: number, x: number, y: number): number {
  return y * width + x
}
