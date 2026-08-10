import { Game } from './game'
import { TitleScene } from './scenes/title'
import { Input } from './input'
import { loadAssets } from './assets'
import { Sound } from './audio'
import { CANVAS_W, CANVAS_H } from './render/theme'

async function main(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement
  // 内部解像度の情報源は theme.ts に一本化する。index.html の width/height 属性は
  // 初期描画のちらつきを避けるための初期値で、実値はここで上書きする。
  canvas.width = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')!
  const input = new Input()
  // アセット読み込み完了後にアタッチする。読み込み中に押された Enter/Space は
  // Input.confirmEdge にラッチされて残り、TitleScene の最初の update() で即座に
  // 消費されて PlayScene に飛んでしまい、タイトル画面が一度も見えなくなる。
  // 読み込みは通常数百ms程度(画像は全 22 枚で計約 800KB)なので、その間の
  // 最初の1打鍵を落としてもレスポンスの悪さとしては感じられない。
  const assets = await loadAssets()
  // Canvas 2D の ctx.font 代入は Web フォントの遅延ロードをトリガーしないため、
  // 実際に使う指定を明示的にロードしてから描画を開始する。オフライン等で
  // 失敗しても catch して握り潰し、sans-serif フォールバックで起動を続ける。
  await Promise.all([
    document.fonts.load('16px "Dela Gothic One"'),
    document.fonts.load('500 16px "Orbitron"'),
    document.fonts.load('700 16px "Orbitron"'),
    document.fonts.load('900 16px "Orbitron"'),
  ].map((p) => p.catch(() => undefined)))
  await document.fonts.ready
  input.attach()
  const g = { input, assets, sound: new Sound(), storage: localStorage }
  new Game(ctx, new TitleScene(g)).start()
}

void main()
