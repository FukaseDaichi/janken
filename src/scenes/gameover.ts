import type { Scene, GameContext } from '../game'
import { loadHighScore } from '../storage'
import { PlayScene } from './play'
import { FIELD_W, FIELD_H } from '../entities/player'

export class GameOverScene implements Scene {
  private shakeSec = 0.4

  constructor(
    private g: GameContext,
    private score: number,
    private level: number,
    private isNewRecord: boolean,
  ) {}

  update(dtSec: number): Scene | null {
    this.shakeSec = Math.max(0, this.shakeSec - dtSec)
    // シェイクが収まるまではリトライを受け付けない。ただし consumeConfirm() は
    // 必ず呼んでラッチを毎フレーム排水する — ここで呼ばずに早期 return すると、
    // 死亡直前に押されていた（あるいはシェイク中に押された）confirmEdge が
    // 消費されずに残り、シェイク終了直後の1フレームで即リトライしてしまう。
    const confirmed = this.g.input.consumeConfirm()
    if (this.shakeSec > 0) return null
    if (confirmed) {
      this.g.sound.startBgm()
      return new PlayScene(this.g)
    }
    return null
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    if (this.shakeSec > 0) {
      ctx.translate((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14)
    }
    this.g.assets.drawBackground(ctx, FIELD_W, FIELD_H)
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, 0, FIELD_W, FIELD_H)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#e74c3c'
    ctx.font = 'bold 64px sans-serif'
    ctx.fillText('GAME OVER', FIELD_W / 2, 220)
    ctx.fillStyle = '#fff'
    ctx.font = '30px sans-serif'
    ctx.fillText(`スコア: ${Math.floor(this.score)}`, FIELD_W / 2, 320)
    ctx.fillText(`到達レベル: ${this.level}`, FIELD_W / 2, 370)
    if (this.isNewRecord) {
      ctx.fillStyle = '#f1c40f'
      ctx.font = 'bold 32px sans-serif'
      ctx.fillText('★ ハイスコア更新！ ★', FIELD_W / 2, 440)
    } else {
      ctx.font = '22px sans-serif'
      ctx.fillText(`ハイスコア: ${loadHighScore(this.g.storage)}`, FIELD_W / 2, 440)
    }
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 26px sans-serif'
    ctx.fillText('Enter / Space でリトライ', FIELD_W / 2, 560)
    ctx.restore()
  }
}
