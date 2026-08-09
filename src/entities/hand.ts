import type { Hand } from '../logic/janken'
import type { Assets } from '../assets'
import { FIELD_W, FIELD_H } from './player'

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
    assets.draw(ctx, `enemy-${this.hand}`, this.x, this.y, this.radius * 2.4)
  }
}
