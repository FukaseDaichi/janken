import type { Scene, GameContext } from '../game'
import { loadHighScore } from '../storage'
import { PlayScene } from './play'
import { drawNeonBackground } from '../render/background'
import { outlinedText, neonText } from '../render/text'
import { CANVAS_W, CANVAS_H, COLORS, HAND_COLORS, FONT_DISPLAY, FONT_NUM, HAND_EMOJI } from '../render/theme'
import type { Hand } from '../logic/janken'

const HANDS: Hand[] = ['rock', 'scissors', 'paper']

/** 装飾用に漂う敵手の配置(決定的、当たり判定なし)。ルールカードの帯(y 420-570)と
 *  中央のプロンプト文字を避けて、四隅寄りに配置する。 */
const FLOATERS: Array<{ hand: Hand; x: number; y: number; size: number; phase: number }> = [
  { hand: 'rock', x: 0.055, y: 0.16, size: 104, phase: 0 },
  { hand: 'paper', x: 0.045, y: 0.90, size: 88, phase: 2.1 },
  { hand: 'scissors', x: 0.945, y: 0.17, size: 112, phase: 4.2 },
  { hand: 'paper', x: 0.955, y: 0.90, size: 92, phase: 1.3 },
]

export class TitleScene implements Scene {
  constructor(private g: GameContext) {}

  update(): Scene | null {
    if (this.g.input.consumeConfirm()) {
      this.g.sound.startBgm()
      return new PlayScene(this.g)
    }
    return null
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const t = performance.now() / 1000
    ctx.save()
    drawNeonBackground(ctx, CANVAS_W, CANVAS_H, t, { perspective: true })

    // 漂う手(ゆっくり上下)
    for (const f of FLOATERS) {
      const y = f.y * CANVAS_H + Math.sin(t * 0.8 + f.phase) * 10
      this.g.assets.draw(ctx, `enemy-${f.hand}`, f.x * CANVAS_W, y, f.size)
    }

    const cx = CANVAS_W / 2

    // 3すくみエンブレム(六角形+絵文字)
    HANDS.forEach((hand, i) => {
      const ex = cx + (i - 1) * 76
      const ey = 64
      drawHexagon(ctx, ex, ey, 30, HAND_COLORS[hand].base, HAND_COLORS[hand].glow)
      ctx.font = '28px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(HAND_EMOJI[hand], ex, ey)
    })

    // ロゴ2段
    outlinedText(ctx, 'じゃんけん', cx, 170, {
      size: 84, font: FONT_DISPLAY, fill: '#ffffff',
      outline: '#000', outlineWidth: 16, shadowColor: 'rgba(0,0,0,0.7)', shadowOffset: 7,
    })
    const grad = ctx.createLinearGradient(0, 230, 0, 320)
    grad.addColorStop(0, '#ffe45e')
    grad.addColorStop(1, '#ff9d2e')
    outlinedText(ctx, 'サバイバー', cx, 278, {
      size: 92, font: FONT_DISPLAY, fill: grad,
      outline: '#000', outlineWidth: 18, shadowColor: 'rgba(0,0,0,0.7)', shadowOffset: 8,
    })
    outlinedText(ctx, '― 勝てる手で、弾をかいくぐれ！ ―', cx, 352, {
      size: 24, font: FONT_DISPLAY, fill: '#ffffff', outline: '#000', outlineWidth: 6,
    })

    // ルールカード4枚
    const cards: Array<{ title: string; lines: string[] }> = [
      { title: '操作', lines: ['矢印キー / WASD', 'で移動'] },
      { title: '弾に当たると', lines: ['GAME OVER'] },
      { title: 'じゃんけんの手は', lines: ['勝てる手なら', '体当たりで倒せる！', 'あいこ・負けはNG'] },
      { title: '3回勝つと', lines: ['LEVEL UP!', '手が変わり倍率UP'] },
    ]
    const cardW = 262
    const cardH = 150
    const gap = 18
    const x0 = cx - (cardW * 2 + gap * 1.5)
    cards.forEach((card, i) => {
      const x = x0 + i * (cardW + gap)
      const y = 420
      ctx.fillStyle = 'rgba(12, 8, 34, 0.85)'
      ctx.strokeStyle = COLORS.panelBorder
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(x, y, cardW, cardH, 14)
      ctx.fill()
      ctx.stroke()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `17px ${FONT_DISPLAY}`
      ctx.fillStyle = COLORS.cyan
      ctx.fillText(card.title, x + cardW / 2, y + 32)
      card.lines.forEach((line, j) => {
        const emphasis = line.includes('GAME OVER') || line.includes('LEVEL UP')
        ctx.font = `${emphasis ? 20 : 15}px ${FONT_DISPLAY}`
        ctx.fillStyle = line.includes('GAME OVER') ? COLORS.red : line.includes('LEVEL UP') ? COLORS.yellow : '#fff'
        ctx.fillText(line, x + cardW / 2, y + 66 + j * 26)
      })
    })

    // スタートプロンプト(点滅)+ ハイスコア
    if (Math.floor(t * 1.6) % 2 === 0) {
      neonText(ctx, 'PRESS ENTER / SPACE', cx, 620, { size: 28, font: FONT_NUM, color: COLORS.cyan })
    }
    ctx.font = `700 18px ${FONT_NUM}`
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText(`HIGH SCORE  ${loadHighScore(this.g.storage).toLocaleString('en-US')}`, cx, 672)

    ctx.restore()
  }
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, glow: string): void {
  ctx.save()
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2
    const px = x + Math.cos(a) * r
    const py = y + Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.shadowColor = glow
  ctx.shadowBlur = 14
  ctx.fill()
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()
}
