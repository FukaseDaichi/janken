import { describe, it, expect } from 'vitest'
import { drawInvincibleRing } from '../src/render/effects'

interface ArcCall { x: number; y: number; r: number; start: number; end: number }

/** drawInvincibleRing が描いた円弧を記録する。Canvas 実体は不要。 */
function record(remainingSec: number, maxSec: number): ArcCall[] {
  const arcs: ArcCall[] = []
  const ctx = {
    save() {}, restore() {}, beginPath() {}, stroke() {},
    arc(x: number, y: number, r: number, start: number, end: number) {
      arcs.push({ x, y, r, start, end })
    },
  } as unknown as CanvasRenderingContext2D
  drawInvincibleRing(ctx, 100, 200, 24, remainingSec, maxSec)
  return arcs
}

describe('drawInvincibleRing', () => {
  it('残量いっぱいなら1周ぶんの円弧を描く', () => {
    const [arc] = record(8, 8)
    expect(arc.end - arc.start).toBeCloseTo(Math.PI * 2)
  })

  it('残量が半分なら半周ぶんの円弧を描く', () => {
    const [arc] = record(4, 8)
    expect(arc.end - arc.start).toBeCloseTo(Math.PI)
  })

  it('12時方向から時計回りに描く', () => {
    const [arc] = record(8, 8)
    expect(arc.start).toBeCloseTo(-Math.PI / 2)
    expect(arc.end).toBeGreaterThan(arc.start)
  })

  it('自機の半径より外側に描く', () => {
    const [arc] = record(8, 8)
    expect(arc.x).toBe(100)
    expect(arc.y).toBe(200)
    expect(arc.r).toBeGreaterThan(24)
  })

  it('残時間が 0 なら何も描かない', () => {
    expect(record(0, 8)).toEqual([])
  })

  // 0.125 秒周期の点滅で「もうすぐ切れる」と伝える
  it('残り 1.5 秒未満では点滅する', () => {
    expect(record(1.0, 8).length).toBe(1)
    expect(record(1.125, 8).length).toBe(0)
    // 1.5 秒以上あるうちは点滅しない
    expect(record(2.125, 8).length).toBe(1)
  })
})
