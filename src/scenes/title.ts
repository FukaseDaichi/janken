import type { Scene, GameContext } from '../game'
import { loadHighScore } from '../storage'
import { PlayScene } from './play'
import { FIELD_W, FIELD_H } from '../entities/player'
import { drawNeonBackground } from '../render/background'

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
    ctx.save()
    drawNeonBackground(ctx, FIELD_W, FIELD_H, 0)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, FIELD_W, FIELD_H)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.font = 'bold 56px sans-serif'
    ctx.fillText('じゃんけん弾除け', FIELD_W / 2, 160)
    ctx.font = '22px sans-serif'
    const lines = [
      '矢印キー / WASD で移動して弾を避けろ！',
      '',
      'じゃんけんの手も襲ってくる：',
      '勝てる手に触れると倒せる（3回勝つと LVUP・スコア倍率UP）',
      'あいこ・負けの手、弾に触れると GAME OVER',
      '',
      'LVUP すると自分の手はランダムで変化する',
    ]
    lines.forEach((l, i) => ctx.fillText(l, FIELD_W / 2, 260 + i * 34))
    ctx.font = 'bold 28px sans-serif'
    ctx.fillText('Enter / Space でスタート', FIELD_W / 2, 560)
    ctx.font = '20px sans-serif'
    ctx.fillText(`ハイスコア: ${loadHighScore(this.g.storage)}`, FIELD_W / 2, 630)
    ctx.restore()
  }
}
