export interface Circle {
  x: number
  y: number
  radius: number
}

export function collides(a: Circle, b: Circle): boolean {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const r = a.radius + b.radius
  return dx * dx + dy * dy < r * r
}
