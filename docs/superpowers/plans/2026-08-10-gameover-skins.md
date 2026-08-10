# ハイスコア連動きせかえ(スキン)実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハイスコアで解放されるスキンをゲームオーバー画面の ←→ で選択でき、次のプレイから自機スプライトに反映される。

**Architecture:** スキン定義は純粋ロジック `src/logic/skins.ts` に置き、選択の永続化は `src/storage.ts`、スプライト名解決は `src/assets.ts` に閉じ込める。シーン側(gameover/play)はそれらを呼ぶだけ。当たり判定・スコアなどのゲームロジックは一切変更しない。

**Tech Stack:** TypeScript + Vite、テストは vitest(`npm test`)。Canvas 2D、フレームワーク不使用。

**Spec:** `docs/superpowers/specs/2026-08-10-gameover-skins-design.md`

## Global Constraints

- 解放判定は保存済みハイスコアのみ参照(しきい値: cyber 15,000 / mage 30,000 / forest 45,000 / samurai 60,000 / maid 75,000。default は 0 で常時解放)
- 巡回順は default → cyber → mage → forest → samurai → maid(未解放も巡回に含める)
- 保存・適用されるのは解放済みスキンのみ。未解放選択中のリトライは直前の保存値を維持
- コミットは main に直接(この repo の方針)。push はしない
- テスト実行: `npm test`(全体) / `npx vitest run tests/<file>.ts`(単体)

---

### Task 1: スキン定義ロジック `src/logic/skins.ts`

**Files:**
- Create: `src/logic/skins.ts`
- Test: `tests/skins.test.ts`

**Interfaces:**
- Produces: `type SkinId`、`SKINS: readonly { id: SkinId; label: string; unlockScore: number }[]`、`isSkinId(v: unknown): v is SkinId`、`isUnlocked(id: SkinId, highScore: number): boolean`、`unlockScoreOf(id: SkinId): number`、`nextSkin(current: SkinId, dir: 1 | -1): SkinId`

- [ ] **Step 1: 失敗するテストを書く** — `tests/skins.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { SKINS, isSkinId, isUnlocked, unlockScoreOf, nextSkin } from '../src/logic/skins'

describe('SKINS テーブル', () => {
  it('巡回順どおり6スキンが定義されている', () => {
    expect(SKINS.map((s) => s.id)).toEqual(['default', 'cyber', 'mage', 'forest', 'samurai', 'maid'])
  })
  it('解放スコアが仕様どおり', () => {
    expect(SKINS.map((s) => s.unlockScore)).toEqual([0, 15000, 30000, 45000, 60000, 75000])
  })
})

describe('isSkinId', () => {
  it('定義済み ID は true', () => {
    expect(isSkinId('maid')).toBe(true)
  })
  it('未知の文字列・非文字列は false', () => {
    expect(isSkinId('ninja')).toBe(false)
    expect(isSkinId(42)).toBe(false)
    expect(isSkinId(null)).toBe(false)
  })
})

describe('isUnlocked', () => {
  it('default はハイスコア 0 でも解放済み', () => {
    expect(isUnlocked('default', 0)).toBe(true)
  })
  it('しきい値ちょうどで解放される(境界値)', () => {
    expect(isUnlocked('cyber', 14999)).toBe(false)
    expect(isUnlocked('cyber', 15000)).toBe(true)
  })
  it('最上位スキンの境界値', () => {
    expect(isUnlocked('maid', 74999)).toBe(false)
    expect(isUnlocked('maid', 75000)).toBe(true)
  })
})

describe('unlockScoreOf', () => {
  it('ID から解放スコアを引ける', () => {
    expect(unlockScoreOf('forest')).toBe(45000)
  })
})

describe('nextSkin', () => {
  it('右方向で次のスキンに進む(未解放も含めて巡回)', () => {
    expect(nextSkin('default', 1)).toBe('cyber')
  })
  it('末尾から右でラップして先頭に戻る', () => {
    expect(nextSkin('maid', 1)).toBe('default')
  })
  it('先頭から左でラップして末尾に行く', () => {
    expect(nextSkin('default', -1)).toBe('maid')
  })
  it('左方向で前のスキンに戻る', () => {
    expect(nextSkin('mage', -1)).toBe('cyber')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/skins.test.ts`
Expected: FAIL(`src/logic/skins.ts` が存在しないため import エラー)

- [ ] **Step 3: 実装** — `src/logic/skins.ts`

```ts
/** きせかえスキン定義。解放判定は保存済みハイスコアのみを参照する(純粋ロジック、DOM/Canvas 非依存)。
 *  配列順 = ゲームオーバー画面での ←→ 巡回順。 */
export const SKINS = [
  { id: 'default', label: 'DEFAULT', unlockScore: 0 },
  { id: 'cyber', label: 'CYBER', unlockScore: 15000 },
  { id: 'mage', label: 'MAGE', unlockScore: 30000 },
  { id: 'forest', label: 'FOREST', unlockScore: 45000 },
  { id: 'samurai', label: 'SAMURAI', unlockScore: 60000 },
  { id: 'maid', label: 'MAID', unlockScore: 75000 },
] as const

export type SkinId = (typeof SKINS)[number]['id']

export function isSkinId(v: unknown): v is SkinId {
  return typeof v === 'string' && SKINS.some((s) => s.id === v)
}

export function unlockScoreOf(id: SkinId): number {
  return SKINS.find((s) => s.id === id)!.unlockScore
}

export function isUnlocked(id: SkinId, highScore: number): boolean {
  return highScore >= unlockScoreOf(id)
}

/** 全スキンを巡回する(未解放も含める — シルエット表示でモチベーションにするため)。 */
export function nextSkin(current: SkinId, dir: 1 | -1): SkinId {
  const i = SKINS.findIndex((s) => s.id === current)
  return SKINS[(i + dir + SKINS.length) % SKINS.length].id
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run tests/skins.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
git add src/logic/skins.ts tests/skins.test.ts
git commit -m "feat: スキン定義と解放判定・巡回ロジックを追加"
```

---

### Task 2: スキン選択の永続化(`src/storage.ts`)

**Files:**
- Modify: `src/storage.ts`
- Test: `tests/storage.test.ts`(describe を追記)

**Interfaces:**
- Consumes: Task 1 の `SkinId`, `isSkinId`, `isUnlocked`
- Produces: `SKIN_KEY = 'janken-dodge-skin'`、`loadSkin(store: ScoreStore, highScore: number): SkinId`、`saveSkin(store: ScoreStore, id: SkinId): void`

- [ ] **Step 1: 失敗するテストを書く** — `tests/storage.test.ts` の末尾に追記(既存の `memoryStore` ヘルパーを再利用)

```ts
import { loadSkin, saveSkin, SKIN_KEY } from '../src/storage'

describe('loadSkin', () => {
  it('未保存なら default', () => {
    expect(loadSkin(memoryStore(), 100000)).toBe('default')
  })
  it('保存済みかつ解放済みならその値', () => {
    expect(loadSkin(memoryStore({ [SKIN_KEY]: 'cyber' }), 15000)).toBe('cyber')
  })
  it('保存済みでも未解放(ハイスコア不足)なら default にフォールバック', () => {
    expect(loadSkin(memoryStore({ [SKIN_KEY]: 'maid' }), 74999)).toBe('default')
  })
  it('不正な ID は default にフォールバック', () => {
    expect(loadSkin(memoryStore({ [SKIN_KEY]: 'ninja' }), 100000)).toBe('default')
  })
})

describe('saveSkin', () => {
  it('スキン ID を保存する', () => {
    const store = memoryStore()
    saveSkin(store, 'forest')
    expect(store.data[SKIN_KEY]).toBe('forest')
  })
})
```

(import は既存の import 文にまとめる: `import { loadHighScore, saveHighScoreIfHigher, loadSkin, saveSkin, HIGHSCORE_KEY, SKIN_KEY, type ScoreStore } from '../src/storage'`)

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run tests/storage.test.ts`
Expected: FAIL(`loadSkin` 未定義)

- [ ] **Step 3: 実装** — `src/storage.ts` に追記

```ts
import { isSkinId, isUnlocked, type SkinId } from './logic/skins'

export const SKIN_KEY = 'janken-dodge-skin'

/** 保存値が不正 ID・未解放スキンのときは 'default' にフォールバックする。
 *  highScore には loadHighScore() の値を渡すこと。 */
export function loadSkin(store: ScoreStore, highScore: number): SkinId {
  const raw = store.getItem(SKIN_KEY)
  if (raw !== null && isSkinId(raw) && isUnlocked(raw, highScore)) return raw
  return 'default'
}

/** 呼び出し側で解放済みスキンのみを渡すこと(未解放は保存しない仕様)。 */
export function saveSkin(store: ScoreStore, id: SkinId): void {
  store.setItem(SKIN_KEY, id)
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run tests/storage.test.ts`
Expected: PASS(既存含む全件)

- [ ] **Step 5: コミット**

```bash
git add src/storage.ts tests/storage.test.ts
git commit -m "feat: スキン選択の永続化(未解放・不正値は default にフォールバック)"
```

---

### Task 3: スキン画像アセットとスプライト名解決(`src/assets.ts`)

**Files:**
- Create: `public/assets/player-{cyber,mage,forest,samurai,maid}-{rock,scissors,paper}.png`(15枚コピー)
- Modify: `src/assets.ts`
- Test: `tests/skins.test.ts`(describe を追記)

**Interfaces:**
- Consumes: Task 1 の `SkinId`
- Produces: `playerSprite(skin: SkinId, hand: Hand): SpriteName`(default → `player-${hand}`、それ以外 → `player-${skin}-${hand}`)。`SpriteName` 型がスキン付き15名を含むよう拡張される。

- [ ] **Step 1: 画像を public/assets へコピー**

```bash
cd /Users/fukasedaichi/git/janken
for skin in "02-cyber:cyber" "03-mage:mage" "04-forest:forest" "05-samurai:samurai" "01-maid:maid"; do
  src="${skin%%:*}"; dst="${skin##*:}"
  for hand in rock scissors paper; do
    cp "output/imagegen/revised/${src}-${hand}.png" "public/assets/player-${dst}-${hand}.png"
  done
done
ls public/assets/ | grep player | wc -l   # 18 (既存3 + 新規15)
```

- [ ] **Step 2: 失敗するテストを書く** — `tests/skins.test.ts` に追記

```ts
import { playerSprite } from '../src/assets'

describe('playerSprite', () => {
  it('default は従来のスプライト名', () => {
    expect(playerSprite('default', 'rock')).toBe('player-rock')
  })
  it('スキン付きは player-{skin}-{hand}', () => {
    expect(playerSprite('cyber', 'scissors')).toBe('player-cyber-scissors')
    expect(playerSprite('maid', 'paper')).toBe('player-maid-paper')
  })
})
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npx vitest run tests/skins.test.ts`
Expected: FAIL(`playerSprite` 未 export)

- [ ] **Step 4: 実装** — `src/assets.ts` を変更

型定義とテーブルを拡張する。`FALLBACK_EMOJI` / `HAND_OF` の 2 つの Record は名前が増えると全キー列挙が破綻するので、スプライト名の末尾から手を導出する方式に置き換える:

```ts
import { HAND_COLORS } from './render/theme'
import type { SkinId } from './logic/skins'

type Hand = 'rock' | 'scissors' | 'paper'
type SkinnedSkin = Exclude<SkinId, 'default'>

/** 正方形として中心座標で描くスプライト。読み込み失敗時は絵文字にフォールバックする */
export type SpriteName =
  | `player-${Hand}`
  | `player-${SkinnedSkin}-${Hand}`
  | `enemy-${Hand}`

/** スプライト + 単体で扱う一枚絵。'hero-title' はタイトルのロゴ看板 */
export type ImageName = SpriteName | 'hero-title'

const IMAGE_FILES: Record<ImageName, string> = {
  'player-rock': 'player-rock.png',
  'player-scissors': 'player-scissors.png',
  'player-paper': 'player-paper.png',
  'player-cyber-rock': 'player-cyber-rock.png',
  'player-cyber-scissors': 'player-cyber-scissors.png',
  'player-cyber-paper': 'player-cyber-paper.png',
  'player-mage-rock': 'player-mage-rock.png',
  'player-mage-scissors': 'player-mage-scissors.png',
  'player-mage-paper': 'player-mage-paper.png',
  'player-forest-rock': 'player-forest-rock.png',
  'player-forest-scissors': 'player-forest-scissors.png',
  'player-forest-paper': 'player-forest-paper.png',
  'player-samurai-rock': 'player-samurai-rock.png',
  'player-samurai-scissors': 'player-samurai-scissors.png',
  'player-samurai-paper': 'player-samurai-paper.png',
  'player-maid-rock': 'player-maid-rock.png',
  'player-maid-scissors': 'player-maid-scissors.png',
  'player-maid-paper': 'player-maid-paper.png',
  'enemy-rock': 'enemy-rock.png',
  'enemy-scissors': 'enemy-scissors.png',
  'enemy-paper': 'enemy-paper.png',
  // ヒーロー画像だけ WebP。同じ絵の PNG は 1.1MB あり初回ロードに見合わない(WebP は 205KB)。
  // 元絵と生成手順は docs/reference/title.png と tools/make-hero.py を参照。
  'hero-title': 'hero-title.webp',
}

const FALLBACK_EMOJI: Record<Hand, string> = { rock: '✊', scissors: '✌️', paper: '✋' }

/** スプライト名は必ず `-{hand}` で終わる規約なので、末尾から手を導出する */
function handOfSprite(name: SpriteName): Hand {
  return name.split('-').pop() as Hand
}

/** 選択スキン + 現在の手からスプライト名を解決する。default だけ従来名になる分岐をここに閉じ込める */
export function playerSprite(skin: SkinId, hand: Hand): SpriteName {
  return skin === 'default' ? `player-${hand}` : `player-${skin}-${hand}`
}
```

`Assets.draw` のフォールバック部は導出関数を使うように変更:

```ts
    // フォールバック: 手のキーカラー円 + 絵文字
    const hand = handOfSprite(name)
    ctx.save()
    ctx.fillStyle = HAND_COLORS[hand].base
    ctx.beginPath()
    ctx.arc(x, y, size / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = `${size * 0.6}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(FALLBACK_EMOJI[hand], x, y)
    ctx.restore()
```

(`loadImage` / `loadAssets` は `IMAGE_FILES` のキーを列挙しているので変更不要 — 15枚が自動的にロード対象になる)

- [ ] **Step 5: テストと型チェックが通ることを確認**

Run: `npx vitest run tests/skins.test.ts && npm run build`
Expected: テスト PASS、`tsc --noEmit` エラーなし

- [ ] **Step 6: コミット**

```bash
git add public/assets/player-*.png src/assets.ts tests/skins.test.ts
git commit -m "feat: スキン画像15枚を追加しスプライト名解決 playerSprite を導入"
```

---

### Task 4: ←→ のエッジ入力(`src/input.ts`)

**Files:**
- Modify: `src/input.ts`

**Interfaces:**
- Produces: `Input.consumeDirX(): number` — 最後に押された ←(-1)/→(+1)を1回だけ返すエッジラッチ。未入力は 0。`consumeConfirm` と同じ「消費したらクリア」方式。

(window イベント依存のため vitest では検証せず、Task 6 のシーンテストはスタブで、実機挙動は Task 7 のブラウザ確認で検証する)

- [ ] **Step 1: 実装** — `src/input.ts` を変更

フィールド追加と keydown / blur ハンドラの変更:

```ts
export class Input {
  private pressed = new Set<string>()
  private confirmEdge = false
  private dirXEdge = 0

  attach(): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      this.pressed.add(e.code)
      if (e.code === 'Enter' || e.code === 'Space') this.confirmEdge = true
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.dirXEdge = -1
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.dirXEdge = 1
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
    })
    window.addEventListener('keyup', (e) => this.pressed.delete(e.code))
    window.addEventListener('blur', () => {
      this.pressed.clear()
      this.confirmEdge = false
      this.dirXEdge = 0
    })
  }
```

メソッド追加(`consumeConfirm` の直後):

```ts
  /** ←→ のエッジラッチ。ゲームオーバー画面のスキン切替用。-1 / 0 / +1 を返し、消費したらクリアする */
  consumeDirX(): number {
    const v = this.dirXEdge
    this.dirXEdge = 0
    return v
  }
```

- [ ] **Step 2: 型チェックと既存テストが通ることを確認**

Run: `npm run build && npm test`
Expected: エラーなし・全テスト PASS

- [ ] **Step 3: コミット**

```bash
git add src/input.ts
git commit -m "feat: ←→ のエッジラッチ consumeDirX を Input に追加"
```

---

### Task 5: プレイ中の自機・HUD にスキンを反映

**Files:**
- Modify: `src/entities/player.ts`(draw のスプライト名解決)
- Modify: `src/scenes/play.ts`(スキンのロードと受け渡し)
- Modify: `src/render/panel.ts`(HUD の自機アイコン)

**Interfaces:**
- Consumes: Task 1 `SkinId`、Task 2 `loadSkin`、Task 3 `playerSprite`
- Produces: `Player` コンストラクタが `constructor(public hand: Hand, public skin: SkinId = 'default')` になる(第2引数はデフォルト付きなので既存テスト・呼び出しは壊れない)。`HudData` に `skin: SkinId` フィールドが追加される。

- [ ] **Step 1: Player にスキンを持たせる** — `src/entities/player.ts`

```ts
import { playerSprite } from '../assets'
import type { SkinId } from '../logic/skins'
```

コンストラクタと draw の変更:

```ts
  constructor(public hand: Hand, public skin: SkinId = 'default') {}
```

```ts
    assets.draw(ctx, playerSprite(this.skin, this.hand), this.x, this.y, this.radius * 2.4)
```

- [ ] **Step 2: PlayScene でスキンをロードして渡す** — `src/scenes/play.ts`

import 追加: `import { saveHighScoreIfHigher, loadHighScore, loadSkin } from '../storage'`(既存の `saveHighScoreIfHigher` import に追記)

コンストラクタ内の Player 生成(45行付近)を変更:

```ts
    const skin = loadSkin(g.storage, loadHighScore(g.storage))
    this.player = new Player(randomHand(Math.random), skin)
```

- [ ] **Step 3: HUD の自機アイコンにスキンを反映** — `src/render/panel.ts`

`HudData` インターフェース(13行付近)に `skin: SkinId` を追加し、import を足す:

```ts
import { playerSprite } from '../assets'
import type { SkinId } from '../logic/skins'
```

77行付近の描画を変更:

```ts
  assets.draw(ctx, playerSprite(d.skin, d.playerHand), cx, 486, 76)
```

`src/scenes/play.ts` 内で HudData を組み立てている箇所(`playerHand:` で grep)に `skin: this.player.skin,` を追加する。

- [ ] **Step 4: 型チェックと全テストが通ることを確認**

Run: `npm run build && npm test`
Expected: エラーなし・全テスト PASS(HudData を組み立てるテストがあれば `skin: 'default'` を追加して修正)

- [ ] **Step 5: コミット**

```bash
git add src/entities/player.ts src/scenes/play.ts src/render/panel.ts
git commit -m "feat: 選択スキンをプレイ中の自機スプライトと HUD に反映"
```

---

### Task 6: ゲームオーバー画面のスキン選択 UI

**Files:**
- Modify: `src/scenes/gameover.ts`
- Modify: `tests/play-scene.test.ts`(Input スタブに `consumeDirX` を追加)
- Test: `tests/gameover-skins.test.ts`(新規)

**Interfaces:**
- Consumes: Task 1 `SKINS`/`nextSkin`/`isUnlocked`/`unlockScoreOf`、Task 2 `loadSkin`/`saveSkin`、Task 3 `playerSprite`、Task 4 `consumeDirX`
- Produces: `GameOverScene` に `selectedSkin(): SkinId`(テスト用の読み取り口)を追加。update() が毎フレーム `consumeDirX()` を呼ぶため、**Input をスタブする全テストは `consumeDirX: () => 0` を持つ必要がある**。

- [ ] **Step 1: 既存テストの Input スタブを更新** — `tests/play-scene.test.ts`

`makeLatchInput` の返すオブジェクトと、`makeContext` 内のデフォルト input スタブの両方に 1 行追加:

```ts
    consumeDirX: (): number => 0,
```

- [ ] **Step 2: 失敗するテストを書く** — `tests/gameover-skins.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import type { GameContext } from '../src/game'
import type { Input } from '../src/input'
import type { ScoreStore } from '../src/storage'
import { GameOverScene } from '../src/scenes/gameover'
import { HIGHSCORE_KEY, SKIN_KEY } from '../src/storage'
import { PlayScene } from '../src/scenes/play'

function memoryStore(initial: Record<string, string> = {}): ScoreStore & { data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = v },
  }
}

/** confirm と dirX の両エッジラッチを模した Input スタブ */
function makeInput(): Input & { press(dir: -1 | 1): void; confirm(): void } {
  let confirmEdge = false
  let dirXEdge = 0
  return {
    dx: 0,
    dy: 0,
    consumeConfirm: (): boolean => {
      const v = confirmEdge
      confirmEdge = false
      return v
    },
    consumeDirX: (): number => {
      const v = dirXEdge
      dirXEdge = 0
      return v
    },
    press: (dir: -1 | 1): void => { dirXEdge = dir },
    confirm: (): void => { confirmEdge = true },
  } as unknown as Input & { press(dir: -1 | 1): void; confirm(): void }
}

function makeScene(storeData: Record<string, string>) {
  const input = makeInput()
  const storage = memoryStore(storeData)
  const g = {
    input,
    storage,
    assets: { get: () => undefined, draw: () => {} },
    sound: { startBgm: () => {}, stopBgm: () => {} },
  } as unknown as GameContext
  const scene = new GameOverScene(g, 1000, 3, false)
  // シェイク(0.4秒)を排水してから操作を受け付けさせる
  scene.update(0.5)
  return { scene, input, storage }
}

describe('GameOverScene のスキン選択', () => {
  it('→ で次のスキンに切り替わり、解放済みなら即保存される', () => {
    const { scene, input, storage } = makeScene({ [HIGHSCORE_KEY]: '15000' })
    input.press(1)
    scene.update(1 / 60)
    expect(scene.selectedSkin()).toBe('cyber')
    expect(storage.data[SKIN_KEY]).toBe('cyber')
  })

  it('未解放スキンへはカーソルは移動するが保存されない', () => {
    const { scene, input, storage } = makeScene({ [HIGHSCORE_KEY]: '15000', [SKIN_KEY]: 'cyber' })
    input.press(1)
    scene.update(1 / 60)
    input.press(1)
    scene.update(1 / 60)  // cyber → mage(未解放)
    expect(scene.selectedSkin()).toBe('mage')
    expect(storage.data[SKIN_KEY]).toBe('cyber')
  })

  it('未解放スキン表示中にリトライしても保存値は変わらず、PlayScene には保存済みスキンが適用される', () => {
    const { scene, input, storage } = makeScene({ [HIGHSCORE_KEY]: '15000', [SKIN_KEY]: 'cyber' })
    input.press(1)
    scene.update(1 / 60)
    input.press(1)
    scene.update(1 / 60)  // mage(未解放)にカーソル
    input.confirm()
    const next = scene.update(1 / 60)
    expect(next).toBeInstanceOf(PlayScene)
    expect(storage.data[SKIN_KEY]).toBe('cyber')
  })

  it('← で末尾へラップする(未解放も巡回に含む)', () => {
    const { scene, input } = makeScene({ [HIGHSCORE_KEY]: '0' })
    input.press(-1)
    scene.update(1 / 60)
    expect(scene.selectedSkin()).toBe('maid')
  })

  it('シェイク中の ←→ 入力は排水され、シェイク終了後に持ち越されない', () => {
    const input = makeInput()
    const storage = memoryStore({ [HIGHSCORE_KEY]: '15000' })
    const g = {
      input,
      storage,
      assets: { get: () => undefined, draw: () => {} },
      sound: { startBgm: () => {}, stopBgm: () => {} },
    } as unknown as GameContext
    const scene = new GameOverScene(g, 1000, 3, false)
    input.press(1)
    scene.update(0.1)  // まだシェイク中
    scene.update(0.5)  // シェイク終了
    expect(scene.selectedSkin()).toBe('default')
  })
})
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npx vitest run tests/gameover-skins.test.ts`
Expected: FAIL(`selectedSkin` 未定義)

- [ ] **Step 4: 実装** — `src/scenes/gameover.ts`

import 追加:

```ts
import { loadHighScore, loadSkin, saveSkin } from '../storage'
import { SKINS, nextSkin, isUnlocked, unlockScoreOf, type SkinId } from '../logic/skins'
import { playerSprite } from '../assets'
```

フィールドとコンストラクタ(ハイスコアは play.ts 側で保存済みなので、ここで読む値は NEW RECORD 反映後):

```ts
export class GameOverScene implements Scene {
  private shakeSec = 0.4
  private highScore: number
  private selected: SkinId

  constructor(
    private g: GameContext,
    private score: number,
    private level: number,
    private isNewRecord: boolean,
  ) {
    this.highScore = loadHighScore(g.storage)
    this.selected = loadSkin(g.storage, this.highScore)
  }

  /** テスト用の読み取り口 */
  selectedSkin(): SkinId {
    return this.selected
  }
```

update():confirm と同様に、シェイク中も consumeDirX() を毎フレーム呼んでラッチを排水する(呼ばないと死亡直前の ←→ がシェイク終了直後に化けて発火する):

```ts
  update(dtSec: number): Scene | null {
    this.shakeSec = Math.max(0, this.shakeSec - dtSec)
    const confirmed = this.g.input.consumeConfirm()
    const dir = this.g.input.consumeDirX()
    if (this.shakeSec > 0) return null
    if (dir === 1 || dir === -1) {
      this.selected = nextSkin(this.selected, dir)
      // 解放済みに合った時点で即保存。未解放は保存しない(リトライ時は直前の保存値が使われる)
      if (isUnlocked(this.selected, this.highScore)) saveSkin(this.g.storage, this.selected)
    }
    if (confirmed) {
      this.g.sound.startBgm()
      return new PlayScene(this.g)
    }
    return null
  }
```

draw():スコアパネルの左にスキンプレビューを追加する。既存の描画コードはそのまま、パネル描画(`// 集計パネル` ブロック)の後に追記:

```ts
    // スキンプレビュー: パネル左のスペースに選択中スキンを表示。←→ で全スキンを巡回し、
    // 未解放はシルエット + 必要スコアを見せてモチベーションにする(保存は解放済みのみ)
    const sx = px - 115  // パネル左端から 115px 左が中心
    const sy = py + 92
    const unlocked = isUnlocked(this.selected, this.highScore)
    const skinDef = SKINS.find((s) => s.id === this.selected)!
    ctx.save()
    if (!unlocked) ctx.filter = 'brightness(0)'
    this.g.assets.draw(ctx, playerSprite(this.selected, 'rock'), sx, sy, 130)
    ctx.restore()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 15px ${FONT_NUM}`
    ctx.fillStyle = COLORS.labelStrong
    ctx.fillText(`◀  ${skinDef.label}  ▶`, sx, sy + 92)
    if (!unlocked) {
      ctx.fillStyle = COLORS.label
      ctx.fillText(`UNLOCK ${unlockScoreOf(this.selected).toLocaleString('en-US')}`, sx, sy + 116)
    }
```

(`px` / `py` はパネル描画で定義済みのローカル変数をそのまま使う。CANVAS_W=960, pw=460 なので sx=135 となり左余白 0〜250px に収まる)

- [ ] **Step 5: テストが通ることを確認**

Run: `npx vitest run tests/gameover-skins.test.ts tests/play-scene.test.ts`
Expected: PASS(全件)

- [ ] **Step 6: 全テストと型チェック**

Run: `npm test && npm run build`
Expected: 全テスト PASS、型エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/scenes/gameover.ts tests/gameover-skins.test.ts tests/play-scene.test.ts
git commit -m "feat: ゲームオーバー画面に ←→ で切り替えるスキン選択 UI を追加"
```

---

### Task 7: ブラウザ確認とドキュメント更新

**Files:**
- Modify: `CLAUDE.md`(ゲームルールとアーキテクチャの記述)
- Modify: `docs/DESIGN.md`(存在する場合、きせかえ仕様を追記)

- [ ] **Step 1: ブラウザで動作確認**

`npm run dev` をプレビューツール(preview_start)で起動し、以下を確認:

1. localStorage の `janken-dodge-highscore` を `75000` に設定してリロード → ゲームオーバー画面で全スキンが選択可能
2. ←→ でスキンが巡回し、ラベルが切り替わる
3. `janken-dodge-highscore` を `20000` にすると mage 以降がシルエット + `UNLOCK 30,000` 表示になる
4. cyber を選んでリトライ → 自機と HUD アイコンが cyber スプライトになる
5. 未解放スキンを表示中にリトライ → 直前に選んだ解放済みスキンでプレイが始まる
6. スクリーンショットを撮ってユーザーに提示

- [ ] **Step 2: ドキュメント更新**

`CLAUDE.md` の「ゲームルール」節の末尾に追記:

```markdown
- ハイスコアに応じてスキン(きせかえ)が解放される(cyber 15,000 / mage 30,000 / forest 45,000 / samurai 60,000 / maid 75,000)。ゲームオーバー画面で ←→ で選択し、選択は localStorage に保存されて次のプレイの自機スプライトに反映される。未解放スキンもシルエットで巡回表示されるが保存はされない。スキン定義は `src/logic/skins.ts`。
```

`docs/DESIGN.md` が存在すれば、同趣旨の節を既存の文体に合わせて追記する。

- [ ] **Step 3: 最終確認とコミット**

```bash
npm test && npm run build
git add CLAUDE.md docs/DESIGN.md
git commit -m "docs: きせかえ機能の追加に合わせて CLAUDE.md / DESIGN.md を更新"
```

---

## Self-Review 済み確認事項

- スペックの全要件(しきい値、巡回順、未解放の表示・非保存、プレイ反映、フォールバック)に対応するタスクがある
- `SkinId` / `playerSprite` / `consumeDirX` / `loadSkin(store, highScore)` のシグネチャはタスク間で一致
- 既存テストへの影響は Task 6 Step 1(Input スタブへの `consumeDirX` 追加)で吸収
