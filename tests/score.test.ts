import { describe, it, expect } from 'vitest'
import { levelMultiplier, timeScore, killBonus, BASE_RATE, KILL_BONUS } from '../src/logic/score'

describe('levelMultiplier', () => {
  it('LV1 は 1.0、以降 +0.5', () => {
    expect(levelMultiplier(1)).toBe(1.0)
    expect(levelMultiplier(2)).toBe(1.5)
    expect(levelMultiplier(3)).toBe(2.0)
    expect(levelMultiplier(5)).toBe(3.0)
  })
})

describe('timeScore', () => {
  it('基礎レート × 経過秒 × 倍率', () => {
    expect(timeScore(1, 1)).toBe(BASE_RATE)
    expect(timeScore(2, 3)).toBe(BASE_RATE * 2 * 2.0)
    expect(timeScore(0.5, 1)).toBe(BASE_RATE * 0.5)
  })
})

describe('killBonus', () => {
  it('KILL_BONUS × 倍率', () => {
    expect(killBonus(1)).toBe(KILL_BONUS)
    expect(killBonus(3)).toBe(KILL_BONUS * 2.0)
  })
})
