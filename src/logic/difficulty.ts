export type BulletType = 'straight' | 'aimed' | 'curve'

export interface DifficultyParams {
  bulletInterval: number
  handInterval: number
  speedMin: number
  speedMax: number
  bulletTypes: BulletType[]
}

export function difficultyFor(level: number, elapsedSec: number): DifficultyParams {
  // 時間とレベルの両方で 0→1 に近づく進行度
  const t = Math.min(1, elapsedSec / 180)
  const l = Math.min(1, (level - 1) / 9)
  const p = Math.min(1, t * 0.6 + l * 0.6)

  const bulletTypes: BulletType[] = ['straight']
  if (level >= 3) bulletTypes.push('aimed')
  if (level >= 5) bulletTypes.push('curve')

  return {
    bulletInterval: Math.max(0.12, 1.0 - 0.88 * p),
    handInterval: Math.max(0.5, 3.0 - 2.5 * p),
    speedMin: 80 + 100 * p,
    speedMax: Math.min(420, 160 + 260 * p),
    bulletTypes,
  }
}
