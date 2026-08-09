import { COLORS } from './theme'

/** 残りこの秒数を切ったらリングを点滅させ、無敵が切れることを予告する。 */
const BLINK_SEC = 1.5

/** 無敵の残り時間リング。自機の周りに 12 時方向から時計回りに、残量ぶんの
 *  円弧を描く。数値 HUD ではなく自機に付随する演出なので、DESIGN.md §4 の
 *  「フィールドに重ねてよいのは演出だけ」に収まる。 */
export function drawInvincibleRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  playerRadius: number,
  remainingSec: number,
  maxSec: number,
): void {
  if (remainingSec <= 0) return
  if (remainingSec < BLINK_SEC && Math.floor(remainingSec * 8) % 2 === 1) return

  const r = playerRadius * 1.6
  const ratio = Math.max(0, Math.min(1, remainingSec / maxSec))
  const start = -Math.PI / 2

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = COLORS.yellow
  ctx.shadowColor = COLORS.yellow
  ctx.shadowBlur = 12
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(x, y, r, start, start + Math.PI * 2 * ratio)
  ctx.stroke()
  ctx.restore()
}
