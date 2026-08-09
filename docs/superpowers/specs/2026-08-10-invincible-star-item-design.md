# じゃんけんサバイバー — 無敵アイテム(星)

日付: 2026-08-10
ステータス: 承認済み

## 目的

プレイフィールドに星型のアイテムを一定間隔で出現させ、取得すると
**一定時間 BGM が変わり、無敵になる**。マリオのスターに相当する
「一気に無双する」報酬をゲームループに足す。

## 非目標(やらないこと)

- 無敵中のスコア倍率ボーナス(無敵の報酬は「撃破機会と生存」であって稼ぎ倍率ではない)
- 連続撃破コンボ、アイテム取得数の HUD 表示
- 星以外のアイテム種別
- 音楽ファイル(mp3/ogg)の導入。BGM は既存の WebAudio ビープ生成のまま差し替える
- 新規 PNG スプライトの追加。星はコード描画する(弾を画像からコード描画へ移した既存の方向性に合わせる)

---

## 1. ゲームルールとパラメータ

### 星の出現

| 項目 | 値 | 意図 |
|---|---|---|
| 初回出現 | プレイ開始 15 秒後 | 開幕直後に出さず、まず通常プレイを体験させる |
| 出現間隔 | 22 秒 | LVUP(3勝)とは独立したリズムを作る |
| 場に出せる数 | 最大 1 個 | 複数同時は狙いが散る |
| 消滅までの寿命 | 8 秒 | 取り逃しの緊張感。消滅 2 秒前から点滅で予告 |
| 出現位置 | フィールド内、外周 80px を除く範囲のランダム位置。自機から 220px 以上離す | 自機の真上に湧いて自動取得されるのを防ぐ |
| 当たり判定 | 半径 20 の円。既存 `collides()` をそのまま使う | |

出現位置は最大 10 回リトライして距離条件を満たす点を探し、満たせなければ
最後の候補をそのまま使う。**フィールド内かつ外周マージン内という条件は
リトライ結果に関わらず必ず満たす**(距離条件だけを妥協する)。

スポーンタイマーの回り方を明示しておく。

- `itemTimer` は**場に星がない間だけ**減る。星が存在する間は止める
- `itemTimer <= 0` になったら星を1個スポーンする
- 星が場から消えた瞬間(取得された、または寿命切れ)に
  `itemTimer = ITEM_SPAWN_INTERVAL_SEC` を再セットする

つまり 22 秒は「**星が場から消えてから次が湧くまで**」の時間であり、
星の寿命 8 秒と合わせると 1 サイクルは最短 22 秒・最長 30 秒になる。
初回だけ `itemTimer` の初期値を `ITEM_FIRST_SPAWN_SEC`(15) にする。

### 無敵の効果(8 秒)

- **弾**: 触れた弾は消滅し、その弾種の色でパーティクルが飛ぶ。スコアは入らない
- **手**: じゃんけんの勝敗を無視して全て撃破。`killBonus` が入り、勝利カウントも +1
- したがって無敵中に 3 体倒せば LVUP が発生する。LVUP の形態変化・フラッシュ・
  モーフ点滅は通常どおり起き、**無敵は中断されず継続する**
- **再取得**: 無敵中に星を取ると残時間は 8 秒に**リセット**(加算しない)。
  上限が読めなくなるのを防ぐ
- スコア倍率(`levelMultiplier`)は変更しない

無敵中は弾も手も無効化されるため、原理上 GAME OVER にならない。
無敵が切れた瞬間に弾と重なっていれば死ぬが、無敵中に触れた弾は消えていくため
自機周辺は自然に掃除される。

### 決定の記録

以下は設計時に選択肢を比較して決めた事項。将来の変更時に前提を見失わないため残す。

- **無敵の範囲**: 弾のみ無効ではなく「勝敗を無視して全て倒せる」スター型を選んだ。
  BGM 変更を伴う演出との相性を優先した。
- **勝利カウント**: 無敵中の撃破も全て勝利としてカウントする。無敵中に LVUP が
  連発し、解除直後の難度が跳ね上がる可能性は認識した上で、爽快感を優先している。
  問題が出た場合は「本来勝てる手だけカウント」への変更が最小の調整点になる。
- **弾の扱い**: すり抜けではなく消滅。解除直後に弾の中に埋もれて即死する事故を減らす。

---

## 2. モジュール構成

### 新規 `src/logic/invincible.ts`

無敵状態を純粋関数に閉じ込める。定数もここに置く。

```ts
export const INVINCIBLE_SEC = 8
export interface InvincibleState { remainingSec: number }
export function initialInvincibleState(): InvincibleState
export function isInvincible(s: InvincibleState): boolean
export function activateInvincible(s: InvincibleState): { state: InvincibleState; justStarted: boolean }
export function tickInvincible(s: InvincibleState, dtSec: number): { state: InvincibleState; justEnded: boolean }
```

- `justStarted` は直前に無敵でなかった場合のみ `true`。再取得では `false`
- `justEnded` は残時間が 0 を跨いだ**そのフレームだけ** `true`。
  すでに 0 の状態で tick し続けても立たない

**この2つのエッジフラグが本設計の要**。BGM の切替は「開始時に1回だけ無敵BGMへ、
終了時に1回だけ通常BGMへ戻す」というエッジ処理で、取りこぼすと BGM が戻らない、
あるいはタイマーが多重起動するという目視では気づきにくい壊れ方をする。
純粋関数にしてテストで担保する。

### 新規 `src/entities/item.ts`

`Bullet` / `JankenHand` と同形のエンティティ。

```ts
export const ITEM_RADIUS = 20
export const ITEM_LIFE_SEC = 8
export const ITEM_SPAWN_INTERVAL_SEC = 22
export const ITEM_FIRST_SPAWN_SEC = 15
export const ITEM_SPAWN_MARGIN = 80
export const ITEM_MIN_DIST_FROM_PLAYER = 220

export class StarItem {
  alive: boolean
  readonly radius: number
  constructor(x: number, y: number)
  update(dtSec: number): void
  isExpired(): boolean
  draw(ctx: CanvasRenderingContext2D, timeSec: number): void
}

export function pickItemSpawnPos(px: number, py: number, rand: () => number): { x: number; y: number }
```

`pickItemSpawnPos` は乱数源を引数で受ける(既存の `randomHand(Math.random)` と同じ流儀)。
純粋なのでテストで固定乱数を差せる。

### 変更するファイル

| ファイル | 変更内容 |
|---|---|
| `src/scenes/play.ts` | `items[]` / `itemTimer` / `inv` フィールド追加、衝突分岐の拡張、描画追加 |
| `src/audio.ts` | BGM をトラックテーブル化し `setBgmMode()` / `powerUp()` を追加 |
| `src/render/theme.ts` | `STAR_COLORS` を追加 |
| `src/entities/bullet.ts` | `private type` → `public readonly type`(1語) |

`bullet.ts` の変更は、弾消しパーティクルを弾種の色で出すために
`PlayScene` から `BULLET_COLORS[b.type]` を引きたいため。描画構造には触れない。

`STAR_COLORS` は DESIGN.md §2 の「黄＝良いこと」に沿う。

```ts
export const STAR_COLORS = { core: '#fff3a8', base: '#ffd23e', glow: '#ffb03a' }
```

`base` は既存 `COLORS.yellow` と同値。`core`/`glow` はグラデーション用の
明暗2値で、`HAND_COLORS` / `BULLET_COLORS` と同じ「描画に必要な数だけ持つ」方針。

---

## 3. データフロー(`PlayScene.update` の処理順)

既存の順序に差し込む。**4 と 7 が新規**。

1. `consumeConfirm()`
2. 経過時間・スコア加算、`flashSec` / `morphSec` 減衰
3. `player.update()`
4. **`tickInvincible()`** → `justEnded` なら `sound.setBgmMode('normal')`
5. `spawn(dtSec)` — 弾・手に加えて星のスポーン(§1 のタイマー規則に従う)
6. 各エンティティの `update()`(items を含む)
7. **星の取得判定** → `activateInvincible()`。`justStarted` なら
   `sound.setBgmMode('invincible')`。取得時は常に `sound.powerUp()` +
   黄フラッシュ 0.25s + `burstParticles(星のx, 星のy, STAR_COLORS.core, 20)`
8. 弾との衝突 → 無敵なら弾を `alive = false` にして弾種色のパーティクル、
   そうでなければ `gameOver()`
9. 手との衝突 → 無敵なら勝敗を無視して撃破、そうでなければ既存の `judge()`
10. `filter` で死んだ・寿命切れのものを除去(items を含む)

**7 を 8・9 より前に置くのは意図的**。同一フレームで星と弾に同時接触したとき、
取得を先に処理すれば無敵が成立して死なない。逆順だと「取ったのに死んだ」が起きる。
この理由はコード中にコメントとして残す。

無敵中の手の撃破処理は、勝敗判定をスキップする以外は既存パスと同一
(`h.alive = false` / `killBonus` 加算 / パーティクル / `sound.kill()` /
`addWin()` → `leveledUp` なら `levelUp()`)。

---

## 4. 描画と演出

DESIGN.md §6 の発光ルール(加算合成 `lighter` + `save`/`restore`)に従う。

### 星

1. `STAR_COLORS.glow` のラジアルグラデ(半径 `radius * 2.2`、中心 `55` → 外周 `00` アルファ)
2. その上に5稜星のパスを `core` → `base` の線形グラデで塗る
3. `timeSec * 1.2 rad/s` で回転、`1 + 0.08 * sin(timeSec * 4)` で脈動
4. 消滅 2 秒前から `Math.floor(lifeSec * 8) % 2` で点滅して予告

アニメの位相は `timeSec` 引数で外から受ける(DESIGN.md §9)。
`PlayScene` は `elapsedSec` を渡す。

### 無敵中の自機

自機中心・半径 `radius * 1.6`・線幅 4 の円弧を、12 時方向から時計回りに
`remainingSec / INVINCIBLE_SEC` の割合ぶん描く(`COLORS.yellow` + `shadowBlur 12`)。
残り 1.5 秒でリングを `Math.floor(t * 8) % 2` で点滅させ、切れる前に予告する。

- **自機のグロー色(手のキーカラー)は変えない。** 手の色は TARGET 判定に直結する
  情報なので、無敵表現で上書きすると誤読を招く。黄色はリングにだけ乗せる
- **リングは LVUP のモーフ点滅の影響を受けず常に描画する。** 無敵中に LVUP が
  起きたとき、自機と一緒にリングまで消えると残時間を見失うため

残り時間をサイドパネルではなくフィールドの自機周りに出すのは、パネルが
y=694 まで埋まっていて空き枠がないため。DESIGN.md §4 は
「フィールドに重ねてよいのは演出だけ」としており、自機に付随するリングは
数値 HUD ではなく演出として扱う。

### フラッシュの一般化

現状 `flashSec` は LVUP 専用の白フラッシュ。アイテム取得は黄フラッシュにして
区別したいので、`flashSec` に加えて `flashColor: string` と `flashMaxSec: number`
を持たせる。

| きっかけ | 色 | 時間 |
|---|---|---|
| LVUP | 白 `255,255,255` | 0.35s |
| アイテム取得 | 黄 `255,210,62` | 0.25s |

いずれも DESIGN.md §7 の「短く、強く、すぐ収まる(1秒以内)」に収まる。

### 弾消しパーティクル

`burstParticles(b.x, b.y, BULLET_COLORS[b.type].core, 8)`。
撃破の 16 個より少なめにして、無敵中に弾が大量に消えても画面が飽和しないようにする。

---

## 5. 音

### BGM のトラックテーブル化

`src/audio.ts` の `startBgmTimer()` に直書きされている音列・テンポを
テーブルへ移し、モードで切り替える。

```ts
type BgmMode = 'normal' | 'invincible'

const BGM_TRACKS: Record<BgmMode, {
  notes: number[]; stepMs: number; type: OscillatorType; gain: number; durSec: number
}> = {
  normal:     { notes: [262, 330, 392, 330, 294, 370, 440, 370], stepMs: 220, type: 'triangle', gain: 0.03,  durSec: 0.18 },
  invincible: { notes: [523, 659, 784, 988, 784, 659, 880, 988], stepMs: 110, type: 'square',   gain: 0.045, durSec: 0.09 },
}
```

`normal` は現行の値をそのまま移したもの(既存の聞こえ方を変えない)。
`invincible` は1オクターブ上・倍テンポ・矩形波で「切り替わった」と即座に分かるようにする。

### `setBgmMode(mode: BgmMode): void`

- 現在のモードと同じなら何もしない(no-op)
- 違えば `bgmMode` を更新し、**`bgmTimer` が動いているときだけ** clear → start で
  タイマーを作り直す
- `bgmRunning` / `pausedByVisibility` には触らない

非表示タブで `bgmTimer` が止まっている間はモード変数だけ更新され、
既存の `visibilitychange` ハンドラが復帰時に新しいモードで鳴らす。

### `stopBgm()` でモードをリセットする

`stopBgm()` の中で `bgmMode = 'normal'` に戻す。`GameContext` の `Sound` は
シーンをまたいで共有されるため、これがないと「無敵中でない次のプレイが
無敵BGMで始まる」状態の漏れが起きうる。`stopBgm()` は `PlayScene.gameOver()` から、
`startBgm()` は `title.ts` と `gameover.ts` の遷移時に呼ばれる。

### `powerUp(): void`

取得時の効果音。上昇アルペジオ 784 → 1047 → 1319 Hz を `square` で 0.05 秒間隔、
最後の音だけ長めに伸ばす。既存の `levelUp()`(523/659/784/1047、`triangle`、
0.09 秒間隔)と音色・テンポで区別できるようにしている。

---

## 6. エッジケース

| ケース | 挙動 |
|---|---|
| 非表示タブ中に無敵が開始/終了 | `setBgmMode()` はモード変数だけ更新。復帰時に正しいモードで再開 |
| リトライ後の BGM | `stopBgm()` が `bgmMode` を `'normal'` に戻すので必ず通常BGMで始まる |
| 無敵中の再取得 | 残時間リセット。`setBgmMode` は同一モードで no-op、`powerUp()` は鳴る |
| 無敵中の LVUP | 形態変化・フラッシュ・バナーは通常どおり。無敵は継続 |
| 星の寿命切れ | 何も起きない。次のスポーンタイマーが `ITEM_SPAWN_INTERVAL_SEC` で回り始める |
| 大きな `dtSec` | `game.ts` で 1/30 にクランプ済み。1フレームで無敵が丸ごと消費されることはない |
| `AudioContext` 未初期化/suspended | 既存の `ensure()` がハンドルする。変更なし |

---

## 7. テスト

### 新規 `tests/invincible.test.ts`

- `activateInvincible` は初回で `justStarted = true`、残時間が `INVINCIBLE_SEC` になる
- 無敵中の再取得では `justStarted = false` かつ残時間が `INVINCIBLE_SEC` にリセットされる(加算されない)
- `tickInvincible` は残時間が 0 を跨いだフレームだけ `justEnded = true`
- その次のフレーム、および 0 のまま tick し続けても `justEnded = false`
  (BGM 多重復帰の回帰テスト)
- `isInvincible` の境界(残時間 0 は false)

### 新規 `tests/item.test.ts`

- `pickItemSpawnPos` の結果が外周マージン内に出ない
- 自機から `ITEM_MIN_DIST_FROM_PLAYER` 以上離れる
- 距離条件を満たせない乱数を与えてもフィールド内かつマージン内には収まる
- `StarItem.isExpired()` の境界(`ITEM_LIFE_SEC` 経過で true)

### 既存 `tests/play-scene.test.ts` への追加

- 星に触れると無敵になり、`setBgmMode('invincible')` が呼ばれる
- 無敵中に弾に触れても `GameOverScene` に遷移せず、弾が `alive = false` になる
- 無敵中に負ける手に触れても遷移せず、撃破され `killBonus` と勝利カウントが入る
- 無敵が切れたフレームで `setBgmMode('normal')` がちょうど1回だけ呼ばれる
- 星と弾に同時接触したフレームで GAME OVER にならない(処理順の回帰テスト)
- 場に星がある間は次の星が湧かない。星が消えてから
  `ITEM_SPAWN_INTERVAL_SEC` 経過して初めて次が湧く

`makeContext()` の `Sound` スタブに `setBgmMode` と `powerUp` を追加する。
呼び出し回数と引数を記録できるスパン形式にして、上記の「ちょうど1回」を検証する。

---

## 8. DESIGN.md の更新

本設計で追加される取り決めを DESIGN.md に反映する。

- §2 カラーパレットに `STAR_COLORS` を追記
- §6 エンティティの発光ルールの表に「アイテム(星)」の行を追加
- §7 モーション・演出の表に「アイテム取得フラッシュ 0.25s」「無敵リング」を追加
