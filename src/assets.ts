import { HAND_COLORS } from './render/theme'
import type { SkinId } from './logic/skins'
import type { Hand } from './logic/janken'

type SkinnedSkin = Exclude<SkinId, 'default'>

/** 正方形として中心座標で描くスプライト。読み込み失敗時は絵文字にフォールバックする */
export type SpriteName =
  | `player-${Hand}`
  | `player-${SkinnedSkin}-${Hand}`
  | `enemy-${Hand}`

/** スプライト + 単体で扱う一枚絵。'hero-title' はタイトルのロゴ看板 */
export type ImageName = SpriteName | 'hero-title'

const IMAGE_FILES: Record<ImageName, string> = {
  'player-rock': 'player-rock.png',
  'player-scissors': 'player-scissors.png',
  'player-paper': 'player-paper.png',
  'player-cyber-rock': 'player-cyber-rock.png',
  'player-cyber-scissors': 'player-cyber-scissors.png',
  'player-cyber-paper': 'player-cyber-paper.png',
  'player-mage-rock': 'player-mage-rock.png',
  'player-mage-scissors': 'player-mage-scissors.png',
  'player-mage-paper': 'player-mage-paper.png',
  'player-forest-rock': 'player-forest-rock.png',
  'player-forest-scissors': 'player-forest-scissors.png',
  'player-forest-paper': 'player-forest-paper.png',
  'player-samurai-rock': 'player-samurai-rock.png',
  'player-samurai-scissors': 'player-samurai-scissors.png',
  'player-samurai-paper': 'player-samurai-paper.png',
  'player-maid-rock': 'player-maid-rock.png',
  'player-maid-scissors': 'player-maid-scissors.png',
  'player-maid-paper': 'player-maid-paper.png',
  'enemy-rock': 'enemy-rock.png',
  'enemy-scissors': 'enemy-scissors.png',
  'enemy-paper': 'enemy-paper.png',
  // ヒーロー画像だけ WebP。同じ絵の PNG は 1.1MB あり初回ロードに見合わない(WebP は 205KB)。
  // 元絵と生成手順は docs/reference/title.png と tools/make-hero.py を参照。
  'hero-title': 'hero-title.webp',
}

const FALLBACK_EMOJI: Record<Hand, string> = { rock: '✊', scissors: '✌️', paper: '✋' }

/** スプライト名は必ず `-{hand}` で終わる規約なので、末尾から手を導出する */
function handOfSprite(name: SpriteName): Hand {
  return name.split('-').pop() as Hand
}

/** 選択スキン + 現在の手からスプライト名を解決する。default だけ従来名になる分岐をここに閉じ込める */
export function playerSprite(skin: SkinId, hand: Hand): SpriteName {
  return skin === 'default' ? `player-${hand}` : `player-${skin}-${hand}`
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
    const hand = handOfSprite(name)
    ctx.save()
    ctx.fillStyle = HAND_COLORS[hand].base
    ctx.beginPath()
    ctx.arc(x, y, size / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = `${size * 0.6}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(FALLBACK_EMOJI[hand], x, y)
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
