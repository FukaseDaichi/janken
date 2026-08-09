import { Game } from './game'
import { TitleScene } from './scenes/title'
import { Input } from './input'
import { loadAssets } from './assets'
import { Sound } from './audio'

async function main(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!
  const input = new Input()
  // アセット読み込み完了後にアタッチする。読み込み中に押された Enter/Space は
  // Input.confirmEdge にラッチされて残り、TitleScene の最初の update() で即座に
  // 消費されて PlayScene に飛んでしまい、タイトル画面が一度も見えなくなる。
  // 読み込みは通常数百ms程度なので、その間の最初の1打鍵を落としても
  // レスポンスの悪さとしては感じられない。
  const assets = await loadAssets()
  input.attach()
  const g = { input, assets, sound: new Sound(), storage: localStorage }
  new Game(ctx, new TitleScene(g)).start()
}

void main()
