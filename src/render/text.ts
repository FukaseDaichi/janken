type Align = CanvasTextAlign

/**
 * 字間(トラッキング)を開けて 1 行を描く。筐体の刻印ラベル調の小見出しに使う。
 * ctx.letterSpacing は未対応ブラウザがあるため自前で 1 文字ずつ送る。
 * font / fillStyle / textBaseline は呼び出し側で設定しておくこと(measureText が font に依存する)。
 */
export function fillTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: Align,
  tracking: number,
): void {
  if (tracking === 0) {
    ctx.textAlign = align
    ctx.fillText(text, x, y)
    return
  }
  const chars = [...text]
  const widths = chars.map((c) => ctx.measureText(c).width)
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1)
  let cur = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x
  ctx.textAlign = 'left'
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cur, y)
    cur += widths[i] + tracking
  }
  ctx.textAlign = align
}

export interface OutlinedTextOpts {
  size: number
  font: string
  fill: string | CanvasGradient
  outline?: string
  outlineWidth?: number
  align?: Align
  shadowColor?: string
  shadowOffset?: number
}

/** 袋文字(縁取り+オフセットシャドウ)。ロゴ・見出し用 */
export function outlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: OutlinedTextOpts,
): void {
  const { size, font, fill, outline = '#000', outlineWidth = size * 0.18, align = 'center', shadowColor, shadowOffset = size * 0.08 } = opts
  ctx.save()
  ctx.font = `${size}px ${font}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  if (shadowColor) {
    ctx.fillStyle = shadowColor
    ctx.fillText(text, x + shadowOffset, y + shadowOffset)
  }
  ctx.strokeStyle = outline
  ctx.lineWidth = outlineWidth
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
  ctx.restore()
}

export interface NeonTextOpts {
  size: number
  font: string
  color: string
  align?: Align
  blur?: number
  /** 字間(px)。既定 0 */
  tracking?: number
}

/** ネオングロー文字。HUD 数値・点滅プロンプト用 */
export function neonText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: NeonTextOpts,
): void {
  const { size, font, color, align = 'center', blur = size * 0.5, tracking = 0 } = opts
  ctx.save()
  ctx.font = `${size}px ${font}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.shadowColor = color
  ctx.shadowBlur = blur
  ctx.fillStyle = color
  fillTracked(ctx, text, x, y, align, tracking)
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  fillTracked(ctx, text, x, y, align, tracking)
  ctx.restore()
}
