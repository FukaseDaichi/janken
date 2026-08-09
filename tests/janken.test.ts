import { describe, it, expect } from 'vitest'
import { judge, beats, randomOtherHand, randomHand, type Hand } from '../src/logic/janken'

describe('judge', () => {
  it('全 9 組み合わせを正しく判定する', () => {
    expect(judge('rock', 'scissors')).toBe('win')
    expect(judge('rock', 'paper')).toBe('lose')
    expect(judge('rock', 'rock')).toBe('draw')
    expect(judge('scissors', 'paper')).toBe('win')
    expect(judge('scissors', 'rock')).toBe('lose')
    expect(judge('scissors', 'scissors')).toBe('draw')
    expect(judge('paper', 'rock')).toBe('win')
    expect(judge('paper', 'scissors')).toBe('lose')
    expect(judge('paper', 'paper')).toBe('draw')
  })
})

describe('beats', () => {
  it('各手が勝てる相手を返す', () => {
    expect(beats('rock')).toBe('scissors')
    expect(beats('scissors')).toBe('paper')
    expect(beats('paper')).toBe('rock')
  })
})

describe('randomOtherHand', () => {
  it('現在の手以外の 2 種から選ぶ', () => {
    const others: Hand[] = [randomOtherHand('rock', () => 0), randomOtherHand('rock', () => 0.99)]
    expect(others).not.toContain('rock')
    expect(new Set(others).size).toBe(2)
  })
})

describe('randomHand', () => {
  it('3 種すべてを返しうる', () => {
    expect(randomHand(() => 0)).toBe('rock')
    expect(randomHand(() => 0.5)).toBe('scissors')
    expect(randomHand(() => 0.99)).toBe('paper')
  })
})
