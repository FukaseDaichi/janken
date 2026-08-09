import { describe, it, expect } from 'vitest'
import { initialLevelState, addWin, WINS_PER_LEVEL } from '../src/logic/level'

describe('level progression', () => {
  it('初期状態は LV1 / 0 勝', () => {
    expect(initialLevelState()).toEqual({ level: 1, wins: 0 })
  })

  it('3 勝未満では LVUP しない', () => {
    let { state, leveledUp } = addWin(initialLevelState())
    expect(state).toEqual({ level: 1, wins: 1 })
    expect(leveledUp).toBe(false)
  })

  it('3 勝で LVUP し勝利カウントがリセットされる', () => {
    let s = initialLevelState()
    let leveledUp = false
    for (let i = 0; i < WINS_PER_LEVEL; i++) {
      const r = addWin(s)
      s = r.state
      leveledUp = r.leveledUp
    }
    expect(s).toEqual({ level: 2, wins: 0 })
    expect(leveledUp).toBe(true)
  })

  it('元の state を破壊しない', () => {
    const s = initialLevelState()
    addWin(s)
    expect(s).toEqual({ level: 1, wins: 0 })
  })
})
