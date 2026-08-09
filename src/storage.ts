export const HIGHSCORE_KEY = 'janken-dodge-highscore'

export type ScoreStore = Pick<Storage, 'getItem' | 'setItem'>

export function loadHighScore(store: ScoreStore): number {
  const raw = store.getItem(HIGHSCORE_KEY)
  const n = raw === null ? NaN : Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function saveHighScoreIfHigher(store: ScoreStore, score: number): boolean {
  const floored = Math.floor(score)
  if (floored <= loadHighScore(store)) return false
  store.setItem(HIGHSCORE_KEY, String(floored))
  return true
}
