import { COLORS } from './theme'

/**
 * ネオンアーケード調の背景: 深紫の空間 + パースの効いたグリッド床 + ビネット。
 * 状態は持たず、timeSec(経過秒)でグリッドのスクロール位相を決める。
 */
export function drawNeonBackground(ctx: CanvasRenderingContext2D, w: number, h: number, timeSec: number): void {
  ctx.save()

  // 空間のベース: 上が濃く、下(床)に向けて紫が差す
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#05030e')
  sky.addColorStop(0.55, COLORS.bgDeep)
  sky.addColorStop(1, '#1b0f3a')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // 床グリッド(画面下半分、消失点は画面中央やや上)
  const horizonY = h * 0.42
  const cx = w / 2
  ctx.strokeStyle = 'rgba(160, 80, 255, 0.35)'
  ctx.lineWidth = 1.5

  // 放射状の縦線
  for (let i = -10; i <= 10; i++) {
    ctx.beginPath()
    ctx.moveTo(cx + i * (w * 0.055), h)
    ctx.lineTo(cx + i * (w * 0.014), horizonY)
    ctx.stroke()
  }
  // 奥行き方向の横線(手前ほど間隔が広い)。timeSec で手前に流す
  const scroll = (timeSec * 0.25) % 1
  for (let j = 0; j < 14; j++) {
    const t = (j + scroll) / 14
    const y = horizonY + (h - horizonY) * t * t
    ctx.globalAlpha = 0.15 + 0.45 * t
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // 地平線の発光
  const glow = ctx.createLinearGradient(0, horizonY - 40, 0, horizonY + 40)
  glow.addColorStop(0, 'rgba(90, 40, 200, 0)')
  glow.addColorStop(0.5, 'rgba(150, 80, 255, 0.25)')
  glow.addColorStop(1, 'rgba(90, 40, 200, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, horizonY - 40, w, 80)

  // 浮遊光点(位置は決定的に散らし、明滅だけ timeSec で揺らす)
  for (let k = 0; k < 24; k++) {
    const px = ((k * 379) % 997) / 997 * w
    const py = ((k * 613) % 991) / 991 * horizonY
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(timeSec * 1.3 + k))
    ctx.globalAlpha = 0.25 * tw
    ctx.fillStyle = k % 3 === 0 ? COLORS.cyan : k % 3 === 1 ? '#c07dff' : COLORS.yellow
    ctx.beginPath()
    ctx.arc(px, py, 1.5 + (k % 3), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // ビネット
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, h * 0.95)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, w, h)

  ctx.restore()
}
