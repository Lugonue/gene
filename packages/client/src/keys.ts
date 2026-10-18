// Обработчик клавиш на время жизни компонента (модальные окна).
import { onBeforeUnmount, onMounted } from 'vue'

export function useKeys(handler: (ev: KeyboardEvent) => boolean | void): void {
  const listener = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape' || ev.ctrlKey || ev.metaKey || ev.altKey) return
    if (handler(ev) === true) ev.preventDefault()
  }
  onMounted(() => window.addEventListener('keydown', listener))
  onBeforeUnmount(() => window.removeEventListener('keydown', listener))
}
