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
    this.clearBgmTimer()
  }

  private startBgmTimer(): void {
    if (this.bgmTimer !== null) return
    const notes = [262, 330, 392, 330, 294, 370, 440, 370]
    let i = 0
    const step = () => {
      this.beep(notes[i % notes.length], 0.18, 'triangle', 0.03)
      i++
    }
    step()
    this.bgmTimer = window.setInterval(step, 220)
  }

  private clearBgmTimer(): void {
    if (this.bgmTimer !== null) {
      clearInterval(this.bgmTimer)
      this.bgmTimer = null
    }
  }
}
