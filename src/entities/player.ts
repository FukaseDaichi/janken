import type { Hand } from '../logic/janken'
import type { Input } from '../input'
import { playerSprite, type Assets } from '../assets'
import type { SkinId } from '../logic/skins'
import { HAND_COLORS } from '../render/theme'

export const FIELD_W = 960
export const FIELD_H = 720
const SPEED = 320

export class Player {
  x = FIELD_W / 2
  y = FIELD_H / 2
  readonly radius = 24

  constructor(public hand: Hand, public skin: SkinId = 'default') {}

  update(input: Input, dtSec: number): void {
    let dx = input.dx
    let dy = input.dy
    const len = Math.hypot(dx, dy)
    if (len > 0) {
      dx /= len
      dy /= len
    }
    this.x = Math.min(FIELD_W - this.radius, Math.max(this.radius, this.x + dx * SPEED * dtSec))
    this.y = Math.min(FIELD_H - this.radius, Math.max(this.radius, this.y + dy * SPEED * dtSec))
  }

  draw(ctx: CanvasRenderingContext2D, assets: Assets): void {
    const glow = HAND_COLORS[this.hand].glow
    const r = this.radius * 1.8
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r)
    g.addColorStop(0, `${glow}55`)
    g.addColorStop(1, `${glow}00`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    assets.draw(ctx, playerSprite(this.skin, this.hand), this.x, this.y, this.radius * 2.4)
  }
}
