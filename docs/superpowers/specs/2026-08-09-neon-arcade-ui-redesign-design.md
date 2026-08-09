# じゃんけんサバイバー — ネオンアーケードUI再設計

日付: 2026-08-09
ステータス: 承認待ち

## 目的

リファレンス画像(ネオンアーケード調のキービジュアル)に合わせて、ゲームの見た目を全面再設計する。
**ゲーム性(ロジック・当たり判定・難易度・操作)は一切変更しない。**

## 非目標(やらないこと)

- `logic/` 配下、`entities/*` の update・衝突判定、`input.ts`、`storage.ts`、`audio.ts`、シーン遷移の変更
- モバイル対応・タッチ操作
- キャラ画像の手描き・コード描画(画像は Codex imagegen による AI 生成に一本化)

## アートディレクション

- **世界観**: 暗い空間(#0a0618 系の深い紫紺)+ パースの効いたネオングリッド床 + ビネット
- **キーカラー**(手の3すくみ、リファレンス踏襲):
  - グー = ネオングリーン `#5ad14f` / 発光 `#8dff70`
  - チョキ = ピンク/マゼンタ `#e8586f` / 発光 `#ff7d9c`
  - パー = ブルー `#3f9df0` / 発光 `#6fc4ff`
  - アクセント: シアン `#37e0e8`(スコア)、イエロー `#ffd23e`(倍率・強調)、レッド `#ff3b4f`(危険・GAME OVER)
- **タイポグラフィ**(Google Fonts、`index.html` で読み込み):
  - 見出し・ロゴ: **Dela Gothic One**(極太日本語、袋文字向き)
  - 数字・英字ラベル: **Orbitron**(SCORE / MULTIPLIER / LV)
  - フォント未ロード時は sans-serif フォールバック。`main.ts` で `document.fonts.ready` を await してから起動(既存のアセット待ちと同列)

## レイアウト: サイドパネル型(案A)

- canvas 内部解像度を **960×720 → 1200×720** に変更(`index.html`)
  - CSS の 4:3 固定を 5:3 に更新(`aspect-ratio: 5 / 3`、`min()` 式も対応)
- **プレイフィールドは左 960×720 のまま**。`FIELD_W` / `FIELD_H` は不変 → 移動範囲・スポーン・衝突は完全無変更
- 右 240px は常設サイドパネル。**描画順: フィールド内容 → パネル**(フィールド右端外にスポーンした敵弾のはみ出しをパネルが覆う)

## 新規モジュール構成

描画専用モジュールを `src/render/` に新設し、シーンから呼ぶ:

| ファイル | 責務 |
|---|---|
| `src/render/theme.ts` | カラー・フォント定数(上記キーカラーの一元管理)。手の種類→色のマップ |
| `src/render/background.ts` | ネオングリッド床(パース+奥行きフェード)、ビネット、浮遊光点。時間を受け取り微アニメ。`background.png` は使用終了 |
| `src/render/panel.ts` | 右サイドパネル描画。入力: score, level, multiplier, wins, playerHand |
| `src/render/text.ts` | 袋文字(縁取り+シャドウ)ヘルパー、ネオングロー文字ヘルパー |

各モジュールは `(ctx, ...データ)` を受け取る純粋な描画関数。状態は持たない(背景のアニメ位相のみ経過時間引数で受ける)。

## 画面別仕様

### 1. タイトル (`scenes/title.ts` の draw 全面書き換え)

- 背景: ネオングリッド + 浮遊する敵手スプライト(ゆっくり漂う装飾、当たり判定なし)
- 中央上: 六角形エンブレム3個(グー緑/チョキマゼンタ/パー青、絵文字 or スプライト)
- ロゴ: 「じゃんけん」(白・黒縁・斜めシャドウ)/「サバイバー」(黄→オレンジグラデ・黒縁)の2段、わずかに斜体。下にキャッチコピー「― 勝てる手で、弾をかいくぐれ！ ―」
- 下部: **ルールカード4枚**(角丸パネル、ネオン枠):
  1. 操作 — 矢印キー / WASD で移動
  2. 弾に当たると GAME OVER
  3. 勝てる手なら体当たりで倒せる(✊>✌️>✋>✊ の図)/ あいこ・負けは GAME OVER
  4. 3回勝つと LEVEL UP! 形態がランダムに変わりスコア倍率が上がる
- 最下部: 「PRESS ENTER / SPACE」(点滅)、ハイスコア表示
- update() は無変更

### 2. プレイ (`scenes/play.ts` の draw/drawHud 書き換え)

- 背景: ネオングリッド(`render/background.ts`)
- 弾: グロー(半径方向グラデ)+ 進行方向の残光ストリーク。`bullet.ts` の draw のみ変更(速度角度は内部の vx/vy から算出)。`bullet.png` 画像は使用終了しコード描画に統一
- 敵の手・プレイヤー: スプライトの下に色付きグロー(soft-light 円)を敷いて発光感を出す。draw のみ変更
- パーティクル: 加算合成(`globalCompositeOperation: 'lighter'`)+ サイズ減衰。`particle.ts` の draw のみ変更
- LVUP演出: 既存の flash/morph に加え、フィールド中央に「LEVEL UP!」バナー(黄・袋文字、0.6秒スイープ)。既存 `morphSec` を流用
- HUD: フィールド上のテキストを全廃し、右パネルへ移動:
  - SCORE(Orbitron、シアン、カンマ区切り)
  - MULTIPLIER ×N.N(イエロー)
  - LV(大きく)
  - 勝利ゲージ: ○○○ の3ピップ(`WINS_PER_LEVEL`)
  - 自分の手(スプライト+ラベル)と「倒せる手」(大きく、緑グロー枠)

### 3. ゲームオーバー (`scenes/gameover.ts` の draw 書き換え)

- 暗転 + グリッド薄表示。シェイクは既存のまま
- 「GAME OVER」: 赤の袋文字 + グリッチ風二重ずらし(赤/シアンの色ずれ)
- 中央パネル: スコア・到達レベル・ハイスコア。更新時は「★ NEW RECORD ★」がネオン点滅(sin波でalpha)
- 「PRESS ENTER / SPACE — RETRY」点滅

## キャラ素材の再生成(Codex imagegen 担当)

- Codex CLI の組み込み `imagegen` スキル(`image_gen` ツール、gpt-image-2)で**ビットマップ画像を直接生成**する
- **参考画像**: ユーザー提供のキービジュアル(ネオンアーケード調)を `docs/reference/` に置き、Codex にスタイル参照として渡す
- **並行生成**: 複数の Codex サブエージェントを並行起動し、それぞれ別プロンプト方針(例: 参考画像忠実 / よりデフォルメ / より発光強め)で候補セットを生成 → 全候補を見比べて最良セットを採用
- 生成対象: `player-rock/scissors/paper.png`、`enemy-rock/scissors/paper.png` の6種
  - スタイル: 参考画像準拠の3Dレンダー調。グー=緑、チョキ=ピンク、パー=青。敵=怒り顔、自機=元気/凛々しい顔。ネオン発光の縁
  - **透過背景必須**: 組み込みモードでフラットなクロマキー背景で生成 → `remove_chroma_key.py` でアルファ化(imagegen スキルの標準手順)
  - サイズ: 256×256 以上で生成し必要ならリサイズ(描画側は size 指定なので解像度変更の影響なし)
- `bullet.png` / `background.png` は生成しない(コード描画に移行)。ファイルは削除し、`assets.ts` の `SpriteName` から `bullet` / `background` を外す
- 採用後も、同名 PNG を置くだけで手動差し替え可能(この互換性は維持する)

## エラー処理

- スプライト読込失敗: 既存の絵文字フォールバックを維持(色は theme.ts の手色に合わせて更新)
- フォント読込失敗/オフライン: `document.fonts.ready` は失敗してもresolveされるため起動はブロックされない。sans-serif で表示継続

## テスト・検証

- 既存 vitest(`npm test`)が無変更で通ること(ロジック非変更の証明)
- `npm run build`(tsc --noEmit 含む)が通ること
- ブラウザ実機確認(dev server + スクリーンショット): タイトル/プレイ/LVUP演出/ゲームオーバーの4状態
- 描画モジュールは視覚成果物のためユニットテスト対象外。ただし theme.ts の手→色マップは全 Hand 網羅を型で保証(`Record<Hand, ...>`)

## 変更ファイル一覧(見込み)

- 変更: `index.html`, `src/main.ts`, `src/assets.ts`, `src/scenes/{title,play,gameover}.ts`, `src/entities/{bullet,hand,player,particle}.ts`(draw のみ)
- 新規: `src/render/{theme,background,panel,text}.ts`, `docs/reference/`(参考画像)
- 削除: `public/assets/{background,bullet}.png`(生成後に旧手PNGも上書き)
