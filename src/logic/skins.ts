/** きせかえスキン定義。解放判定は保存済みハイスコアのみを参照する(純粋ロジック、DOM/Canvas 非依存)。
 *  配列順 = ゲームオーバー画面での ←→ 巡回順。 */
export const SKINS = [
  { id: 'default', label: 'DEFAULT', unlockScore: 0 },
  { id: 'cyber', label: 'CYBER', unlockScore: 15000 },
  { id: 'mage', label: 'MAGE', unlockScore: 30000 },
  { id: 'forest', label: 'FOREST', unlockScore: 45000 },
  { id: 'samurai', label: 'SAMURAI', unlockScore: 60000 },
  { id: 'maid', label: 'MAID', unlockScore: 75000 },
] as const

export type SkinId = (typeof SKINS)[number]['id']

export function isSkinId(v: unknown): v is SkinId {
  return typeof v === 'string' && SKINS.some((s) => s.id === v)
}

export function unlockScoreOf(id: SkinId): number {
  return SKINS.find((s) => s.id === id)!.unlockScore
}

export function isUnlocked(id: SkinId, highScore: number): boolean {
  return highScore >= unlockScoreOf(id)
}

/** 全スキンを巡回する(未解放も含める — シルエット表示でモチベーションにするため)。 */
export function nextSkin(current: SkinId, dir: 1 | -1): SkinId {
  const i = SKINS.findIndex((s) => s.id === current)
  return SKINS[(i + dir + SKINS.length) % SKINS.length].id
}
