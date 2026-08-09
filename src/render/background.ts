import { COLORS } from './theme'

export interface NeonBackgroundOpts {
  /** true でタイトル画面用の遠近グリッド、false(既定)で見下ろし型のフラットグリッド */
  perspective?: boolean
}

/**
 * ネオンアーケード調の背景: 深紫の空間 + グリッド + ビネット。
 * 状態は持たず、timeSec(経過秒)でグリッドのスクロール位相を決める。
 *
 * 既定(perspective: false)は見下ろし型のフラットグリッド。プレイ画面/ゲームオーバー
 * 画面はプレイヤーが2D平面上を自由移動するため、消失点のある床は「宙に浮いている」
 * ような誤読を招く。タイトル画面だけは奥行き演出として遠近グリッドを使う。
 */
export function drawNeonBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeSec: number,
  opts: NeonBackgroundOpts = {},
): void {
  const perspective = opts.perspective ?? false
  ctx.save()

  // 空間のベース
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  if (perspective) {
    // 上が濃く、下(床)に向けて紫が差す
    sky.addColorStop(0, '#05030e')
    sky.addColorStop(0.55, COLORS.bgDeep)
    sky.addColorStop(1, '#1b0f3a')
  } else {
    // 見下ろし型は上下に意味の差がないため対称にする
    sky.addColorStop(0, '#0a0618')
    sky.addColorStop(0.5, '#150c33')
    sky.addColorStop(1, '#0a0618')
  }
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // 浮遊光点の縦方向レンジは両モード共通(horizonY はレイアウト上の定数として維持)
  const horizonY = h * 0.42

  if (perspective) {
    // 床グリッド(画面下半分、消失点は画面中央やや上)
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
  } else {
    // 見下ろし型のフラットグリッド。等間隔のセルが timeSec でゆっくりスクロールし、
    // 4本ごとに明るい線を入れて広さの手がかりにする。消失点を作らないことで、
    // プレイヤーが平面上を動いているという読み取りを壊さない。
    const CELL = 60
    const offset = (timeSec * 12) % CELL
    ctx.lineWidth = 1
    for (let x = -CELL; x <= w + CELL; x += CELL) {
      const px = x + offset
      const major = Math.round((px - offset) / CELL) % 4 === 0
      ctx.strokeStyle = major ? 'rgba(170, 100, 255, 0.38)' : 'rgba(140, 80, 230, 0.16)'
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, h)
      ctx.stroke()
    }
    for (let y = -CELL; y <= h + CELL; y += CELL) {
      const py = y + offset
      const major = Math.round((py - offset) / CELL) % 4 === 0
      ctx.strokeStyle = major ? 'rgba(170, 100, 255, 0.38)' : 'rgba(140, 80, 230, 0.16)'
      ctx.beginPath()
      ctx.moveTo(0, py)
      ctx.lineTo(w, py)
      ctx.stroke()
    }
    // 中央からのやわらかい発光で、平面に奥行きではなく「場」の中心を与える
    const center = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6)
    center.addColorStop(0, 'rgba(120, 60, 220, 0.22)')
    center.addColorStop(1, 'rgba(120, 60, 220, 0)')
    ctx.fillStyle = center
    ctx.fillRect(0, 0, w, h)
  }

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
