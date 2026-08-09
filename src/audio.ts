export type BgmMode = 'normal' | 'invincible'

interface BgmTrack {
  notes: number[]
  stepMs: number
  type: OscillatorType
  gain: number
  durSec: number
}

/** normal は従来 startBgmTimer() に直書きされていた値をそのまま移したもので、
 *  既存の聞こえ方は変わらない。invincible は1オクターブ上・倍テンポ・矩形波にして、
 *  切り替わったことが一聴して分かるようにしている。 */
export const BGM_TRACKS: Record<BgmMode, BgmTrack> = {
  normal: {
    notes: [262, 330, 392, 330, 294, 370, 440, 370],
    stepMs: 220, type: 'triangle', gain: 0.03, durSec: 0.18,
  },
  invincible: {
    notes: [523, 659, 784, 988, 784, 659, 880, 988],
    stepMs: 110, type: 'square', gain: 0.045, durSec: 0.09,
  },
}

export class Sound {
  private ctx: AudioContext | null = null
  private bgmTimer: number | null = null
  /** startBgm()/stopBgm() から見た論理状態。タブが非表示の間も保持し、
   *  「BGM は流すべきか」を bgmTimer の有無と分離して管理する。 */
  private bgmRunning = false
  /** タブが非表示になったことで bgmTimer を止めた場合のみ true。
   *  再表示時にこれが立っていて bgmRunning も true のときだけ再開する
   *  （タブがフォーカスを取り戻しただけでタイトル画面から BGM が鳴り出す、
   *  という事故を避けるため）。 */
  private pausedByVisibility = false
  /** 現在の BGM トラック。stopBgm() で 'normal' に戻す。 */
  private bgmMode: BgmMode = 'normal'

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => this.handleVisibilityChange())
    }
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      if (this.bgmTimer !== null) {
        this.clearBgmTimer()
        this.pausedByVisibility = true
      }
      return
    }
    if (this.pausedByVisibility && this.bgmRunning) {
      this.pausedByVisibility = false
      this.startBgmTimer()
    }
  }

  private ensure(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private beep(freq: number, durSec: number, type: OscillatorType = 'square', gainVal = 0.08, when = 0): void {
    const ctx = this.ensure()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(gainVal, ctx.currentTime + when)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + durSec)
    osc.connect(gain).connect(ctx.destination)
    osc.start(ctx.currentTime + when)
    osc.stop(ctx.currentTime + when + durSec)
  }

  kill(): void {
    this.beep(660, 0.08)
    this.beep(990, 0.12, 'square', 0.08, 0.06)
  }

  levelUp(): void {
    ;[523, 659, 784, 1047].forEach((f, i) => this.beep(f, 0.12, 'triangle', 0.1, i * 0.09))
  }

  gameOver(): void {
    ;[440, 349, 262, 196].forEach((f, i) => this.beep(f, 0.25, 'sawtooth', 0.08, i * 0.18))
  }

  /** アイテム取得音。levelUp()(523/659/784/1047・triangle・0.09秒間隔)と
   *  取り違えないよう、square の速い上昇3音にして最後だけ伸ばす。 */
  powerUp(): void {
    this.beep(784, 0.08, 'square', 0.09)
    this.beep(1047, 0.08, 'square', 0.09, 0.05)
    this.beep(1319, 0.22, 'square', 0.09, 0.1)
  }

  startBgm(): void {
    this.bgmRunning = true
    this.pausedByVisibility = false
    // 非表示タブ中に呼ばれた場合はここでは鳴らさない。visibilitychange の
    // ハンドラが表示に戻ったタイミングで bgmRunning を見て開始する。
    if (typeof document !== 'undefined' && document.hidden) return
    this.startBgmTimer()
  }

  stopBgm(): void {
    this.bgmRunning = false
    this.pausedByVisibility = false
    // Sound は GameContext 経由でシーンをまたいで共有される。ここで戻さないと、
    // 無敵中に終わったプレイの次のプレイが無敵BGMで始まってしまう。
    this.bgmMode = 'normal'
    this.clearBgmTimer()
  }

  /** BGM のトラックを切り替える。同じモードなら何もしない。
   *  bgmTimer が動いているときだけ作り直す点が重要で、タブ非表示で止めている間は
   *  モード変数だけ更新し、visibilitychange ハンドラが復帰時に新しいモードで鳴らす。 */
  setBgmMode(mode: BgmMode): void {
    if (this.bgmMode === mode) return
    this.bgmMode = mode
    if (this.bgmTimer === null) return
    this.clearBgmTimer()
    this.startBgmTimer()
  }

  private startBgmTimer(): void {
    if (this.bgmTimer !== null) return
    const track = BGM_TRACKS[this.bgmMode]
    let i = 0
    const step = () => {
      this.beep(track.notes[i % track.notes.length], track.durSec, track.type, track.gain)
      i++
    }
    step()
    this.bgmTimer = window.setInterval(step, track.stepMs)
  }

  private clearBgmTimer(): void {
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer)
      this.bgmTimer = null
    }
  }
}
