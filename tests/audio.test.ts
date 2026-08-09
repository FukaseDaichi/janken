import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Sound, BGM_TRACKS } from '../src/audio'

/** beep() が鳴らした周波数、setInterval / clearInterval の回数を記録する。 */
let notes: number[]
let intervalCalls: number
let clearCalls: number

beforeEach(() => {
  notes = []
  intervalCalls = 0
  clearCalls = 0

  // osc.connect(gain).connect(ctx.destination) が繋がるよう connect は引数を返す
  const makeOsc = () => ({
    type: 'square' as OscillatorType,
    frequency: { set value(v: number) { notes.push(v) } },
    connect: (n: unknown) => n,
    start() {},
    stop() {},
  })
  const makeGain = () => ({
    gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    connect: (n: unknown) => n,
  })

  vi.stubGlobal('AudioContext', class {
    state = 'running'
    currentTime = 0
    destination = {}
    resume() {}
    createOscillator() { return makeOsc() }
    createGain() { return makeGain() }
  })
  vi.stubGlobal('window', {
    setInterval: () => { intervalCalls++; return intervalCalls },
  })
  vi.stubGlobal('clearInterval', () => { clearCalls++ })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Sound の BGM モード切替', () => {
  it('startBgm() は通常トラックの1音目から鳴らす', () => {
    const s = new Sound()
    s.startBgm()
    expect(notes[0]).toBe(BGM_TRACKS.normal.notes[0])
  })

  it('再生中の setBgmMode() はタイマーを作り直し、新しいトラックの1音目を鳴らす', () => {
    const s = new Sound()
    s.startBgm()
    const before = intervalCalls

    s.setBgmMode('invincible')

    expect(intervalCalls).toBe(before + 1)
    expect(clearCalls).toBe(1)
    expect(notes[notes.length - 1]).toBe(BGM_TRACKS.invincible.notes[0])
  })

  // 無敵中の再取得のたびに鳴らし直すと BGM が頭出しされ続けてしまう
  it('同じモードへの setBgmMode() は何もしない', () => {
    const s = new Sound()
    s.startBgm()
    s.setBgmMode('invincible')
    const calls = intervalCalls
    const played = notes.length

    s.setBgmMode('invincible')

    expect(intervalCalls).toBe(calls)
    expect(notes.length).toBe(played)
  })

  // タブ非表示で bgmTimer を止めている間の切替がこの経路。
  // モード変数だけ更新し、再開時に新しいトラックで鳴り出す。
  it('BGM が止まっている間の setBgmMode() は音を鳴らさず、次の startBgm() で反映される', () => {
    const s = new Sound()

    s.setBgmMode('invincible')

    expect(intervalCalls).toBe(0)
    expect(notes).toEqual([])

    s.startBgm()
    expect(notes[0]).toBe(BGM_TRACKS.invincible.notes[0])
  })

  // Sound は GameContext 経由でシーンをまたいで共有されるので、
  // ここでモードを戻さないと次のプレイが無敵BGMで始まってしまう。
  it('stopBgm() はモードを normal に戻すので、次のプレイは通常BGMで始まる', () => {
    const s = new Sound()
    s.startBgm()
    s.setBgmMode('invincible')
    s.stopBgm()
    notes.length = 0

    s.startBgm()

    expect(notes[0]).toBe(BGM_TRACKS.normal.notes[0])
  })
})

describe('powerUp()', () => {
  it('levelUp() とは違う音列を鳴らす', () => {
    const s = new Sound()
    s.powerUp()
    const powerUpNotes = [...notes]

    notes.length = 0
    s.levelUp()
    const levelUpNotes = [...notes]

    expect(powerUpNotes.length).toBeGreaterThan(0)
    expect(powerUpNotes).not.toEqual(levelUpNotes)
  })
})
