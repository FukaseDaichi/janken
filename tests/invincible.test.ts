import { describe, it, expect } from 'vitest'
import {
  INVINCIBLE_SEC,
  initialInvincibleState,
  isInvincible,
  activateInvincible,
  tickInvincible,
} from '../src/logic/invincible'

describe('invincible', () => {
  it('初期状態は無敵ではない', () => {
    expect(isInvincible(initialInvincibleState())).toBe(false)
  })

  it('取得すると残時間 INVINCIBLE_SEC の無敵になり、justStarted が立つ', () => {
    const { state, justStarted } = activateInvincible(initialInvincibleState())
    expect(state.remainingSec).toBe(INVINCIBLE_SEC)
    expect(isInvincible(state)).toBe(true)
    expect(justStarted).toBe(true)
  })

  it('無敵中の再取得は残時間をリセットするが、justStarted は立たず加算もしない', () => {
    const half = tickInvincible(
      activateInvincible(initialInvincibleState()).state,
      INVINCIBLE_SEC / 2,
    ).state
    expect(half.remainingSec).toBeCloseTo(INVINCIBLE_SEC / 2)

    const { state, justStarted } = activateInvincible(half)
    expect(state.remainingSec).toBe(INVINCIBLE_SEC)
    expect(justStarted).toBe(false)
  })

  it('残時間が 0 を跨いだフレームだけ justEnded が立つ', () => {
    const started = activateInvincible(initialInvincibleState()).state

    const mid = tickInvincible(started, INVINCIBLE_SEC - 0.1)
    expect(mid.justEnded).toBe(false)
    expect(isInvincible(mid.state)).toBe(true)

    const end = tickInvincible(mid.state, 0.1)
    expect(end.justEnded).toBe(true)
    expect(end.state.remainingSec).toBe(0)
    expect(isInvincible(end.state)).toBe(false)
  })

  // BGM を通常へ戻す処理が毎フレーム走ると bgmTimer を作り直し続けてしまう。
  // 切れたあとは何度 tick しても justEnded が立たないことを固定する。
  it('無敵が切れた後は何フレーム tick しても justEnded が立たない', () => {
    let state = tickInvincible(
      activateInvincible(initialInvincibleState()).state,
      INVINCIBLE_SEC,
    ).state

    for (let i = 0; i < 5; i++) {
      const r = tickInvincible(state, 1 / 60)
      expect(r.justEnded).toBe(false)
      state = r.state
    }
  })

  it('残時間を超える dtSec を渡しても残時間は負にならない', () => {
    const r = tickInvincible(
      activateInvincible(initialInvincibleState()).state,
      INVINCIBLE_SEC * 3,
    )
    expect(r.state.remainingSec).toBe(0)
    expect(r.justEnded).toBe(true)
  })
})
