import { HAND_COLORS } from './render/theme'

/** 正方形として中心座標で描くスプライト。読み込み失敗時は絵文字にフォールバックする */
export type SpriteName =
  | 'player-rock' | 'player-scissors' | 'player-paper'
  | 'enemy-rock' | 'enemy-scissors' | 'enemy-paper'

/** スプライト + 単体で扱う一枚絵。'hero-title' はタイトルのロゴ看板 */
export type ImageName = SpriteName | 'hero-title'

const IMAGE_FILES: Record<ImageName, string> = {
  'player-rock': 'player-rock.png',
  'player-scissors': 'player-scissors.png',
  'player-paper': 'player-paper.png',
  'enemy-rock': 'enemy-rock.png',
  'enemy-scissors': 'enemy-scissors.png',
  'enemy-paper': 'enemy-paper.png',
  // ヒーロー画像だけ WebP。同じ絵の PNG は 1.1MB あり初回ロードに見合わない(WebP は 205KB)。
  // 元絵と生成手順は docs/reference/title.png と tools/make-hero.py を参照。
  'hero-title': 'hero-title.webp',
}

const FALLBACK_EMOJI: Record<SpriteName, string> = {
  'player-rock': '✊', 'player-scissors': '✌️', 'player-paper': '✋',
  'enemy-rock': '✊', 'enemy-scissors': '✌️', 'enemy-paper': '✋',
}

const HAND_OF: Record<SpriteName, keyof typeof HAND_COLORS> = {
  'player-rock': 'rock', 'player-scissors': 'scissors', 'player-paper': 'paper',
  'enemy-rock': 'rock', 'enemy-scissors': 'scissors', 'enemy-paper': 'paper',
}

export class Assets {
  constructor(private images: Partial<Record<ImageName, HTMLImageElement>>) {}

  /** 読み込み済みの画像。未読み込み/失敗時は undefined を返すので、呼び出し側で代替表示を用意する */
  get(name: ImageName): HTMLImageElement | undefined {
    return this.images[name]
  }

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

function loadImage(name: ImageName): Promise<[ImageName, HTMLImageElement | undefined]> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve([name, img])
    img.onerror = () => resolve([name, undefined])
    img.src = `${import.meta.env.BASE_URL}assets/${IMAGE_FILES[name]}`
  })
}

export async function loadAssets(): Promise<Assets> {
  const names = Object.keys(IMAGE_FILES) as ImageName[]
  const entries = await Promise.all(names.map(loadImage))
  const images: Partial<Record<ImageName, HTMLImageElement>> = {}
  for (const [name, img] of entries) if (img) images[name] = img
  return new Assets(images)
}
