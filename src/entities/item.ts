import { FIELD_W, FIELD_H } from './player'
import { STAR_COLORS } from '../render/theme'

export const ITEM_RADIUS = 20
/** 取られなかった星が消えるまでの時間(秒)。 */
export const ITEM_LIFE_SEC = 8
/** 星が場から消えてから次が湧くまでの時間(秒)。 */
export const ITEM_SPAWN_INTERVAL_SEC = 22
/** プレイ開始から最初の星が湧くまでの時間(秒)。開幕直後には出さない。 */
export const ITEM_FIRST_SPAWN_SEC = 15
/** フィールド外周のこの幅にはスポーンさせない(端に張り付くと取りに行きにくい)。 */
export const ITEM_SPAWN_MARGIN = 80
/** 自機の真上に湧いて自動取得されるのを防ぐための最低距離。 */
export const ITEM_MIN_DIST_FROM_PLAYER = 220

const SPAWN_RETRY = 10
/** 消滅までこの秒数を切ったら点滅して予告する。 */
const BLINK_SEC = 2

export class StarItem {
  alive = true
  readonly radius = ITEM_RADIUS
  private ageSec = 0

  constructor(
    public x: number,
    public y: number,
  ) {}

  update(dtSec: number): void {
    this.ageSec += dtSec
  }

  isExpired(): boolean {
    return this.ageSec >= ITEM_LIFE_SEC
  }

  draw(ctx: CanvasRenderingContext2D, timeSec: number): void {
    const remainingSec = Math.max(0, ITEM_LIFE_SEC - this.ageSec)
    // 消滅間際は点滅させて「もうすぐ消える」と伝える
    if (remainingSec < BLINK_SEC && Math.floor(remainingSec * 8) % 2 === 1) return

    const r = this.radius * (1 + 0.08 * Math.sin(timeSec * 4))
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'

    // 外周グロー
    const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 2.2)
    glow.addColorStop(0, `${STAR_COLORS.glow}55`)
    glow.addColorStop(1, `${STAR_COLORS.glow}00`)
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(this.x, this.y, r * 2.2, 0, Math.PI * 2)
    ctx.fill()

    // 5稜星の本体。外側と内側の頂点を交互に結ぶ(-PI/2 始点で上向きになる)。
    ctx.translate(this.x, this.y)
    ctx.rotate(timeSec * 1.2)
    const body = ctx.createLinearGradient(0, -r, 0, r)
    body.addColorStop(0, STAR_COLORS.core)
    body.addColorStop(1, STAR_COLORS.base)
    ctx.fillStyle = body
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45
      const ang = -Math.PI / 2 + (Math.PI * i) / 5
      const px = Math.cos(ang) * rad
      const py = Math.sin(ang) * rad
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }
}

/** 星のスポーン位置を選ぶ。外周マージンの内側には必ず収め、自機からは
 *  ITEM_MIN_DIST_FROM_PLAYER 以上離す。離せる候補が見つからない場合
 *  (自機が中央にいるなど)は距離条件だけを諦め、マージン条件は必ず守る。 */
export function pickItemSpawnPos(
  px: number,
  py: number,
  rand: () => number,
): { x: number; y: number } {
  const minX = ITEM_SPAWN_MARGIN
  const maxX = FIELD_W - ITEM_SPAWN_MARGIN
  const minY = ITEM_SPAWN_MARGIN
  const maxY = FIELD_H - ITEM_SPAWN_MARGIN

  let x = minX
  let y = minY
  for (let i = 0; i < SPAWN_RETRY; i++) {
    x = minX + rand() * (maxX - minX)
    y = minY + rand() * (maxY - minY)
    if (Math.hypot(x - px, y - py) >= ITEM_MIN_DIST_FROM_PLAYER) break
  }
  return { x, y }
}
