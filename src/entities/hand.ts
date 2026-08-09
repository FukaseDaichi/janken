import type { Hand } from '../logic/janken'
import type { Assets } from '../assets'
import { FIELD_W, FIELD_H } from './player'
import { HAND_COLORS } from '../render/theme'

const MARGIN = 80

export class JankenHand {
  alive = true
  readonly radius = 28

  constructor(
    public x: number,
    public y: number,
    private vx: number,
    private vy: number,
    public hand: Hand,
  ) {}

  update(dtSec: number): void {
    this.x += this.vx * dtSec
    this.y += this.vy * dtSec
  }

  isOffscreen(): boolean {
    return this.x < -MARGIN || this.x > FIELD_W + MARGIN || this.y < -MARGIN || this.y > FIELD_H + MARGIN
  }

  draw(ctx: CanvasRenderingContext2D, assets: Assets): void {
    const glow = HAND_COLORS[this.hand].base
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
    assets.draw(ctx, `enemy-${this.hand}`, this.x, this.y, this.radius * 2.4)
  }
}
