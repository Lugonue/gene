import { beforeEach, describe, expect, it } from 'vitest'
import { useItem } from './actions'
import { store } from './store'
import { part, viewFixture } from './testing'

function lastLog(): string | undefined {
  return store.log[store.log.length - 1]?.text
}

describe('применение предмета из интерфейса', () => {
  beforeEach(() => {
    store.log = []
    store.modal = 'inventory'
    store.pending = null
    store.connected = true
    store.screen = 'game'
  })

  it('бинт без ран: окно выбора не открывается, в журнале «Я полностью здоров.»', () => {
    store.view = viewFixture()
    useItem(store.view.inventory[0]!)
    expect(store.modal).toBeNull()
    expect(lastLog()).toBe('Я полностью здоров.')
  })

  it('бинт при ране открывает окно выбора цели', () => {
    store.view = viewFixture({ parts: [part('head', { damaged: true, hp: 5 })], fullHealth: false })
    useItem(store.view.inventory[0]!)
    expect(store.modal).toBe('bandageTarget')
  })

  it('зелье при полном здоровье не отправляется на сервер, в журнале «Я полностью здоров.»', () => {
    store.view = viewFixture()
    useItem(store.view.inventory[1]!)
    expect(store.pending).toBeNull()
    expect(store.modal).toBeNull()
    expect(lastLog()).toBe('Я полностью здоров.')
  })

  it('зелье при ранах отправляется', () => {
    store.view = viewFixture({ fullHealth: false })
    useItem(store.view.inventory[1]!)
    expect(store.pending).not.toBeNull()
  })
})
