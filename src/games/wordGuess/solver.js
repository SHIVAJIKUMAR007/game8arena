// Solvability check for the answer list (used by tests, not by the game at runtime).
//
// Builds a decision tree the way a careful player would play: each guess is the word that splits the
// remaining possible answers into the smallest groups (lowest expected group size), preferring a word
// that could itself be the answer. The tree proves how many guesses each answer needs when the player
// only knows the clues and the approved answer list.
//   hard = false: any accepted word may be guessed (normal mode).
//   hard = true:  only words still consistent with every clue may be guessed (hard mode).
import { ANSWERS, VALID_WORDS } from './logic'

const ALL_GREEN = 242 // 22222 in base 3
const CNT = new Int8Array(26)
const MARK = new Int8Array(5)
const toCodes = w => Array.from(w, c => c.charCodeAt(0) - 97)

/** Clue pattern of guess `g` against answer `a` as a number 0…242 (0 absent, 1 present, 2 correct per spot). */
export function patternCode(g, a) {
  for (let i = 0; i < 5; i++) {
    if (g[i] === a[i]) MARK[i] = 2
    else { MARK[i] = 0; CNT[a[i]]++ }
  }
  for (let i = 0; i < 5; i++) {
    if (MARK[i] !== 2 && CNT[g[i]] > 0) { MARK[i] = 1; CNT[g[i]]-- }
  }
  for (let i = 0; i < 5; i++) CNT[a[i]] = 0
  return MARK[0] * 81 + MARK[1] * 27 + MARK[2] * 9 + MARK[3] * 3 + MARK[4]
}

/**
 * Number of guesses the solver needs for every answer: Map(word → guesses).
 * Words it cannot separate within `limit` guesses get Infinity.
 */
export function solveDepths({ answers = ANSWERS, guesses = [...VALID_WORDS], hard = false, limit = 8 } = {}) {
  const A = answers.map(toCodes)
  const G = guesses.map(toCodes)
  const depths = new Map()
  const buckets = new Int32Array(243)

  const bestGuess = cands => {
    if (cands.length <= 2) return { g: A[cands[0]], word: answers[cands[0]] }
    const pool = hard ? cands.map(i => ({ g: A[i], word: answers[i], cand: true })) : [
      ...cands.map(i => ({ g: A[i], word: answers[i], cand: true })),
      ...G.map((g, i) => ({ g, word: guesses[i], cand: false })),
    ]
    let best = null, bestScore = Infinity
    for (const p of pool) {
      buckets.fill(0)
      let sumSq = 0
      for (const c of cands) buckets[patternCode(p.g, A[c])]++
      for (let k = 0; k < 243; k++) sumSq += buckets[k] * buckets[k]
      const score = sumSq - (p.cand ? 0.5 : 0) // a possible answer might just win outright
      if (score < bestScore) { bestScore = score; best = p }
    }
    return best
  }

  const solve = (cands, depth) => {
    if (depth > limit) { cands.forEach(i => depths.set(answers[i], Infinity)); return }
    const { g } = bestGuess(cands)
    const groups = new Map()
    for (const c of cands) {
      const k = patternCode(g, A[c])
      if (k === ALL_GREEN) { depths.set(answers[c], depth); continue }
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push(c)
    }
    for (const group of groups.values()) solve(group, depth + 1)
  }

  solve(answers.map((_, i) => i), 1)
  return depths
}
