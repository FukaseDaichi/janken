import { describe, it, expect } from 'vitest'
import { loadHighScore, saveHighScoreIfHigher, HIGHSCORE_KEY, type ScoreStore } from '../src/storage'

function memoryStore(initial: Record<string, string> = {}): ScoreStore & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v },
  }
}

describe('loadHighScore', () => {
  it('未保存なら 0', () => {
    expect(loadHighScore(memoryStore())).toBe(0)
  })
  it('保存済みの値を返す', () => {
    expect(loadHighScore(memoryStore({ [HIGHSCORE_KEY]: '1234' }))).toBe(1234)
  })
  it('不正値は 0', () => {
    expect(loadHighScore(memoryStore({ [HIGHSCORE_KEY]: 'abc' }))).toBe(0)
  })
})

describe('saveHighScoreIfHigher', () => {
  it('ハイスコアを上回れば保存して true', () => {
    const store = memoryStore({ [HIGHSCORE_KEY]: '100' })
    expect(saveHighScoreIfHigher(store, 200)).toBe(true)
    expect(store.data[HIGHSCORE_KEY]).toBe('200')
  })
  it('下回れば保存せず false', () => {
    const store = memoryStore({ [HIGHSCORE_KEY]: '100' })
    expect(saveHighScoreIfHigher(store, 50)).toBe(false)
    expect(store.data[HIGHSCORE_KEY]).toBe('100')
  })
})
