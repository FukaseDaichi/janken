import { Game } from './game'
import { TitleScene } from './scenes/title'
import { Input } from './input'
import { loadAssets } from './assets'
import { Sound } from './audio'

async function main(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!
  const input = new Input()
  input.attach()
  const assets = await loadAssets()
  const g = { input, assets, sound: new Sound(), storage: localStorage }
  new Game(ctx, new TitleScene(g)).start()
}

void main()
