// Code Breaker: secret codes, clue scoring and deduction helpers.
//
// A code is an array of colour indexes (0-based; shown to the player as numbers 1…colors as well as
// colours). Each guess is scored like Bulls and Cows: `exact` = right colour in the right spot,
// `close` = right colour in the wrong spot (each secret peg counts once).
import { createRng } from '../../platform/rng'

export const COLOR_NAMES = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'cyan', 'pink']

/** Attempts added (with a lost 💧) each time the rows run out. */
export const EXTRA_ATTEMPTS = 3

/** Difficulty curve: longer codes, more colours, then repeated colours. */
export function paramsFor(level) {
  const L = Math.max(1, level)
  if (L <= 2) return { length: 3, colors: 4, attempts: 7, repeats: false }
  if (L <= 5) return { length: 4, colors: 5, attempts: 8, repeats: false }
  if (L <= 9) return { length: 4, colors: 6, attempts: 8, repeats: false }
  if (L <= 15) return { length: 4, colors: 6, attempts: 8, repeats: true }
  if (L <= 22) return { length: 5, colors: 7, attempts: 9, repeats: true }
  return { length: 5, colors: 8, attempts: 9, repeats: true }
}

/** Deterministic puzzle for a seed and level: { length, colors, attempts, repeats, code }. */
export function generateLevel(seed, level) {
  const rng = createRng(`${seed}#${level}`)
  const params = paramsFor(level)
  const { length, colors, repeats } = params
  const code = repeats
    ? Array.from({ length }, () => rng.int(0, colors - 1))
    : rng.shuffle(Array.from({ length: colors }, (_, i) => i)).slice(0, length)
  return { ...params, code }
}

/** Score `guess` against `secret`. */
export function score(secret, guess) {
  let exact = 0
  const a = new Array(16).fill(0), b = new Array(16).fill(0)
  for (let i = 0; i < secret.length; i++) {
    if (secret[i] === guess[i]) exact++
    else { a[secret[i]]++; b[guess[i]]++ }
  }
  let close = 0
  for (let c = 0; c < 16; c++) close += Math.min(a[c], b[c])
  return { exact, close }
}

const codeCache = new Map()
/** Every legal code for these settings. */
export function allCodes({ length, colors, repeats }) {
  const id = `${length}/${colors}/${repeats}`
  if (codeCache.has(id)) return codeCache.get(id)
  const out = []
  const cur = []
  const build = () => {
    if (cur.length === length) { out.push([...cur]); return }
    for (let c = 0; c < colors; c++) {
      if (!repeats && cur.includes(c)) continue
      cur.push(c); build(); cur.pop()
    }
  }
  build()
  codeCache.set(id, out)
  return out
}

/** Could `candidate` be the secret, given every clue so far and the revealed spots? */
export function fits(p, rows, revealed, candidate) {
  if (!p.repeats && new Set(candidate).size !== candidate.length) return false
  for (const [i, c] of revealed) if (candidate[i] !== c) return false
  return rows.every(r => {
    const s = score(candidate, r.guess)
    return s.exact === r.exact && s.close === r.close
  })
}

/** The first clue `guess` contradicts (index into rows), -2 if it breaks the repeats rule or a revealed spot, else -1. */
export function brokenClue(p, rows, revealed, guess) {
  if (!p.repeats && new Set(guess).size !== guess.length) return -2
  for (const [i, c] of revealed) if (guess[i] !== c) return -2
  return rows.findIndex(r => {
    const s = score(guess, r.guess)
    return s.exact !== r.exact || s.close !== r.close
  })
}

/** How many codes are still possible. */
export const possibleCount = (p, rows, revealed) => allCodes(p).reduce((n, c) => n + (fits(p, rows, revealed, c) ? 1 : 0), 0)

/** Hint: the leftmost spot not yet revealed, or -1 (one spot always stays hidden). */
export function hintSpot(p, revealed) {
  if (revealed.size >= p.length - 1) return -1
  for (let i = 0; i < p.length; i++) if (!revealed.has(i)) return i
  return -1
}

export const describeCode = code => code.map(c => `${COLOR_NAMES[c]} ${c + 1}`).join(', ')
