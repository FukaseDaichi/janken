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

- `src/logic/` — 純粋ロジック（じゃんけん勝敗判定、難易度曲線、レベル、スコア）。DOM/Canvas 非依存で、テストは主にここと `src/entities/` を対象にしている。
- `src/entities/` — プレイヤー・弾・じゃんけんの手・パーティクル・衝突判定。
- `src/render/` — 描画ユーティリティとテーマ。**内部解像度（CANVAS_W/H）や色などの定数は `src/render/theme.ts` に一本化**されている。index.html 側の canvas 属性は初期値にすぎない。
- `src/input.ts` — キー入力。Enter/Space はエッジラッチ方式（`confirmEdge`）。
- `src/storage.ts` — ハイスコアの永続化。

## ゲームルール（ロジック変更時の前提）

- 弾に当たると GAME OVER。じゃんけんの手は「勝てる手」のみ体当たりで倒せる（あいこ・負けは GAME OVER）。
- 3勝で LVUP、形態がランダムに変わりスコア倍率が上がる。
