# ネオンアーケードUI再設計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** じゃんけん弾除けゲームの見た目を、参考画像(`docs/reference/keyvisual.png`)のネオンアーケード調に全面再設計する。ゲームロジックは一切変更しない。

**Architecture:** canvas を 1200×720 に拡張し、左 960×720 のプレイフィールド(無変更)+ 右 240px のサイドパネル。描画専用モジュール `src/render/` を新設し、シーンの draw だけを書き換える。キャラ画像は Codex imagegen で参考画像ベースに再生成。

**Tech Stack:** TypeScript + Vite + Canvas 2D。Google Fonts(Dela Gothic One / Orbitron)。画像生成は Codex CLI 組み込み imagegen スキル。

## Global Constraints

- `logic/` 配下、`entities/*` の update・衝突判定、`input.ts`、`storage.ts`、`audio.ts`、シーン遷移は変更禁止
- `FIELD_W = 960` / `FIELD_H = 720` は不変(entities/player.ts で定義)
- 各タスク完了時に `npm run build`(tsc --noEmit + vite build)が通ること
- 最終的に既存 vitest(`npm test`)が無変更で通ること
- キーカラー: グー `#5ad14f`/`#8dff70`、チョキ `#e8586f`/`#ff7d9c`、パー `#3f9df0`/`#6fc4ff`、シアン `#37e0e8`、イエロー `#ffd23e`、レッド `#ff3b4f`、背景 `#0a0618`

---

### Task 1: canvas 拡張・フォント読み込み(index.html / main.ts)

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`

**Interfaces:**
- Produces: canvas 内部解像度 1200×720。Dela Gothic One / Orbitron が `document.fonts` 経由で利用可能

- [ ] **Step 1: index.html を書き換え**

```html
<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>じゃんけんサバイバー</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Orbitron:wght@500;700;900&display=swap" rel="stylesheet" />
  <style>
    html, body { margin: 0; height: 100%; background: #05030e; display: grid; place-items: center; }
    /* 内部解像度は 1200x720 固定(フィールド960 + パネル240)。
       ウィンドウの縦横どちらが制約になっても 5:3 を保ったまま最大限まで拡大/縮小する。 */
    canvas {
      width: min(100vw, calc(100vh * 5 / 3));
      height: min(100vh, calc(100vw * 3 / 5));
      aspect-ratio: 5 / 3;
    }
  </style>
</head>
<body>
  <canvas id="game" width="1200" height="720"></canvas>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

(`image-rendering: pixelated` は高解像度スプライト化に伴い削除)

- [ ] **Step 2: main.ts でフォント読み込みを待つ**

`const assets = await loadAssets()` の直後に追加:

```ts
  // Webフォント(Dela Gothic One / Orbitron)のロードを待つ。失敗しても
  // document.fonts.ready は resolve されるため起動はブロックされない。
  await document.fonts.ready
```

- [ ] **Step 3: ビルド確認** — Run: `npm run build` → PASS

- [ ] **Step 4: Commit** — `git add index.html src/main.ts && git commit -m "feat: canvas を 1200x720 に拡張し Web フォントを導入"`

---

### Task 2: テーマ定数モジュール(src/render/theme.ts)

**Files:**
- Create: `src/render/theme.ts`

**Interfaces:**
- Produces:
  - `CANVAS_W = 1200`, `CANVAS_H = 720`, `PANEL_X = 960`, `PANEL_W = 240`
  - `COLORS: { bgDeep, cyan, yellow, red, white, panelBg, panelBorder }`
  - `HAND_COLORS: Record<Hand, { base: string; glow: string }>`
  - `HAND_LABEL: Record<Hand, string>`, `HAND_EMOJI: Record<Hand, string>`
  - `FONT_DISPLAY`, `FONT_NUM`(CSS font-family 文字列)

- [ ] **Step 1: 実装**

```ts
import type { Hand } from '../logic/janken'

export const CANVAS_W = 1200
export const CANVAS_H = 720
export const PANEL_X = 960
export const PANEL_W = 240

export const COLORS = {
  bgDeep: '#0a0618',
  cyan: '#37e0e8',
  yellow: '#ffd23e',
  red: '#ff3b4f',
  white: '#ffffff',
  panelBg: 'rgba(10, 8, 30, 0.92)',
  panelBorder: '#5a3fd0',
} as const

/** 手ごとのキーカラー。Record<Hand, ...> により全 Hand の網羅を型で保証する */
export const HAND_COLORS: Record<Hand, { base: string; glow: string }> = {
  rock: { base: '#5ad14f', glow: '#8dff70' },
  scissors: { base: '#e8586f', glow: '#ff7d9c' },
  paper: { base: '#3f9df0', glow: '#6fc4ff' },
}

export const HAND_LABEL: Record<Hand, string> = { rock: 'グー', scissors: 'チョキ', paper: 'パー' }
export const HAND_EMOJI: Record<Hand, string> = { rock: '✊', scissors: '✌️', paper: '✋' }

export const FONT_DISPLAY = '"Dela Gothic One", sans-serif'
export const FONT_NUM = '"Orbitron", sans-serif'
```

- [ ] **Step 2: ビルド確認** — Run: `npm run build` → PASS
- [ ] **Step 3: Commit** — `git commit -m "feat: render/theme を追加(キーカラー・フォント定数)"`

---

### Task 3: 文字描画ヘルパー(src/render/text.ts)

**Files:**
- Create: `src/render/text.ts`

**Interfaces:**
- Consumes: なし(theme.ts とは独立)
- Produces:
  - `outlinedText(ctx, text, x, y, opts)` — 袋文字。opts: `{ size, font, fill, outline?, outlineWidth?, align?, shadowColor?, shadowOffset? }`。fill は色文字列 or `CanvasGradient`
  - `neonText(ctx, text, x, y, opts)` — グロー文字。opts: `{ size, font, color, align?, blur? }`

- [ ] **Step 1: 実装**

```ts
type Align = CanvasTextAlign

export interface OutlinedTextOpts {
  size: number
  font: string
  fill: string | CanvasGradient
  outline?: string
  outlineWidth?: number
  align?: Align
  shadowColor?: string
  shadowOffset?: number
}

/** 袋文字(縁取り+オフセットシャドウ)。ロゴ・見出し用 */
export function outlinedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: OutlinedTextOpts,
): void {
  const { size, font, fill, outline = '#000', outlineWidth = size * 0.18, align = 'center', shadowColor, shadowOffset = size * 0.08 } = opts
  ctx.save()
  ctx.font = `${size}px ${font}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  if (shadowColor) {
    ctx.fillStyle = shadowColor
    ctx.fillText(text, x + shadowOffset, y + shadowOffset)
  }
  ctx.strokeStyle = outline
  ctx.lineWidth = outlineWidth
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
  ctx.restore()
}

export interface NeonTextOpts {
  size: number
  font: string
  color: string
  align?: Align
  blur?: number
}

/** ネオングロー文字。HUD 数値・点滅プロンプト用 */
export function neonText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: NeonTextOpts,
): void {
  const { size, font, color, align = 'center', blur = size * 0.5 } = opts
  ctx.save()
  ctx.font = `${size}px ${font}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.shadowColor = color
  ctx.shadowBlur = blur
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(text, x, y)
  ctx.restore()
}
```

- [ ] **Step 2: ビルド確認** — Run: `npm run build` → PASS
- [ ] **Step 3: Commit** — `git commit -m "feat: render/text を追加(袋文字・ネオン文字ヘルパー)"`

---

### Task 4: ネオングリッド背景(src/render/background.ts)

**Files:**
- Create: `src/render/background.ts`

**Interfaces:**
- Consumes: `COLORS` (theme.ts)
- Produces: `drawNeonBackground(ctx, w, h, timeSec)` — 指定領域全体に背景を描く。`timeSec` でグリッドがゆっくり流れる

- [ ] **Step 1: 実装**

```ts
import { COLORS } from './theme'

/**
 * ネオンアーケード調の背景: 深紫の空間 + パースの効いたグリッド床 + ビネット。
 * 状態は持たず、timeSec(経過秒)でグリッドのスクロール位相を決める。
 */
export function drawNeonBackground(ctx: CanvasRenderingContext2D, w: number, h: number, timeSec: number): void {
  ctx.save()

  // 空間のベース: 上が濃く、下(床)に向けて紫が差す
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#05030e')
  sky.addColorStop(0.55, COLORS.bgDeep)
  sky.addColorStop(1, '#1b0f3a')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // 床グリッド(画面下半分、消失点は画面中央やや上)
  const horizonY = h * 0.42
  const cx = w / 2
  ctx.strokeStyle = 'rgba(160, 80, 255, 0.35)'
  ctx.lineWidth = 1.5

  // 放射状の縦線
  for (let i = -10; i <= 10; i++) {
    ctx.beginPath()
    ctx.moveTo(cx + i * (w * 0.055), h)
    ctx.lineTo(cx + i * (w * 0.014), horizonY)
    ctx.stroke()
  }
  // 奥行き方向の横線(手前ほど間隔が広い)。timeSec で手前に流す
  const scroll = (timeSec * 0.25) % 1
  for (let j = 0; j < 14; j++) {
    const t = (j + scroll) / 14
    const y = horizonY + (h - horizonY) * t * t
    ctx.globalAlpha = 0.15 + 0.45 * t
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // 地平線の発光
  const glow = ctx.createLinearGradient(0, horizonY - 40, 0, horizonY + 40)
  glow.addColorStop(0, 'rgba(90, 40, 200, 0)')
  glow.addColorStop(0.5, 'rgba(150, 80, 255, 0.25)')
  glow.addColorStop(1, 'rgba(90, 40, 200, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, horizonY - 40, w, 80)

  // 浮遊光点(位置は決定的に散らし、明滅だけ timeSec で揺らす)
  for (let k = 0; k < 24; k++) {
    const px = ((k * 379) % 997) / 997 * w
    const py = ((k * 613) % 991) / 991 * horizonY
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(timeSec * 1.3 + k))
    ctx.globalAlpha = 0.25 * tw
    ctx.fillStyle = k % 3 === 0 ? COLORS.cyan : k % 3 === 1 ? '#c07dff' : COLORS.yellow
    ctx.beginPath()
    ctx.arc(px, py, 1.5 + (k % 3), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // ビネット
  const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, h * 0.95)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, w, h)

  ctx.restore()
}
```

- [ ] **Step 2: ビルド確認** — Run: `npm run build` → PASS
- [ ] **Step 3: Commit** — `git commit -m "feat: render/background を追加(ネオングリッド床)"`

---

### Task 5: assets.ts から bullet / background を除去

**Files:**
- Modify: `src/assets.ts`

**Interfaces:**
- Produces: `SpriteName` = player/enemy × rock/scissors/paper の6種のみ。絵文字フォールバックの円色は `HAND_COLORS` 準拠

- [ ] **Step 1: 書き換え**

```ts
import { HAND_COLORS } from './render/theme'

export type SpriteName =
  | 'player-rock' | 'player-scissors' | 'player-paper'
  | 'enemy-rock' | 'enemy-scissors' | 'enemy-paper'

const FALLBACK_EMOJI: Record<SpriteName, string> = {
  'player-rock': '✊', 'player-scissors': '✌️', 'player-paper': '✋',
  'enemy-rock': '✊', 'enemy-scissors': '✌️', 'enemy-paper': '✋',
}

const HAND_OF: Record<SpriteName, keyof typeof HAND_COLORS> = {
  'player-rock': 'rock', 'player-scissors': 'scissors', 'player-paper': 'paper',
  'enemy-rock': 'rock', 'enemy-scissors': 'scissors', 'enemy-paper': 'paper',
}

export class Assets {
  constructor(private images: Partial<Record<SpriteName, HTMLImageElement>>) {}

  draw(ctx: CanvasRenderingContext2D, name: SpriteName, x: number, y: number, size: number): void {
    const img = this.images[name]
    if (img) {
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size)
      return
    }
    // フォールバック: 手のキーカラー円 + 絵文字
    ctx.save()
    ctx.fillStyle = HAND_COLORS[HAND_OF[name]].base
    ctx.beginPath()
    ctx.arc(x, y, size / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = `${size * 0.6}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(FALLBACK_EMOJI[name], x, y)
    ctx.restore()
  }
}

const NAMES: SpriteName[] = [
  'player-rock', 'player-scissors', 'player-paper',
  'enemy-rock', 'enemy-scissors', 'enemy-paper',
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

注意: `drawBackground` を削除するため、この時点では各シーンがまだ参照していてビルドが落ちる。**Task 5〜9 は連続して実施し、シーン側の置き換え(Task 7〜9)まで進めてからビルド確認する**……のではなく、ビルドを常に通すため、このタスクでは `drawBackground` を**残したまま** `SpriteName` から `bullet`/`background` だけ外すことはできない(型エラーになる)。よって次の順で1コミットにまとめる:
1. 上記の assets.ts 書き換え
2. 同コミット内で、シーン3ファイルの `this.g.assets.drawBackground(ctx, FIELD_W, FIELD_H)` を `drawNeonBackground(ctx, FIELD_W, FIELD_H, 0)` に仮置換(import 追加。時間は Task 7〜9 で配線)
3. `bullet.ts` の `assets.draw(ctx, 'bullet', ...)` を仮の円描画に置換(Task 6 で本実装):

```ts
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.fillStyle = '#c07dff'
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
```

`bullet.draw` の呼び出し側(play.ts)も `b.draw(ctx)` に合わせる。

- [ ] **Step 2: 旧アセット削除** — Run: `git rm public/assets/bullet.png public/assets/background.png`
- [ ] **Step 3: ビルド確認** — Run: `npm run build` → PASS
- [ ] **Step 4: テスト確認** — Run: `npm test` → PASS(ロジック非変更の確認)
- [ ] **Step 5: Commit** — `git commit -m "refactor: bullet/background 画像を廃止しコード描画に移行"`

---

### Task 6: エンティティ描画の発光化(bullet / player / hand / particle)

**Files:**
- Modify: `src/entities/bullet.ts`(draw のみ)
- Modify: `src/entities/player.ts`(draw のみ)
- Modify: `src/entities/hand.ts`(draw のみ)
- Modify: `src/entities/particle.ts`(draw のみ)

**Interfaces:**
- Consumes: `HAND_COLORS`(theme.ts)
- Produces: `Bullet.draw(ctx)`(assets 引数なし)。Player/JankenHand の draw シグネチャは既存のまま `(ctx, assets)`

- [ ] **Step 1: bullet.ts の draw を本実装(グロー+進行方向の残光ストリーク)**

```ts
  draw(ctx: CanvasRenderingContext2D): void {
    const ang = Math.atan2(this.vy, this.vx)
    const r = this.radius
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    // 残光ストリーク(進行方向の逆へ伸びる)
    const tail = ctx.createLinearGradient(
      this.x, this.y,
      this.x - Math.cos(ang) * r * 5, this.y - Math.sin(ang) * r * 5,
    )
    tail.addColorStop(0, 'rgba(190, 120, 255, 0.55)')
    tail.addColorStop(1, 'rgba(190, 120, 255, 0)')
    ctx.strokeStyle = tail
    ctx.lineWidth = r * 1.2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(this.x, this.y)
    ctx.lineTo(this.x - Math.cos(ang) * r * 5, this.y - Math.sin(ang) * r * 5)
    ctx.stroke()
    // 本体グロー
    const orb = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 1.6)
    orb.addColorStop(0, '#ffffff')
    orb.addColorStop(0.35, '#e0b3ff')
    orb.addColorStop(1, 'rgba(160, 60, 255, 0)')
    ctx.fillStyle = orb
    ctx.beginPath()
    ctx.arc(this.x, this.y, r * 1.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
```

(注: `vx`/`vy` は private のままクラス内から参照するので変更不要)

- [ ] **Step 2: player.ts / hand.ts の draw にグロー下敷きを追加**

player.ts(hand.ts も同型。色は `HAND_COLORS[this.hand].glow`、hand.ts は敵なので `base` を使う):

```ts
  draw(ctx: CanvasRenderingContext2D, assets: Assets): void {
    const glow = HAND_COLORS[this.hand].glow
    const r = this.radius * 1.8
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r)
    g.addColorStop(0, `${glow}55`)
    g.addColorStop(1, `${glow}00`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    assets.draw(ctx, `player-${this.hand}`, this.x, this.y, this.radius * 2.4)
  }
```

(hand.ts では `enemy-${this.hand}`、`HAND_COLORS[this.hand].base + '44'` 相当のうっすら赤みでなく手色そのまま。import は `import { HAND_COLORS } from '../render/theme'`)

- [ ] **Step 3: particle.ts の draw を加算合成+サイズ減衰に**

```ts
  draw(ctx: CanvasRenderingContext2D): void {
    const t = Math.max(0, this.lifeSec / this.maxLifeSec)
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = t
    ctx.fillStyle = this.color
    ctx.shadowColor = this.color
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(this.x, this.y, 2 + 3 * t, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
```

- [ ] **Step 4: ビルド確認** — Run: `npm run build` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: 弾・手・パーティクルの描画をネオン発光化"`

---

### Task 7: サイドパネルとプレイ画面 HUD(render/panel.ts + scenes/play.ts)

**Files:**
- Create: `src/render/panel.ts`
- Modify: `src/scenes/play.ts`(draw / drawHud のみ)

**Interfaces:**
- Consumes: `drawNeonBackground`, `outlinedText`, `neonText`, theme 定数, `beats`(logic/janken), `levelMultiplier`(logic/score), `WINS_PER_LEVEL`(logic/level), `Assets.draw`
- Produces: `drawSidePanel(ctx, assets, data)` — `data: { score: number; level: number; multiplier: number; wins: number; winsPerLevel: number; playerHand: Hand }`

- [ ] **Step 1: panel.ts を実装**

```ts
import type { Hand } from '../logic/janken'
import type { Assets } from '../assets'
import { beats } from '../logic/janken'
import { CANVAS_H, PANEL_X, PANEL_W, COLORS, HAND_COLORS, HAND_LABEL, FONT_DISPLAY, FONT_NUM } from './theme'
import { neonText } from './text'

export interface PanelData {
  score: number
  level: number
  multiplier: number
  wins: number
  winsPerLevel: number
  playerHand: Hand
}

export function drawSidePanel(ctx: CanvasRenderingContext2D, assets: Assets, d: PanelData): void {
  const x = PANEL_X
  ctx.save()

  // パネル地(フィールド外はみ出し描画をここで覆う)
  ctx.fillStyle = COLORS.panelBg
  ctx.fillRect(x, 0, PANEL_W, CANVAS_H)
  ctx.strokeStyle = COLORS.panelBorder
  ctx.lineWidth = 2
  ctx.strokeRect(x + 1, 1, PANEL_W - 2, CANVAS_H - 2)

  const cx = x + PANEL_W / 2
  const label = (text: string, y: number) => {
    ctx.font = `700 15px ${FONT_NUM}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillText(text, cx, y)
  }

  // SCORE
  label('SCORE', 48)
  neonText(ctx, Math.floor(d.score).toLocaleString('en-US'), cx, 84, { size: 30, font: FONT_NUM, color: COLORS.cyan })

  // MULTIPLIER
  label('MULTIPLIER', 140)
  neonText(ctx, `× ${d.multiplier.toFixed(1)}`, cx, 176, { size: 28, font: FONT_NUM, color: COLORS.yellow })

  // LV
  label('LV.', 232)
  neonText(ctx, String(d.level).padStart(2, '0'), cx, 272, { size: 36, font: FONT_NUM, color: COLORS.white })

  // 勝利ピップ(winsPerLevel 個)
  label('WINS', 330)
  const pipGap = 34
  const pipX0 = cx - ((d.winsPerLevel - 1) * pipGap) / 2
  for (let i = 0; i < d.winsPerLevel; i++) {
    const filled = i < d.wins
    ctx.beginPath()
    ctx.arc(pipX0 + i * pipGap, 362, 9, 0, Math.PI * 2)
    if (filled) {
      ctx.fillStyle = COLORS.yellow
      ctx.shadowColor = COLORS.yellow
      ctx.shadowBlur = 10
      ctx.fill()
      ctx.shadowBlur = 0
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }

  // 自分の手
  label('YOU', 430)
  assets.draw(ctx, `player-${d.playerHand}`, cx, 486, 76)
  ctx.font = `16px ${FONT_DISPLAY}`
  ctx.fillStyle = HAND_COLORS[d.playerHand].glow
  ctx.fillText(HAND_LABEL[d.playerHand], cx, 540)

  // 倒せる手(緑グロー枠で強調)
  const target = beats(d.playerHand)
  label('TARGET', 584)
  ctx.strokeStyle = HAND_COLORS[target].glow
  ctx.lineWidth = 2.5
  ctx.shadowColor = HAND_COLORS[target].glow
  ctx.shadowBlur = 12
  ctx.strokeRect(cx - 46, 602, 92, 92)
  ctx.shadowBlur = 0
  assets.draw(ctx, `enemy-${target}`, cx, 648, 76)
  ctx.font = `14px ${FONT_DISPLAY}`
  ctx.fillStyle = HAND_COLORS[target].glow
  ctx.fillText(`${HAND_LABEL[target]}を倒せる！`, cx, 702)

  ctx.restore()
}
```

- [ ] **Step 2: play.ts の draw / drawHud を書き換え**

- import 追加: `drawNeonBackground`, `drawSidePanel`, `outlinedText`, `FONT_DISPLAY`, `COLORS`
- `HAND_LABEL` ローカル定義を削除(theme.ts へ移設済みだが play.ts では不要になる)
- `beats` は drawHud 削除後は未使用になるため、logic/janken からの import 行から外す(panel.ts が自前で import する)
- draw():

```ts
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    drawNeonBackground(ctx, FIELD_W, FIELD_H, this.elapsedSec)

    for (const h of this.hands) h.draw(ctx, this.g.assets)
    for (const b of this.bullets) b.draw(ctx)

    if (this.morphSec <= 0 || Math.floor(this.morphSec * 12) % 2 === 0) {
      this.player.draw(ctx, this.g.assets)
    }
    for (const p of this.particles) p.draw(ctx)

    if (this.flashSec > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flashSec / 0.35 * 0.6})`
      ctx.fillRect(0, 0, FIELD_W, FIELD_H)
    }

    // LEVEL UP! バナー(morph 中のみ)。上からスッと降りてフェード
    if (this.morphSec > 0) {
      const t = 1 - this.morphSec / 0.6
      ctx.globalAlpha = Math.min(1, (1 - t) * 3)
      outlinedText(ctx, 'LEVEL UP!', FIELD_W / 2, FIELD_H * 0.3 - (1 - t) * 20, {
        size: 64, font: FONT_DISPLAY, fill: COLORS.yellow,
        outline: '#000', shadowColor: 'rgba(0,0,0,0.6)',
      })
      ctx.globalAlpha = 1
    }

    // パネルは最後(フィールド右端のはみ出しを覆う)
    drawSidePanel(ctx, this.g.assets, {
      score: this.score,
      level: this.levelState.level,
      multiplier: levelMultiplier(this.levelState.level),
      wins: this.levelState.wins,
      winsPerLevel: WINS_PER_LEVEL,
      playerHand: this.player.hand,
    })
    ctx.restore()
  }
```

- `drawHud` メソッドは削除

- [ ] **Step 3: ビルド確認** — Run: `npm run build` → PASS
- [ ] **Step 4: テスト確認** — Run: `npm test` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: サイドパネル HUD を実装しプレイ画面をネオン化"`

---

### Task 8: タイトル画面(scenes/title.ts)

**Files:**
- Modify: `src/scenes/title.ts`(draw の全面書き換え。update は無変更)

**Interfaces:**
- Consumes: `drawNeonBackground`, `outlinedText`, `neonText`, theme 定数, `loadHighScore`, `Assets.draw`
- Produces: なし(終端シーン描画)

- [ ] **Step 1: 実装**

update() には手を付けない。クラスに `private timeSec = 0` を追加し、update 冒頭で加算……は update 変更にあたるため行わない。代わりに `performance.now() / 1000` を draw 内で使う(演出専用の時刻。ロジックに影響しない):

```ts
import type { Scene, GameContext } from '../game'
import { loadHighScore } from '../storage'
import { PlayScene } from './play'
import { drawNeonBackground } from '../render/background'
import { outlinedText, neonText } from '../render/text'
import { CANVAS_W, CANVAS_H, COLORS, HAND_COLORS, FONT_DISPLAY, FONT_NUM, HAND_EMOJI } from '../render/theme'
import type { Hand } from '../logic/janken'

const HANDS: Hand[] = ['rock', 'scissors', 'paper']

/** 装飾用に漂う敵手の配置(決定的、当たり判定なし) */
const FLOATERS: Array<{ hand: Hand; x: number; y: number; size: number; phase: number }> = [
  { hand: 'rock', x: 0.09, y: 0.18, size: 110, phase: 0 },
  { hand: 'paper', x: 0.08, y: 0.62, size: 130, phase: 2.1 },
  { hand: 'scissors', x: 0.90, y: 0.20, size: 120, phase: 4.2 },
  { hand: 'paper', x: 0.91, y: 0.60, size: 125, phase: 1.3 },
]

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
    const t = performance.now() / 1000
    ctx.save()
    drawNeonBackground(ctx, CANVAS_W, CANVAS_H, t)

    // 漂う手(ゆっくり上下)
    for (const f of FLOATERS) {
      const y = f.y * CANVAS_H + Math.sin(t * 0.8 + f.phase) * 10
      this.g.assets.draw(ctx, `enemy-${f.hand}`, f.x * CANVAS_W, y, f.size)
    }

    const cx = CANVAS_W / 2

    // 3すくみエンブレム(六角形+絵文字)
    HANDS.forEach((hand, i) => {
      const ex = cx + (i - 1) * 76
      const ey = 64
      drawHexagon(ctx, ex, ey, 30, HAND_COLORS[hand].base, HAND_COLORS[hand].glow)
      ctx.font = '28px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(HAND_EMOJI[hand], ex, ey)
    })

    // ロゴ2段
    outlinedText(ctx, 'じゃんけん', cx, 170, {
      size: 84, font: FONT_DISPLAY, fill: '#ffffff',
      outline: '#000', outlineWidth: 16, shadowColor: 'rgba(0,0,0,0.7)', shadowOffset: 7,
    })
    const grad = ctx.createLinearGradient(0, 230, 0, 320)
    grad.addColorStop(0, '#ffe45e')
    grad.addColorStop(1, '#ff9d2e')
    outlinedText(ctx, 'サバイバー', cx, 278, {
      size: 92, font: FONT_DISPLAY, fill: grad,
      outline: '#000', outlineWidth: 18, shadowColor: 'rgba(0,0,0,0.7)', shadowOffset: 8,
    })
    outlinedText(ctx, '― 勝てる手で、弾をかいくぐれ！ ―', cx, 352, {
      size: 24, font: FONT_DISPLAY, fill: '#ffffff', outline: '#000', outlineWidth: 6,
    })

    // ルールカード4枚
    const cards: Array<{ title: string; lines: string[] }> = [
      { title: '操作', lines: ['矢印キー / WASD', 'で移動'] },
      { title: '弾に当たると', lines: ['GAME OVER'] },
      { title: 'じゃんけんの手は', lines: ['勝てる手なら', '体当たりで倒せる！', 'あいこ・負けはNG'] },
      { title: '3回勝つと', lines: ['LEVEL UP!', '手が変わり倍率UP'] },
    ]
    const cardW = 262
    const cardH = 150
    const gap = 18
    const x0 = cx - (cardW * 2 + gap * 1.5)
    cards.forEach((card, i) => {
      const x = x0 + i * (cardW + gap)
      const y = 420
      ctx.fillStyle = 'rgba(12, 8, 34, 0.85)'
      ctx.strokeStyle = COLORS.panelBorder
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(x, y, cardW, cardH, 14)
      ctx.fill()
      ctx.stroke()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `17px ${FONT_DISPLAY}`
      ctx.fillStyle = COLORS.cyan
      ctx.fillText(card.title, x + cardW / 2, y + 32)
      card.lines.forEach((line, j) => {
        const emphasis = line.includes('GAME OVER') || line.includes('LEVEL UP')
        ctx.font = `${emphasis ? 20 : 15}px ${FONT_DISPLAY}`
        ctx.fillStyle = line.includes('GAME OVER') ? COLORS.red : line.includes('LEVEL UP') ? COLORS.yellow : '#fff'
        ctx.fillText(line, x + cardW / 2, y + 66 + j * 26)
      })
    })

    // スタートプロンプト(点滅)+ ハイスコア
    if (Math.floor(t * 1.6) % 2 === 0) {
      neonText(ctx, 'PRESS ENTER / SPACE', cx, 620, { size: 28, font: FONT_NUM, color: COLORS.cyan })
    }
    ctx.font = `700 18px ${FONT_NUM}`
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText(`HIGH SCORE  ${loadHighScore(this.g.storage).toLocaleString('en-US')}`, cx, 672)

    ctx.restore()
  }
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, glow: string): void {
  ctx.save()
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2
    const px = x + Math.cos(a) * r
    const py = y + Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.shadowColor = glow
  ctx.shadowBlur = 14
  ctx.fill()
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()
}
```

- [ ] **Step 2: ビルド確認** — Run: `npm run build` → PASS
- [ ] **Step 3: Commit** — `git commit -m "feat: タイトル画面をネオンアーケード調に全面刷新"`

---

### Task 9: ゲームオーバー画面(scenes/gameover.ts)

**Files:**
- Modify: `src/scenes/gameover.ts`(draw のみ。update・シェイクは無変更)

**Interfaces:**
- Consumes: `drawNeonBackground`, `outlinedText`, `neonText`, theme 定数, `loadHighScore`
- Produces: なし

- [ ] **Step 1: draw を書き換え**

```ts
  draw(ctx: CanvasRenderingContext2D): void {
    const t = performance.now() / 1000
    ctx.save()
    if (this.shakeSec > 0) {
      ctx.translate((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14)
    }
    drawNeonBackground(ctx, CANVAS_W, CANVAS_H, t * 0.3)
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(-20, -20, CANVAS_W + 40, CANVAS_H + 40)

    const cx = CANVAS_W / 2

    // GAME OVER: 赤袋文字 + グリッチ風の色ずれ(赤/シアンを左右にずらして重ねる)
    const gy = 200
    ctx.globalAlpha = 0.55
    outlinedText(ctx, 'GAME OVER', cx - 5, gy, { size: 88, font: FONT_DISPLAY, fill: COLORS.red, outline: 'transparent', outlineWidth: 0.1 })
    outlinedText(ctx, 'GAME OVER', cx + 5, gy, { size: 88, font: FONT_DISPLAY, fill: COLORS.cyan, outline: 'transparent', outlineWidth: 0.1 })
    ctx.globalAlpha = 1
    outlinedText(ctx, 'GAME OVER', cx, gy, {
      size: 88, font: FONT_DISPLAY, fill: COLORS.red,
      outline: '#000', outlineWidth: 16, shadowColor: 'rgba(0,0,0,0.8)', shadowOffset: 6,
    })

    // 集計パネル
    const pw = 460
    const ph = 220
    const px = cx - pw / 2
    const py = 280
    ctx.fillStyle = COLORS.panelBg
    ctx.strokeStyle = COLORS.panelBorder
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(px, py, pw, ph, 16)
    ctx.fill()
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 16px ${FONT_NUM}`
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillText('SCORE', cx, py + 40)
    neonText(ctx, Math.floor(this.score).toLocaleString('en-US'), cx, py + 78, { size: 40, font: FONT_NUM, color: COLORS.cyan })
    ctx.font = `700 16px ${FONT_NUM}`
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillText(`LV. ${String(this.level).padStart(2, '0')}`, cx, py + 122)
    if (this.isNewRecord) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6)
      neonText(ctx, '★ NEW RECORD ★', cx, py + 170, { size: 26, font: FONT_DISPLAY, color: COLORS.yellow })
      ctx.globalAlpha = 1
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = `700 16px ${FONT_NUM}`
      ctx.fillText(`HIGH SCORE  ${loadHighScore(this.g.storage).toLocaleString('en-US')}`, cx, py + 170)
    }

    // リトライプロンプト(シェイク終了後のみ点滅表示)
    if (this.shakeSec <= 0 && Math.floor(t * 1.6) % 2 === 0) {
      neonText(ctx, 'PRESS ENTER / SPACE — RETRY', cx, 600, { size: 24, font: FONT_NUM, color: COLORS.cyan })
    }
    ctx.restore()
  }
```

import 追加: `drawNeonBackground`, `outlinedText`, `neonText`, `CANVAS_W`, `CANVAS_H`, `COLORS`, `FONT_DISPLAY`, `FONT_NUM`

- [ ] **Step 2: ビルド確認** — Run: `npm run build` → PASS
- [ ] **Step 3: テスト確認** — Run: `npm test` → PASS
- [ ] **Step 4: Commit** — `git commit -m "feat: ゲームオーバー画面をグリッチ演出つきで刷新"`

---

### Task 10: キャラスプライトの並行生成(Codex imagegen)

**Files:**
- Modify: `public/assets/player-{rock,scissors,paper}.png`, `public/assets/enemy-{rock,scissors,paper}.png`(上書き)

**Interfaces:**
- Consumes: `docs/reference/keyvisual.png`(参考画像)
- Produces: 透過背景 PNG 6種(256×256 以上)

**手順(このタスクはメインセッションで実施。コード実装サブエージェントには渡さない):**

- [ ] **Step 1: Codex サブエージェントを3並行で起動**(Agent tool, subagent_type: `codex:codex-rescue`)。各エージェントへの共通指示:
  - Codex の組み込み imagegen スキルを使用
  - 参考画像 `docs/reference/keyvisual.png` をスタイルリファレンスとして渡す
  - 6キャラ生成: グー(緑 #5ad14f)/チョキ(ピンク #e8586f)/パー(青 #3f9df0)× 敵(怒り顔)/自機(元気で凛々しい顔)
  - 3Dレンダー調・太短い黒い腕脚つき・ネオン発光の縁・単色フラット背景(クロマキー)で生成
  - `remove_chroma_key.py` で透過化し、各自の候補ディレクトリ(`scratchpad/candidates/{a,b,c}/`)に `player-rock.png` 等の正式名で保存
  - 方針差分: A=参考画像忠実 / B=デフォルメ強め(頭身低く・顔大きく) / C=発光・エフェクト強め
- [ ] **Step 2: 全候補をタイル状に並べた比較画像を作り、ユーザーに提示して選んでもらう**
- [ ] **Step 3: 採用セットを `public/assets/` に配置**(6ファイル上書き)
- [ ] **Step 4: ブラウザで表示確認**(dev server でタイトル・プレイ画面のスプライト描画)
- [ ] **Step 5: Commit** — `git add public/assets && git commit -m "assets: 手キャラスプライトを参考画像準拠の新デザインに差し替え"`

---

### Task 11: 最終検証

**Files:** なし(検証のみ)

- [ ] **Step 1: テスト** — Run: `npm test` → 全 PASS
- [ ] **Step 2: ビルド** — Run: `npm run build` → PASS
- [ ] **Step 3: ブラウザ実機確認** — dev server 起動(preview_start)し、以下4状態のスクリーンショットを取得してユーザーに共有:
  1. タイトル画面(ロゴ・エンブレム・ルールカード・点滅プロンプト)
  2. プレイ画面(グリッド背景・発光弾・サイドパネルの SCORE/MULTIPLIER/LV/WINS/YOU/TARGET)
  3. LEVEL UP! バナー(3体撃破直後)
  4. ゲームオーバー画面(グリッチ GAME OVER・集計パネル)
- [ ] **Step 4: コンソールエラー確認** — read_console_messages でエラーゼロ
- [ ] **Step 5: 仕様書のステータスを「実装済み」に更新して Commit**
