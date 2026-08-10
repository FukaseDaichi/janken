# ゲームオーバー画面のきせかえ(スキン)機能 設計

日付: 2026-08-10

## 目的

ハイスコアに応じて解放される「きせかえ(スキン)」を追加する。ゲームオーバー画面で
スキンを選択でき、選択したスキンは次のプレイから自機スプライト(グー・チョキ・パー)に
反映される。未解放スキンもシルエットで見せ、必要スコアを提示してモチベーションにする。

## スキン一覧と解放条件

解放判定は**保存済みハイスコア**(NEW RECORD 更新直後はその更新値)のみを参照する。

| 順序 | ID | ラベル | 解放ハイスコア | 画像ソース |
|---|---|---|---|---|
| 1 | `default` | デフォルト | 0(常時) | 既存 `player-{hand}.png` |
| 2 | `cyber` | サイバー | 15,000 | `output/imagegen/revised/02-cyber-*.png` |
| 3 | `mage` | メイジ | 30,000 | `output/imagegen/revised/03-mage-*.png` |
| 4 | `forest` | フォレスト | 45,000 | `output/imagegen/revised/04-forest-*.png` |
| 5 | `samurai` | サムライ | 60,000 | `output/imagegen/revised/05-samurai-*.png` |
| 6 | `maid` | メイド | 75,000 | `output/imagegen/revised/01-maid-*.png` |

## アーキテクチャ

### src/logic/skins.ts(新規・純粋ロジック)

- `SkinId` 型と `SKINS` テーブル(`{ id, label, unlockScore }[]`、配列順 = 巡回順)。
- `isUnlocked(id, highScore): boolean`
- `nextSkin(current, dir): SkinId` — 全スキンを巡回(未解放も含む)。
- DOM / Canvas 非依存。ユニットテスト対象。

### src/storage.ts

- `SKIN_KEY = 'janken-dodge-skin'` を追加。
- `loadSkin(store, highScore): SkinId` — 保存値が不正 ID または未解放なら `'default'` に
  フォールバック。
- `saveSkin(store, id): void` — 呼び出し側で解放済みのみ渡す。

### src/assets.ts

- `IMAGE_FILES` に `player-{skin}-{hand}` 15 エントリを追加(default は既存名のまま)。
- 起動時に一括ロード。読み込み失敗時は既存フォールバック(絵文字)を踏襲。
- スキン+手 → `SpriteName` の解決ヘルパーを用意する(default のみ従来名になる分岐を
  一箇所に閉じ込める)。

### アセット配置

- `output/imagegen/revised/NN-{skin}-{hand}.png` → `public/assets/player-{skin}-{hand}.png`
  として 15 枚コピー(約 1MB 増)。

### プレイへの反映

- `PlayScene` / `Player` の描画時に、選択スキン+現在の手からスプライト名を解決する。
- ロジック(当たり判定・スコア・レベル)は一切変更しない。見た目のみ。

### ゲームオーバー画面(src/scenes/gameover.ts)

- スコアパネルの左側に選択中スキンのキャラ絵を表示(手はグーで代表)。
- `←` / `→` で全スキンを巡回。未解放スキンはシルエット(黒塗り)+
  `UNLOCK <必要スコア>` を表示。
- 解放済みスキンにカーソルが合った時点で即 localStorage に保存。
- 未解放スキンを表示中に Enter/Space でリトライした場合、保存は行わず
  直前に保存された解放済みスキンでプレイ開始。
- リトライ操作(Enter/Space、シェイク中の入力排水)は従来どおり。

## テスト

- `tests/skins.test.ts`(新規): 解放判定の境界値、巡回順(両方向・ラップ)、
  `loadSkin` の不正値・未解放フォールバック、`saveSkin` の保存。
- 既存テストは変更不要の見込み(ロジック変更なし)。

## 非スコープ

- タイトル画面やプレイ中のスキン切り替え UI
- 敵スプライトのきせかえ
- 画像の WebP 化(必要になれば別途)
