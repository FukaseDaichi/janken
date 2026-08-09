export const BASE_RATE = 100
export const KILL_BONUS = 500

export function levelMultiplier(level: number): number {
  return 1 + (level - 1) * 0.5
}

export function timeScore(dtSec: number, level: number): number {
  return BASE_RATE * dtSec * levelMultiplier(level)
}

export function killBonus(level: number): number {
  return KILL_BONUS * levelMultiplier(level)
}
