import type { Hand } from '../logic/janken'
import type { Input } from '../input'
import type { Assets } from '../assets'

export const FIELD_W = 960
export const FIELD_H = 720
const SPEED = 320

export class Player {
  x = FIELD_W / 2
  y = FIELD_H / 2
  readonly radius = 24

  constructor(public hand: Hand) {}

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
    assets.draw(ctx, `player-${this.hand}`, this.x, this.y, this.radius * 2.4)
  }
}
