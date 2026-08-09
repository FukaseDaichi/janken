import type { Input } from './input'
import type { Assets } from './assets'
import type { Sound } from './audio'
import type { ScoreStore } from './storage'

export interface GameContext {
  input: Input
  assets: Assets
  sound: Sound
  storage: ScoreStore
}

export interface Scene {
  update(dtSec: number): Scene | null
  draw(ctx: CanvasRenderingContext2D): void
}

export class Game {
  private lastTime = 0

  constructor(
    private ctx: CanvasRenderingContext2D,
    private scene: Scene,
  ) {}

  start(): void {
    const loop = (time: number) => {
      const dtSec = Math.min(1 / 30, (time - this.lastTime) / 1000)
      this.lastTime = time
      const next = this.scene.update(dtSec)
      if (next) this.scene = next
      this.scene.draw(this.ctx)
      requestAnimationFrame(loop)
    }
    requestAnimationFrame((t) => {
      this.lastTime = t
      requestAnimationFrame(loop)
    })
  }
}
