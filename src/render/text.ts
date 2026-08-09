type Align = CanvasTextAlign

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
}

/** ネオングロー文字。HUD 数値・点滅プロンプト用 */
export function neonText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: NeonTextOpts,
): void {
  const { size, font, color, align = 'center', blur = size * 0.5 } = opts
  ctx.save()
  ctx.font = `${size}px ${font}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.shadowColor = color
  ctx.shadowBlur = blur
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(text, x, y)
  ctx.restore()
}
