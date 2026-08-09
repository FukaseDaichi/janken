export class Particle {
  alive = true
  private lifeSec: number

  constructor(
    private x: number,
    private y: number,
    private vx: number,
    private vy: number,
    private color: string,
    private maxLifeSec = 0.5,
  ) {
    this.lifeSec = maxLifeSec
  }

  update(dtSec: number): void {
    this.lifeSec -= dtSec
    if (this.lifeSec <= 0) {
      this.alive = false
      return
    }
    this.x += this.vx * dtSec
    this.y += this.vy * dtSec
    this.vx *= 0.95
    this.vy *= 0.95
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.globalAlpha = Math.max(0, this.lifeSec / this.maxLifeSec)
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

export function burstParticles(x: number, y: number, color: string, count = 16): Particle[] {
  const out: Particle[] = []
  for (let i = 0; i < count; i++) {
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4
    const speed = 120 + Math.random() * 180
    out.push(new Particle(x, y, Math.cos(ang) * speed, Math.sin(ang) * speed, color))
  }
  return out
}
