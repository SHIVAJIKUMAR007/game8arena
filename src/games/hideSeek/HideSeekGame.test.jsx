// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import HideSeekGame from './HideSeekGame'
import { serverUrl, infoUrl } from './net'

/** A WebSocket stand-in the test controls. */
class FakeSocket {
  static all = []
  constructor(url) {
    this.url = url
    this.readyState = 0
    this.sent = []
    FakeSocket.all.push(this)
  }
  send(text) { this.sent.push(JSON.parse(text)) }
  close() { this.readyState = 3 }
  open() { this.readyState = 1; this.onopen?.() }
  say(msg) { this.onmessage?.({ data: JSON.stringify(msg) }) }
}
const socket = () => FakeSocket.all[FakeSocket.all.length - 1]

beforeEach(() => {
  FakeSocket.all = []
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ ips: ['192.168.1.9'], port: 8787 }) })))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('server address', () => {
  const loc = (extra = {}) => ({ search: '', hostname: '192.168.1.9', host: '192.168.1.9:8787', protocol: 'http:', ...extra })
  it('is the page address when the server hosts the page, and port 8787 in development', () => {
    expect(serverUrl(loc(), false)).toBe('ws://192.168.1.9:8787')
    expect(serverUrl(loc({ host: 'x.com', protocol: 'https:' }), false)).toBe('wss://x.com')
    expect(serverUrl(loc({ host: 'localhost:5173', hostname: 'localhost' }), true)).toBe('ws://localhost:8787')
    expect(infoUrl(loc(), false)).toBe('http://192.168.1.9:8787/api/info')
  })

  it('accepts a ?server= override but only for plain host names', () => {
    expect(serverUrl(loc({ search: '?server=10.0.0.5:9000' }), false)).toBe('ws://10.0.0.5:9000')
    expect(serverUrl(loc({ search: '?server=evil.com/x?y' }), false)).toBe('ws://192.168.1.9:8787')
  })
})

describe('Mafia Hunt screens', () => {
  it('shows a helpful message when no server can be reached', async () => {
    render(<HideSeekGame />)
    expect(screen.getByText(/Connecting to the game server/)).toBeTruthy()
    act(() => socket().onclose())
    expect((await screen.findByRole('alert')).textContent).toMatch(/npm run host/)
    expect(screen.getByRole('button', { name: 'Create a room' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(FakeSocket.all).toHaveLength(2)
  })

  it('creates a room with the typed name, shows the lobby, and only the host can start', () => {
    render(<HideSeekGame />)
    act(() => socket().open())
    fireEvent.change(screen.getByPlaceholderText('Player'), { target: { value: 'Ann' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }))
    expect(socket().sent).toContainEqual({ t: 'create', name: 'Ann' })
    act(() => {
      socket().say({ t: 'joined', code: 'ABCD', id: '1' })
      socket().say({ t: 'room', code: 'ABCD', hostId: '1', phase: 'lobby', settings: { duration: 180 }, players: [{ id: '1', name: 'Ann' }] })
    })
    expect(screen.getByLabelText(/Room code A B C D/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Waiting for another player/ }).hasAttribute('disabled')).toBe(true)
    act(() => socket().say({ t: 'room', code: 'ABCD', hostId: '1', phase: 'lobby', settings: { duration: 180, map: 'random' }, maps: [{ id: 'crates', name: 'Crates' }, { id: 'maze', name: 'Maze' }], players: [{ id: '1', name: 'Ann' }, { id: '2', name: 'Bob' }] }))
    fireEvent.change(screen.getByLabelText('Round length'), { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText('Map'), { target: { value: 'maze' } })
    expect(socket().sent).toContainEqual({ t: 'settings', map: 'maze' })
    expect(socket().sent).toContainEqual({ t: 'settings', duration: 60 })
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    expect(socket().sent).toContainEqual({ t: 'start' })
  })

  it('joins with an uppercase code and shows server errors', () => {
    render(<HideSeekGame />)
    act(() => socket().open())
    const code = screen.getByLabelText('Room code')
    expect(screen.getByRole('button', { name: 'Join' }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(code, { target: { value: 'ab1cd' } })
    expect(code.value).toBe('ABCD')
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(socket().sent).toContainEqual({ t: 'join', code: 'ABCD', name: '' })
    act(() => socket().say({ t: 'error', message: 'Room not found. Check the code.' }))
    expect(screen.getByRole('alert').textContent).toMatch(/Room not found/)
  })

  it('shows the Wi-Fi address to share and a non-host waits for the host', async () => {
    render(<HideSeekGame />)
    act(() => socket().open())
    act(() => {
      socket().say({ t: 'joined', code: 'WXYZ', id: '2' })
      socket().say({ t: 'room', code: 'WXYZ', hostId: '1', phase: 'lobby', settings: { duration: 120 }, players: [{ id: '1', name: 'Ann' }, { id: '2', name: 'Bob' }] })
    })
    expect(await screen.findByText('http://192.168.1.9:8787')).toBeTruthy()
    expect(screen.getByText(/Waiting for the host to start/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Start game' })).toBeNull()
  })

  it('moves into the match, shows the role and clock, and ends with a result and a play-again for the host', () => {
    render(<HideSeekGame />)
    act(() => socket().open())
    const players = [{ id: '1', name: 'Ann' }, { id: '2', name: 'Bob' }]
    act(() => {
      socket().say({ t: 'joined', code: 'ABCD', id: '1' })
      socket().say({ t: 'room', code: 'ABCD', hostId: '1', phase: 'game', settings: { duration: 60 }, players })
      socket().say({ t: 'start', you: '1', mafiaId: '2', world: { w: 1200, h: 800 }, walls: [], duration: 60, hide: 10, players })
      socket().say({ t: 'state', phase: 'hide', left: 7.2, me: { x: 60, y: 60, alive: true, role: 'villager', cooldown: 0, vision: 300, blind: false }, others: [], shots: [], alive: 1, total: 1 })
    })
    expect(screen.getByText('Hide! Mafia: Bob')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/released in 8s/)
    expect(screen.getByText(/1\/1 alive/)).toBeTruthy()
    expect(screen.getByRole('application')).toBeTruthy()
    act(() => socket().say({ t: 'over', winner: 'mafia', mafiaId: '2', survivors: 0 }))
    expect(screen.getByRole('dialog', { name: 'Game over' }).textContent).toMatch(/Mafia wins/)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(socket().sent).toContainEqual({ t: 'lobby' })
    act(() => socket().say({ t: 'room', code: 'ABCD', hostId: '1', phase: 'lobby', settings: { duration: 60 }, players }))
    expect(screen.getByLabelText(/Room code/)).toBeTruthy()
  })

  it('sends the player’s keys to the server while playing', () => {
    vi.useFakeTimers()
    render(<HideSeekGame />)
    act(() => socket().open())
    const players = [{ id: '1', name: 'Ann' }, { id: '2', name: 'Bob' }]
    act(() => {
      socket().say({ t: 'joined', code: 'ABCD', id: '1' })
      socket().say({ t: 'room', code: 'ABCD', hostId: '1', phase: 'game', settings: { duration: 60 }, players })
      socket().say({ t: 'start', you: '1', mafiaId: '1', world: { w: 1200, h: 800 }, walls: [], duration: 60, hide: 10, players })
    })
    fireEvent.keyDown(window, { key: 'd' })
    act(() => { vi.advanceTimersByTime(120) })
    expect(socket().sent.some(m => m.t === 'input' && m.dx === 1)).toBe(true)
    fireEvent.keyDown(window, { key: ' ' })
    expect(socket().sent.filter(m => m.t === 'input').pop().fire).toBe(1)
    vi.useRealTimers()
  })
})
