import { describe, it, expect } from 'vitest'
import type { GameContext } from '../src/game'
import type { Input } from '../src/input'
import type { ScoreStore } from '../src/storage'
import { GameOverScene } from '../src/scenes/gameover'
import { HIGHSCORE_KEY, SKIN_KEY } from '../src/storage'
import { PlayScene } from '../src/scenes/play'

function memoryStore(initial: Record<string, string> = {}): ScoreStore & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v },
  }
}

/** confirm と dirX の両エッジラッチを模した Input スタブ */
function makeInput(): Input & { press(dir: -1 | 1): void; confirm(): void } {
  let confirmEdge = false
  let dirXEdge = 0
  return {
    dx: 0,
    dy: 0,
    consumeConfirm: (): boolean => {
      const v = confirmEdge
      confirmEdge = false
      return v
    },
    consumeDirX: (): number => {
      const v = dirXEdge
      dirXEdge = 0
      return v
    },
    press: (dir: -1 | 1): void => { dirXEdge = dir },
    confirm: (): void => { confirmEdge = true },
  } as unknown as Input & { press(dir: -1 | 1): void; confirm(): void }
}

function makeScene(storeData: Record<string, string>) {
  const input = makeInput()
  const storage = memoryStore(storeData)
  const g = {
    input,
    storage,
    assets: { get: () => undefined, draw: () => {} },
    sound: { startBgm: () => {}, stopBgm: () => {} },
  } as unknown as GameContext
  const scene = new GameOverScene(g, 1000, 3, false)
  // シェイク(0.4秒)を排水してから操作を受け付けさせる
  scene.update(0.5)
  return { scene, input, storage }
}

describe('GameOverScene のスキン選択', () => {
  it('→ で次のスキンに切り替わり、解放済みなら即保存される', () => {
    const { scene, input, storage } = makeScene({ [HIGHSCORE_KEY]: '15000' })
    input.press(1)
    scene.update(1 / 60)
    expect(scene.selectedSkin()).toBe('cyber')
    expect(storage.data[SKIN_KEY]).toBe('cyber')
  })

  it('未解放スキンへはカーソルは移動するが保存されない', () => {
    const { scene, input, storage } = makeScene({ [HIGHSCORE_KEY]: '15000', [SKIN_KEY]: 'cyber' })
    input.press(1)
    scene.update(1 / 60)  // cyber → mage(未解放)
    expect(scene.selectedSkin()).toBe('mage')
    expect(storage.data[SKIN_KEY]).toBe('cyber')
  })

  it('未解放スキン表示中にリトライしても保存値は変わらず、PlayScene には保存済みスキンが適用される', () => {
    const { scene, input, storage } = makeScene({ [HIGHSCORE_KEY]: '15000', [SKIN_KEY]: 'cyber' })
    input.press(1)
    scene.update(1 / 60)  // cyber → mage(未解放)にカーソル
    input.confirm()
    const next = scene.update(1 / 60)
    expect(next).toBeInstanceOf(PlayScene)
    expect(storage.data[SKIN_KEY]).toBe('cyber')
  })

  it('← で末尾へラップする(未解放も巡回に含む)', () => {
    const { scene, input } = makeScene({ [HIGHSCORE_KEY]: '0' })
    input.press(-1)
    scene.update(1 / 60)
    expect(scene.selectedSkin()).toBe('maid')
  })

  it('シェイク中の ←→ 入力は排水され、シェイク終了後に持ち越されない', () => {
    const input = makeInput()
    const storage = memoryStore({ [HIGHSCORE_KEY]: '15000' })
    const g = {
      input,
      storage,
      assets: { get: () => undefined, draw: () => {} },
      sound: { startBgm: () => {}, stopBgm: () => {} },
    } as unknown as GameContext
    const scene = new GameOverScene(g, 1000, 3, false)
    input.press(1)
    scene.update(0.1)  // まだシェイク中
    scene.update(0.5)  // シェイク終了
    expect(scene.selectedSkin()).toBe('default')
  })
})
