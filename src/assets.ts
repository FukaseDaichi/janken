export type SpriteName =
  | 'player-rock' | 'player-scissors' | 'player-paper'
  | 'enemy-rock' | 'enemy-scissors' | 'enemy-paper'
  | 'bullet' | 'background'

const FALLBACK_EMOJI: Record<SpriteName, string> = {
  'player-rock': '✊', 'player-scissors': '✌️', 'player-paper': '✋',
  'enemy-rock': '✊', 'enemy-scissors': '✌️', 'enemy-paper': '✋',
  bullet: '💢', background: '',
}

export class Assets {
  constructor(private images: Partial<Record<SpriteName, HTMLImageElement>>) {}

  draw(ctx: CanvasRenderingContext2D, name: SpriteName, x: number, y: number, size: number): void {
    const img = this.images[name]
    if (img) {
      ctx.drawImage(img, x - size / 2, y - size / 2, size, size)
      return
    }
    // フォールバック: 敵は赤円、味方は青円の上に絵文字
    // 'background' はここでは描かない（drawBackground が担当する）
    if (name !== 'background') {
      ctx.save()
      ctx.fillStyle = name.startsWith('enemy') ? '#c0392b' : name === 'bullet' ? '#8e44ad' : '#2980b9'
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

  drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const img = this.images.background
    if (img) {
      ctx.drawImage(img, 0, 0, w, h)
    } else {
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, w, h)
    }
  }
}

const NAMES: SpriteName[] = [
  'player-rock', 'player-scissors', 'player-paper',
  'enemy-rock', 'enemy-scissors', 'enemy-paper',
  'bullet', 'background',
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
