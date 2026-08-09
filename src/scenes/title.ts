import type { Scene, GameContext } from '../game'
import { loadHighScore } from '../storage'
import { PlayScene } from './play'
import { drawNeonBackground } from '../render/background'
import { outlinedText, neonText, fillTracked } from '../render/text'
import { CANVAS_W, CANVAS_H, COLORS, FONT_DISPLAY, FONT_NUM, FONT_BODY } from '../render/theme'

/* タイトル画面の構図は「アーケード筐体」を模す:
 *   マーキー(発光する看板 = ヒーロー画像) → その光が落ちる床 → インストカード。
 * 画面の主役はヒーロー画像 1 枚だけで、それ以外の要素は色数・動きともに抑える。 */

/** hero-title.webp の実寸 1200x809 のアスペクト比 */
const HERO_ASPECT = 1200 / 809
const HERO_W = 784
const HERO_H = Math.round(HERO_W / HERO_ASPECT)
const HERO_X = Math.round((CANVAS_W - HERO_W) / 2)
const HERO_Y = 2
/** 看板の下端 = 床の地平線。背景の遠近グリッドをここに合わせて「看板の下に床がある」構図にする */
const FLOOR_Y = HERO_Y + HERO_H

const PROMPT_Y = 578
const SCORE_Y = 622
/** インストカード: 上端の細線 → ラベル → 本文 1 行 */
const BAND_RAIL_Y = 648
const BAND_LABEL_Y = 670
const BAND_TEXT_Y = 697
const BAND_X0 = 56
const BAND_X1 = CANVAS_W - 56

/** 起動時のマーキー点灯(蛍光管がストライクする瞬間)。[経過秒, 明るさ] の区分定数 */
const POWER_ON: ReadonlyArray<readonly [number, number]> = [
  [0.00, 0.00], [0.08, 0.70], [0.14, 0.06], [0.22, 0.95],
  [0.30, 0.20], [0.38, 0.85], [0.46, 0.45], [0.60, 1.00],
]
/** 点灯が落ち着いてから UI をフェードインさせる */
const UI_DELAY = 0.55
const UI_FADE = 0.4

/** インストカード 1 列。label は筐体の刻印ラベル、text は日本語のルール本文。
 *  「弾」と「あいこ・負けの手」は結果が同じ(即 GAME OVER)なので DANGER 列にまとめ、
 *  4 列すべてを 1 行に揃えている。 */
interface RuleColumn {
  label: string
  accent: string
  text: string
}

const RULES: RuleColumn[] = [
  { label: 'MOVE', accent: COLORS.labelStrong, text: '矢印キー ・ WASD' },
  { label: 'DANGER', accent: COLORS.red, text: '弾・あいこ・負けの手は即死' },
  { label: 'BREAK', accent: COLORS.cyan, text: '勝てる手だけ体当たりで撃破' },
  { label: 'LEVEL UP', accent: COLORS.yellow, text: '3勝で形態が変わり倍率アップ' },
]

export class TitleScene implements Scene {
  private timeSec = 0

  constructor(private g: GameContext) {}

  update(dtSec: number): Scene | null {
    this.timeSec += dtSec
    if (this.g.input.consumeConfirm()) {
      this.g.sound.startBgm()
      return new PlayScene(this.g)
    }
    return null
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const t = this.timeSec
    const lit = powerOnLevel(t)
    const ui = clamp01((t - UI_DELAY) / UI_FADE)
    const cx = CANVAS_W / 2
    const hero = this.g.assets.get('hero-title')

    ctx.save()
    drawNeonBackground(ctx, CANVAS_W, CANVAS_H, t, {
      perspective: true,
      horizonRatio: FLOOR_Y / CANVAS_H,
    })

    // マーキーの光が背後の壁と足元の床に落ちる — この画面のシグネチャ
    drawMarqueeSpill(ctx, t, lit)
    drawFloorPool(ctx, lit)

    if (hero) {
      // ヒーロー画像は黒背景の発光ロゴなので screen 合成で背景に溶け込ませる
      // (黒 = 変化なし、発光部だけが加算される)。矩形の継ぎ目は出ない。
      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      ctx.globalAlpha = lit
      ctx.drawImage(hero, HERO_X, HERO_Y, HERO_W, HERO_H)
      ctx.restore()
    } else {
      drawFallbackLogo(ctx, cx, lit)
    }

    // 床の手前を落として、インストカードを筐体のコンパネ面のように沈める
    const shelf = ctx.createLinearGradient(0, 630, 0, 700)
    shelf.addColorStop(0, 'rgba(5, 3, 14, 0)')
    shelf.addColorStop(1, 'rgba(5, 3, 14, 0.85)')
    ctx.fillStyle = shelf
    ctx.fillRect(0, 630, CANVAS_W, CANVAS_H - 630)

    ctx.globalAlpha = ui
    drawStartPrompt(ctx, cx, t)
    drawHighScore(ctx, cx, loadHighScore(this.g.storage))
    drawRuleBand(ctx)
    ctx.globalAlpha = 1

    ctx.restore()
  }
}

/** 経過秒 → マーキーの明るさ。区分定数なので蛍光管のちらつきとして読める */
function powerOnLevel(elapsed: number): number {
  const last = POWER_ON[POWER_ON.length - 1]
  if (elapsed >= last[0]) return last[1]
  let level = 0
  for (const [at, value] of POWER_ON) {
    if (elapsed < at) break
    level = value
  }
  return level
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** 看板から漏れる光。横長の楕円ひとつだけに絞り、蛍光管のゆらぎをごく浅く乗せる */
function drawMarqueeSpill(ctx: CanvasRenderingContext2D, t: number, lit: number): void {
  if (lit <= 0) return
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = lit * (0.94 + 0.06 * Math.sin(t * 2.1))
  ctx.translate(CANVAS_W / 2, HERO_Y + HERO_H * 0.46)
  ctx.scale(1, 0.62)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 640)
  g.addColorStop(0, 'rgba(150, 60, 220, 0.5)')
  g.addColorStop(0.45, 'rgba(120, 40, 190, 0.22)')
  g.addColorStop(1, 'rgba(60, 20, 120, 0)')
  ctx.fillStyle = g
  ctx.fillRect(-CANVAS_W, -CANVAS_H, CANVAS_W * 2, CANVAS_H * 2)
  ctx.restore()
}

/** 看板の真下、床に落ちる光だまり。ロゴの鏡像を焼いてみると床が汚れて見えたので、
 *  形を持たない光として置き、グリッドの奥行きだけを照らす。 */
function drawFloorPool(ctx: CanvasRenderingContext2D, lit: number): void {
  if (lit <= 0) return
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = lit
  ctx.translate(CANVAS_W / 2, FLOOR_Y)
  ctx.scale(1, 0.34)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, HERO_W * 0.62)
  g.addColorStop(0, 'rgba(190, 110, 255, 0.4)')
  g.addColorStop(0.5, 'rgba(120, 60, 220, 0.15)')
  g.addColorStop(1, 'rgba(80, 30, 160, 0)')
  ctx.fillStyle = g
  ctx.fillRect(-CANVAS_W, -CANVAS_H, CANVAS_W * 2, CANVAS_H * 2)
  ctx.restore()
}

/** ヒーロー画像が読み込めなかったときの文字ロゴ。看板と同じ枠内に収める */
function drawFallbackLogo(ctx: CanvasRenderingContext2D, cx: number, lit: number): void {
  ctx.save()
  ctx.globalAlpha = lit
  outlinedText(ctx, 'じゃんけん', cx, HERO_Y + HERO_H * 0.34, {
    size: 84, font: FONT_DISPLAY, fill: COLORS.white,
    outline: '#000', outlineWidth: 16, shadowColor: 'rgba(0,0,0,0.7)', shadowOffset: 7,
  })
  const grad = ctx.createLinearGradient(0, HERO_Y + HERO_H * 0.42, 0, HERO_Y + HERO_H * 0.66)
  grad.addColorStop(0, '#ffe45e')
  grad.addColorStop(1, '#ff9d2e')
  outlinedText(ctx, 'サバイバー', cx, HERO_Y + HERO_H * 0.56, {
    size: 92, font: FONT_DISPLAY, fill: grad,
    outline: '#000', outlineWidth: 18, shadowColor: 'rgba(0,0,0,0.7)', shadowOffset: 8,
  })
  outlinedText(ctx, '― 勝てる手で、弾をかいくぐれ！ ―', cx, HERO_Y + HERO_H * 0.84, {
    size: 24, font: FONT_DISPLAY, fill: COLORS.white, outline: '#000', outlineWidth: 6,
  })
  ctx.restore()
}

function drawStartPrompt(ctx: CanvasRenderingContext2D, cx: number, t: number): void {
  if (Math.floor(t * 1.6) % 2 !== 0) return
  neonText(ctx, 'PRESS ENTER / SPACE', cx, PROMPT_Y, {
    size: 26, font: FONT_NUM, color: COLORS.cyan, tracking: 5,
  })
}

/** ラベルは沈め、数値だけを金色で立てる */
function drawHighScore(ctx: CanvasRenderingContext2D, cx: number, score: number): void {
  const label = 'HIGH SCORE'
  const value = score.toLocaleString('en-US')
  const gap = 16
  ctx.save()
  ctx.textBaseline = 'middle'
  ctx.font = `700 13px ${FONT_NUM}`
  const labelW = ctx.measureText(label).width + 2 * (label.length - 1)
  ctx.font = `900 19px ${FONT_NUM}`
  const valueW = ctx.measureText(value).width
  let x = cx - (labelW + gap + valueW) / 2

  ctx.font = `700 13px ${FONT_NUM}`
  ctx.fillStyle = COLORS.label
  fillTracked(ctx, label, x, SCORE_Y, 'left', 2)
  x += labelW + gap
  ctx.font = `900 19px ${FONT_NUM}`
  ctx.fillStyle = COLORS.yellow
  ctx.textAlign = 'left'
  ctx.fillText(value, x, SCORE_Y)
  ctx.restore()
}

/** インストカード(筐体のコンパネに貼られた説明書き)。4 列 + 列間の細線 */
function drawRuleBand(ctx: CanvasRenderingContext2D): void {
  const colW = (BAND_X1 - BAND_X0) / RULES.length
  ctx.save()
  ctx.textBaseline = 'middle'

  // 上端のレール。両端を透明に落として、箱ではなく一本の線として置く
  const rail = ctx.createLinearGradient(BAND_X0, 0, BAND_X1, 0)
  rail.addColorStop(0, 'rgba(90, 63, 208, 0)')
  rail.addColorStop(0.5, 'rgba(120, 90, 240, 0.75)')
  rail.addColorStop(1, 'rgba(90, 63, 208, 0)')
  ctx.fillStyle = rail
  ctx.fillRect(BAND_X0, BAND_RAIL_Y, BAND_X1 - BAND_X0, 1)

  RULES.forEach((col, i) => {
    const cx = BAND_X0 + colW * (i + 0.5)

    if (i > 0) {
      ctx.fillStyle = 'rgba(120, 90, 240, 0.28)'
      ctx.fillRect(BAND_X0 + colW * i, BAND_LABEL_Y - 9, 1, 46)
    }

    ctx.font = `700 11px ${FONT_NUM}`
    ctx.fillStyle = col.accent
    fillTracked(ctx, col.label, cx, BAND_LABEL_Y, 'center', 3)

    setFittedFont(ctx, col.text, colW - 28, 16, FONT_BODY)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    ctx.textAlign = 'center'
    ctx.fillText(col.text, cx, BAND_TEXT_Y)
  })
  ctx.restore()
}

/** 和文の字幅は環境にインストールされたフォントで変わるため、maxW に収まるまで
 *  1px ずつ縮めた指定を ctx.font に設定する。 */
function setFittedFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  size: number,
  family: string,
  weight = 600,
  min = 11,
): void {
  for (let s = size; s >= min; s--) {
    ctx.font = `${weight} ${s}px ${family}`
    if (s === min || ctx.measureText(text).width <= maxW) return
  }
}
