import type { Scene, GameContext } from '../game'
import { loadHighScore, loadSkin, saveSkin } from '../storage'
import { SKINS, nextSkin, isUnlocked, unlockScoreOf, type SkinId } from '../logic/skins'
import { playerSprite } from '../assets'
import { PlayScene } from './play'
import { drawNeonBackground } from '../render/background'
import { outlinedText, neonText } from '../render/text'
import { CANVAS_W, CANVAS_H, COLORS, FONT_DISPLAY, FONT_NUM } from '../render/theme'

export class GameOverScene implements Scene {
  private shakeSec = 0.4
  private highScore: number
  private selected: SkinId

  constructor(
    private g: GameContext,
    private score: number,
    private level: number,
    private isNewRecord: boolean,
  ) {
    this.highScore = loadHighScore(g.storage)
    this.selected = loadSkin(g.storage, this.highScore)
  }

  /** テスト用の読み取り口 */
  selectedSkin(): SkinId {
    return this.selected
  }

  update(dtSec: number): Scene | null {
    this.shakeSec = Math.max(0, this.shakeSec - dtSec)
    // シェイクが収まるまではリトライを受け付けない。ただし consumeConfirm() は
    // 必ず呼んでラッチを毎フレーム排水する — ここで呼ばずに早期 return すると、
    // 死亡直前に押されていた（あるいはシェイク中に押された）confirmEdge が
    // 消費されずに残り、シェイク終了直後の1フレームで即リトライしてしまう。
    // consumeDirX() も同じ理由で毎フレーム呼ぶ(呼ばないと死亡直前の ←→ が
    // シェイク終了直後に化けて発火する)。
    const confirmed = this.g.input.consumeConfirm()
    const dir = this.g.input.consumeDirX()
    if (this.shakeSec > 0) return null
    if (dir === 1 || dir === -1) {
      this.selected = nextSkin(this.selected, dir)
      // 解放済みに合った時点で即保存。未解放は保存しない(リトライ時は直前の保存値が使われる)
      if (isUnlocked(this.selected, this.highScore)) saveSkin(this.g.storage, this.selected)
    }
    if (confirmed) {
      this.g.sound.startBgm()
      return new PlayScene(this.g)
    }
    return null
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const t = performance.now() / 1000
    ctx.save()
    if (this.shakeSec > 0) {
      ctx.translate((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14)
    }
    drawNeonBackground(ctx, CANVAS_W, CANVAS_H, t * 0.3)
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(-20, -20, CANVAS_W + 40, CANVAS_H + 40)

    const cx = CANVAS_W / 2

    // GAME OVER: 赤袋文字 + グリッチ風の色ずれ(赤/シアンを左右にずらして重ねる)
    const gy = 200
    ctx.globalAlpha = 0.55
    outlinedText(ctx, 'GAME OVER', cx - 13, gy, { size: 88, font: FONT_DISPLAY, fill: COLORS.red, outline: 'transparent', outlineWidth: 0.1 })
    outlinedText(ctx, 'GAME OVER', cx + 13, gy, { size: 88, font: FONT_DISPLAY, fill: COLORS.cyan, outline: 'transparent', outlineWidth: 0.1 })
    ctx.globalAlpha = 1
    outlinedText(ctx, 'GAME OVER', cx, gy, {
      size: 88, font: FONT_DISPLAY, fill: COLORS.red,
      outline: '#000', outlineWidth: 16, shadowColor: 'rgba(0,0,0,0.8)', shadowOffset: 6,
    })

    // 集計パネル
    const pw = 460
    const ph = 220
    const px = cx - pw / 2
    const py = 280
    ctx.fillStyle = COLORS.panelBg
    ctx.strokeStyle = COLORS.panelBorder
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(px, py, pw, ph, 16)
    ctx.fill()
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 16px ${FONT_NUM}`
    ctx.fillStyle = COLORS.label
    ctx.fillText('SCORE', cx, py + 40)
    neonText(ctx, Math.floor(this.score).toLocaleString('en-US'), cx, py + 78, { size: 40, font: FONT_NUM, color: COLORS.cyan })
    ctx.font = `700 16px ${FONT_NUM}`
    ctx.fillStyle = COLORS.label
    ctx.fillText(`LV. ${String(this.level).padStart(2, '0')}`, cx, py + 122)
    if (this.isNewRecord) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6)
      neonText(ctx, '★ NEW RECORD ★', cx, py + 170, { size: 26, font: FONT_DISPLAY, color: COLORS.yellow })
      ctx.globalAlpha = 1
    } else {
      ctx.fillStyle = COLORS.labelStrong
      ctx.font = `700 16px ${FONT_NUM}`
      ctx.fillText(`HIGH SCORE  ${this.highScore.toLocaleString('en-US')}`, cx, py + 170)
    }

    // スキンプレビュー: パネル左のスペースに選択中スキンを表示。←→ で全スキンを巡回し、
    // 未解放はシルエット + 必要スコアを見せてモチベーションにする(保存は解放済みのみ)
    const sx = px - 115  // パネル左端から 115px 左が中心
    const sy = py + 92
    const unlocked = isUnlocked(this.selected, this.highScore)
    const skinDef = SKINS.find((s) => s.id === this.selected)!
    ctx.save()
    if (!unlocked) ctx.filter = 'brightness(0)'
    this.g.assets.draw(ctx, playerSprite(this.selected, 'rock'), sx, sy, 130)
    ctx.restore()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 15px ${FONT_NUM}`
    ctx.fillStyle = COLORS.labelStrong
    ctx.fillText(`◀  ${skinDef.label}  ▶`, sx, sy + 92)
    if (!unlocked) {
      ctx.fillStyle = COLORS.label
      ctx.fillText(`UNLOCK ${unlockScoreOf(this.selected).toLocaleString('en-US')}`, sx, sy + 116)
    }

    // リトライプロンプト(シェイク終了後のみ点滅表示)
    if (this.shakeSec <= 0 && Math.floor(t * 1.6) % 2 === 0) {
      neonText(ctx, 'PRESS ENTER / SPACE — RETRY', cx, 600, { size: 24, font: FONT_NUM, color: COLORS.cyan })
    }
    ctx.restore()
  }
}
