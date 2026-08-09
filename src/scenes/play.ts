import type { Scene, GameContext } from '../game'
import { GameOverScene } from './gameover'
import { FIELD_W, FIELD_H } from '../entities/player'

export class PlayScene implements Scene {
  constructor(private g: GameContext) {}

  update(): Scene | null {
    if (this.g.input.consumeConfirm()) {
      return new GameOverScene(this.g, 0, 1, false)
    }
    return null
  }

  draw(ctx: CanvasRenderingContext2D): void {
    this.g.assets.drawBackground(ctx, FIELD_W, FIELD_H)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.font = '24px sans-serif'
    ctx.fillText('PlayScene（仮）: Enter で GAMEOVER へ', FIELD_W / 2, FIELD_H / 2)
  }
}
