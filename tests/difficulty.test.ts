import { describe, it, expect } from 'vitest'
import { difficultyFor } from '../src/logic/difficulty'

describe('difficultyFor', () => {
  it('時間経過でスポーン間隔が短くなる', () => {
    const early = difficultyFor(1, 0)
    const late = difficultyFor(1, 120)
    expect(late.bulletInterval).toBeLessThan(early.bulletInterval)
    expect(late.handInterval).toBeLessThan(early.handInterval)
  })

  it('レベル上昇でも間隔が短くなり速度が上がる', () => {
    const lv1 = difficultyFor(1, 60)
    const lv5 = difficultyFor(5, 60)
    expect(lv5.bulletInterval).toBeLessThan(lv1.bulletInterval)
    expect(lv5.speedMax).toBeGreaterThan(lv1.speedMax)
  })

  it('スポーン間隔と速度に上下限がある', () => {
    const extreme = difficultyFor(100, 100000)
    expect(extreme.bulletInterval).toBeGreaterThanOrEqual(0.12)
    expect(extreme.handInterval).toBeGreaterThanOrEqual(0.5)
    expect(extreme.speedMax).toBeLessThanOrEqual(420)
  })

  it('弾種はレベルで解放される', () => {
    expect(difficultyFor(1, 0).bulletTypes).toEqual(['straight'])
    expect(difficultyFor(3, 0).bulletTypes).toEqual(['straight', 'aimed'])
    expect(difficultyFor(5, 0).bulletTypes).toEqual(['straight', 'aimed', 'curve'])
  })
})
