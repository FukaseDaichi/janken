export type Hand = 'rock' | 'scissors' | 'paper'
export type JankenResult = 'win' | 'lose' | 'draw'

const HANDS: Hand[] = ['rock', 'scissors', 'paper']

const BEATS: Record<Hand, Hand> = {
  rock: 'scissors',
  scissors: 'paper',
  paper: 'rock',
}

export function beats(hand: Hand): Hand {
  return BEATS[hand]
}

export function judge(player: Hand, enemy: Hand): JankenResult {
  if (player === enemy) return 'draw'
  return BEATS[player] === enemy ? 'win' : 'lose'
}

export function randomHand(rand: () => number): Hand {
  return HANDS[Math.floor(rand() * HANDS.length)]
}

export function randomOtherHand(current: Hand, rand: () => number): Hand {
  const others = HANDS.filter((h) => h !== current)
  return others[Math.floor(rand() * others.length)]
}
