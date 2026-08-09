import { describe, it, expect } from 'vitest'
import type { GameContext } from '../src/game'
import type { Input } from '../src/input'
import type { Assets } from '../src/assets'
import type { Sound } from '../src/audio'
import type { ScoreStore } from '../src/storage'
import { PlayScene } from '../src/scenes/play'
import { GameOverScene } from '../src/scenes/gameover'
import { JankenHand } from '../src/entities/hand'
import { spawnBullet } from '../src/entities/bullet'
import { beats } from '../src/logic/janken'
import { killBonus, timeScore } from '../src/logic/score'

// tests/storage.test.ts と同じ形の in-memory ScoreStore
function memoryStore(initial: Record<string, string> = {}): ScoreStore & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v },
  }
}

/** Input/Assets/Sound は private フィールドを持つ具象クラスなので、
 *  構造的に一致するスタブを any-cast で GameContext に差し込む。 */
function makeContext(): GameContext {
  const input = {
    dx: 0,
    dy: 0,
    consumeConfirm: () => false,
  } as unknown as Input

  const assets = {
    draw: () => {},
    drawBackground: () => {},
  } as unknown as Assets

  const sound = {
    kill: () => {},
    levelUp: () => {},
    gameOver: () => {},
    startBgm: () => {},
    stopBgm: () => {},
  } as unknown as Sound

  const storage = memoryStore()

  return { input, assets, sound, storage }
}

describe('PlayScene.update', () => {
  it('勝てる手に触れると、その手が死に、killBonus分スコアが増え、勝利カウンタが増え、シーンは遷移しない', () => {
    const scene = new PlayScene(makeContext())
    const player = (scene as any).player
    player.hand = 'rock'

    // rock が倒せる手 = beats('rock') = 'scissors'
    const enemy = new JankenHand(player.x, player.y, 0, 0, 'scissors')
    ;(scene as any).hands = [enemy]
    ;(scene as any).bullets = []

    const next = scene.update(0)

    expect(next).toBeNull()
    expect(enemy.alive).toBe(false)
    expect((scene as any).levelState.wins).toBe(1)
    expect((scene as any).levelState.level).toBe(1)
    // dtSec=0 なので timeScore は 0、増分は killBonus(level=1) のみ
    expect((scene as any).score).toBe(killBonus(1))
  })

  it('あいこの手に触れると GameOverScene に遷移する', () => {
    const scene = new PlayScene(makeContext())
    const player = (scene as any).player
    player.hand = 'rock'

    const enemy = new JankenHand(player.x, player.y, 0, 0, 'rock')
    ;(scene as any).hands = [enemy]
    ;(scene as any).bullets = []

    const next = scene.update(0)

    expect(next).toBeInstanceOf(GameOverScene)
  })

  it('負ける手に触れると GameOverScene に遷移する', () => {
    const scene = new PlayScene(makeContext())
    const player = (scene as any).player
    player.hand = 'rock'

    // rock に勝つ手 = 'paper'
    const enemy = new JankenHand(player.x, player.y, 0, 0, 'paper')
    ;(scene as any).hands = [enemy]
    ;(scene as any).bullets = []

    const next = scene.update(0)

    expect(next).toBeInstanceOf(GameOverScene)
  })

  it('弾に触れると GameOverScene に遷移する', () => {
    const scene = new PlayScene(makeContext())
    const player = (scene as any).player

    const bullet = spawnBullet('straight', player.x, player.y, 0, 0)
    ;(scene as any).bullets = [bullet]
    ;(scene as any).hands = []

    const next = scene.update(0)

    expect(next).toBeInstanceOf(GameOverScene)
  })

  it('3連勝すると LV2 になり、勝利カウンタが 0 にリセットされ、手が別の手に変わる', () => {
    const scene = new PlayScene(makeContext())
    const player = (scene as any).player
    player.hand = 'rock'
    const originalHand = player.hand

    for (let i = 0; i < 3; i++) {
      const enemy = new JankenHand(player.x, player.y, 0, 0, beats(player.hand))
      ;(scene as any).hands = [enemy]
      ;(scene as any).bullets = []
      const next = scene.update(0)
      expect(next).toBeNull()
    }

    expect((scene as any).levelState.level).toBe(2)
    expect((scene as any).levelState.wins).toBe(0)
    expect(player.hand).not.toBe(originalHand)
  })

  it('スコアは時間経過で増え、レベルが高いほど速く増える', () => {
    const dt = 0.5

    const sceneLv1 = new PlayScene(makeContext())
    ;(sceneLv1 as any).hands = []
    ;(sceneLv1 as any).bullets = []
    sceneLv1.update(dt)
    const scoreLv1 = (sceneLv1 as any).score as number

    const sceneLv2 = new PlayScene(makeContext())
    ;(sceneLv2 as any).levelState = { level: 2, wins: 0 }
    ;(sceneLv2 as any).hands = []
    ;(sceneLv2 as any).bullets = []
    sceneLv2.update(dt)
    const scoreLv2 = (sceneLv2 as any).score as number

    expect(scoreLv1).toBeCloseTo(timeScore(dt, 1))
    expect(scoreLv2).toBeCloseTo(timeScore(dt, 2))
    expect(scoreLv2).toBeGreaterThan(scoreLv1)
  })
})
