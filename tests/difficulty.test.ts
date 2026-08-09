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
    expect(extreme.handInterval).toBeGreaterThanOrEqual(0.45)
    expect(extreme.speedMax).toBeLessThanOrEqual(420)
  })

  // 手の出現頻度は「弾は据え置きで、倒せる対象だけを少し増やす」という
  // 意図で調整した値。リファクタで意図せず旧値(序盤3.0秒/下限0.5秒)に
  // 戻るのを防ぐため、具体値で固定する。
  it('手のスポーン間隔は序盤2.6秒・下限0.45秒', () => {
    expect(difficultyFor(1, 0).handInterval).toBeCloseTo(2.6)
    expect(difficultyFor(100, 100000).handInterval).toBeCloseTo(0.45)
  })

  it('手のスポーン間隔は弾のスポーン間隔より常に長い', () => {
    for (const [level, elapsed] of [[1, 0], [3, 60], [5, 120], [100, 100000]]) {
      const d = difficultyFor(level, elapsed)
      expect(d.handInterval).toBeGreaterThan(d.bulletInterval)
    }
  })

  it('弾種はレベルで解放される', () => {
    expect(difficultyFor(1, 0).bulletTypes).toEqual(['straight'])
    expect(difficultyFor(3, 0).bulletTypes).toEqual(['straight', 'aimed'])
    expect(difficultyFor(5, 0).bulletTypes).toEqual(['straight', 'aimed', 'curve'])
  })
})
