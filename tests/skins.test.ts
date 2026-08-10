import { describe, it, expect } from 'vitest'
import { SKINS, isSkinId, isUnlocked, unlockScoreOf, nextSkin } from '../src/logic/skins'
import { playerSprite } from '../src/assets'

describe('playerSprite', () => {
  it('default は従来のスプライト名', () => {
    expect(playerSprite('default', 'rock')).toBe('player-rock')
  })
  it('スキン付きは player-{skin}-{hand}', () => {
    expect(playerSprite('cyber', 'scissors')).toBe('player-cyber-scissors')
    expect(playerSprite('maid', 'paper')).toBe('player-maid-paper')
  })
})

describe('SKINS テーブル', () => {
  it('巡回順どおり6スキンが定義されている', () => {
    expect(SKINS.map((s) => s.id)).toEqual(['default', 'cyber', 'mage', 'forest', 'samurai', 'maid'])
  })
  it('解放スコアが仕様どおり', () => {
    expect(SKINS.map((s) => s.unlockScore)).toEqual([0, 15000, 30000, 45000, 60000, 75000])
  })
})

describe('isSkinId', () => {
  it('定義済み ID は true', () => {
    expect(isSkinId('maid')).toBe(true)
  })
  it('未知の文字列・非文字列は false', () => {
    expect(isSkinId('ninja')).toBe(false)
    expect(isSkinId(42)).toBe(false)
    expect(isSkinId(null)).toBe(false)
  })
})

describe('isUnlocked', () => {
  it('default はハイスコア 0 でも解放済み', () => {
    expect(isUnlocked('default', 0)).toBe(true)
  })
  it('しきい値ちょうどで解放される(境界値)', () => {
    expect(isUnlocked('cyber', 14999)).toBe(false)
    expect(isUnlocked('cyber', 15000)).toBe(true)
  })
  it('最上位スキンの境界値', () => {
    expect(isUnlocked('maid', 74999)).toBe(false)
    expect(isUnlocked('maid', 75000)).toBe(true)
  })
})

describe('unlockScoreOf', () => {
  it('ID から解放スコアを引ける', () => {
    expect(unlockScoreOf('forest')).toBe(45000)
  })
})

describe('nextSkin', () => {
  it('右方向で次のスキンに進む(未解放も含めて巡回)', () => {
    expect(nextSkin('default', 1)).toBe('cyber')
  })
  it('末尾から右でラップして先頭に戻る', () => {
    expect(nextSkin('maid', 1)).toBe('default')
  })
  it('先頭から左でラップして末尾に行く', () => {
    expect(nextSkin('default', -1)).toBe('maid')
  })
  it('左方向で前のスキンに戻る', () => {
    expect(nextSkin('mage', -1)).toBe('cyber')
  })
})
