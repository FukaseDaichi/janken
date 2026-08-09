# じゃんけん弾除けゲーム Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** じゃんけん3形態を持つプレイヤーが弾とじゃんけんの手を避け/倒して生存スコアを稼ぐ、PC ブラウザ向け全方位弾除けゲームを作り、GitHub Pages で公開する。

**Architecture:** クラスベースのエンティティ（Player / Bullet / JankenHand / Particle）＋シーン状態マシン（Title / Play / GameOver）。1つの requestAnimationFrame ループを `Game` が回す。じゃんけん判定・スコア・レベル・難易度・ストレージはピュア関数に分離して Vitest でテストする。

**Tech Stack:** TypeScript, Vite, Vitest, Canvas 2D, Web Audio API, GitHub Actions (Pages デプロイ)

## Global Constraints

- 内部解像度 960×720 固定。CSS でアスペクト比維持スケール
- 操作: 矢印キー＋WASD。決定は Enter / Space
- レベル倍率: LV1 = ×1.0、レベルごとに +0.5
- レベル内で 3 勝で LVUP。勝利カウントはレベルごとにリセット
- LVUP 時の形態変化は「現在と異なる 2 種からランダム」
- あいこ・負けの手・弾への接触は即 GAMEOVER
- ハイスコアの localStorage キーは `janken-dodge-highscore`
- 画像は `public/assets/*.png`（Codex が並行生成中）。ロード失敗時は絵文字フォールバック描画で動作すること
- コミットメッセージ末尾に `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: プロジェクトスキャフォールド

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `.gitignore`

**Interfaces:**
- Produces: `npm run dev` / `npm run build` / `npm test` が動く土台。960×720 Canvas が表示される `#game` 要素

- [ ] **Step 1: npm プロジェクト初期化と依存導入**

```bash
cd /Users/fukasedaichi/git/janken
npm init -y
npm install -D typescript vite vitest
```

- [ ] **Step 2: 設定ファイル作成**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "skipLibCheck": true,
    "types": ["vite/client"]
  },
  "include": ["src", "tests"]
}
```

`vite.config.ts`（GitHub Pages のサブパス配信に対応するため base は相対パス）:
```ts
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
})
```

`.gitignore`:
```
node_modules/
dist/
```

`package.json` の scripts を以下に書き換え:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: index.html と main.ts 作成**

`index.html`:
```html
<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>じゃんけん弾除け</title>
  <style>
    html, body { margin: 0; height: 100%; background: #111; display: grid; place-items: center; }
    canvas { max-width: 100vw; max-height: 100vh; aspect-ratio: 4 / 3; image-rendering: pixelated; }
  </style>
</head>
<body>
  <canvas id="game" width="960" height="720"></canvas>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

`src/main.ts`（仮描画。後のタスクで Game 起動に置き換える）:
```ts
const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
ctx.fillStyle = '#1a1a2e'
ctx.fillRect(0, 0, canvas.width, canvas.height)
ctx.fillStyle = '#fff'
ctx.font = '32px sans-serif'
ctx.fillText('じゃんけん弾除け - scaffold OK', 240, 360)
```

- [ ] **Step 4: 動作確認**

Run: `npm run build`
Expected: エラーなく `dist/` が生成される

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: Vite + TypeScript + Vitest スキャフォールド"
```

---

### Task 2: じゃんけん判定ロジック

**Files:**
- Create: `src/logic/janken.ts`
- Test: `tests/janken.test.ts`

**Interfaces:**
- Produces:
  - `type Hand = 'rock' | 'scissors' | 'paper'`
  - `type JankenResult = 'win' | 'lose' | 'draw'`
  - `judge(player: Hand, enemy: Hand): JankenResult`（player 視点の結果）
  - `beats(hand: Hand): Hand`（その手が勝てる相手の手）
  - `randomOtherHand(current: Hand, rand: () => number): Hand`（current 以外の 2 種から選択。rand は [0,1) を返す注入用乱数）
  - `randomHand(rand: () => number): Hand`

- [ ] **Step 1: 失敗するテストを書く**

`tests/janken.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { judge, beats, randomOtherHand, randomHand, type Hand } from '../src/logic/janken'

describe('judge', () => {
  it('全 9 組み合わせを正しく判定する', () => {
    expect(judge('rock', 'scissors')).toBe('win')
    expect(judge('rock', 'paper')).toBe('lose')
    expect(judge('rock', 'rock')).toBe('draw')
    expect(judge('scissors', 'paper')).toBe('win')
    expect(judge('scissors', 'rock')).toBe('lose')
    expect(judge('scissors', 'scissors')).toBe('draw')
    expect(judge('paper', 'rock')).toBe('win')
    expect(judge('paper', 'scissors')).toBe('lose')
    expect(judge('paper', 'paper')).toBe('draw')
  })
})

describe('beats', () => {
  it('各手が勝てる相手を返す', () => {
    expect(beats('rock')).toBe('scissors')
    expect(beats('scissors')).toBe('paper')
    expect(beats('paper')).toBe('rock')
  })
})

describe('randomOtherHand', () => {
  it('現在の手以外の 2 種から選ぶ', () => {
    const others: Hand[] = [randomOtherHand('rock', () => 0), randomOtherHand('rock', () => 0.99)]
    expect(others).not.toContain('rock')
    expect(new Set(others).size).toBe(2)
  })
})

describe('randomHand', () => {
  it('3 種すべてを返しうる', () => {
    expect(randomHand(() => 0)).toBe('rock')
    expect(randomHand(() => 0.5)).toBe('scissors')
    expect(randomHand(() => 0.99)).toBe('paper')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/janken.test.ts`
Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: 実装**

`src/logic/janken.ts`:
```ts
export type Hand = 'rock' | 'scissors' | 'paper'
export type JankenResult = 'win' | 'lose' | 'draw'

const HANDS: Hand[] = ['rock', 'scissors', 'paper']

const BEATS: Record<Hand, Hand> = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
}

export function beats(hand: Hand): Hand {
  return BEATS[hand]
}

export function judge(player: Hand, enemy: Hand): JankenResult {
  if (player === enemy) return 'draw'
  return BEATS[player] === enemy ? 'win' : 'lose'
}

export function randomHand(rand: () => number): Hand {
  return HANDS[Math.floor(rand() * HANDS.length)]
}

export function randomOtherHand(current: Hand, rand: () => number): Hand {
  const others = HANDS.filter((h) => h !== current)
  return others[Math.floor(rand() * others.length)]
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run tests/janken.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/logic/janken.ts tests/janken.test.ts
git commit -m "feat: じゃんけん勝敗判定ロジック"
```

---

### Task 3: レベル進行ロジック

**Files:**
- Create: `src/logic/level.ts`
- Test: `tests/level.test.ts`

**Interfaces:**
- Produces:
  - `WINS_PER_LEVEL = 3`
  - `interface LevelState { level: number; wins: number }`
  - `initialLevelState(): LevelState`（level 1, wins 0）
  - `addWin(s: LevelState): { state: LevelState; leveledUp: boolean }`

- [ ] **Step 1: 失敗するテストを書く**

`tests/level.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { initialLevelState, addWin, WINS_PER_LEVEL } from '../src/logic/level'

describe('level progression', () => {
  it('初期状態は LV1 / 0 勝', () => {
    expect(initialLevelState()).toEqual({ level: 1, wins: 0 })
  })

  it('3 勝未満では LVUP しない', () => {
    let { state, leveledUp } = addWin(initialLevelState())
    expect(state).toEqual({ level: 1, wins: 1 })
    expect(leveledUp).toBe(false)
  })

  it('3 勝で LVUP し勝利カウントがリセットされる', () => {
    let s = initialLevelState()
    let leveledUp = false
    for (let i = 0; i < WINS_PER_LEVEL; i++) {
      const r = addWin(s)
      s = r.state
      leveledUp = r.leveledUp
    }
    expect(s).toEqual({ level: 2, wins: 0 })
    expect(leveledUp).toBe(true)
  })

  it('元の state を破壊しない', () => {
    const s = initialLevelState()
    addWin(s)
    expect(s).toEqual({ level: 1, wins: 0 })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/level.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/logic/level.ts`:
```ts
export const WINS_PER_LEVEL = 3

export interface LevelState {
  level: number
  wins: number
}

export function initialLevelState(): LevelState {
  return { level: 1, wins: 0 }
}

export function addWin(s: LevelState): { state: LevelState; leveledUp: boolean } {
  const wins = s.wins + 1
  if (wins >= WINS_PER_LEVEL) {
    return { state: { level: s.level + 1, wins: 0 }, leveledUp: true }
  }
  return { state: { level: s.level, wins }, leveledUp: false }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run tests/level.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/logic/level.ts tests/level.test.ts
git commit -m "feat: レベル進行ロジック（3勝でLVUP）"
```

---

### Task 4: スコア計算ロジック

**Files:**
- Create: `src/logic/score.ts`
- Test: `tests/score.test.ts`

**Interfaces:**
- Produces:
  - `levelMultiplier(level: number): number`（LV1=1.0、+0.5/LV）
  - `BASE_RATE = 100`（1 秒あたりの基礎スコア）
  - `KILL_BONUS = 500`
  - `timeScore(dtSec: number, level: number): number`（dtSec 間の加算スコア = BASE_RATE × dtSec × 倍率）
  - `killBonus(level: number): number`（KILL_BONUS × 倍率）

- [ ] **Step 1: 失敗するテストを書く**

`tests/score.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { levelMultiplier, timeScore, killBonus, BASE_RATE, KILL_BONUS } from '../src/logic/score'

describe('levelMultiplier', () => {
  it('LV1 は 1.0、以降 +0.5', () => {
    expect(levelMultiplier(1)).toBe(1.0)
    expect(levelMultiplier(2)).toBe(1.5)
    expect(levelMultiplier(3)).toBe(2.0)
    expect(levelMultiplier(5)).toBe(3.0)
  })
})

describe('timeScore', () => {
  it('基礎レート × 経過秒 × 倍率', () => {
    expect(timeScore(1, 1)).toBe(BASE_RATE)
    expect(timeScore(2, 3)).toBe(BASE_RATE * 2 * 2.0)
    expect(timeScore(0.5, 1)).toBe(BASE_RATE * 0.5)
  })
})

describe('killBonus', () => {
  it('KILL_BONUS × 倍率', () => {
    expect(killBonus(1)).toBe(KILL_BONUS)
    expect(killBonus(3)).toBe(KILL_BONUS * 2.0)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/score.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/logic/score.ts`:
```ts
export const BASE_RATE = 100
export const KILL_BONUS = 500

export function levelMultiplier(level: number): number {
  return 1 + (level - 1) * 0.5
}

export function timeScore(dtSec: number, level: number): number {
  return BASE_RATE * dtSec * levelMultiplier(level)
}

export function killBonus(level: number): number {
  return KILL_BONUS * levelMultiplier(level)
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run tests/score.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/logic/score.ts tests/score.test.ts
git commit -m "feat: スコア計算ロジック（レベル倍率つき）"
```

---

### Task 5: 難易度カーブロジック

**Files:**
- Create: `src/logic/difficulty.ts`
- Test: `tests/difficulty.test.ts`

**Interfaces:**
- Produces:
  - `type BulletType = 'straight' | 'aimed' | 'curve'`
  - `interface DifficultyParams { bulletInterval: number; handInterval: number; speedMin: number; speedMax: number; bulletTypes: BulletType[] }`（interval は秒、speed は px/秒）
  - `difficultyFor(level: number, elapsedSec: number): DifficultyParams`

- [ ] **Step 1: 失敗するテストを書く**

`tests/difficulty.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { difficultyFor } from '../src/logic/difficulty'

describe('difficultyFor', () => {
  it('時間経過でスポーン間隔が短くなる', () => {
    const early = difficultyFor(1, 0)
    const late = difficultyFor(1, 120)
    expect(late.bulletInterval).toBeLessThan(early.bulletInterval)
    expect(late.handInterval).toBeLessThan(early.handInterval)
  })

  it('レベル上昇でも間隔が短くなり速度が上がる', () => {
    const lv1 = difficultyFor(1, 60)
    const lv5 = difficultyFor(5, 60)
    expect(lv5.bulletInterval).toBeLessThan(lv1.bulletInterval)
    expect(lv5.speedMax).toBeGreaterThan(lv1.speedMax)
  })

  it('スポーン間隔と速度に上下限がある', () => {
    const extreme = difficultyFor(100, 100000)
    expect(extreme.bulletInterval).toBeGreaterThanOrEqual(0.12)
    expect(extreme.handInterval).toBeGreaterThanOrEqual(0.5)
    expect(extreme.speedMax).toBeLessThanOrEqual(420)
  })

  it('弾種はレベルで解放される', () => {
    expect(difficultyFor(1, 0).bulletTypes).toEqual(['straight'])
    expect(difficultyFor(3, 0).bulletTypes).toEqual(['straight', 'aimed'])
    expect(difficultyFor(5, 0).bulletTypes).toEqual(['straight', 'aimed', 'curve'])
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/difficulty.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/logic/difficulty.ts`:
```ts
export type BulletType = 'straight' | 'aimed' | 'curve'

export interface DifficultyParams {
  bulletInterval: number
  handInterval: number
  speedMin: number
  speedMax: number
  bulletTypes: BulletType[]
}

export function difficultyFor(level: number, elapsedSec: number): DifficultyParams {
  // 時間とレベルの両方で 0→1 に近づく進行度
  const t = Math.min(1, elapsedSec / 180)
  const l = Math.min(1, (level - 1) / 9)
  const p = Math.min(1, t * 0.6 + l * 0.6)

  const bulletTypes: BulletType[] = ['straight']
  if (level >= 3) bulletTypes.push('aimed')
  if (level >= 5) bulletTypes.push('curve')

  return {
    bulletInterval: Math.max(0.12, 1.0 - 0.88 * p),
    handInterval: Math.max(0.5, 3.0 - 2.5 * p),
    speedMin: 80 + 100 * p,
    speedMax: Math.min(420, 160 + 260 * p),
    bulletTypes,
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run tests/difficulty.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/logic/difficulty.ts tests/difficulty.test.ts
git commit -m "feat: 難易度カーブ（時間・レベルでスポーン間隔/速度/弾種が変化）"
```

---

### Task 6: ハイスコアストレージ

**Files:**
- Create: `src/storage.ts`
- Test: `tests/storage.test.ts`

**Interfaces:**
- Produces:
  - `HIGHSCORE_KEY = 'janken-dodge-highscore'`
  - `type ScoreStore = Pick<Storage, 'getItem' | 'setItem'>`
  - `loadHighScore(store: ScoreStore): number`（未保存・不正値は 0）
  - `saveHighScoreIfHigher(store: ScoreStore, score: number): boolean`（更新したら true）

- [ ] **Step 1: 失敗するテストを書く**

`tests/storage.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { loadHighScore, saveHighScoreIfHigher, HIGHSCORE_KEY, type ScoreStore } from '../src/storage'

function memoryStore(initial: Record<string, string> = {}): ScoreStore & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v },
  }
}

describe('loadHighScore', () => {
  it('未保存なら 0', () => {
    expect(loadHighScore(memoryStore())).toBe(0)
  })
  it('保存済みの値を返す', () => {
    expect(loadHighScore(memoryStore({ [HIGHSCORE_KEY]: '1234' }))).toBe(1234)
  })
  it('不正値は 0', () => {
    expect(loadHighScore(memoryStore({ [HIGHSCORE_KEY]: 'abc' }))).toBe(0)
  })
})

describe('saveHighScoreIfHigher', () => {
  it('ハイスコアを上回れば保存して true', () => {
    const store = memoryStore({ [HIGHSCORE_KEY]: '100' })
    expect(saveHighScoreIfHigher(store, 200)).toBe(true)
    expect(store.data[HIGHSCORE_KEY]).toBe('200')
  })
  it('下回れば保存せず false', () => {
    const store = memoryStore({ [HIGHSCORE_KEY]: '100' })
    expect(saveHighScoreIfHigher(store, 50)).toBe(false)
    expect(store.data[HIGHSCORE_KEY]).toBe('100')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/storage.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/storage.ts`:
```ts
export const HIGHSCORE_KEY = 'janken-dodge-highscore'

export type ScoreStore = Pick<Storage, 'getItem' | 'setItem'>

export function loadHighScore(store: ScoreStore): number {
  const raw = store.getItem(HIGHSCORE_KEY)
  const n = raw === null ? NaN : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function saveHighScoreIfHigher(store: ScoreStore, score: number): boolean {
  if (score <= loadHighScore(store)) return false
  store.setItem(HIGHSCORE_KEY, String(Math.floor(score)))
  return true
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run tests/storage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/storage.ts tests/storage.test.ts
git commit -m "feat: localStorage ハイスコア保存"
```

---

### Task 7: 入力・アセット・オーディオ基盤

**Files:**
- Create: `src/input.ts`, `src/assets.ts`, `src/audio.ts`

**Interfaces:**
- Produces:
  - `class Input { readonly dx: number; readonly dy: number; consumeConfirm(): boolean; attach(): void }`（dx/dy は -1〜1 の移動方向。矢印キー＋WASD。confirm は Enter/Space の押下エッジ）
  - `type SpriteName = 'player-rock' | 'player-scissors' | 'player-paper' | 'enemy-rock' | 'enemy-scissors' | 'enemy-paper' | 'bullet' | 'background'`
  - `loadAssets(): Promise<Assets>` / `class Assets { draw(ctx, name: SpriteName, x, y, size): void }`（画像未ロード時は絵文字フォールバック描画）
  - `class Sound { kill(): void; levelUp(): void; gameOver(): void; startBgm(): void; stopBgm(): void }`（Web Audio 合成。AudioContext はユーザー操作後に生成）

- [ ] **Step 1: input.ts 実装**

`src/input.ts`:
```ts
export class Input {
  private pressed = new Set<string>()
  private confirmEdge = false

  attach(): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      this.pressed.add(e.code)
      if (e.code === 'Enter' || e.code === 'Space') this.confirmEdge = true
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
    })
    window.addEventListener('keyup', (e) => this.pressed.delete(e.code))
    window.addEventListener('blur', () => this.pressed.clear())
  }

  get dx(): number {
    let v = 0
    if (this.pressed.has('ArrowLeft') || this.pressed.has('KeyA')) v -= 1
    if (this.pressed.has('ArrowRight') || this.pressed.has('KeyD')) v += 1
    return v
  }

  get dy(): number {
    let v = 0
    if (this.pressed.has('ArrowUp') || this.pressed.has('KeyW')) v -= 1
    if (this.pressed.has('ArrowDown') || this.pressed.has('KeyS')) v += 1
    return v
  }

  consumeConfirm(): boolean {
    const v = this.confirmEdge
    this.confirmEdge = false
    return v
  }
}
```

- [ ] **Step 2: assets.ts 実装（絵文字フォールバックつき）**

`src/assets.ts`:
```ts
export type SpriteName =
  | 'player-rock' | 'player-scissors' | 'player-paper'
  | 'enemy-rock' | 'enemy-scissors' | 'enemy-paper'
  | 'bullet' | 'background'

const FALLBACK_EMOJI: Record<SpriteName, string> = {
  'player-rock': '✊', 'player-scissors': '✌️', 'player-paper': '✋',
  'enemy-rock': '✊', 'enemy-scissors': '✌️', 'enemy-paper': '✋',
  bullet: '💢', background: '',
}

export class Assets {
  constructor(private images: Partial<Record<SpriteName, HTMLImageElement>>) {}

  draw(ctx: CanvasRenderingContext2D, name: SpriteName, x: number, y: number, size: number): void {
    const img = this.images[name]
    if (img) {
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size)
      return
    }
    // フォールバック: 敵は赤円、味方は青円の上に絵文字
    if (name !== 'background') {
      ctx.fillStyle = name.startsWith('enemy') ? '#c0392b' : name === 'bullet' ? '#8e44ad' : '#2980b9'
      ctx.beginPath()
      ctx.arc(x, y, size / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = `${size * 0.6}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(FALLBACK_EMOJI[name], x, y)
    }
  }

  drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const img = this.images.background
    if (img) {
      ctx.drawImage(img, 0, 0, w, h)
    } else {
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, w, h)
    }
  }
}

const NAMES: SpriteName[] = [
  'player-rock', 'player-scissors', 'player-paper',
  'enemy-rock', 'enemy-scissors', 'enemy-paper',
  'bullet', 'background',
]

function loadImage(name: SpriteName): Promise<[SpriteName, HTMLImageElement | undefined]> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve([name, img])
    img.onerror = () => resolve([name, undefined])
    img.src = `${import.meta.env.BASE_URL}assets/${name}.png`
  })
}

export async function loadAssets(): Promise<Assets> {
  const entries = await Promise.all(NAMES.map(loadImage))
  const images: Partial<Record<SpriteName, HTMLImageElement>> = {}
  for (const [name, img] of entries) if (img) images[name] = img
  return new Assets(images)
}
```

- [ ] **Step 3: audio.ts 実装**

`src/audio.ts`:
```ts
export class Sound {
  private ctx: AudioContext | null = null
  private bgmTimer: number | null = null

  private ensure(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private beep(freq: number, durSec: number, type: OscillatorType = 'square', gainVal = 0.08, when = 0): void {
    const ctx = this.ensure()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(gainVal, ctx.currentTime + when)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + durSec)
    osc.connect(gain).connect(ctx.destination)
    osc.start(ctx.currentTime + when)
    osc.stop(ctx.currentTime + when + durSec)
  }

  kill(): void {
    this.beep(660, 0.08)
    this.beep(990, 0.12, 'square', 0.08, 0.06)
  }

  levelUp(): void {
    ;[523, 659, 784, 1047].forEach((f, i) => this.beep(f, 0.12, 'triangle', 0.1, i * 0.09))
  }

  gameOver(): void {
    ;[440, 349, 262, 196].forEach((f, i) => this.beep(f, 0.25, 'sawtooth', 0.08, i * 0.18))
  }

  startBgm(): void {
    if (this.bgmTimer !== null) return
    const notes = [262, 330, 392, 330, 294, 370, 440, 370]
    let i = 0
    const step = () => {
      this.beep(notes[i % notes.length], 0.18, 'triangle', 0.03)
      i++
    }
    step()
    this.bgmTimer = window.setInterval(step, 220)
  }

  stopBgm(): void {
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer)
      this.bgmTimer = null
    }
  }
}
```

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: 型エラーなし

- [ ] **Step 5: Commit**

```bash
git add src/input.ts src/assets.ts src/audio.ts
git commit -m "feat: 入力・アセットロード・Web Audio サウンド基盤"
```

---

### Task 8: エンティティ（Player / Bullet / JankenHand / Particle）

**Files:**
- Create: `src/entities/player.ts`, `src/entities/bullet.ts`, `src/entities/hand.ts`, `src/entities/particle.ts`
- Test: `tests/entities.test.ts`

**Interfaces:**
- Consumes: `Hand`（janken.ts）、`BulletType`（difficulty.ts）、`Assets`/`SpriteName`（assets.ts）、`Input`（input.ts）
- Produces:
  - `class Player { x; y; radius: 24; hand: Hand; update(input: Input, dtSec: number): void; draw(ctx, assets): void }`（速度 320px/秒、960×720 内にクランプ、斜め移動は正規化）
  - `class Bullet { x; y; radius: 10; alive: boolean; update(dtSec, player: {x,y}): void; draw(ctx, assets): void; isOffscreen(): boolean }` / `spawnBullet(type: BulletType, x, y, angle, speed): Bullet`
  - `class JankenHand { x; y; radius: 28; hand: Hand; alive: boolean; update(dtSec): void; draw(ctx, assets): void; isOffscreen(): boolean }`
  - `class Particle { alive: boolean; update(dtSec): void; draw(ctx): void }` / `burstParticles(x, y, color, count): Particle[]`
  - `collides(a: {x,y,radius}, b: {x,y,radius}): boolean`（円判定、`src/entities/collision.ts` に置く）

- [ ] **Step 1: 衝突判定の失敗するテストを書く**

`tests/entities.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { collides } from '../src/entities/collision'

describe('collides', () => {
  it('半径の和より近ければ衝突', () => {
    expect(collides({ x: 0, y: 0, radius: 10 }, { x: 15, y: 0, radius: 10 })).toBe(true)
  })
  it('半径の和より遠ければ非衝突', () => {
    expect(collides({ x: 0, y: 0, radius: 10 }, { x: 25, y: 0, radius: 10 })).toBe(false)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/entities.test.ts`
Expected: FAIL

- [ ] **Step 3: collision.ts 実装**

`src/entities/collision.ts`:
```ts
export interface Circle {
  x: number
  y: number
  radius: number
}

export function collides(a: Circle, b: Circle): boolean {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const r = a.radius + b.radius
  return dx * dx + dy * dy < r * r
}
```

Run: `npx vitest run tests/entities.test.ts` → PASS を確認

- [ ] **Step 4: player.ts 実装**

`src/entities/player.ts`:
```ts
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
```

- [ ] **Step 5: bullet.ts 実装**

`src/entities/bullet.ts`:
```ts
import type { BulletType } from '../logic/difficulty'
import type { Assets } from '../assets'
import { FIELD_W, FIELD_H } from './player'

const MARGIN = 60

export class Bullet {
  alive = true
  readonly radius = 10
  private ageSec = 0

  constructor(
    public x: number,
    public y: number,
    private vx: number,
    private vy: number,
    private type: BulletType,
  ) {}

  update(dtSec: number, player: { x: number; y: number }): void {
    this.ageSec += dtSec
    if (this.type === 'aimed' && this.ageSec < 0.6) {
      // 発射直後だけ緩く追尾し、その後は直進
      const speed = Math.hypot(this.vx, this.vy)
      const ang = Math.atan2(player.y - this.y, player.x - this.x)
      const cur = Math.atan2(this.vy, this.vx)
      const turn = 2.5 * dtSec
      const diff = Math.atan2(Math.sin(ang - cur), Math.cos(ang - cur))
      const next = cur + Math.max(-turn, Math.min(turn, diff))
      this.vx = Math.cos(next) * speed
      this.vy = Math.sin(next) * speed
    } else if (this.type === 'curve') {
      const ang = 1.8 * dtSec
      const { vx, vy } = this
      this.vx = vx * Math.cos(ang) - vy * Math.sin(ang)
      this.vy = vx * Math.sin(ang) + vy * Math.cos(ang)
    }
    this.x += this.vx * dtSec
    this.y += this.vy * dtSec
  }

  isOffscreen(): boolean {
    return this.x < -MARGIN || this.x > FIELD_W + MARGIN || this.y < -MARGIN || this.y > FIELD_H + MARGIN
  }

  draw(ctx: CanvasRenderingContext2D, assets: Assets): void {
    assets.draw(ctx, 'bullet', this.x, this.y, this.radius * 2.6)
  }
}

export function spawnBullet(type: BulletType, x: number, y: number, angle: number, speed: number): Bullet {
  return new Bullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, type)
}
```

- [ ] **Step 6: hand.ts 実装**

`src/entities/hand.ts`:
```ts
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
```

- [ ] **Step 7: particle.ts 実装**

`src/entities/particle.ts`:
```ts
export class Particle {
  alive = true
  private lifeSec: number

  constructor(
    private x: number,
    private y: number,
    private vx: number,
    private vy: number,
    private color: string,
    private maxLifeSec = 0.5,
  ) {
    this.lifeSec = maxLifeSec
  }

  update(dtSec: number): void {
    this.lifeSec -= dtSec
    if (this.lifeSec <= 0) {
      this.alive = false
      return
    }
    this.x += this.vx * dtSec
    this.y += this.vy * dtSec
    this.vx *= 0.95
    this.vy *= 0.95
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = Math.max(0, this.lifeSec / this.maxLifeSec)
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

export function burstParticles(x: number, y: number, color: string, count = 16): Particle[] {
  const out: Particle[] = []
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4
    const speed = 120 + Math.random() * 180
    out.push(new Particle(x, y, Math.cos(ang) * speed, Math.sin(ang) * speed, color))
  }
  return out
}
```

- [ ] **Step 8: 全テスト＋ビルド確認**

Run: `npm test && npm run build`
Expected: 全 PASS、型エラーなし

- [ ] **Step 9: Commit**

```bash
git add src/entities tests/entities.test.ts
git commit -m "feat: ゲームエンティティ（Player/Bullet/JankenHand/Particle/衝突判定）"
```

---

### Task 9: シーン基盤・タイトル・GAMEOVER

**Files:**
- Create: `src/game.ts`, `src/scenes/title.ts`, `src/scenes/gameover.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `Input`, `Assets`, `Sound`, `loadHighScore`/`saveHighScoreIfHigher`
- Produces:
  - `interface Scene { update(dtSec: number): Scene | null; draw(ctx: CanvasRenderingContext2D): void }`（update が別 Scene を返したら遷移、null は継続）
  - `interface GameContext { input: Input; assets: Assets; sound: Sound; storage: ScoreStore }`
  - `class Game { start(): void }`（rAF ループ。dt は 1/30 秒で上限クランプ）
  - `class TitleScene implements Scene`、`class GameOverScene implements Scene`（constructor に `score: number`, `level: number` を受ける）
  - PlayScene はこのタスクでは仮実装（Enter で GameOverScene(0, 1) に遷移する程度）を `src/scenes/play.ts` に置き、Task 10 で本実装に差し替える

- [ ] **Step 1: game.ts 実装**

`src/game.ts`:
```ts
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
```

- [ ] **Step 2: title.ts 実装**

`src/scenes/title.ts`:
```ts
import type { Scene, GameContext } from '../game'
import { loadHighScore } from '../storage'
import { PlayScene } from './play'
import { FIELD_W, FIELD_H } from '../entities/player'

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
    this.g.assets.drawBackground(ctx, FIELD_W, FIELD_H)
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
  }
}
```

- [ ] **Step 3: gameover.ts 実装**

`src/scenes/gameover.ts`:
```ts
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
    if (this.g.input.consumeConfirm()) {
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
```

- [ ] **Step 4: play.ts 仮実装**

`src/scenes/play.ts`（Task 10 で本実装に差し替える）:
```ts
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
```

- [ ] **Step 5: main.ts を差し替え**

`src/main.ts`:
```ts
import { Game } from './game'
import { TitleScene } from './scenes/title'
import { Input } from './input'
import { loadAssets } from './assets'
import { Sound } from './audio'

async function main(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!
  const input = new Input()
  input.attach()
  const assets = await loadAssets()
  const g = { input, assets, sound: new Sound(), storage: localStorage }
  new Game(ctx, new TitleScene(g)).start()
}

void main()
```

- [ ] **Step 6: 手動確認**

Run: `npm run dev` してブラウザで確認
Expected: タイトル → Enter → 仮プレイ → Enter → GAMEOVER → Enter → 仮プレイ、と遷移する。`npm run build` も通る。

- [ ] **Step 7: Commit**

```bash
git add src/game.ts src/scenes src/main.ts
git commit -m "feat: シーン基盤とタイトル/GAMEOVER画面"
```

---

### Task 10: プレイシーン本実装（ゲームコア）

**Files:**
- Modify: `src/scenes/play.ts`（全面差し替え）

**Interfaces:**
- Consumes: Task 2〜8 の全モジュール
- Produces: 完全なゲームプレイ。`PlayScene` のコンストラクタシグネチャは Task 9 と同じ `new PlayScene(g: GameContext)`

- [ ] **Step 1: play.ts 本実装**

`src/scenes/play.ts`:
```ts
import type { Scene, GameContext } from '../game'
import { GameOverScene } from './gameover'
import { Player, FIELD_W, FIELD_H } from '../entities/player'
import { Bullet, spawnBullet } from '../entities/bullet'
import { JankenHand } from '../entities/hand'
import { Particle, burstParticles } from '../entities/particle'
import { collides } from '../entities/collision'
import { judge, beats, randomHand, randomOtherHand, type Hand } from '../logic/janken'
import { initialLevelState, addWin, WINS_PER_LEVEL, type LevelState } from '../logic/level'
import { timeScore, killBonus, levelMultiplier } from '../logic/score'
import { difficultyFor } from '../logic/difficulty'
import { saveHighScoreIfHigher } from '../storage'

const HAND_LABEL: Record<Hand, string> = { rock: 'グー', scissors: 'チョキ', paper: 'パー' }

export class PlayScene implements Scene {
  private player: Player
  private bullets: Bullet[] = []
  private hands: JankenHand[] = []
  private particles: Particle[] = []
  private levelState: LevelState = initialLevelState()
  private score = 0
  private elapsedSec = 0
  private bulletTimer = 0
  private handTimer = 0
  private flashSec = 0
  private shakeSec = 0
  private morphSec = 0

  constructor(private g: GameContext) {
    this.player = new Player(randomHand(Math.random))
  }

  update(dtSec: number): Scene | null {
    this.elapsedSec += dtSec
    this.score += timeScore(dtSec, this.levelState.level)
    this.flashSec = Math.max(0, this.flashSec - dtSec)
    this.shakeSec = Math.max(0, this.shakeSec - dtSec)
    this.morphSec = Math.max(0, this.morphSec - dtSec)

    this.player.update(this.g.input, dtSec)
    this.spawn(dtSec)

    for (const b of this.bullets) b.update(dtSec, this.player)
    for (const h of this.hands) h.update(dtSec)
    for (const p of this.particles) p.update(dtSec)

    // 弾との衝突 → 即 GAMEOVER
    for (const b of this.bullets) {
      if (b.alive && collides(b, this.player)) return this.gameOver()
    }

    // 手との衝突 → じゃんけん判定
    for (const h of this.hands) {
      if (!h.alive || !collides(h, this.player)) continue
      const result = judge(this.player.hand, h.hand)
      if (result !== 'win') return this.gameOver()
      h.alive = false
      this.score += killBonus(this.levelState.level)
      this.particles.push(...burstParticles(h.x, h.y, '#f1c40f'))
      this.g.sound.kill()
      const { state, leveledUp } = addWin(this.levelState)
      this.levelState = state
      if (leveledUp) this.levelUp()
    }

    this.bullets = this.bullets.filter((b) => b.alive && !b.isOffscreen())
    this.hands = this.hands.filter((h) => h.alive && !h.isOffscreen())
    this.particles = this.particles.filter((p) => p.alive)
    return null
  }

  private levelUp(): void {
    this.player.hand = randomOtherHand(this.player.hand, Math.random)
    this.flashSec = 0.35
    this.morphSec = 0.6
    this.g.sound.levelUp()
    this.particles.push(...burstParticles(this.player.x, this.player.y, '#3498db', 24))
  }

  private gameOver(): Scene {
    this.g.sound.stopBgm()
    this.g.sound.gameOver()
    const finalScore = Math.floor(this.score)
    const isNewRecord = saveHighScoreIfHigher(this.g.storage, finalScore)
    return new GameOverScene(this.g, finalScore, this.levelState.level, isNewRecord)
  }

  /** 画面外周のランダム地点と、そこからフィールド中央付近へ向かう角度を返す */
  private edgeSpawn(): { x: number; y: number; angle: number } {
    const side = Math.floor(Math.random() * 4)
    const m = 40
    let x: number, y: number
    if (side === 0) { x = Math.random() * FIELD_W; y = -m }
    else if (side === 1) { x = Math.random() * FIELD_W; y = FIELD_H + m }
    else if (side === 2) { x = -m; y = Math.random() * FIELD_H }
    else { x = FIELD_W + m; y = Math.random() * FIELD_H }
    const tx = FIELD_W * (0.25 + Math.random() * 0.5)
    const ty = FIELD_H * (0.25 + Math.random() * 0.5)
    return { x, y, angle: Math.atan2(ty - y, tx - x) }
  }

  private spawn(dtSec: number): void {
    const d = difficultyFor(this.levelState.level, this.elapsedSec)
    this.bulletTimer -= dtSec
    this.handTimer -= dtSec

    if (this.bulletTimer <= 0) {
      this.bulletTimer = d.bulletInterval
      const { x, y, angle } = this.edgeSpawn()
      const type = d.bulletTypes[Math.floor(Math.random() * d.bulletTypes.length)]
      const speed = d.speedMin + Math.random() * (d.speedMax - d.speedMin)
      this.bullets.push(spawnBullet(type, x, y, angle, speed))
    }

    if (this.handTimer <= 0) {
      this.handTimer = d.handInterval
      const { x, y, angle } = this.edgeSpawn()
      const speed = (d.speedMin + Math.random() * (d.speedMax - d.speedMin)) * 0.7
      this.hands.push(new JankenHand(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, randomHand(Math.random)))
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    if (this.shakeSec > 0) {
      ctx.translate((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12)
    }
    this.g.assets.drawBackground(ctx, FIELD_W, FIELD_H)

    for (const h of this.hands) h.draw(ctx, this.g.assets)
    for (const b of this.bullets) b.draw(ctx, this.g.assets)

    // 形態変化アニメ: 点滅
    if (this.morphSec <= 0 || Math.floor(this.morphSec * 12) % 2 === 0) {
      this.player.draw(ctx, this.g.assets)
    }
    for (const p of this.particles) p.draw(ctx)

    if (this.flashSec > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flashSec / 0.35 * 0.6})`
      ctx.fillRect(0, 0, FIELD_W, FIELD_H)
    }

    this.drawHud(ctx)
    ctx.restore()
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'left'
    ctx.font = 'bold 24px sans-serif'
    ctx.fillText(`SCORE ${Math.floor(this.score)}`, 16, 34)
    ctx.font = '18px sans-serif'
    ctx.fillText(`LV ${this.levelState.level} (×${levelMultiplier(this.levelState.level).toFixed(1)})`, 16, 62)
    ctx.fillText(`勝利 ${this.levelState.wins}/${WINS_PER_LEVEL}`, 16, 86)

    ctx.textAlign = 'right'
    ctx.font = 'bold 20px sans-serif'
    ctx.fillText(`自分: ${HAND_LABEL[this.player.hand]}`, FIELD_W - 16, 34)
    ctx.fillStyle = '#2ecc71'
    ctx.fillText(`倒せる手: ${HAND_LABEL[beats(this.player.hand)]}`, FIELD_W - 16, 62)
  }
}
```

- [ ] **Step 2: テスト＋ビルド確認**

Run: `npm test && npm run build`
Expected: 全 PASS、型エラーなし

- [ ] **Step 3: 手動プレイ確認**

Run: `npm run dev`
確認項目:
- 移動・弾のスポーン・手のスポーンが動く
- 勝てる手に触れると倒せて勝利カウントが増える
- 3 勝で LVUP（フラッシュ＋形態変化＋倍率表示更新）
- あいこ/負けの手・弾で GAMEOVER になりスコアが表示される
- ハイスコアがリトライ後のタイトル/GAMEOVER に反映される

- [ ] **Step 4: Commit**

```bash
git add src/scenes/play.ts
git commit -m "feat: プレイシーン本実装（スポーン・衝突・じゃんけん・LVUP・HUD・演出）"
```

---

### Task 11: GitHub Pages デプロイ・README

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**
- Consumes: `npm run build`（Task 1）
- Produces: main への push で GitHub Pages に自動デプロイされるワークフロー

- [ ] **Step 1: ワークフロー作成**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: README 作成**

`README.md`:
```markdown
# じゃんけん弾除け

グー・チョキ・パーの形態を持つプレイヤーが、飛来する弾とじゃんけんの手を避け（時に倒し）ながらスコアを稼ぐ PC ブラウザ向け弾除けゲーム。

## 遊び方

- 矢印キー / WASD で移動
- 弾に当たると GAME OVER
- じゃんけんの手は、自分が**勝てる手**なら体当たりで倒せる（あいこ・負けは GAME OVER）
- 3 回勝つと LVUP。形態がランダムに変わり、スコア倍率が上がる

## 開発

```bash
npm install
npm run dev    # 開発サーバー
npm test       # ユニットテスト
npm run build  # ビルド
```

main ブランチへの push で GitHub Actions が GitHub Pages に自動デプロイする。
```

- [ ] **Step 3: Commit**

```bash
git add .github README.md
git commit -m "chore: GitHub Pages デプロイワークフローと README"
```

- [ ] **Step 4: リポジトリ公開（ユーザー確認後）**

GitHub にリポジトリを作成して push（リポジトリ名・公開設定はユーザーに確認）。その後、リポジトリの Settings → Pages で Source を「GitHub Actions」に設定。

```bash
gh repo create janken --public --source=. --push
```

---

### Task 12: 生成画像の組み込み確認

**Files:**
- Modify: なし（`public/assets/*.png` は Codex サブエージェントが並行生成）

**Interfaces:**
- Consumes: `loadAssets()`（Task 7）が `public/assets/{player,enemy}-{rock,scissors,paper}.png`, `bullet.png`, `background.png` を自動ロード

- [ ] **Step 1: 画像ファイルの存在確認**

Run: `ls -la public/assets/`
Expected: 8 ファイル（player×3, enemy×3, bullet, background）。未生成ならこのタスクを保留し、絵文字フォールバックのまま進める。

- [ ] **Step 2: 手動で見た目確認**

Run: `npm run dev`
確認項目:
- 各スプライトが表示され、グー・チョキ・パーが一瞬で判別できる
- プレイヤーと敵の手が明確に区別できる
- 背景がプレイヤー・弾の視認性を妨げない
- 問題があれば Codex に再生成を依頼

- [ ] **Step 3: Commit**

```bash
git add public/assets
git commit -m "feat: ドット絵ゲーム素材を追加"
```
