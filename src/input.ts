export class Input {
  private pressed = new Set<string>()
  private confirmEdge = false
  private dirXEdge = 0

  attach(): void {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      this.pressed.add(e.code)
      if (e.code === 'Enter' || e.code === 'Space') this.confirmEdge = true
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.dirXEdge = -1
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.dirXEdge = 1
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
    })
    window.addEventListener('keyup', (e) => this.pressed.delete(e.code))
    window.addEventListener('blur', () => {
      this.pressed.clear()
      this.confirmEdge = false
      this.dirXEdge = 0
    })
  }

  get dx(): number {
    let v = 0
    if (this.pressed.has('ArrowLeft') || this.pressed.has('KeyA')) v -= 1
    if (this.pressed.has('ArrowRight') || this.pressed.has('KeyD')) v += 1
    return v
  }

  get dy(): number {
    let v = 0
    if (this.pressed.has('ArrowUp') || this.pressed.has('KeyW')) v -= 1
    if (this.pressed.has('ArrowDown') || this.pressed.has('KeyS')) v += 1
    return v
  }

  consumeConfirm(): boolean {
    const v = this.confirmEdge
    this.confirmEdge = false
    return v
  }

  /** ←→ のエッジラッチ。ゲームオーバー画面のスキン切替用。-1 / 0 / +1 を返し、消費したらクリアする */
  consumeDirX(): number {
    const v = this.dirXEdge
    this.dirXEdge = 0
    return v
  }
}
