# 無敵アイテム(星) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プレイフィールドに一定間隔で星アイテムを出現させ、取得すると 8 秒間 BGM が切り替わって無敵になる機能を実装する。

**Architecture:** 無敵の残時間と開始/終了エッジは `src/logic/invincible.ts` の純粋関数に閉じ込め、星は `src/entities/item.ts` に既存の `Bullet` / `JankenHand` と同形のエンティティとして足す。`PlayScene` は両者を組み合わせるだけにする。BGM は `src/audio.ts` の音列をトラックテーブル化してモードで切り替える。

**Tech Stack:** TypeScript + Vite + Canvas 2D + WebAudio。テストは vitest(環境は node、DOM/WebAudio はテスト側でスタブする)。

**設計元:** `docs/superpowers/specs/2026-08-10-invincible-star-item-design.md`

## Global Constraints

- 色・サイズ定数は `src/render/theme.ts` に一本化する(DESIGN.md §1)。シーンやエンティティにハードコードしない
- 発光は `globalCompositeOperation = 'lighter'` を使い、必ず `ctx.save()` / `ctx.restore()` で閉じる(DESIGN.md §6)
- 描画関数は状態を持たず `(ctx, ...data)` を受ける。アニメ位相は時間引数で渡す(DESIGN.md §9)
- 演出は 1 秒以内に収める(DESIGN.md §7)
- `tsconfig.json` は `strict: true` かつ `noUnusedLocals: true`。`include` は `["src", "tests"]` なので**テストコードも型チェックの対象**。未使用の import / ローカル変数があると `npm run build` が落ちる
- 各タスク完了時に `npm test` と `npm run build` の両方が通ること
- 数値定数(実測値): `INVINCIBLE_SEC = 8` / `ITEM_LIFE_SEC = 8` / `ITEM_SPAWN_INTERVAL_SEC = 22` / `ITEM_FIRST_SPAWN_SEC = 15` / `ITEM_RADIUS = 20` / `ITEM_SPAWN_MARGIN = 80` / `ITEM_MIN_DIST_FROM_PLAYER = 220`
- 色: `STAR_COLORS = { core: '#fff3a8', base: '#ffd23e', glow: '#ffb03a' }`

## File Structure

| ファイル | 責務 | Task |
|---|---|---|
| `src/logic/invincible.ts`(新規) | 無敵の残時間と開始/終了エッジ。純粋、DOM 非依存 | 1 |
| `src/render/theme.ts`(変更) | `STAR_COLORS` / `FLASH_RGB` の追加 | 2, 5 |
| `src/entities/item.ts`(新規) | 星エンティティと出現位置の選定 | 2 |
| `src/audio.ts`(変更) | BGM トラックテーブル化、`setBgmMode()` / `powerUp()` | 3 |
| `src/entities/bullet.ts`(変更) | `type` を公開(弾消しの飛沫色に使う) | 4 |
| `src/scenes/play.ts`(変更) | 星のスポーン・取得・無敵の適用・描画の組み立て | 4, 5 |
| `src/render/effects.ts`(新規) | 無敵の残り時間リング。純粋な描画関数 | 5 |
| `DESIGN.md` / `CLAUDE.md`(変更) | 追加した取り決めとゲームルールの反映 | 6 |

---

### Task 1: 無敵状態の純粋ロジック(`src/logic/invincible.ts`)

**Files:**
- Create: `src/logic/invincible.ts`
- Test: `tests/invincible.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `INVINCIBLE_SEC: number`(= 8)
  - `interface InvincibleState { remainingSec: number }`
  - `initialInvincibleState(): InvincibleState`
  - `isInvincible(s: InvincibleState): boolean`
  - `activateInvincible(s: InvincibleState): { state: InvincibleState; justStarted: boolean }`
  - `tickInvincible(s: InvincibleState, dtSec: number): { state: InvincibleState; justEnded: boolean }`

このタスクの肝は `justStarted` / `justEnded` の2つのエッジフラグ。BGM の切替は
「開始時に1回だけ / 終了時に1回だけ」でなければならず、毎フレーム立つと
`bgmTimer` を作り直し続けて音が途切れる。テストで固定する。

- [ ] **Step 1: 失敗するテストを書く**

`tests/invincible.test.ts` を新規作成:

```ts
import { describe, it, expect } from 'vitest'
import {
  INVINCIBLE_SEC,
  initialInvincibleState,
  isInvincible,
  activateInvincible,
  tickInvincible,
} from '../src/logic/invincible'

describe('invincible', () => {
  it('初期状態は無敵ではない', () => {
    expect(isInvincible(initialInvincibleState())).toBe(false)
  })

  it('取得すると残時間 INVINCIBLE_SEC の無敵になり、justStarted が立つ', () => {
    const { state, justStarted } = activateInvincible(initialInvincibleState())
    expect(state.remainingSec).toBe(INVINCIBLE_SEC)
    expect(isInvincible(state)).toBe(true)
    expect(justStarted).toBe(true)
  })

  it('無敵中の再取得は残時間をリセットするが、justStarted は立たず加算もしない', () => {
    const half = tickInvincible(
      activateInvincible(initialInvincibleState()).state,
      INVINCIBLE_SEC / 2,
    ).state
    expect(half.remainingSec).toBeCloseTo(INVINCIBLE_SEC / 2)

    const { state, justStarted } = activateInvincible(half)
    expect(state.remainingSec).toBe(INVINCIBLE_SEC)
    expect(justStarted).toBe(false)
  })

  it('残時間が 0 を跨いだフレームだけ justEnded が立つ', () => {
    const started = activateInvincible(initialInvincibleState()).state

    const mid = tickInvincible(started, INVINCIBLE_SEC - 0.1)
    expect(mid.justEnded).toBe(false)
    expect(isInvincible(mid.state)).toBe(true)

    const end = tickInvincible(mid.state, 0.1)
    expect(end.justEnded).toBe(true)
    expect(end.state.remainingSec).toBe(0)
    expect(isInvincible(end.state)).toBe(false)
  })

  // BGM を通常へ戻す処理が毎フレーム走ると bgmTimer を作り直し続けてしまう。
  // 切れたあとは何度 tick しても justEnded が立たないことを固定する。
  it('無敵が切れた後は何フレーム tick しても justEnded が立たない', () => {
    let state = tickInvincible(
      activateInvincible(initialInvincibleState()).state,
      INVINCIBLE_SEC,
    ).state

    for (let i = 0; i < 5; i++) {
      const r = tickInvincible(state, 1 / 60)
      expect(r.justEnded).toBe(false)
      state = r.state
    }
  })

  it('残時間を超える dtSec を渡しても残時間は負にならない', () => {
    const r = tickInvincible(
      activateInvincible(initialInvincibleState()).state,
      INVINCIBLE_SEC * 3,
    )
    expect(r.state.remainingSec).toBe(0)
    expect(r.justEnded).toBe(true)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/invincible.test.ts`
Expected: FAIL — `Failed to resolve import "../src/logic/invincible"`

- [ ] **Step 3: 実装を書く**

`src/logic/invincible.ts` を新規作成:

```ts
/** アイテム取得時に設定される無敵の持続時間(秒)。 */
export const INVINCIBLE_SEC = 8

export interface InvincibleState {
  remainingSec: number
}

export function initialInvincibleState(): InvincibleState {
  return { remainingSec: 0 }
}

export function isInvincible(s: InvincibleState): boolean {
  return s.remainingSec > 0
}

/** アイテム取得時に呼ぶ。残時間は INVINCIBLE_SEC に「リセット」する(加算しない)。
 *  justStarted は直前が無敵でなかった場合のみ true。BGM を無敵用へ切り替えるのは
 *  このフラグが立ったときだけにして、再取得のたびに鳴らし直さないようにする。 */
export function activateInvincible(
  s: InvincibleState,
): { state: InvincibleState; justStarted: boolean } {
  return {
    state: { remainingSec: INVINCIBLE_SEC },
    justStarted: !isInvincible(s),
  }
}

/** 毎フレーム呼ぶ。justEnded は残時間が 0 を跨いだそのフレームだけ true になり、
 *  すでに 0 の状態で呼び続けても立たない。BGM を通常へ戻す処理が毎フレーム走って
 *  bgmTimer を作り直し続けるのを防ぐため、この非対称性が必要。 */
export function tickInvincible(
  s: InvincibleState,
  dtSec: number,
): { state: InvincibleState; justEnded: boolean } {
  if (!isInvincible(s)) return { state: s, justEnded: false }
  const remainingSec = Math.max(0, s.remainingSec - dtSec)
  return { state: { remainingSec }, justEnded: remainingSec <= 0 }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run tests/invincible.test.ts`
Expected: PASS(6 tests)

- [ ] **Step 5: 型チェック**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/logic/invincible.ts tests/invincible.test.ts
git commit -m "feat: 無敵状態の純粋ロジック(logic/invincible.ts)を追加"
```

---

### Task 2: 星エンティティ(`src/entities/item.ts` + `STAR_COLORS`)

**Files:**
- Modify: `src/render/theme.ts`(末尾に `STAR_COLORS` を追加)
- Create: `src/entities/item.ts`
- Test: `tests/item.test.ts`

**Interfaces:**
- Consumes: `FIELD_W` / `FIELD_H`(`src/entities/player.ts` からの既存 export)
- Produces:
  - `STAR_COLORS: { core: string; base: string; glow: string }`(`src/render/theme.ts`)
  - `ITEM_RADIUS` / `ITEM_LIFE_SEC` / `ITEM_SPAWN_INTERVAL_SEC` / `ITEM_FIRST_SPAWN_SEC` / `ITEM_SPAWN_MARGIN` / `ITEM_MIN_DIST_FROM_PLAYER`: いずれも `number`
  - `class StarItem` — `alive: boolean` / `readonly radius: number` / `x: number` / `y: number` / `constructor(x, y)` / `update(dtSec: number): void` / `isExpired(): boolean` / `draw(ctx: CanvasRenderingContext2D, timeSec: number): void`
  - `pickItemSpawnPos(px: number, py: number, rand: () => number): { x: number; y: number }`

`StarItem` は `x` / `y` / `radius` を持つので、既存の `collides()`(`src/entities/collision.ts` の `Circle` インターフェース)にそのまま渡せる。

- [ ] **Step 1: 失敗するテストを書く**

`tests/item.test.ts` を新規作成:

```ts
import { describe, it, expect } from 'vitest'
import {
  StarItem,
  pickItemSpawnPos,
  ITEM_LIFE_SEC,
  ITEM_SPAWN_MARGIN,
  ITEM_MIN_DIST_FROM_PLAYER,
} from '../src/entities/item'
import { FIELD_W, FIELD_H } from '../src/entities/player'
import { STAR_COLORS } from '../src/render/theme'

/** 呼ぶたびに与えた列を順に返す決定的な乱数。使い切ったら最後の値を返し続ける。 */
function seq(values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('pickItemSpawnPos', () => {
  it('外周マージンの内側にだけ出す', () => {
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      const { x, y } = pickItemSpawnPos(0, 0, () => v)
      expect(x).toBeGreaterThanOrEqual(ITEM_SPAWN_MARGIN)
      expect(x).toBeLessThanOrEqual(FIELD_W - ITEM_SPAWN_MARGIN)
      expect(y).toBeGreaterThanOrEqual(ITEM_SPAWN_MARGIN)
      expect(y).toBeLessThanOrEqual(FIELD_H - ITEM_SPAWN_MARGIN)
    }
  })

  it('自機から十分離れた候補が出たらそれを採用する', () => {
    const px = FIELD_W / 2
    const py = FIELD_H / 2
    // 1回目は自機と同じ中央(却下)、2回目は左上寄り(採用)
    const { x, y } = pickItemSpawnPos(px, py, seq([0.5, 0.5, 0, 0]))
    expect(Math.hypot(x - px, y - py)).toBeGreaterThanOrEqual(ITEM_MIN_DIST_FROM_PLAYER)
  })

  // 距離条件は妥協してよいが、マージン条件は必ず守る。
  it('距離条件を満たす候補が出なくてもマージン内には必ず収まる', () => {
    const px = FIELD_W / 2
    const py = FIELD_H / 2
    const { x, y } = pickItemSpawnPos(px, py, () => 0.5)
    expect(Math.hypot(x - px, y - py)).toBeLessThan(ITEM_MIN_DIST_FROM_PLAYER)
    expect(x).toBeGreaterThanOrEqual(ITEM_SPAWN_MARGIN)
    expect(x).toBeLessThanOrEqual(FIELD_W - ITEM_SPAWN_MARGIN)
    expect(y).toBeGreaterThanOrEqual(ITEM_SPAWN_MARGIN)
    expect(y).toBeLessThanOrEqual(FIELD_H - ITEM_SPAWN_MARGIN)
  })
})

describe('StarItem', () => {
  it('寿命 ITEM_LIFE_SEC を超えると isExpired が true になる', () => {
    const item = new StarItem(100, 100)
    item.update(ITEM_LIFE_SEC - 0.01)
    expect(item.isExpired()).toBe(false)
    item.update(0.01)
    expect(item.isExpired()).toBe(true)
  })

  // tests/bullet-colors.test.ts と同じ手法。Canvas 実体は不要なので、
  // draw() が呼ぶメソッドだけを持つスタブでグラデーションの色を記録する。
  it('星は STAR_COLORS の色だけで描かれる', () => {
    const colors: string[] = []
    const gradient = {
      addColorStop: (_offset: number, color: string) => { colors.push(color) },
    }
    const ctx = {
      save() {}, restore() {}, beginPath() {}, closePath() {},
      moveTo() {}, lineTo() {}, arc() {}, fill() {},
      translate() {}, rotate() {},
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
    } as unknown as CanvasRenderingContext2D

    new StarItem(100, 100).draw(ctx, 0)

    // 8桁hex(#RRGGBBAA)のアルファ部分を落として基本色だけを取り出す
    const used = new Set(colors.map((c) => c.slice(0, 7)))
    expect(used).toEqual(new Set([STAR_COLORS.glow, STAR_COLORS.core, STAR_COLORS.base]))
  })

  it('消滅間際は点滅するので、描かれないフレームがある', () => {
    const noop = {
      save() {}, restore() {}, beginPath() {}, closePath() {},
      moveTo() {}, lineTo() {}, arc() {}, fill() {},
      translate() {}, rotate() {},
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    }
    const drawnAt = (ageSec: number): boolean => {
      let filled = 0
      const ctx = { ...noop, fill: () => { filled++ } } as unknown as CanvasRenderingContext2D
      const item = new StarItem(100, 100)
      item.update(ageSec)
      item.draw(ctx, 0)
      return filled > 0
    }

    // 残り 2 秒未満で 0.125 秒周期の点滅に入る(残り 1.0 秒 → 描く / 1.125 秒 → 描かない)
    expect(drawnAt(ITEM_LIFE_SEC - 3)).toBe(true)
    expect(drawnAt(ITEM_LIFE_SEC - 1.0)).toBe(true)
    expect(drawnAt(ITEM_LIFE_SEC - 1.125)).toBe(false)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/item.test.ts`
Expected: FAIL — `Failed to resolve import "../src/entities/item"`

- [ ] **Step 3: `STAR_COLORS` を theme.ts に追加**

`src/render/theme.ts` の `BULLET_COLORS` 定義の直後(`HAND_LABEL` の行の前)に追加:

```ts
/** 無敵アイテム(星)のキーカラー。DESIGN.md §2 の「イエロー = 良いこと」に沿う。
 *  base は COLORS.yellow と同値で、core は中心のハイライト、glow は外周グロー。
 *  弾(紫/オレンジ/シアン)・手(緑/赤ピンク/青)のどれとも色相が重ならない。 */
export const STAR_COLORS = { core: '#fff3a8', base: '#ffd23e', glow: '#ffb03a' }
```

- [ ] **Step 4: `src/entities/item.ts` を書く**

```ts
import { FIELD_W, FIELD_H } from './player'
import { STAR_COLORS } from '../render/theme'

export const ITEM_RADIUS = 20
/** 取られなかった星が消えるまでの時間(秒)。 */
export const ITEM_LIFE_SEC = 8
/** 星が場から消えてから次が湧くまでの時間(秒)。 */
export const ITEM_SPAWN_INTERVAL_SEC = 22
/** プレイ開始から最初の星が湧くまでの時間(秒)。開幕直後には出さない。 */
export const ITEM_FIRST_SPAWN_SEC = 15
/** フィールド外周のこの幅にはスポーンさせない(端に張り付くと取りに行きにくい)。 */
export const ITEM_SPAWN_MARGIN = 80
/** 自機の真上に湧いて自動取得されるのを防ぐための最低距離。 */
export const ITEM_MIN_DIST_FROM_PLAYER = 220

const SPAWN_RETRY = 10
/** 消滅までこの秒数を切ったら点滅して予告する。 */
const BLINK_SEC = 2

export class StarItem {
  alive = true
  readonly radius = ITEM_RADIUS
  private ageSec = 0

  constructor(
    public x: number,
    public y: number,
  ) {}

  update(dtSec: number): void {
    this.ageSec += dtSec
  }

  isExpired(): boolean {
    return this.ageSec >= ITEM_LIFE_SEC
  }

  draw(ctx: CanvasRenderingContext2D, timeSec: number): void {
    const remainingSec = Math.max(0, ITEM_LIFE_SEC - this.ageSec)
    // 消滅間際は点滅させて「もうすぐ消える」と伝える
    if (remainingSec < BLINK_SEC && Math.floor(remainingSec * 8) % 2 === 1) return

    const r = this.radius * (1 + 0.08 * Math.sin(timeSec * 4))
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'

    // 外周グロー
    const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 2.2)
    glow.addColorStop(0, `${STAR_COLORS.glow}55`)
    glow.addColorStop(1, `${STAR_COLORS.glow}00`)
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(this.x, this.y, r * 2.2, 0, Math.PI * 2)
    ctx.fill()

    // 5稜星の本体。外側と内側の頂点を交互に結ぶ(-PI/2 始点で上向きになる)。
    ctx.translate(this.x, this.y)
    ctx.rotate(timeSec * 1.2)
    const body = ctx.createLinearGradient(0, -r, 0, r)
    body.addColorStop(0, STAR_COLORS.core)
    body.addColorStop(1, STAR_COLORS.base)
    ctx.fillStyle = body
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45
      const ang = -Math.PI / 2 + (Math.PI * i) / 5
      const px = Math.cos(ang) * rad
      const py = Math.sin(ang) * rad
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }
}

/** 星のスポーン位置を選ぶ。外周マージンの内側には必ず収め、自機からは
 *  ITEM_MIN_DIST_FROM_PLAYER 以上離す。離せる候補が見つからない場合
 *  (自機が中央にいるなど)は距離条件だけを諦め、マージン条件は必ず守る。 */
export function pickItemSpawnPos(
  px: number,
  py: number,
  rand: () => number,
): { x: number; y: number } {
  const minX = ITEM_SPAWN_MARGIN
  const maxX = FIELD_W - ITEM_SPAWN_MARGIN
  const minY = ITEM_SPAWN_MARGIN
  const maxY = FIELD_H - ITEM_SPAWN_MARGIN

  let x = minX
  let y = minY
  for (let i = 0; i < SPAWN_RETRY; i++) {
    x = minX + rand() * (maxX - minX)
    y = minY + rand() * (maxY - minY)
    if (Math.hypot(x - px, y - py) >= ITEM_MIN_DIST_FROM_PLAYER) break
  }
  return { x, y }
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npx vitest run tests/item.test.ts`
Expected: PASS(5 tests)

- [ ] **Step 6: 全テストと型チェック**

Run: `npm test && npm run build`
Expected: 両方 PASS

- [ ] **Step 7: Commit**

```bash
git add src/entities/item.ts src/render/theme.ts tests/item.test.ts
git commit -m "feat: 星アイテムのエンティティと STAR_COLORS を追加"
```

---

### Task 3: BGM のモード切替(`src/audio.ts`)

**Files:**
- Modify: `src/audio.ts`
- Test: `tests/audio.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `type BgmMode = 'normal' | 'invincible'`
  - `BGM_TRACKS: Record<BgmMode, { notes: number[]; stepMs: number; type: OscillatorType; gain: number; durSec: number }>`
  - `Sound.setBgmMode(mode: BgmMode): void`
  - `Sound.powerUp(): void`

`Sound` は WebAudio(`AudioContext`)と `window.setInterval` に直接触る。vitest の
環境は node なので、テスト側で両方をスタブする。`document` は未定義のままでよい
(`Sound` のコンストラクタは `typeof document !== 'undefined'` でガードしている)。

- [ ] **Step 1: 失敗するテストを書く**

`tests/audio.test.ts` を新規作成:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Sound, BGM_TRACKS } from '../src/audio'

/** beep() が鳴らした周波数、setInterval / clearInterval の回数を記録する。 */
let notes: number[]
let intervalCalls: number
let clearCalls: number

beforeEach(() => {
  notes = []
  intervalCalls = 0
  clearCalls = 0

  // osc.connect(gain).connect(ctx.destination) が繋がるよう connect は引数を返す
  const makeOsc = () => ({
    type: 'square' as OscillatorType,
    frequency: { set value(v: number) { notes.push(v) } },
    connect: (n: unknown) => n,
    start() {},
    stop() {},
  })
  const makeGain = () => ({
    gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    connect: (n: unknown) => n,
  })

  vi.stubGlobal('AudioContext', class {
    state = 'running'
    currentTime = 0
    destination = {}
    resume() {}
    createOscillator() { return makeOsc() }
    createGain() { return makeGain() }
  })
  vi.stubGlobal('window', {
    setInterval: () => { intervalCalls++; return intervalCalls },
  })
  vi.stubGlobal('clearInterval', () => { clearCalls++ })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Sound の BGM モード切替', () => {
  it('startBgm() は通常トラックの1音目から鳴らす', () => {
    const s = new Sound()
    s.startBgm()
    expect(notes[0]).toBe(BGM_TRACKS.normal.notes[0])
  })

  it('再生中の setBgmMode() はタイマーを作り直し、新しいトラックの1音目を鳴らす', () => {
    const s = new Sound()
    s.startBgm()
    const before = intervalCalls

    s.setBgmMode('invincible')

    expect(intervalCalls).toBe(before + 1)
    expect(clearCalls).toBe(1)
    expect(notes[notes.length - 1]).toBe(BGM_TRACKS.invincible.notes[0])
  })

  // 無敵中の再取得のたびに鳴らし直すと BGM が頭出しされ続けてしまう
  it('同じモードへの setBgmMode() は何もしない', () => {
    const s = new Sound()
    s.startBgm()
    s.setBgmMode('invincible')
    const calls = intervalCalls
    const played = notes.length

    s.setBgmMode('invincible')

    expect(intervalCalls).toBe(calls)
    expect(notes.length).toBe(played)
  })

  // タブ非表示で bgmTimer を止めている間の切替がこの経路。
  // モード変数だけ更新し、再開時に新しいトラックで鳴り出す。
  it('BGM が止まっている間の setBgmMode() は音を鳴らさず、次の startBgm() で反映される', () => {
    const s = new Sound()

    s.setBgmMode('invincible')

    expect(intervalCalls).toBe(0)
    expect(notes).toEqual([])

    s.startBgm()
    expect(notes[0]).toBe(BGM_TRACKS.invincible.notes[0])
  })

  // Sound は GameContext 経由でシーンをまたいで共有されるので、
  // ここでモードを戻さないと次のプレイが無敵BGMで始まってしまう。
  it('stopBgm() はモードを normal に戻すので、次のプレイは通常BGMで始まる', () => {
    const s = new Sound()
    s.startBgm()
    s.setBgmMode('invincible')
    s.stopBgm()
    notes.length = 0

    s.startBgm()

    expect(notes[0]).toBe(BGM_TRACKS.normal.notes[0])
  })
})

describe('powerUp()', () => {
  it('levelUp() とは違う音列を鳴らす', () => {
    const s = new Sound()
    s.powerUp()
    const powerUpNotes = [...notes]

    notes.length = 0
    s.levelUp()
    const levelUpNotes = [...notes]

    expect(powerUpNotes.length).toBeGreaterThan(0)
    expect(powerUpNotes).not.toEqual(levelUpNotes)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/audio.test.ts`
Expected: FAIL — `BGM_TRACKS` / `setBgmMode` / `powerUp` が存在しない

- [ ] **Step 3: `src/audio.ts` にトラックテーブルを追加**

ファイル先頭(`export class Sound` の前)に追加:

```ts
export type BgmMode = 'normal' | 'invincible'

interface BgmTrack {
  notes: number[]
  stepMs: number
  type: OscillatorType
  gain: number
  durSec: number
}

/** normal は従来 startBgmTimer() に直書きされていた値をそのまま移したもので、
 *  既存の聞こえ方は変わらない。invincible は1オクターブ上・倍テンポ・矩形波にして、
 *  切り替わったことが一聴して分かるようにしている。 */
export const BGM_TRACKS: Record<BgmMode, BgmTrack> = {
  normal: {
    notes: [262, 330, 392, 330, 294, 370, 440, 370],
    stepMs: 220, type: 'triangle', gain: 0.03, durSec: 0.18,
  },
  invincible: {
    notes: [523, 659, 784, 988, 784, 659, 880, 988],
    stepMs: 110, type: 'square', gain: 0.045, durSec: 0.09,
  },
}
```

- [ ] **Step 4: `Sound` クラスにモードを持たせる**

`private pausedByVisibility = false` の直後にフィールドを追加:

```ts
  /** 現在の BGM トラック。stopBgm() で 'normal' に戻す。 */
  private bgmMode: BgmMode = 'normal'
```

`startBgmTimer()` を書き換え(音列・テンポをトラックから引く):

```ts
  private startBgmTimer(): void {
    if (this.bgmTimer !== null) return
    const track = BGM_TRACKS[this.bgmMode]
    let i = 0
    const step = () => {
      this.beep(track.notes[i % track.notes.length], track.durSec, track.type, track.gain)
      i++
    }
    step()
    this.bgmTimer = window.setInterval(step, track.stepMs)
  }
```

`stopBgm()` にモードのリセットを追加:

```ts
  stopBgm(): void {
    this.bgmRunning = false
    this.pausedByVisibility = false
    // Sound は GameContext 経由でシーンをまたいで共有される。ここで戻さないと、
    // 無敵中に終わったプレイの次のプレイが無敵BGMで始まってしまう。
    this.bgmMode = 'normal'
    this.clearBgmTimer()
  }
```

`stopBgm()` の直後に `setBgmMode()` を追加:

```ts
  /** BGM のトラックを切り替える。同じモードなら何もしない。
   *  bgmTimer が動いているときだけ作り直す点が重要で、タブ非表示で止めている間は
   *  モード変数だけ更新し、visibilitychange ハンドラが復帰時に新しいモードで鳴らす。 */
  setBgmMode(mode: BgmMode): void {
    if (this.bgmMode === mode) return
    this.bgmMode = mode
    if (this.bgmTimer === null) return
    this.clearBgmTimer()
    this.startBgmTimer()
  }
```

- [ ] **Step 5: `powerUp()` を追加**

`gameOver()` の直後に追加:

```ts
  /** アイテム取得音。levelUp()(523/659/784/1047・triangle・0.09秒間隔)と
   *  取り違えないよう、square の速い上昇3音にして最後だけ伸ばす。 */
  powerUp(): void {
    this.beep(784, 0.08, 'square', 0.09)
    this.beep(1047, 0.08, 'square', 0.09, 0.05)
    this.beep(1319, 0.22, 'square', 0.09, 0.1)
  }
```

- [ ] **Step 6: テストが通ることを確認**

Run: `npx vitest run tests/audio.test.ts`
Expected: PASS(6 tests)

- [ ] **Step 7: 全テストと型チェック**

Run: `npm test && npm run build`
Expected: 両方 PASS

- [ ] **Step 8: Commit**

```bash
git add src/audio.ts tests/audio.test.ts
git commit -m "feat: BGM をトラックテーブル化し無敵BGMへの切替を追加"
```

---

### Task 4: PlayScene への統合(スポーン・取得・無敵の適用)

**Files:**
- Modify: `src/entities/bullet.ts:21`(`private type` → `public readonly type`)
- Modify: `src/scenes/play.ts`
- Test: `tests/play-scene.test.ts`

**Interfaces:**
- Consumes: Task 1 の `initialInvincibleState` / `isInvincible` / `activateInvincible` / `tickInvincible`、Task 2 の `StarItem` / `pickItemSpawnPos` / `ITEM_SPAWN_INTERVAL_SEC` / `ITEM_FIRST_SPAWN_SEC` / `STAR_COLORS`、Task 3 の `Sound.setBgmMode` / `Sound.powerUp`
- Produces: `PlayScene` の private フィールド `items: StarItem[]` / `itemTimer: number` / `inv: InvincibleState`(テストが `as any` で触る)

このタスクは update のロジックと星の描画呼び出しまで。無敵の可視化(リング・
フラッシュ)は Task 5 で足す。

- [ ] **Step 1: 失敗するテストを書く**

`tests/play-scene.test.ts` の import 群に追加:

```ts
import { StarItem, ITEM_SPAWN_INTERVAL_SEC, ITEM_LIFE_SEC } from '../src/entities/item'
import { initialInvincibleState, activateInvincible, isInvincible, INVINCIBLE_SEC } from '../src/logic/invincible'
```

既存の `makeContext()` を、Sound の呼び出しを記録できるように差し替える
(既存の呼び出し側 `makeContext()` / `makeContext(input)` はそのまま動く):

```ts
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
```

`describe('PlayScene.update', ...)` の中(既存の it の後ろ)に追加:

```ts
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/play-scene.test.ts`
Expected: FAIL — 新規7件が失敗(`inv` が undefined、`items` が反映されない等)

- [ ] **Step 3: `bullet.ts` の `type` を公開する**

`src/entities/bullet.ts:21` を変更:

```ts
    private type: BulletType,   // 変更前
    public readonly type: BulletType,   // 変更後
```

弾消しの飛沫を弾種の色で出すため、`PlayScene` から `BULLET_COLORS[b.type]` を
引けるようにする。`draw()` 内の `this.type` 参照はそのままで動く。

- [ ] **Step 4: `play.ts` の import とフィールドを追加**

import 群を差し替え(追加分のみ抜粋、既存 import はそのまま残す):

```ts
import { StarItem, pickItemSpawnPos, ITEM_SPAWN_INTERVAL_SEC, ITEM_FIRST_SPAWN_SEC } from '../entities/item'
import {
  initialInvincibleState, isInvincible, activateInvincible, tickInvincible,
  type InvincibleState,
} from '../logic/invincible'
```

既存の `import { FONT_DISPLAY, COLORS } from '../render/theme'` を差し替え:

```ts
import { FONT_DISPLAY, COLORS, BULLET_COLORS, STAR_COLORS } from '../render/theme'
```

`private morphSec = 0` の直後にフィールドを追加:

```ts
  private items: StarItem[] = []
  private itemTimer = ITEM_FIRST_SPAWN_SEC
  private inv: InvincibleState = initialInvincibleState()
```

- [ ] **Step 5: `update()` を書き換える**

`src/scenes/play.ts` の `update()` を丸ごと以下に置き換える(先頭の
`consumeConfirm` のコメントは既存のものをそのまま残す):

```ts
  update(dtSec: number): Scene | null {
    // プレイ中に押された Enter/Space はここで捨てる。PlayScene は confirmEdge を
    // 消費しないため、消費し忘れるとラッチが残り続け、GameOverScene の最初の
    // フレームで即座に消費されて GAME OVER 画面を一度も描画せず次の PlayScene
    // に遷移してしまう（スコア表示が飛ぶ）。戻り値は使わないが意図的に破棄する。
    this.g.input.consumeConfirm()

    this.elapsedSec += dtSec
    this.score += timeScore(dtSec, this.levelState.level)
    this.flashSec = Math.max(0, this.flashSec - dtSec)
    this.morphSec = Math.max(0, this.morphSec - dtSec)

    // 無敵の残時間を進める。justEnded は 0 を跨いだフレームだけ立つので、
    // BGM を戻す処理が毎フレーム走って bgmTimer を作り直し続けることはない。
    const ticked = tickInvincible(this.inv, dtSec)
    this.inv = ticked.state
    if (ticked.justEnded) this.g.sound.setBgmMode('normal')

    this.player.update(this.g.input, dtSec)
    this.spawn(dtSec)

    for (const b of this.bullets) b.update(dtSec, this.player)
    for (const h of this.hands) h.update(dtSec)
    for (const it of this.items) it.update(dtSec)
    for (const p of this.particles) p.update(dtSec)

    // アイテムの取得判定は弾・手の判定より先に行う。同じフレームで星と弾に
    // 同時接触したとき、取得を先に処理すれば無敵が成立して死なずに済む。
    // 逆順にすると「取ったのに死んだ」が起きる。
    for (const it of this.items) {
      if (!it.alive || !collides(it, this.player)) continue
      it.alive = false
      const activated = activateInvincible(this.inv)
      this.inv = activated.state
      // BGM の切替は無敵が「始まった」ときだけ。再取得では鳴らし直さない。
      if (activated.justStarted) this.g.sound.setBgmMode('invincible')
      this.g.sound.powerUp()
      this.particles.push(...burstParticles(it.x, it.y, STAR_COLORS.core, 20))
    }

    // 弾との衝突 → 通常は即 GAMEOVER。無敵中は弾を消して飛沫だけ出す(スコアなし)。
    for (const b of this.bullets) {
      if (!b.alive || !collides(b, this.player)) continue
      if (!isInvincible(this.inv)) return this.gameOver()
      b.alive = false
      this.particles.push(...burstParticles(b.x, b.y, BULLET_COLORS[b.type].core, 8))
    }

    // 手との衝突 → じゃんけん判定。無敵中は勝敗を無視して撃破できる。
    for (const h of this.hands) {
      if (!h.alive || !collides(h, this.player)) continue
      if (!isInvincible(this.inv) && judge(this.player.hand, h.hand) !== 'win') return this.gameOver()
      h.alive = false
      this.score += killBonus(this.levelState.level)
      this.particles.push(...burstParticles(h.x, h.y, '#f1c40f'))
      this.g.sound.kill()
      const { state, leveledUp } = addWin(this.levelState)
      this.levelState = state
      if (leveledUp) this.levelUp()
    }

    this.bullets = this.bullets.filter((b) => b.alive && !b.shouldDespawn())
    this.hands = this.hands.filter((h) => h.alive && !h.isOffscreen())
    this.items = this.items.filter((it) => it.alive && !it.isExpired())
    this.particles = this.particles.filter((p) => p.alive)
    return null
  }
```

- [ ] **Step 6: `spawn()` に星のスポーンを足す**

`spawn()` の末尾(`this.hands.push(...)` の `}` の後ろ)に追加:

```ts
    // 星は場に1個まで。場に星がある間はタイマーを間隔いっぱいに戻し続けるので、
    // ITEM_SPAWN_INTERVAL_SEC は「星が場から消えてから次が湧くまで」の時間になる。
    if (this.items.length > 0) {
      this.itemTimer = ITEM_SPAWN_INTERVAL_SEC
      return
    }
    this.itemTimer -= dtSec
    if (this.itemTimer <= 0) {
      const { x, y } = pickItemSpawnPos(this.player.x, this.player.y, Math.random)
      this.items.push(new StarItem(x, y))
    }
```

- [ ] **Step 7: `draw()` に星を足す**

`draw()` の `for (const h of this.hands) ...` と `for (const b of this.bullets) ...`
の間に1行追加:

```ts
    for (const h of this.hands) h.draw(ctx, this.g.assets)
    for (const it of this.items) it.draw(ctx, this.elapsedSec)
    for (const b of this.bullets) b.draw(ctx)
```

- [ ] **Step 8: テストが通ることを確認**

Run: `npx vitest run tests/play-scene.test.ts`
Expected: PASS(既存9件 + 新規7件)

- [ ] **Step 9: 全テストと型チェック**

Run: `npm test && npm run build`
Expected: 両方 PASS

- [ ] **Step 10: Commit**

```bash
git add src/scenes/play.ts src/entities/bullet.ts tests/play-scene.test.ts
git commit -m "feat: 星の出現・取得と無敵中の当たり判定を PlayScene に組み込む"
```

---

### Task 5: 無敵の可視化(リング + フラッシュの一般化)

**Files:**
- Modify: `src/render/theme.ts`(`FLASH_RGB` を追加)
- Create: `src/render/effects.ts`
- Modify: `src/scenes/play.ts`
- Test: `tests/effects.test.ts`
- Test: `tests/theme.test.ts`

**Interfaces:**
- Consumes: Task 1 の `INVINCIBLE_SEC` / `isInvincible`、`COLORS`(既存)
- Produces:
  - `FLASH_RGB: Record<'white' | 'yellow', string>`(`src/render/theme.ts`)
  - `drawInvincibleRing(ctx: CanvasRenderingContext2D, x: number, y: number, playerRadius: number, remainingSec: number, maxSec: number): void`(`src/render/effects.ts`)

フラッシュは `rgba()` のアルファを毎フレーム変えるため hex ではなく `"R,G,B"`
形式が必要になる。`COLORS` の hex と対応する値を `FLASH_RGB` に持ち、対応が
崩れていないことをテストで担保する。

- [ ] **Step 1: 失敗するテストを書く**

`tests/effects.test.ts` を新規作成:

```ts
import { describe, it, expect } from 'vitest'
import { drawInvincibleRing } from '../src/render/effects'

interface ArcCall { x: number; y: number; r: number; start: number; end: number }

/** drawInvincibleRing が描いた円弧を記録する。Canvas 実体は不要。 */
function record(remainingSec: number, maxSec: number): ArcCall[] {
  const arcs: ArcCall[] = []
  const ctx = {
    save() {}, restore() {}, beginPath() {}, stroke() {},
    arc(x: number, y: number, r: number, start: number, end: number) {
      arcs.push({ x, y, r, start, end })
    },
  } as unknown as CanvasRenderingContext2D
  drawInvincibleRing(ctx, 100, 200, 24, remainingSec, maxSec)
  return arcs
}

describe('drawInvincibleRing', () => {
  it('残量いっぱいなら1周ぶんの円弧を描く', () => {
    const [arc] = record(8, 8)
    expect(arc.end - arc.start).toBeCloseTo(Math.PI * 2)
  })

  it('残量が半分なら半周ぶんの円弧を描く', () => {
    const [arc] = record(4, 8)
    expect(arc.end - arc.start).toBeCloseTo(Math.PI)
  })

  it('12時方向から時計回りに描く', () => {
    const [arc] = record(8, 8)
    expect(arc.start).toBeCloseTo(-Math.PI / 2)
    expect(arc.end).toBeGreaterThan(arc.start)
  })

  it('自機の半径より外側に描く', () => {
    const [arc] = record(8, 8)
    expect(arc.x).toBe(100)
    expect(arc.y).toBe(200)
    expect(arc.r).toBeGreaterThan(24)
  })

  it('残時間が 0 なら何も描かない', () => {
    expect(record(0, 8)).toEqual([])
  })

  // 0.125 秒周期の点滅で「もうすぐ切れる」と伝える
  it('残り 1.5 秒未満では点滅する', () => {
    expect(record(1.0, 8).length).toBe(1)
    expect(record(1.125, 8).length).toBe(0)
    // 1.5 秒以上あるうちは点滅しない
    expect(record(2.125, 8).length).toBe(1)
  })
})
```

`tests/theme.test.ts` を新規作成:

```ts
import { describe, it, expect } from 'vitest'
import { COLORS, FLASH_RGB } from '../src/render/theme'

/** '#rrggbb' → 'R,G,B'。フラッシュ演出は rgba() のアルファを毎フレーム変えるため、
 *  hex ではなく分解済みの文字列が要る。変換はテスト側に置き、
 *  production では定数の対応が崩れていないことだけを保証する。 */
function hexToRgbString(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

describe('FLASH_RGB', () => {
  it('COLORS の hex と同じ色を指している', () => {
    expect(FLASH_RGB.white).toBe(hexToRgbString(COLORS.white))
    expect(FLASH_RGB.yellow).toBe(hexToRgbString(COLORS.yellow))
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/effects.test.ts tests/theme.test.ts`
Expected: FAIL — `../src/render/effects` が解決できない / `FLASH_RGB` が存在しない

- [ ] **Step 3: `FLASH_RGB` を theme.ts に追加**

`src/render/theme.ts` の `COLORS` 定義の直後に追加:

```ts
/** 画面フラッシュ用。rgba() のアルファを毎フレーム変えるので hex ではなく
 *  "R,G,B" 形式で持つ。値は COLORS の同名色と一致させること
 *  (tests/theme.test.ts が対応を検証している)。 */
export const FLASH_RGB: Record<'white' | 'yellow', string> = {
  white: '255,255,255',
  yellow: '255,210,62',
}
```

- [ ] **Step 4: `src/render/effects.ts` を書く**

```ts
import { COLORS } from './theme'

/** 残りこの秒数を切ったらリングを点滅させ、無敵が切れることを予告する。 */
const BLINK_SEC = 1.5

/** 無敵の残り時間リング。自機の周りに 12 時方向から時計回りに、残量ぶんの
 *  円弧を描く。数値 HUD ではなく自機に付随する演出なので、DESIGN.md §4 の
 *  「フィールドに重ねてよいのは演出だけ」に収まる。 */
export function drawInvincibleRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  playerRadius: number,
  remainingSec: number,
  maxSec: number,
): void {
  if (remainingSec <= 0) return
  if (remainingSec < BLINK_SEC && Math.floor(remainingSec * 8) % 2 === 1) return

  const r = playerRadius * 1.6
  const ratio = Math.max(0, Math.min(1, remainingSec / maxSec))
  const start = -Math.PI / 2

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = COLORS.yellow
  ctx.shadowColor = COLORS.yellow
  ctx.shadowBlur = 12
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(x, y, r, start, start + Math.PI * 2 * ratio)
  ctx.stroke()
  ctx.restore()
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npx vitest run tests/effects.test.ts tests/theme.test.ts`
Expected: PASS(7 tests)

- [ ] **Step 6: `play.ts` のフラッシュを色付きに一般化する**

import を追加:

```ts
import { drawInvincibleRing } from '../render/effects'
```

`FLASH_RGB` を theme の import に足す:

```ts
import { FONT_DISPLAY, COLORS, BULLET_COLORS, STAR_COLORS, FLASH_RGB } from '../render/theme'
```

`INVINCIBLE_SEC` を invincible の import に足す:

```ts
import {
  initialInvincibleState, isInvincible, activateInvincible, tickInvincible,
  INVINCIBLE_SEC, type InvincibleState,
} from '../logic/invincible'
```

`private flashSec = 0` を以下3行に差し替える:

```ts
  /** 画面フラッシュ。色は FLASH_RGB の "R,G,B" 形式で持ち、
   *  アルファは残り時間 / 全体時間から決める。 */
  private flashSec = 0
  private flashMaxSec = 1
  private flashRgb = FLASH_RGB.white
```

`levelUp()` の直前(private メソッド群の先頭)にヘルパーを追加:

```ts
  private flash(rgb: string, sec: number): void {
    this.flashRgb = rgb
    this.flashSec = sec
    this.flashMaxSec = sec
  }
```

`levelUp()` の `this.flashSec = 0.35` を差し替え:

```ts
    this.flash(FLASH_RGB.white, 0.35)
```

`update()` の星取得ブロックで `this.g.sound.powerUp()` の直後に追加:

```ts
      // LVUP の白フラッシュと区別するためイエローにする
      this.flash(FLASH_RGB.yellow, 0.25)
```

`draw()` のフラッシュ描画を差し替え:

```ts
    if (this.flashSec > 0) {
      ctx.fillStyle = `rgba(${this.flashRgb},${(this.flashSec / this.flashMaxSec) * 0.6})`
      ctx.fillRect(0, 0, FIELD_W, FIELD_H)
    }
```

- [ ] **Step 7: `draw()` に無敵リングを足す**

`draw()` のプレイヤー描画ブロックの直後、パーティクル描画の直前に追加:

```ts
    if (this.morphSec <= 0 || Math.floor(this.morphSec * 12) % 2 === 0) {
      this.player.draw(ctx, this.g.assets)
    }
    // 無敵リングは morph の点滅条件の外に置く。無敵中に LVUP が起きたとき
    // 自機と一緒にリングまで消えると、残り時間を見失うため。
    if (isInvincible(this.inv)) {
      drawInvincibleRing(ctx, this.player.x, this.player.y, this.player.radius, this.inv.remainingSec, INVINCIBLE_SEC)
    }
    for (const p of this.particles) p.draw(ctx)
```

- [ ] **Step 8: 全テストと型チェック**

Run: `npm test && npm run build`
Expected: 両方 PASS

- [ ] **Step 9: 実機で目視確認**

Run: `npm run dev` してブラウザで開き、以下を確認する。

- 開始 15 秒後にフィールド内へ回転する黄色い星が現れる
- 星は 8 秒で消え、消える 2 秒前から点滅する
- 星を取ると黄フラッシュ + 取得音 + BGM が速い高音に切り替わる
- 自機の周りに黄色いリングが出て、時計回りに減っていく
- 無敵中は弾に当たっても死なず、弾がその場で消える
- 無敵中は負ける手・あいこの手に当たっても死なず、撃破できる
- 8 秒後にリングが消え、BGM が元に戻る(残り 1.5 秒でリングが点滅する)
- 無敵中に LVUP しても、自機が点滅する間もリングは出たままになる

- [ ] **Step 10: Commit**

```bash
git add src/render/effects.ts src/render/theme.ts src/scenes/play.ts tests/effects.test.ts tests/theme.test.ts
git commit -m "feat: 無敵の残り時間リングと取得フラッシュを追加"
```

---

### Task 6: ドキュメント更新(DESIGN.md / CLAUDE.md)

**Files:**
- Modify: `DESIGN.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: Task 1〜5 で確定した定数・演出
- Produces: なし(ドキュメントのみ)

- [ ] **Step 1: DESIGN.md §2 にカラーを追記**

`### 手の3すくみカラー(`HAND_COLORS`)` の節の後ろ、`### ラベル色` の前に追加:

```markdown
### 無敵アイテム(星)のカラー(`STAR_COLORS`)

| 用途 | 値 |
|---|---|
| core（中心のハイライト） | `#fff3a8` |
| base（星の本体） | `#ffd23e` |
| glow（外周グロー） | `#ffb03a` |

`base` は `COLORS.yellow` と同値。アイテムは「良いこと」なのでイエロー系に統一する。
弾（紫・オレンジ・シアン）とも手（緑・赤ピンク・青）とも色相が重ならない。

フラッシュ演出は `rgba()` のアルファを毎フレーム変えるため hex では使えない。
`FLASH_RGB`（`"R,G,B"` 形式）に `COLORS` と対応する値を持たせている。
```

- [ ] **Step 2: DESIGN.md §6 の表に行を追加**

「パーティクル」の行の下に追加:

```markdown
| アイテム(星) | 外周グロー（半径 `radius * 2.2`、`STAR_COLORS.glow` の `55` → `00`）+ 5稜星のパス（`core` → `base` の線形グラデ）。`timeSec * 1.2 rad/s` で回転、`1 + 0.08 * sin(timeSec * 4)` で脈動 |
| 無敵中の自機 | 手の `glow` 色はそのまま。外側に半径 `radius * 1.6` の黄色い残り時間リングを重ねる（`render/effects.ts`） |
```

- [ ] **Step 3: DESIGN.md §7 の表と注記を追加**

表の「点滅プロンプト」の行の下に追加:

```markdown
| アイテム取得フラッシュ | 0.25s | イエロー `alpha 0.6` から線形フェード（LVUP の白と区別する） |
| 星の消滅予告 | 消滅前 2s | `Math.floor(残り寿命 * 8) % 2` で点滅 |
| 無敵リングの終了予告 | 残り 1.5s | `Math.floor(残り * 8) % 2` で点滅 |
```

表の下の箇条書きに1項目追加:

```markdown
- 無敵リングは LVUP のモーフ点滅の対象外。自機と一緒に消えると残り時間を見失うため。
```

- [ ] **Step 4: CLAUDE.md のアーキテクチャ節を更新**

「レイヤー分離」の `src/logic/` と `src/entities/` の説明を差し替え:

```markdown
- `src/logic/` — 純粋ロジック（じゃんけん勝敗判定、難易度曲線、レベル、スコア、無敵状態）。DOM/Canvas 非依存で、テストは主にここと `src/entities/` を対象にしている。
- `src/entities/` — プレイヤー・弾・じゃんけんの手・アイテム（星）・パーティクル・衝突判定。
```

`src/render/` の説明の後ろに1行追加:

```markdown
- `src/audio.ts` — WebAudio によるビープ生成。BGM は `BGM_TRACKS`（`normal` / `invincible`）をモードで切り替える。
```

- [ ] **Step 5: CLAUDE.md のゲームルール節を更新**

「ゲームルール（ロジック変更時の前提）」に1項目追加:

```markdown
- 一定間隔で星アイテムが出現し、取得すると 8 秒間無敵になり BGM が切り替わる。無敵中は触れた弾が消え、じゃんけんの勝敗を無視して手を倒せる（撃破ボーナスと勝利カウントは通常どおり入る）。
```

- [ ] **Step 6: Commit**

```bash
git add DESIGN.md CLAUDE.md
git commit -m "docs: 無敵アイテムの追加に合わせて DESIGN.md / CLAUDE.md を更新"
```

---

## 明示的にスコープ外

- `scenes/play.ts` のパーティクル色 `'#f1c40f'` / `'#3498db'` のハードコード（DESIGN.md §8 の既知の逸脱）。本機能とは無関係なので触らない
- `render/panel.ts` の Y 座標マジックナンバーの整理
- 無敵中のスコア倍率ボーナス、コンボ、他種のアイテム
