export const WINS_PER_LEVEL = 3

export interface LevelState {
  level: number
  wins: number
}

export function initialLevelState(): LevelState {
  return { level: 1, wins: 0 }
}

export function addWin(s: LevelState): { state: LevelState; leveledUp: boolean } {
  const wins = s.wins + 1
  if (wins >= WINS_PER_LEVEL) {
    return { state: { level: s.level + 1, wins: 0 }, leveledUp: true }
  }
  return { state: { level: s.level, wins }, leveledUp: false }
}
