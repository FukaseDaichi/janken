import { describe, it, expect } from 'vitest'
import {
  StarItem,
  pickItemSpawnPos,
  ITEM_LIFE_SEC,
  ITEM_SPAWN_MARGIN,
  ITEM_MIN_DIST_FROM_PLAYER,
} from '../src/entities/item'
import { FIELD_W, FIELD_H } from '../src/entities/player'
import { STAR_COLORS } from '../src/render/theme'

/** 呼ぶたびに与えた列を順に返す決定的な乱数。使い切ったら最後の値を返し続ける。 */
function seq(values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('pickItemSpawnPos', () => {
  it('外周マージンの内側にだけ出す', () => {
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      const { x, y } = pickItemSpawnPos(0, 0, () => v)
      expect(x).toBeGreaterThanOrEqual(ITEM_SPAWN_MARGIN)
      expect(x).toBeLessThanOrEqual(FIELD_W - ITEM_SPAWN_MARGIN)
      expect(y).toBeGreaterThanOrEqual(ITEM_SPAWN_MARGIN)
      expect(y).toBeLessThanOrEqual(FIELD_H - ITEM_SPAWN_MARGIN)
    }
  })

  it('自機から十分離れた候補が出たらそれを採用する', () => {
    const px = FIELD_W / 2
    const py = FIELD_H / 2
    // 1回目は自機と同じ中央(却下)、2回目は左上寄り(採用)
    const { x, y } = pickItemSpawnPos(px, py, seq([0.5, 0.5, 0, 0]))
    expect(Math.hypot(x - px, y - py)).toBeGreaterThanOrEqual(ITEM_MIN_DIST_FROM_PLAYER)
  })

  // 距離条件は妥協してよいが、マージン条件は必ず守る。
  it('距離条件を満たす候補が出なくてもマージン内には必ず収まる', () => {
    const px = FIELD_W / 2
    const py = FIELD_H / 2
    const { x, y } = pickItemSpawnPos(px, py, () => 0.5)
    expect(Math.hypot(x - px, y - py)).toBeLessThan(ITEM_MIN_DIST_FROM_PLAYER)
    expect(x).toBeGreaterThanOrEqual(ITEM_SPAWN_MARGIN)
    expect(x).toBeLessThanOrEqual(FIELD_W - ITEM_SPAWN_MARGIN)
    expect(y).toBeGreaterThanOrEqual(ITEM_SPAWN_MARGIN)
    expect(y).toBeLessThanOrEqual(FIELD_H - ITEM_SPAWN_MARGIN)
  })
})

describe('StarItem', () => {
  it('寿命 ITEM_LIFE_SEC を超えると isExpired が true になる', () => {
    const item = new StarItem(100, 100)
    item.update(ITEM_LIFE_SEC - 0.01)
    expect(item.isExpired()).toBe(false)
    item.update(0.01)
    expect(item.isExpired()).toBe(true)
  })

  // tests/bullet-colors.test.ts と同じ手法。Canvas 実体は不要なので、
  // draw() が呼ぶメソッドだけを持つスタブでグラデーションの色を記録する。
  it('星は STAR_COLORS の色だけで描かれる', () => {
    const colors: string[] = []
    const gradient = {
      addColorStop: (_offset: number, color: string) => { colors.push(color) },
    }
    const ctx = {
      save() {}, restore() {}, beginPath() {}, closePath() {},
      moveTo() {}, lineTo() {}, arc() {}, fill() {},
      translate() {}, rotate() {},
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
    } as unknown as CanvasRenderingContext2D

    new StarItem(100, 100).draw(ctx, 0)

    // 8桁hex(#RRGGBBAA)のアルファ部分を落として基本色だけを取り出す
    const used = new Set(colors.map((c) => c.slice(0, 7)))
    expect(used).toEqual(new Set([STAR_COLORS.glow, STAR_COLORS.core, STAR_COLORS.base]))
  })

  it('消滅間際は点滅するので、描かれないフレームがある', () => {
    const noop = {
      save() {}, restore() {}, beginPath() {}, closePath() {},
      moveTo() {}, lineTo() {}, arc() {}, fill() {},
      translate() {}, rotate() {},
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    }
    const drawnAt = (ageSec: number): boolean => {
      let filled = 0
      const ctx = { ...noop, fill: () => { filled++ } } as unknown as CanvasRenderingContext2D
      const item = new StarItem(100, 100)
      item.update(ageSec)
      item.draw(ctx, 0)
      return filled > 0
    }

    // 残り 2 秒未満で 0.125 秒周期の点滅に入る(残り 1.0 秒 → 描く / 1.125 秒 → 描かない)
    expect(drawnAt(ITEM_LIFE_SEC - 3)).toBe(true)
    expect(drawnAt(ITEM_LIFE_SEC - 1.0)).toBe(true)
    expect(drawnAt(ITEM_LIFE_SEC - 1.125)).toBe(false)
  })
})
