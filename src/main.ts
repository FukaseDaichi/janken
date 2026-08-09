const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
ctx.fillStyle = '#1a1a2e'
ctx.fillRect(0, 0, canvas.width, canvas.height)
ctx.fillStyle = '#fff'
ctx.font = '32px sans-serif'
ctx.fillText('じゃんけん弾除け - scaffold OK', 240, 360)
