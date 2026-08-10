import type { Scene, GameContext } from '../game'
import { GameOverScene } from './gameover'
import { drawNeonBackground } from '../render/background'
import { drawSidePanel } from '../render/panel'
import { outlinedText } from '../render/text'
import { FONT_DISPLAY, COLORS, BULLET_COLORS, STAR_COLORS, FLASH_RGB } from '../render/theme'
import { drawInvincibleRing } from '../render/effects'
import { Player, FIELD_W, FIELD_H } from '../entities/player'
import { Bullet, spawnBullet } from '../entities/bullet'
import { JankenHand } from '../entities/hand'
import { Particle, burstParticles } from '../entities/particle'
import { collides } from '../entities/collision'
import { StarItem, pickItemSpawnPos, ITEM_SPAWN_INTERVAL_SEC, ITEM_FIRST_SPAWN_SEC } from '../entities/item'
import {
  initialInvincibleState, isInvincible, activateInvincible, tickInvincible,
  INVINCIBLE_SEC, type InvincibleState,
} from '../logic/invincible'
import { judge, randomHand, randomOtherHand } from '../logic/janken'
import { initialLevelState, addWin, WINS_PER_LEVEL, type LevelState } from '../logic/level'
import { timeScore, killBonus, levelMultiplier } from '../logic/score'
import { difficultyFor } from '../logic/difficulty'
import { saveHighScoreIfHigher, loadHighScore, loadSkin } from '../storage'

export class PlayScene implements Scene {
  private player: Player
  private bullets: Bullet[] = []
  private hands: JankenHand[] = []
  private particles: Particle[] = []
  private levelState: LevelState = initialLevelState()
  private score = 0
  private elapsedSec = 0
  private bulletTimer = 0
  private handTimer = 0
  /** 画面フラッシュ。色は FLASH_RGB の "R,G,B" 形式で持ち、
   *  アルファは残り時間 / 全体時間から決める。 */
  private flashSec = 0
  private flashMaxSec = 1
  private flashRgb = FLASH_RGB.white
  private morphSec = 0
  private items: StarItem[] = []
  private itemTimer = ITEM_FIRST_SPAWN_SEC
  private inv: InvincibleState = initialInvincibleState()

  constructor(private g: GameContext) {
    const skin = loadSkin(g.storage, loadHighScore(g.storage))
    this.player = new Player(randomHand(Math.random), skin)
  }

  update(dtSec: number): Scene | null {
    // プレイ中に押された Enter/Space はここで捨てる。PlayScene は confirmEdge を
    // 消費しないため、消費し忘れるとラッチが残り続け、GameOverScene の最初の
    // フレームで即座に消費されて GAME OVER 画面を一度も描画せず次の PlayScene
    // に遷移してしまう（スコア表示が飛ぶ）。戻り値は使わないが意図的に破棄する。
    this.g.input.consumeConfirm()

    this.elapsedSec += dtSec
    this.score += timeScore(dtSec, this.levelState.level)
    this.flashSec = Math.max(0, this.flashSec - dtSec)
    this.morphSec = Math.max(0, this.morphSec - dtSec)

    // 無敵の残時間を進める。justEnded は 0 を跨いだフレームだけ立つので、
    // BGM を戻す処理が毎フレーム走って bgmTimer を作り直し続けることはない。
    const ticked = tickInvincible(this.inv, dtSec)
    this.inv = ticked.state
    if (ticked.justEnded) this.g.sound.setBgmMode('normal')

    this.player.update(this.g.input, dtSec)
    this.spawn(dtSec)

    for (const b of this.bullets) b.update(dtSec, this.player)
    for (const h of this.hands) h.update(dtSec)
    for (const it of this.items) it.update(dtSec)
    for (const p of this.particles) p.update(dtSec)

    // アイテムの取得判定は弾・手の判定より先に行う。同じフレームで星と弾に
    // 同時接触したとき、取得を先に処理すれば無敵が成立して死なずに済む。
    // 逆順にすると「取ったのに死んだ」が起きる。
    for (const it of this.items) {
      if (!it.alive || !collides(it, this.player)) continue
      it.alive = false
      const activated = activateInvincible(this.inv)
      this.inv = activated.state
      // BGM の切替は無敵が「始まった」ときだけ。再取得では鳴らし直さない。
      if (activated.justStarted) this.g.sound.setBgmMode('invincible')
      this.g.sound.powerUp()
      // LVUP の白フラッシュと区別するためイエローにする
      this.flash(FLASH_RGB.yellow, 0.25)
      this.particles.push(...burstParticles(it.x, it.y, STAR_COLORS.core, 20))
    }

    // 弾との衝突 → 通常は即 GAMEOVER。無敵中は弾を消して飛沫だけ出す(スコアなし)。
    for (const b of this.bullets) {
      if (!b.alive || !collides(b, this.player)) continue
      if (!isInvincible(this.inv)) return this.gameOver()
      b.alive = false
      this.particles.push(...burstParticles(b.x, b.y, BULLET_COLORS[b.type].core, 8))
    }

    // 手との衝突 → じゃんけん判定。無敵中は勝敗を無視して撃破できる。
    for (const h of this.hands) {
      if (!h.alive || !collides(h, this.player)) continue
      if (!isInvincible(this.inv) && judge(this.player.hand, h.hand) !== 'win') return this.gameOver()
      h.alive = false
      this.score += killBonus(this.levelState.level)
      this.particles.push(...burstParticles(h.x, h.y, '#f1c40f'))
      this.g.sound.kill()
      const { state, leveledUp } = addWin(this.levelState)
      this.levelState = state
      if (leveledUp) this.levelUp()
    }

    this.bullets = this.bullets.filter((b) => b.alive && !b.shouldDespawn())
    this.hands = this.hands.filter((h) => h.alive && !h.isOffscreen())
    this.items = this.items.filter((it) => it.alive && !it.isExpired())
    this.particles = this.particles.filter((p) => p.alive)
    return null
  }

  private flash(rgb: string, sec: number): void {
    this.flashRgb = rgb
    this.flashSec = sec
    this.flashMaxSec = sec
  }

  private levelUp(): void {
    this.player.hand = randomOtherHand(this.player.hand, Math.random)
    this.flash(FLASH_RGB.white, 0.35)
    this.morphSec = 0.6
    this.g.sound.levelUp()
    this.particles.push(...burstParticles(this.player.x, this.player.y, '#3498db', 24))
  }

  private gameOver(): Scene {
    this.g.sound.stopBgm()
    this.g.sound.gameOver()
    const finalScore = Math.floor(this.score)
    const isNewRecord = saveHighScoreIfHigher(this.g.storage, finalScore)
    return new GameOverScene(this.g, finalScore, this.levelState.level, isNewRecord)
  }

  /** 画面外周のランダム地点と、そこからフィールド中央付近へ向かう角度を返す */
  private edgeSpawn(): { x: number; y: number; angle: number } {
    const side = Math.floor(Math.random() * 4)
    const m = 40
    let x: number, y: number
    if (side === 0) { x = Math.random() * FIELD_W; y = -m }
    else if (side === 1) { x = Math.random() * FIELD_W; y = FIELD_H + m }
    else if (side === 2) { x = -m; y = Math.random() * FIELD_H }
    else { x = FIELD_W + m; y = Math.random() * FIELD_H }
    const tx = FIELD_W * (0.25 + Math.random() * 0.5)
    const ty = FIELD_H * (0.25 + Math.random() * 0.5)
    return { x, y, angle: Math.atan2(ty - y, tx - x) }
  }

  private spawn(dtSec: number): void {
    const d = difficultyFor(this.levelState.level, this.elapsedSec)
    this.bulletTimer -= dtSec
    this.handTimer -= dtSec

    if (this.bulletTimer <= 0) {
      this.bulletTimer = d.bulletInterval
      const { x, y, angle } = this.edgeSpawn()
      const type = d.bulletTypes[Math.floor(Math.random() * d.bulletTypes.length)]
      const speed = d.speedMin + Math.random() * (d.speedMax - d.speedMin)
      this.bullets.push(spawnBullet(type, x, y, angle, speed))
    }

    if (this.handTimer <= 0) {
      this.handTimer = d.handInterval
      const { x, y, angle } = this.edgeSpawn()
      const speed = (d.speedMin + Math.random() * (d.speedMax - d.speedMin)) * 0.7
      this.hands.push(new JankenHand(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, randomHand(Math.random)))
    }

    // 星は場に1個まで。場に星がある間はタイマーを間隔いっぱいに戻し続けるので、
    // ITEM_SPAWN_INTERVAL_SEC は「星が場から消えてから次が湧くまで」の時間になる。
    if (this.items.length > 0) {
      this.itemTimer = ITEM_SPAWN_INTERVAL_SEC
    } else {
      this.itemTimer -= dtSec
      if (this.itemTimer <= 0) {
        // 湧かせたその場で戻す。次フレームの items.length チェックに任せると、
        // 同じフレームで湧いて取られた星がタイマーを負のまま残し、次フレームで
        // 二重にスポーンしうる。
        this.itemTimer = ITEM_SPAWN_INTERVAL_SEC
        const { x, y } = pickItemSpawnPos(this.player.x, this.player.y, Math.random)
        this.items.push(new StarItem(x, y))
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    drawNeonBackground(ctx, FIELD_W, FIELD_H, this.elapsedSec)

    for (const h of this.hands) h.draw(ctx, this.g.assets)
    for (const it of this.items) it.draw(ctx, this.elapsedSec)
    for (const b of this.bullets) b.draw(ctx)

    if (this.morphSec <= 0 || Math.floor(this.morphSec * 12) % 2 === 0) {
      this.player.draw(ctx, this.g.assets)
    }
    // 無敵リングは morph の点滅条件の外に置く。無敵中に LVUP が起きたとき
    // 自機と一緒にリングまで消えると、残り時間を見失うため。
    if (isInvincible(this.inv)) {
      drawInvincibleRing(ctx, this.player.x, this.player.y, this.player.radius, this.inv.remainingSec, INVINCIBLE_SEC)
    }
    for (const p of this.particles) p.draw(ctx)

    if (this.flashSec > 0) {
      ctx.fillStyle = `rgba(${this.flashRgb},${(this.flashSec / this.flashMaxSec) * 0.6})`
      ctx.fillRect(0, 0, FIELD_W, FIELD_H)
    }

    // LEVEL UP! バナー(morph 中のみ)。上からスッと降りてフェード
    if (this.morphSec > 0) {
      const t = 1 - this.morphSec / 0.6
      ctx.globalAlpha = Math.min(1, (1 - t) * 3)
      outlinedText(ctx, 'LEVEL UP!', FIELD_W / 2, FIELD_H * 0.3 - (1 - t) * 20, {
        size: 64, font: FONT_DISPLAY, fill: COLORS.yellow,
        outline: '#000', shadowColor: 'rgba(0,0,0,0.6)',
      })
      ctx.globalAlpha = 1
    }

    // パネルは最後(フィールド右端のはみ出しを覆う)
    drawSidePanel(ctx, this.g.assets, {
      score: this.score,
      level: this.levelState.level,
      multiplier: levelMultiplier(this.levelState.level),
      wins: this.levelState.wins,
      winsPerLevel: WINS_PER_LEVEL,
      playerHand: this.player.hand,
      skin: this.player.skin,
    })
    ctx.restore()
  }
}
