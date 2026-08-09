# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

「じゃんけんサバイバー」— グー・チョキ・パーの形態を持つプレイヤーが弾とじゃんけんの手を避けながらスコアを稼ぐ、Canvas 2D ベースのブラウザ弾除けゲーム。フレームワーク不使用の TypeScript + Vite 構成。main への push で GitHub Actions が GitHub Pages に自動デプロイする。

## コマンド

```bash
npm run dev                # 開発サーバー (Vite)
npm test                   # 全ユニットテスト (vitest run)
npx vitest run tests/janken.test.ts   # 単一テストファイル実行
npm run build              # tsc --noEmit で型チェック後に vite build
```

## アーキテクチャ

ゲームループはシーン遷移パターンで動く:

- `src/game.ts` — `Game` クラスが requestAnimationFrame ループを回し、`Scene` インターフェース（`update(dtSec)` が次のシーンまたは null を返す / `draw(ctx)`）でシーンを切り替える。dt は 1/30 秒に上限クランプ。
- `src/scenes/` — `title` → `play` → `gameover` の3シーン。シーン遷移は `update()` の戻り値で行う。
- `src/main.ts` — エントリポイント。アセットと Web フォントのロード完了後にループを開始する（起動順序に関するコメントが本文にあるので変更時は読むこと）。

レイヤー分離:

- `src/logic/` — 純粋ロジック（じゃんけん勝敗判定、難易度曲線、レベル、スコア、無敵状態）。DOM/Canvas 非依存で、テストは主にここと `src/entities/` を対象にしている。
- `src/entities/` — プレイヤー・弾・じゃんけんの手・アイテム（星）・パーティクル・衝突判定。
- `src/render/` — 描画ユーティリティとテーマ。**内部解像度（CANVAS_W/H）や色などの定数は `src/render/theme.ts` に一本化**されている。index.html 側の canvas 属性は初期値にすぎない。
- `src/assets.ts` — 画像のロード。ファイル名は `IMAGE_FILES` に集約。読み込み失敗時は `Assets.get()` が undefined を返し、呼び出し側が代替描画にフォールバックする。
- `src/audio.ts` — WebAudio によるビープ生成。BGM は `BGM_TRACKS`（`normal` / `invincible`）をモードで切り替える。
- `src/input.ts` — キー入力。Enter/Space はエッジラッチ方式（`confirmEdge`）。
- `src/storage.ts` — ハイスコアの永続化。

## タイトル画面のヒーロー画像

タイトル画面は `public/assets/hero-title.webp`（ロゴ看板）を主役に構成する。元絵は
`docs/reference/title.png`、書き出しは `python3 tools/make-hero.py`（要 Pillow）。
黒背景の発光ロゴなので **screen 合成**で背景に重ねており、書き出し時に黒を 0 まで潰して
外周をフェザーしてある。背景の遠近グリッドの地平線は看板の下端（`FLOOR_Y`）に合わせて
いるので、片方の座標を動かすときはもう片方も見ること。

## ゲームルール（ロジック変更時の前提）

- 弾に当たると GAME OVER。じゃんけんの手は「勝てる手」のみ体当たりで倒せる（あいこ・負けは GAME OVER）。
- 3勝で LVUP、形態がランダムに変わりスコア倍率が上がる。
- 一定間隔で星アイテムが出現し、取得すると 8 秒間無敵になり BGM が切り替わる。無敵中は触れた弾が消え、じゃんけんの勝敗を無視して手を倒せる（撃破ボーナスと勝利カウントは通常どおり入る）。
