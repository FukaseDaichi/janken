import type { Hand } from '../logic/janken'

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

export const HAND_LABEL: Record<Hand, string> = { rock: 'グー', scissors: 'チョキ', paper: 'パー' }
export const HAND_EMOJI: Record<Hand, string> = { rock: '✊', scissors: '✌️', paper: '✋' }

export const FONT_DISPLAY = '"Dela Gothic One", sans-serif'
export const FONT_NUM = '"Orbitron", sans-serif'
