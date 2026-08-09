import type { BulletType } from '../logic/difficulty'
import { FIELD_W, FIELD_H } from './player'

const MARGIN = 60
/** curve 弾は速度を一定回転させ続けるため、フィールド内に収まる半径の円軌道に
 *  乗ると isOffscreen() が一度も true にならず無限に生き続ける場合がある。
 *  年齢が一定を超えたら軌道に関わらず強制的に消す。 */
const MAX_AGE_SEC = 12

export class Bullet {
  alive = true
  readonly radius = 10
  private ageSec = 0

  constructor(
    public x: number,
    public y: number,
    private vx: number,
    private vy: number,
    private type: BulletType,
  ) {}

  update(dtSec: number, player: { x: number; y: number }): void {
    this.ageSec += dtSec
    if (this.type === 'aimed' && this.ageSec < 0.6) {
      // 発射直後だけ緩く追尾し、その後は直進
      const speed = Math.hypot(this.vx, this.vy)
      const ang = Math.atan2(player.y - this.y, player.x - this.x)
      const cur = Math.atan2(this.vy, this.vx)
      const turn = 2.5 * dtSec
      const diff = Math.atan2(Math.sin(ang - cur), Math.cos(ang - cur))
      const next = cur + Math.max(-turn, Math.min(turn, diff))
      this.vx = Math.cos(next) * speed
      this.vy = Math.sin(next) * speed
    } else if (this.type === 'curve') {
      const ang = 1.8 * dtSec
      const { vx, vy } = this
      this.vx = vx * Math.cos(ang) - vy * Math.sin(ang)
      this.vy = vx * Math.sin(ang) + vy * Math.cos(ang)
    }
    this.x += this.vx * dtSec
    this.y += this.vy * dtSec
  }

  private isOffscreen(): boolean {
    return this.x < -MARGIN || this.x > FIELD_W + MARGIN || this.y < -MARGIN || this.y > FIELD_H + MARGIN
  }

  private isExpired(): boolean {
    return this.ageSec >= MAX_AGE_SEC
  }

  /** 画面外に出た、または一定時間経過した弾はカリング対象。
   *  curve 弾がフィールド内に収まる円軌道に乗って無限に生き続けるのを防ぐため、
   *  isOffscreen だけでなく年齢もカリング条件に含める。 */
  shouldDespawn(): boolean {
    return this.isOffscreen() || this.isExpired()
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const ang = Math.atan2(this.vy, this.vx)
    const r = this.radius
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    // 残光ストリーク(進行方向の逆へ伸びる)
    const tail = ctx.createLinearGradient(
      this.x, this.y,
      this.x - Math.cos(ang) * r * 5, this.y - Math.sin(ang) * r * 5,
    )
    tail.addColorStop(0, 'rgba(190, 120, 255, 0.55)')
    tail.addColorStop(1, 'rgba(190, 120, 255, 0)')
    ctx.strokeStyle = tail
    ctx.lineWidth = r * 1.2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(this.x, this.y)
    ctx.lineTo(this.x - Math.cos(ang) * r * 5, this.y - Math.sin(ang) * r * 5)
    ctx.stroke()
    // 本体グロー
    const orb = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 1.6)
    orb.addColorStop(0, '#ffffff')
    orb.addColorStop(0.35, '#e0b3ff')
    orb.addColorStop(1, 'rgba(160, 60, 255, 0)')
    ctx.fillStyle = orb
    ctx.beginPath()
    ctx.arc(this.x, this.y, r * 1.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

export function spawnBullet(type: BulletType, x: number, y: number, angle: number, speed: number): Bullet {
  return new Bullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, type)
}
