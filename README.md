# じゃんけん弾除け

グー・チョキ・パーの形態を持つプレイヤーが、飛来する弾とじゃんけんの手を避け（時に倒し）ながらスコアを稼ぐ PC ブラウザ向け弾除けゲーム。

公開URL: https://fukasedaichi.github.io/janken/

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
