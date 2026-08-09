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
import { StarItem, ITEM_SPAWN_INTERVAL_SEC, ITEM_LIFE_SEC } from '../src/entities/item'
import { initialInvincibleState, activateInvincible, isInvincible, INVINCIBLE_SEC } from '../src/logic/invincible'

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

interface SoundSpy {
  bgmModes: string[]
  powerUpCalls: number
}

/** Input/Assets/Sound は private フィールドを持つ具象クラスなので、
 *  構造的に一致するスタブを any-cast で GameContext に差し込む。
 *  Sound の呼び出し履歴はテストから読めるよう soundSpy に載せて返す。 */
function makeContext(input?: Input): GameContext & { soundSpy: SoundSpy } {
  const resolvedInput =
    input ??
    ({
      dx: 0,
      dy: 0,
      consumeConfirm: () => false,
    } as unknown as Input)

  const assets = {
    draw: () => {},
  } as unknown as Assets

  const soundSpy: SoundSpy = { bgmModes: [], powerUpCalls: 0 }

  const sound = {
    kill: () => {},
    levelUp: () => {},
    gameOver: () => {},
    startBgm: () => {},
    stopBgm: () => {},
    setBgmMode: (mode: string) => { soundSpy.bgmModes.push(mode) },
    powerUp: () => { soundSpy.powerUpCalls++ },
  } as unknown as Sound

  const storage = memoryStore()

  return { input: resolvedInput, assets, sound, storage, soundSpy }
}

/** 弾と手のスポーンを止める。テストが置いたエンティティ以外が湧かないようにして、
 *  長い dtSec を進めるテストが偶発的な衝突で GAME OVER にならないようにする。 */
function freezeHazardSpawns(scene: PlayScene): void {
  ;(scene as any).bulletTimer = Number.MAX_SAFE_INTEGER
  ;(scene as any).handTimer = Number.MAX_SAFE_INTEGER
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

  it('星に触れると無敵になり、無敵BGMへ切り替わって取得音が鳴る', () => {
    const g = makeContext()
    const scene = new PlayScene(g)
    const player = (scene as any).player
    ;(scene as any).hands = []
    ;(scene as any).bullets = []
    ;(scene as any).items = [new StarItem(player.x, player.y)]

    const next = scene.update(0)

    expect(next).toBeNull()
    expect(isInvincible((scene as any).inv)).toBe(true)
    expect(g.soundSpy.bgmModes).toEqual(['invincible'])
    expect(g.soundSpy.powerUpCalls).toBe(1)
  })

  it('無敵中は弾に当たっても死なず、当たった弾が消える', () => {
    const scene = new PlayScene(makeContext())
    const player = (scene as any).player
    ;(scene as any).inv = activateInvincible(initialInvincibleState()).state
    const bullet = spawnBullet('straight', player.x, player.y, 0, 0)
    ;(scene as any).bullets = [bullet]
    ;(scene as any).hands = []
    ;(scene as any).items = []

    const next = scene.update(0)

    expect(next).toBeNull()
    expect(bullet.alive).toBe(false)
    // 仕様 §1「無敵中に消した弾ではスコアは入らない」。dtSec=0 なので timeScore も 0。
    expect((scene as any).score).toBe(0)
  })

  it('無敵中は負ける手も撃破でき、killBonus と勝利カウントが入る', () => {
    const scene = new PlayScene(makeContext())
    const player = (scene as any).player
    player.hand = 'rock'
    ;(scene as any).inv = activateInvincible(initialInvincibleState()).state
    // rock に勝つ手 = paper。通常なら GAME OVER になる組み合わせ。
    const enemy = new JankenHand(player.x, player.y, 0, 0, 'paper')
    ;(scene as any).hands = [enemy]
    ;(scene as any).bullets = []
    ;(scene as any).items = []

    const next = scene.update(0)

    expect(next).toBeNull()
    expect(enemy.alive).toBe(false)
    expect((scene as any).levelState.wins).toBe(1)
    expect((scene as any).score).toBe(killBonus(1))
  })

  // 逆順だと「取ったのに死んだ」が起きる。処理順の回帰テスト。
  it('星と弾に同時に触れたフレームは、取得が先に処理されるので死なない', () => {
    const scene = new PlayScene(makeContext())
    const player = (scene as any).player
    const bullet = spawnBullet('straight', player.x, player.y, 0, 0)
    ;(scene as any).bullets = [bullet]
    ;(scene as any).hands = []
    ;(scene as any).items = [new StarItem(player.x, player.y)]

    const next = scene.update(0)

    expect(next).toBeNull()
    expect(bullet.alive).toBe(false)
  })

  it('無敵が切れたフレームで通常BGMへ戻す呼び出しがちょうど1回だけ起きる', () => {
    const g = makeContext()
    const scene = new PlayScene(g)
    freezeHazardSpawns(scene)
    ;(scene as any).itemTimer = Number.MAX_SAFE_INTEGER
    ;(scene as any).hands = []
    ;(scene as any).bullets = []
    ;(scene as any).items = []
    ;(scene as any).inv = activateInvincible(initialInvincibleState()).state

    // 無敵が切れるまで進め、そのあとも余分に回す
    for (let i = 0; i < Math.ceil(INVINCIBLE_SEC * 60) + 60; i++) {
      expect(scene.update(1 / 60)).toBeNull()
    }

    expect(g.soundSpy.bgmModes).toEqual(['normal'])
  })

  it('無敵中に LVUP しても無敵は継続する', () => {
    const scene = new PlayScene(makeContext())
    const player = (scene as any).player
    player.hand = 'rock'
    freezeHazardSpawns(scene)
    ;(scene as any).itemTimer = Number.MAX_SAFE_INTEGER
    ;(scene as any).inv = activateInvincible(initialInvincibleState()).state
    ;(scene as any).bullets = []
    ;(scene as any).items = []

    // rock に勝つ手(paper)を3体ぶつける。通常なら1体目で GAME OVER になる。
    for (let i = 0; i < 3; i++) {
      ;(scene as any).hands = [new JankenHand(player.x, player.y, 0, 0, 'paper')]
      expect(scene.update(0)).toBeNull()
    }

    expect((scene as any).levelState.level).toBe(2)
    expect(isInvincible((scene as any).inv)).toBe(true)
  })

  it('場に星がある間は次の星が湧かず、消えてから ITEM_SPAWN_INTERVAL_SEC 後に湧く', () => {
    const scene = new PlayScene(makeContext())
    freezeHazardSpawns(scene)
    ;(scene as any).hands = []
    ;(scene as any).bullets = []
    // 自機(中央)から離れた位置に置き、取得されないようにする
    ;(scene as any).items = [new StarItem(50, 50)]
    ;(scene as any).itemTimer = 0.0001

    scene.update(0.5)
    expect((scene as any).items.length).toBe(1)
    // 場に星がある間はタイマーが間隔いっぱいに戻される
    expect((scene as any).itemTimer).toBe(ITEM_SPAWN_INTERVAL_SEC)

    // 星を寿命切れにすると update 内の filter で除去される
    ;(scene as any).items[0].update(ITEM_LIFE_SEC)
    scene.update(0)
    expect((scene as any).items.length).toBe(0)

    scene.update(ITEM_SPAWN_INTERVAL_SEC - 0.1)
    expect((scene as any).items.length).toBe(0)
    scene.update(0.2)
    expect((scene as any).items.length).toBe(1)
  })

  it('星が湧いたフレームのうちに itemTimer が ITEM_SPAWN_INTERVAL_SEC に戻る', () => {
    // 修正前は items.push() の後に itemTimer をリセットしておらず、次フレームの
    // `items.length > 0` 分岐に入るまで負のまま残っていた。同じフレームで湧いた星が
    // 即座に取得されると、次フレームでも itemTimer <= 0 のままとなり二重にスポーン
    // しうる。湧かせたその場でリセットすることの回帰テスト。
    const scene = new PlayScene(makeContext())
    freezeHazardSpawns(scene)
    ;(scene as any).hands = []
    ;(scene as any).bullets = []
    ;(scene as any).items = []
    ;(scene as any).itemTimer = 0.0001

    scene.update(0.5)

    expect((scene as any).items.length).toBe(1)
    expect((scene as any).itemTimer).toBe(ITEM_SPAWN_INTERVAL_SEC)
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
