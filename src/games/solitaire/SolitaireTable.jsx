// The card table: draws every pile and turns pointer input into taps and drops.
//
// Drag-and-drop uses Pointer Events, so mouse, touch and pen all take the same path: press on a face-up card, move a
// few pixels to start dragging, release over a pile. Where the cards land is decided from the computed layout
// (layout.js), not by asking the browser which element is under the finger. Every card is absolutely positioned and
// keyed by its id, so when a card changes pile React keeps its element and CSS animates the move.
//
// Face-down cards are rendered without any hint of what they are: nothing in the DOM gives them away.
// The table holds no game rules. It reports what the player did:
//   onTap(pile, count)          tapped a card (count = cards from it to the top) or an empty slot (count 0)
//   onDrop(from, count, to)     dropped `count` cards from `from` on pile `to`
//   onDraw()                    tapped the stock
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { RANK_LABELS, SUIT_SYMBOLS, cardName, isRed, rankOf, suitOf } from './cards'
import { columnOffsets, dropRects, dropTarget, pileSlot, tableMetrics, visibleWaste, wasteFan } from './layout'
import { createRng } from '../../platform/rng'

const DRAG_THRESHOLD = 6
const FALLBACK_SIZE = { width: 720, height: 520 } // used until the table is measured (and in tests)
// Server rendering has no layout effects; fall back to useEffect there to avoid the warning.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

const pileName = id => {
  if (id === 'waste') return 'waste pile'
  if (id[0] === 'f') return `foundation ${Number(id[1]) + 1}`
  return `column ${Number(id[1]) + 1}`
}

function useSize(ref) {
  const [size, setSize] = useState(FALLBACK_SIZE)
  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const update = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) setSize(s => (s.width === r.width && s.height === r.height ? s : { width: r.width, height: r.height }))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

function CardFace({ card }) {
  const rank = RANK_LABELS[rankOf(card)]
  const suit = SUIT_SYMBOLS[suitOf(card)]
  const court = rankOf(card) > 10
  return (
    <>
      <span className="sol-corner" aria-hidden="true"><b>{rank}</b><i>{suit}</i></span>
      <span className={`sol-pip${court ? ' court' : ''}`} aria-hidden="true">{court ? <><b>{rank}</b>{suit}</> : suit}</span>
    </>
  )
}

export default function SolitaireTable({ game, selection, hint, shake, disabled, celebrate, onTap, onDrop, onDraw }) {
  const rootRef = useRef(null)
  const size = useSize(rootRef)
  const m = useMemo(() => tableMetrics(size.width, size.height), [size])
  const offsets = useMemo(() => columnOffsets(m, game.tableau, game.hidden), [m, game.tableau, game.hidden])

  const drag = useRef(null) // { pile, count, x0, y0, lead: {x, y}, active, origin }
  const suppressClick = useRef(false)
  const [dragView, setDragView] = useState(null) // { pile, count, dx, dy }

  /* ───── where every card goes ───── */
  const cards = useMemo(() => {
    const out = []
    const fan = wasteFan(m)
    // stock: face down, stacked with a slight lift for the top few
    game.stock.forEach((c, k) => {
      const lift = Math.min(2, game.stock.length - 1 - k)
      const { x, y } = pileSlot(m, 'stock')
      out.push({ c, x: x - lift * 2, y: y - lift * 2, z: k, up: false, pile: 'stock', count: 0 })
    })
    // waste: the top one (draw one) or three (draw three) fanned to the right
    const shown = visibleWaste(game.waste, game.draw)
    game.waste.forEach((c, k) => {
      const fromTop = game.waste.length - 1 - k
      const slot = fromTop < shown.length ? shown.length - 1 - fromTop : 0
      const { x, y } = pileSlot(m, 'waste')
      out.push({ c, x: x + slot * fan, y, z: 100 + k, up: true, pile: 'waste', count: fromTop === 0 ? 1 : 0 })
    })
    game.foundations.forEach((p, f) => p.forEach((c, k) => {
      const { x, y } = pileSlot(m, `f${f}`)
      out.push({ c, x, y, z: 200 + k, up: true, pile: `f${f}`, count: k === p.length - 1 ? 1 : 0 })
    }))
    game.tableau.forEach((col, i) => col.forEach((c, k) => {
      out.push({ c, x: m.colX(i), y: m.tableauY + offsets[i][k], z: 300 + k, up: k >= game.hidden[i], pile: `t${i}`, count: col.length - k })
    }))
    return out
  }, [game, m, offsets])

  const isLifted = (pile, count, sel) => sel && sel.pile === pile && count > 0 && count <= sel.count
  const leadPosition = (pile, count) => {
    const card = cards.find(x => x.pile === pile && x.count === count && x.up)
    return card ? { x: card.x, y: card.y } : pileSlot(m, pile)
  }

  /* ───── pointer input ───── */
  const onPointerDown = (e, pile, count) => {
    if (disabled || count < 1 || (e.pointerType === 'mouse' && e.button !== 0)) return
    const rect = rootRef.current?.getBoundingClientRect() || { left: 0, top: 0 }
    drag.current = { pile, count, x0: e.clientX, y0: e.clientY, origin: rect, lead: leadPosition(pile, count), active: false }
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* capture is optional */ }
  }

  const onPointerMove = e => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x0
    const dy = e.clientY - d.y0
    if (!d.active && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    d.active = true
    setDragView({ pile: d.pile, count: d.count, dx, dy })
  }

  const endDrag = useCallback(e => {
    const d = drag.current
    drag.current = null
    if (!d || !d.active) return
    setDragView(null)
    suppressClick.current = true
    // the click that follows a pointerup must not count as a tap; it never comes on touch, so clear it soon anyway
    setTimeout(() => { suppressClick.current = false }, 0)
    if (!e) return
    const dx = e.clientX - d.x0
    const dy = e.clientY - d.y0
    const left = d.lead.x + dx
    const top = d.lead.y + dy
    const to = dropTarget(dropRects(m), { left, top, right: left + m.cw, bottom: top + m.ch })
    if (to && to !== d.pile) onDrop(d.pile, d.count, to)
  }, [m, onDrop])

  const cancelDrag = () => {
    drag.current = null
    setDragView(null)
  }

  const tap = (pile, count) => {
    if (suppressClick.current) { suppressClick.current = false; return }
    if (!disabled) onTap(pile, count)
  }

  /* ───── win cascade ───── */
  const cascade = useMemo(() => {
    if (!celebrate) return null
    const rng = createRng('solitaire:cascade')
    const list = []
    for (let r = 13; r >= 1; r--) {
      for (let f = 0; f < 4; f++) {
        const p = game.foundations[f]
        const c = p[r - 1]
        if (c === undefined) continue
        const { x, y } = pileSlot(m, `f${f}`)
        const dir = rng.next() < 0.5 ? -1 : 1
        list.push({ c, x, y, dx: dir * (m.width * (0.3 + rng.next() * 0.7)), dy: m.height - y + m.ch * (0.2 + rng.next()), rot: Math.round((rng.next() - 0.5) * 540), delay: list.length * 45 })
      }
    }
    return list
  }, [celebrate, game.foundations, m])

  const hintFrom = hint && hint.from
  const hintTo = hint && hint.to

  const slots = [
    'waste', 'f0', 'f1', 'f2', 'f3', ...game.tableau.map((_, i) => `t${i}`),
  ]

  return (
    <div
      ref={rootRef}
      className={`sol-table${disabled ? ' disabled' : ''}${dragView ? ' dragging' : ''}`}
      style={{ '--cw': `${m.cw}px`, '--ch': `${m.ch}px` }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={cancelDrag}
      onLostPointerCapture={e => drag.current?.active && endDrag(e)}
    >
      {/* empty-pile outlines; tapping one places the picked-up card there */}
      {slots.map(id => {
        const { x, y } = pileSlot(m, id)
        const isF = id[0] === 'f'
        const isT = id[0] === 't'
        const target = hintTo === id
        return (
          <button
            key={id}
            type="button"
            data-pile={id}
            className={`sol-slot${isF ? ' foundation' : ''}${target ? ' hint-to' : ''}`}
            style={{ left: x, top: y }}
            aria-label={`${pileName(id)}, empty`}
            aria-hidden={pileCount(game, id) ? true : undefined}
            tabIndex={pileCount(game, id) ? -1 : 0}
            onClick={() => tap(id, 0)}
          >
            <span aria-hidden="true">{isF ? 'A' : isT ? 'K' : ''}</span>
          </button>
        )
      })}

      {/* the stock: one big button over the face-down cards */}
      <button
        type="button"
        data-pile="stock"
        className={`sol-slot stock${game.stock.length ? ' full' : ''}${hintFrom === 'stock' ? ' hint-from' : ''}`}
        style={{ left: pileSlot(m, 'stock').x, top: pileSlot(m, 'stock').y, zIndex: 60 }}
        aria-label={game.stock.length ? `Stock, ${game.stock.length} cards. Draw ${game.draw === 3 ? 'three' : 'one'}` : game.waste.length ? 'Stock empty. Turn the waste back over' : 'Stock empty'}
        onClick={() => !disabled && onDraw()}
      >
        <span aria-hidden="true">{game.stock.length ? '' : game.waste.length ? '↻' : '✕'}</span>
      </button>

      {cards.map(card => {
        const { c, up, pile, count } = card
        const lifted = isLifted(pile, count, selection)
        const dragged = dragView && dragView.pile === pile && count > 0 && count <= dragView.count && up
        const hinted = hint && hint.from === pile && count > 0 && count <= hint.count && up
        const shaking = shake && shake.pile === pile && count > 0 && count <= shake.count
        const style = {
          left: card.x,
          top: card.y,
          zIndex: dragged ? 1000 + card.z : card.z,
          transform: dragged ? `translate(${dragView.dx}px, ${dragView.dy}px)` : undefined,
        }
        if (!up) {
          return <div key={c} className="sol-card back" style={style} aria-hidden="true" />
        }
        const cls = ['sol-card', 'face', isRed(c) ? 'red' : 'black', `s${suitOf(c)}`, lifted && 'sel', dragged && 'drag', hinted && 'hint', shaking && 'bad'].filter(Boolean).join(' ')
        const interactive = count > 0
        return (
          <button
            key={c}
            type="button"
            className={cls}
            style={style}
            data-pile={pile}
            data-card={interactive ? c : undefined}
            tabIndex={interactive ? 0 : -1}
            aria-label={`${cardName(c)}, ${pileName(pile)}${lifted ? ', picked up' : ''}`}
            aria-pressed={interactive ? Boolean(lifted) : undefined}
            onPointerDown={e => interactive && onPointerDown(e, pile, count)}
            onClick={() => interactive && tap(pile, count)}
          >
            <CardFace card={c} />
          </button>
        )
      })}

      {cascade && (
        <div className="sol-cascade" aria-hidden="true">
          {cascade.map(f => (
            <div
              key={f.c}
              className={`sol-card face fly ${isRed(f.c) ? 'red' : 'black'} s${suitOf(f.c)}`}
              style={{ left: f.x, top: f.y, '--dx': `${f.dx}px`, '--dy': `${f.dy}px`, '--rot': `${f.rot}deg`, animationDelay: `${f.delay}ms` }}
            >
              <CardFace card={f.c} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function pileCount(game, id) {
  if (id === 'waste') return game.waste.length
  if (id[0] === 'f') return game.foundations[Number(id[1])].length
  return game.tableau[Number(id[1])].length
}
