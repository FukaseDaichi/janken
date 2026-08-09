/** アイテム取得時に設定される無敵の持続時間(秒)。 */
export const INVINCIBLE_SEC = 8

export interface InvincibleState {
  remainingSec: number
}

export function initialInvincibleState(): InvincibleState {
  return { remainingSec: 0 }
}

export function isInvincible(s: InvincibleState): boolean {
  return s.remainingSec > 0
}

/** アイテム取得時に呼ぶ。残時間は INVINCIBLE_SEC に「リセット」する(加算しない)。
 *  justStarted は直前が無敵でなかった場合のみ true。BGM を無敵用へ切り替えるのは
 *  このフラグが立ったときだけにして、再取得のたびに鳴らし直さないようにする。 */
export function activateInvincible(
  s: InvincibleState,
): { state: InvincibleState; justStarted: boolean } {
  return {
    state: { remainingSec: INVINCIBLE_SEC },
    justStarted: !isInvincible(s),
  }
}

/** 毎フレーム呼ぶ。justEnded は残時間が 0 を跨いだそのフレームだけ true になり、
 *  すでに 0 の状態で呼び続けても立たない。BGM を通常へ戻す処理が毎フレーム走って
 *  bgmTimer を作り直し続けるのを防ぐため、この非対称性が必要。 */
export function tickInvincible(
  s: InvincibleState,
  dtSec: number,
): { state: InvincibleState; justEnded: boolean } {
  if (!isInvincible(s)) return { state: s, justEnded: false }
  const remainingSec = Math.max(0, s.remainingSec - dtSec)
  return { state: { remainingSec }, justEnded: remainingSec <= 0 }
}
