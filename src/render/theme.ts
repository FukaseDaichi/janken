import type { Hand } from '../logic/janken'
import type { BulletType } from '../logic/difficulty'

export const CANVAS_W = 1200
export const CANVAS_H = 720
export const PANEL_X = 960
export const PANEL_W = 240

export const COLORS = {
  bgDeep: '#0a0618',
  cyan: '#37e0e8',
  yellow: '#ffd23e',
  red: '#ff3b4f',
  white: '#ffffff',
  panelBg: 'rgba(10, 8, 30, 0.92)',
  panelBorder: '#5a3fd0',
  label: 'rgba(255, 255, 255, 0.55)',
  labelStrong: 'rgba(255, 255, 255, 0.7)',
} as const

/** 手ごとのキーカラー。Record<Hand, ...> により全 Hand の網羅を型で保証する */
export const HAND_COLORS: Record<Hand, { base: string; glow: string }> = {
  rock: { base: '#5ad14f', glow: '#8dff70' },
  scissors: { base: '#e8586f', glow: '#ff7d9c' },
  paper: { base: '#3f9df0', glow: '#6fc4ff' },
}

/** 弾種ごとのキーカラー。プレイヤーが色で弾の挙動を見分けられるようにする。
 *  弾は接触即 GAME OVER・手は勝てれば倒せるので、見間違いを防ぐため
 *  HAND_COLORS(緑・赤ピンク・青)から離れた色相だけを使う。
 *
 *  3値あるのは Bullet.draw() のグラデーション3箇所に対応するため:
 *  trail=残光ストリーク / core=本体の中核 / edge=本体グローの外周(α=0)。
 *  edge は透明だが、Canvas は非乗算済み RGBA で補間するため色相が中間色に影響する。 */
export const BULLET_COLORS: Record<BulletType, { core: string; trail: string; edge: string }> = {
  straight: { core: '#e0b3ff', trail: '#be78ff', edge: '#a03cff' },
  aimed: { core: '#ffd9a8', trail: '#ff9a3c', edge: '#ff6a00' },
  curve: { core: '#bff4fa', trail: '#37e0e8', edge: '#00a8c8' },
}

export const HAND_LABEL: Record<Hand, string> = { rock: 'グー', scissors: 'チョキ', paper: 'パー' }
export const HAND_EMOJI: Record<Hand, string> = { rock: '✊', scissors: '✌️', paper: '✋' }

export const FONT_DISPLAY = '"Dela Gothic One", sans-serif'
export const FONT_NUM = '"Orbitron", sans-serif'
