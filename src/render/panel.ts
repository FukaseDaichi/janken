import type { Hand } from '../logic/janken'
import type { Assets } from '../assets'
import { beats } from '../logic/janken'
import { CANVAS_H, PANEL_X, PANEL_W, COLORS, HAND_COLORS, HAND_LABEL, FONT_DISPLAY, FONT_NUM } from './theme'
import { neonText } from './text'

export interface PanelData {
  score: number
  level: number
  multiplier: number
  wins: number
  winsPerLevel: number
  playerHand: Hand
}

export function drawSidePanel(ctx: CanvasRenderingContext2D, assets: Assets, d: PanelData): void {
  const x = PANEL_X
  ctx.save()

  // パネル地は半透明なので、まず不透明な下地を敷く。フィールド外(x > 960)に
  // スポーンした敵・弾がここに描かれること、および game.ts の描画ループが
  // canvas をクリアしないことから、下地がないと前フレームの残像が透けて残る。
  ctx.fillStyle = COLORS.bgDeep
  ctx.fillRect(x, 0, PANEL_W, CANVAS_H)

  // パネル地(フィールド外はみ出し描画をここで覆う)
  ctx.fillStyle = COLORS.panelBg
  ctx.fillRect(x, 0, PANEL_W, CANVAS_H)
  ctx.strokeStyle = COLORS.panelBorder
  ctx.lineWidth = 2
  ctx.strokeRect(x + 1, 1, PANEL_W - 2, CANVAS_H - 2)

  const cx = x + PANEL_W / 2
  const label = (text: string, y: number) => {
    ctx.font = `700 15px ${FONT_NUM}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = COLORS.label
    ctx.fillText(text, cx, y)
  }

  // SCORE
  label('SCORE', 48)
  neonText(ctx, Math.floor(d.score).toLocaleString('en-US'), cx, 84, { size: 30, font: FONT_NUM, color: COLORS.cyan })

  // MULTIPLIER
  label('MULTIPLIER', 140)
  neonText(ctx, `× ${d.multiplier.toFixed(1)}`, cx, 176, { size: 28, font: FONT_NUM, color: COLORS.yellow })

  // LV
  label('LV.', 232)
  neonText(ctx, String(d.level).padStart(2, '0'), cx, 272, { size: 36, font: FONT_NUM, color: COLORS.white })

  // 勝利ピップ(winsPerLevel 個)
  label('WINS', 330)
  const pipGap = 34
  const pipX0 = cx - ((d.winsPerLevel - 1) * pipGap) / 2
  for (let i = 0; i < d.winsPerLevel; i++) {
    const filled = i < d.wins
    ctx.beginPath()
    ctx.arc(pipX0 + i * pipGap, 362, 9, 0, Math.PI * 2)
    if (filled) {
      ctx.fillStyle = COLORS.yellow
      ctx.shadowColor = COLORS.yellow
      ctx.shadowBlur = 10
      ctx.fill()
      ctx.shadowBlur = 0
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }

  // 自分の手
  label('YOU', 430)
  assets.draw(ctx, `player-${d.playerHand}`, cx, 486, 76)
  ctx.font = `16px ${FONT_DISPLAY}`
  ctx.fillStyle = HAND_COLORS[d.playerHand].glow
  ctx.fillText(HAND_LABEL[d.playerHand], cx, 540)

  // 倒せる手(緑グロー枠で強調)
  const target = beats(d.playerHand)
  label('TARGET', 572)
  ctx.strokeStyle = HAND_COLORS[target].glow
  ctx.lineWidth = 2.5
  ctx.shadowColor = HAND_COLORS[target].glow
  ctx.shadowBlur = 12
  ctx.strokeRect(cx - 46, 588, 92, 92)
  ctx.shadowBlur = 0
  assets.draw(ctx, `enemy-${target}`, cx, 634, 76)
  ctx.font = `14px ${FONT_DISPLAY}`
  ctx.fillStyle = HAND_COLORS[target].glow
  ctx.fillText(`${HAND_LABEL[target]}を倒せる！`, cx, 694)

  ctx.restore()
}
