import { isSkinId, isUnlocked, type SkinId } from './logic/skins'

export const HIGHSCORE_KEY = 'janken-dodge-highscore'
export const SKIN_KEY = 'janken-dodge-skin'

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

/** 保存値が不正 ID・未解放スキンのときは 'default' にフォールバックする。
 *  highScore には loadHighScore() の値を渡すこと。 */
export function loadSkin(store: ScoreStore, highScore: number): SkinId {
  const raw = store.getItem(SKIN_KEY)
  if (raw !== null && isSkinId(raw) && isUnlocked(raw, highScore)) return raw
  return 'default'
}

/** 呼び出し側で解放済みスキンのみを渡すこと(未解放は保存しない仕様)。 */
export function saveSkin(store: ScoreStore, id: SkinId): void {
  store.setItem(SKIN_KEY, id)
}
