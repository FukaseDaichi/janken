import { describe, it, expect } from 'vitest'
import { spawnBullet } from '../src/entities/bullet'

describe('Bullet (curve type) の最大生存時間カリング', () => {
  it('フィールド内に収まる円軌道に乗って isOffscreen が一度も true にならなくても、' +
    '一定時間を超えたら shouldDespawn() が true になる', () => {
    // curve 弾は速度を 1.8 rad/s で回転させ続けるため、軌道は半径 speed/1.8 の円になる。
    // フィールド中央付近から speed=100 で発射すると円軌道の半径は約 55.6px で、
    // 960x720 のフィールド内に収まりきり、境界(margin込みで-60〜1020 / -60〜780)に
    // 一度も達しない。これは「isOffscreen() が永遠に false のまま」という
    // Finding 2 の状況を再現する設定。
    const centerX = 480
    const centerY = 360
    const bullet = spawnBullet('curve', centerX, centerY, 0, 100)
    // curve 弾の update は player 引数を使わないため、ダミー座標で十分。
    const dummyPlayer = { x: 0, y: 0 }

    const dt = 0.1
    // 11.9 秒分シミュレート：まだ最大生存時間(12秒)に達していない。
    for (let i = 0; i < 119; i++) bullet.update(dt, dummyPlayer)
    expect(bullet.shouldDespawn()).toBe(false)

    // さらに 0.2 秒進めて合計 12.1 秒 → 最大生存時間を超えたのでカリング対象になる。
    bullet.update(dt, dummyPlayer)
    bullet.update(dt, dummyPlayer)
    expect(bullet.shouldDespawn()).toBe(true)
  })

  it('通常の直進弾は画面外に出たら即座に shouldDespawn() が true になる（既存挙動の回帰確認）', () => {
    const bullet = spawnBullet('straight', -100, 360, Math.PI, 200)
    expect(bullet.shouldDespawn()).toBe(true)
  })
})
