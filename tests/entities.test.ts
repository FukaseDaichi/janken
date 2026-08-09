import { describe, it, expect } from 'vitest'
import { collides } from '../src/entities/collision'

describe('collides', () => {
  it('半径の和より近ければ衝突', () => {
    expect(collides({ x: 0, y: 0, radius: 10 }, { x: 15, y: 0, radius: 10 })).toBe(true)
  })
  it('半径の和より遠ければ非衝突', () => {
    expect(collides({ x: 0, y: 0, radius: 10 }, { x: 25, y: 0, radius: 10 })).toBe(false)
  })
})
