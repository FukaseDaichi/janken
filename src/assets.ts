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
