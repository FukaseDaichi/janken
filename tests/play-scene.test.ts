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

/** Input.confirmEdge の実際の「ラッチしてから consumeConfirm() で1回だけ排水する」
 *  挙動を模した stub。既存の `consumeConfirm: () => false` は常に false を返すだけ
 *  なので、PlayScene/GameOverScene が実際にラッチを消費しているかどうかは
 *  区別できない（呼んでも呼ばなくても false が返る）。ここでは内部状態を持たせ、
 *  peekConfirm() で消費せずに覗けるようにする。 */
function makeLatchInput(initialConfirm = false): Input & { setConfirm(v: boolean): void; peekConfirm(): boolean } {
  let confirmEdge = initialConfirm
  return {
    dx: 0,
    dy: 0,
    consumeConfirm: (): boolean => {
      const v = confirmEdge
      confirmEdge = false
      return v
    },
    setConfirm: (v: boolean): void => {
      confirmEdge = v
    },
    peekConfirm: (): boolean => confirmEdge,
  } as unknown as Input & { setConfirm(v: boolean): void; peekConfirm(): boolean }
}

/** Input/Assets/Sound は private フィールドを持つ具象クラスなので、
 *  構造的に一致するスタブを any-cast で GameContext に差し込む。 */
function makeContext(input?: Input): GameContext {
  const resolvedInput =
    input ??
    ({
      dx: 0,
      dy: 0,
      consumeConfirm: () => false,
    } as unknown as Input)

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

  return { input: resolvedInput, assets, sound, storage }
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

  it('プレイ中に押された confirm エッジは update() 自身が消費し、GameOverScene まで残さない（Finding 1a）', () => {
    // 修正前は PlayScene が consumeConfirm() を一度も呼ばないため、プレイ中に
    // Enter/Space を押すとラッチが死亡まで残り続け、GameOverScene の最初の
    // update() で即座に消費されて GAME OVER 画面が描画されずに次の PlayScene へ
    // 遷移してしまう（このテストは play.ts の update() 内での消費だけを検証する）。
    const input = makeLatchInput(true)
    const scene = new PlayScene(makeContext(input))
    ;(scene as any).hands = []
    ;(scene as any).bullets = []

    const next = scene.update(0)

    expect(next).toBeNull()
    expect(input.peekConfirm()).toBe(false)
  })
})

describe('GameOverScene.update', () => {
  it('シェイクが収まっていない間は confirm があってもリトライしない。ただしラッチは消費して残さない（Finding 1b）', () => {
    const input = makeLatchInput(true)
    const scene = new GameOverScene(makeContext(input), 100, 3, false)

    // shakeSec は 0.4 で始まる。0.1 秒進めてもまだ収まっていない (0.3 > 0)。
    const next = scene.update(0.1)

    expect(next).toBeNull()
    // ブロックされている間もラッチ自体は排水されている（さもないと
    // シェイクが収まった次のフレームでラッチが積み残って即リトライしてしまう）。
    expect(input.peekConfirm()).toBe(false)
  })

  it('シェイクが収まった後に confirm があれば PlayScene に遷移する（Finding 1b）', () => {
    const input = makeLatchInput(false)
    const scene = new GameOverScene(makeContext(input), 100, 3, false)

    // シェイクを完全に収める（confirm なし → 遷移しない）。
    expect(scene.update(0.5)).toBeNull()

    // シェイクが収まった後に confirm を送ると、今度は遷移する。
    input.setConfirm(true)
    const next = scene.update(0)

    expect(next).toBeInstanceOf(PlayScene)
  })
})
