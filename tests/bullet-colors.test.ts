import { describe, it, expect } from 'vitest'
import { spawnBullet } from '../src/entities/bullet'
import { BULLET_COLORS, HAND_COLORS } from '../src/render/theme'
import type { BulletType } from '../src/logic/difficulty'

const TYPES: BulletType[] = ['straight', 'aimed', 'curve']

/** Bullet.draw() がグラデーションに渡した色を記録する。
 *  Canvas 実体は不要なので、draw() が呼ぶメソッドだけを持つスタブで代用する。 */
function drawColorsOf(type: BulletType): string[] {
  const colors: string[] = []
  const gradient = { addColorStop: (_offset: number, color: string) => { colors.push(color) } }
  const ctx = {
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {},
    stroke() {}, arc() {}, fill() {},
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  } as unknown as CanvasRenderingContext2D

  spawnBullet(type, 100, 100, 0, 200).draw(ctx)
  return colors
}

describe('弾種ごとの色分け', () => {
  it('弾種ごとに対応する色だけを使って描画する', () => {
    for (const type of TYPES) {
      const palette = BULLET_COLORS[type]
      // 8桁hex(#RRGGBBAA)のアルファ部分を落として基本色だけを取り出す
      const used = new Set(drawColorsOf(type).map((c) => c.slice(0, 7)))
      // 中心のハイライト白 + その弾種の3色。他の弾種の色が混ざっていたら失敗する。
      expect(used).toEqual(new Set(['#ffffff', palette.core, palette.trail, palette.edge]))
    }
  })

  it('弾3種の色は互いに重複しない', () => {
    const trails = TYPES.map((t) => BULLET_COLORS[t].trail)
    expect(new Set(trails).size).toBe(TYPES.length)
  })

  // 弾は接触即 GAME OVER、手は勝てる手なら倒せる。見間違いが致命的なので、
  // 弾の色は手のキーカラーと必ず別の色にする。
  it('弾の色は手のキーカラーと重複しない', () => {
    const handColors = new Set(Object.values(HAND_COLORS).flatMap((c) => [c.base, c.glow]))
    for (const type of TYPES) {
      const { core, trail, edge } = BULLET_COLORS[type]
      for (const color of [core, trail, edge]) {
        expect(handColors.has(color)).toBe(false)
      }
    }
  })
})
