import { describe, it, expect } from 'vitest'
import { COLORS, FLASH_RGB } from '../src/render/theme'

/** '#rrggbb' → 'R,G,B'。フラッシュ演出は rgba() のアルファを毎フレーム変えるため、
 *  hex ではなく分解済みの文字列が要る。変換はテスト側に置き、
 *  production では定数の対応が崩れていないことだけを保証する。 */
function hexToRgbString(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

describe('FLASH_RGB', () => {
  it('COLORS の hex と同じ色を指している', () => {
    expect(FLASH_RGB.white).toBe(hexToRgbString(COLORS.white))
    expect(FLASH_RGB.yellow).toBe(hexToRgbString(COLORS.yellow))
  })
})
