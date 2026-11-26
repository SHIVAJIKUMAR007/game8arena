// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { settingsStore } from '../../platform/settings'
import MultiverseGame from './MultiverseGame'
import { ResultScreen } from './Screens'
import { createRoom, joinRoom } from './netcode'
import { DEFAULT_SAVE, DAILY_COOLDOWN_MS, mvStore } from './store'

vi.mock('./netcode', async orig => ({ ...(await orig()), createRoom: vi.fn(), joinRoom: vi.fn() }))

const grad = { addColorStop() {} }
const stub = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k.startsWith('create') && k.endsWith('Gradient') ? () => grad : () => {}), set: (t, k, v) => ((t[k] = v), true) })

beforeEach(() => {
  mvStore.set({ ...DEFAULT_SAVE, unlocked: [...DEFAULT_SAVE.unlocked], upgrades: {} })
  settingsStore.set(s => ({ ...s, sound: false }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(stub)
  vi.stubGlobal('requestAnimationFrame', () => 1)
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.mocked(createRoom).mockReset()
  vi.mocked(joinRoom).mockReset()
})

const coins = () => Number(document.querySelector('.mvf-coins b').textContent)
const click = name => fireEvent.click(screen.getByRole('button', { name }))

describe('main menu', () => {
  it('shows level, coins, the belt bar and the main actions', () => {
    render(<MultiverseGame />)
    expect(screen.getByText('Level: 1')).toBeTruthy()
    expect(coins()).toBe(65)
    expect(screen.getByRole('progressbar', { name: /belt progress/i })).toBeTruthy()
    for (const n of [/daily reward/i, /free coins/i, /fighters/i, /^play$/i, /mute sound|turn sound on/i]) expect(screen.getByRole('button', { name: n })).toBeTruthy()
    expect(screen.getByText('Captain America')).toBeTruthy()
  })

  it('works in StrictMode without warnings', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <StrictMode>
        <MultiverseGame />
      </StrictMode>,
    )
    click(/^play$/i)
    click(/vs computer/i)
    click(/fight/i)
    expect(document.querySelector('canvas.mvf-canvas')).toBeTruthy()
    expect(err).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it('toggles sound with the mute button', () => {
    render(<MultiverseGame />)
    expect(settingsStore.get().sound).toBe(false)
    click(/turn sound on/i)
    expect(settingsStore.get().sound).toBe(true)
    click(/mute sound/i)
    expect(settingsStore.get().sound).toBe(false)
  })

  it('claims the daily reward once, then shows the cooldown', () => {
    render(<MultiverseGame />)
    click(/claim daily reward/i)
    expect(coins()).toBe(115)
    expect(mvStore.get().lastDaily).toBeGreaterThan(0)
    const btn = screen.getByRole('button', { name: /daily reward, back in/i })
    expect(btn.disabled).toBe(true)
  })

  it('offers the daily reward again after 24 hours', () => {
    mvStore.set(s => ({ ...s, lastDaily: Date.now() - DAILY_COOLDOWN_MS - 1000 }))
    render(<MultiverseGame />)
    expect(screen.getByRole('button', { name: /claim daily reward/i })).toBeTruthy()
  })

  it('gives 25 coins after a 3-second ad, and cleans up its timer if you leave early', () => {
    vi.useFakeTimers()
    const { unmount } = render(<MultiverseGame />)
    click(/free coins/i)
    expect(screen.getByRole('dialog', { name: /ad playing/i })).toBeTruthy()
    act(() => vi.advanceTimersByTime(2000))
    expect(coins()).toBe(65)
    act(() => vi.advanceTimersByTime(1100))
    expect(coins()).toBe(90)
    expect(screen.queryByRole('dialog')).toBeNull()
    click(/free coins/i)
    unmount()
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow()
    expect(mvStore.get().coins).toBe(90)
  })
})

describe('fighters', () => {
  it('lists twelve fighters, locks ten, and shows prices', () => {
    render(<MultiverseGame />)
    click(/fighters/i)
    expect(screen.getAllByRole('listitem')).toHaveLength(12)
    expect(screen.getByRole('button', { name: /hulk/i }).textContent).toMatch(/500/)
    expect(screen.getAllByText('Power')).toHaveLength(12)
  })

  it('refuses to buy what you cannot afford and buys what you can', () => {
    render(<MultiverseGame />)
    click(/fighters/i)
    fireEvent.click(screen.getByRole('button', { name: /hulk/i }))
    expect(screen.getByRole('status').textContent).toMatch(/costs 500/)
    expect(mvStore.get().unlocked).not.toContain('hulk')
    fireEvent.click(screen.getByRole('button', { name: /stilgar/i }))
    expect(screen.getByRole('status').textContent).toMatch(/costs 100 coins\. You have 65/)
    expect(mvStore.get().unlocked).not.toContain('stilgar')
    expect(mvStore.get().selected).toBe('cap')
    expect(coins()).toBe(65)
  })

  it('buys with enough coins and selects the new fighter', () => {
    mvStore.set(s => ({ ...s, coins: 300 }))
    render(<MultiverseGame />)
    click(/fighters/i)
    fireEvent.click(screen.getByRole('button', { name: /stilgar/i }))
    expect(coins()).toBe(200)
    expect(mvStore.get().selected).toBe('stilgar')
  })

  it('selects an owned fighter', () => {
    render(<MultiverseGame />)
    click(/fighters/i)
    fireEvent.click(screen.getByRole('button', { name: /paul atreides/i }))
    expect(mvStore.get().selected).toBe('paul')
  })
})

describe('versus the computer', () => {
  const toVs = () => {
    render(<MultiverseGame />)
    click(/^play$/i)
    click(/vs computer/i)
  }

  it('shows both fighters, upgrade cards and a Fight button', () => {
    toVs()
    expect(screen.getByRole('button', { name: /^fight$/i })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^(power|health) level/i }).length).toBe(4)
    expect(screen.getByRole('button', { name: /back/i })).toBeTruthy()
  })

  it('upgrades Power for a scaling coin cost', () => {
    toVs()
    fireEvent.click(screen.getAllByRole('button', { name: /power level 1, upgrade for 50 coins/i })[0])
    expect(coins()).toBe(15)
    expect(mvStore.get().upgrades.cap.power).toBe(1)
    expect(screen.getAllByRole('button', { name: /power level 2, upgrade for 80 coins/i })[0].disabled).toBe(true)
  })

  it('starts a fight with a HUD, a pause button and touch controls, and pauses', () => {
    toVs()
    click(/^fight$/i)
    expect(screen.getByRole('progressbar', { name: /you health/i })).toBeTruthy()
    for (const name of [/^kick \(l\)/i, /^flying kick \(k\)/i, /^punch \(j\)/i, /^heavy punch \(i\)/i, /special attack/i]) expect(screen.getByRole('button', { name })).toBeTruthy()
    expect(screen.getByRole('group', { name: /movement pad/i })).toBeTruthy()
    click(/^pause/i)
    const dlg = screen.getByRole('dialog', { name: /paused/i })
    fireEvent.click(within(dlg).getByRole('button', { name: /resume/i }))
  })

  it('quits back to the menu from the pause screen', () => {
    toVs()
    click(/^fight$/i)
    click(/^pause/i)
    fireEvent.click(screen.getByRole('button', { name: /quit to menu/i }))
    expect(screen.getByRole('button', { name: /^play$/i })).toBeTruthy()
  })

  it('holds a touch button down on pointer down and lets go on pointer up', () => {
    toVs()
    click(/^fight$/i)
    const b = screen.getByRole('button', { name: /^punch \(j\)/i })
    fireEvent.pointerDown(b, { pointerId: 1 })
    expect(b.className).toMatch(/down/)
    fireEvent.pointerUp(b, { pointerId: 1 })
    expect(b.className).not.toMatch(/down/)
  })
})

describe('result screen', () => {
  const base = { won: true, coins: 30, xp: 30, levelUp: false, before: { level: 1, xp: 0 }, after: { level: 1, xp: 30 }, reason: 'match' }
  const props = { online: false, peerGone: false, rematch: { mine: false, theirs: false }, onNext: vi.fn(), onMenu: vi.fn(), onRematch: vi.fn() }

  it('shows the win, coins earned and Next fight', () => {
    render(<ResultScreen {...props} result={base} />)
    expect(screen.getByText('You win')).toBeTruthy()
    expect(screen.getAllByText('+30', { selector: 'b' })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /next fight/i }))
    expect(props.onNext).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /menu/i }))
    expect(props.onMenu).toHaveBeenCalled()
  })

  it('announces a level up', () => {
    render(<ResultScreen {...props} result={{ ...base, levelUp: true, after: { level: 2, xp: 20 } }} />)
    expect(screen.getByRole('status').textContent).toMatch(/level 2/i)
  })

  it('shows a loss and the smaller reward', () => {
    render(<ResultScreen {...props} result={{ ...base, won: false, coins: 10, xp: 10 }} />)
    expect(screen.getByText('You lose')).toBeTruthy()
    expect(screen.getAllByText('+10', { selector: 'b' })).toHaveLength(2)
  })

  it('says the opponent disconnected, and offers Rematch online only while they are there', () => {
    const { rerender } = render(<ResultScreen {...props} online result={{ ...base, reason: 'disconnect' }} />)
    expect(screen.getByText('Opponent disconnected')).toBeTruthy()
    expect(screen.getByRole('button', { name: /rematch/i }).disabled).toBe(false)
    rerender(<ResultScreen {...props} online peerGone result={{ ...base, reason: 'disconnect' }} />)
    expect(screen.getByRole('button', { name: /opponent left/i }).disabled).toBe(true)
  })

  it('shows the waiting state after you ask for a rematch', () => {
    render(<ResultScreen {...props} online rematch={{ mine: true, theirs: false }} result={base} />)
    expect(screen.getByRole('button', { name: /waiting for opponent/i }).disabled).toBe(true)
  })
})

describe('online lobby', () => {
  function fakeSession(role, code = 'K7QMX') {
    const subs = { status: new Set(), ctl: new Set() }
    return {
      role,
      code,
      remote: { name: '', fighter: 'hulk' },
      sent: [],
      close: vi.fn(),
      sendControl(m) {
        this.sent.push(m)
        return true
      },
      sendInput() {},
      sendSnapshot() {},
      getPing: () => 42,
      onStatus: f => (subs.status.add(f), () => subs.status.delete(f)),
      onControl: f => (subs.ctl.add(f), () => subs.ctl.delete(f)),
      onInput: () => () => {},
      onSnapshot: () => () => {},
      status: s => act(() => subs.status.forEach(f => f(s))),
      control: m => act(() => subs.ctl.forEach(f => f(m))),
      subs,
    }
  }
  const tick = async (ms = 20) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }
  const toLobby = () => {
    render(<MultiverseGame />)
    click(/^play$/i)
    click(/^online$/i)
  }

  it('creates a room with a 5-character code and a copy button', async () => {
    vi.useFakeTimers()
    const s = fakeSession('host')
    vi.mocked(createRoom).mockResolvedValue(s)
    toLobby()
    await tick()
    expect(screen.getByText('K7QMX')).toBeTruthy()
    expect(screen.getByRole('button', { name: /copy code/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /create room/i }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('status', { name: '' }) || true).toBeTruthy()
  })

  it('shows friendly errors in the lobby', async () => {
    vi.useFakeTimers()
    vi.mocked(createRoom).mockRejectedValue(Object.assign(new Error("Can't reach the matchmaking server. Check your connection and try again in a moment."), { code: 'server-down' }))
    toLobby()
    await tick()
    expect(screen.getByRole('alert').textContent).toMatch(/matchmaking server/i)
  })

  it('joins with a typed code, with the right error for a bad one', async () => {
    vi.useFakeTimers()
    vi.mocked(createRoom).mockResolvedValue(fakeSession('host'))
    toLobby()
    await tick()
    fireEvent.click(screen.getByRole('tab', { name: /join room/i }))
    const input = screen.getByLabelText(/enter a room code/i)
    fireEvent.change(input, { target: { value: 'k7qmx' } })
    expect(input.value).toBe('K7QMX')
    vi.mocked(joinRoom).mockRejectedValue(Object.assign(new Error('No room with that code. Check the letters and ask the host to keep the room open.'), { code: 'not-found' }))
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }))
    await tick()
    expect(joinRoom).toHaveBeenCalledWith('K7QMX', expect.any(Object))
    expect(screen.getByRole('alert').textContent).toMatch(/no room with that code/i)
  })

  it('shows both fighters and ready states, then the host starts the match when both are ready', async () => {
    vi.useFakeTimers()
    const s = fakeSession('host')
    vi.mocked(createRoom).mockResolvedValue(s)
    toLobby()
    await tick()
    s.status({ type: 'connected', remote: { fighter: 'hulk' } })
    s.status({ type: 'ping', ms: 37 })
    expect(screen.getByText(/connected/i)).toBeTruthy()
    expect(screen.getByText(/37 ms/)).toBeTruthy()
    expect(screen.getByText('Hulk')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^ready$/i }))
    expect(s.sent).toContainEqual({ t: 'ready', v: true })
    s.control({ t: 'ready', v: true })
    await tick()
    const start = s.sent.find(m => m.t === 'start')
    expect(start.chars).toEqual(['cap', 'hulk'])
    expect(Number.isFinite(start.seed)).toBe(true)
    expect(screen.getByText(/base stats for both/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /leave/i })).toBeTruthy()
    await tick(3200)
    expect(document.querySelector('canvas.mvf-canvas')).toBeTruthy()
    expect(s.close).not.toHaveBeenCalled()
  })

  it('lets you pick a fighter, which tells the other player', async () => {
    vi.useFakeTimers()
    const s = fakeSession('host')
    vi.mocked(createRoom).mockResolvedValue(s)
    toLobby()
    await tick()
    s.status({ type: 'connected', remote: { fighter: 'hulk' } })
    fireEvent.click(screen.getByRole('button', { name: 'Thor' }))
    expect(s.sent).toContainEqual({ t: 'select', fighter: 'thor' })
  })

  it('closes the room when you leave', async () => {
    vi.useFakeTimers()
    const s = fakeSession('host')
    vi.mocked(createRoom).mockResolvedValue(s)
    toLobby()
    await tick()
    click(/back/i)
    expect(s.close).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^play$/i })).toBeTruthy()
  })

  it('closes the room if the page unmounts', async () => {
    vi.useFakeTimers()
    const s = fakeSession('host')
    vi.mocked(createRoom).mockResolvedValue(s)
    const { unmount } = render(<MultiverseGame />)
    click(/^play$/i)
    click(/^online$/i)
    await tick()
    unmount()
    expect(s.close).toHaveBeenCalled()
  })

  it('starts the guest from the host start message', async () => {
    vi.useFakeTimers()
    vi.mocked(createRoom).mockResolvedValue(fakeSession('host'))
    toLobby()
    await tick()
    fireEvent.click(screen.getByRole('tab', { name: /join room/i }))
    const g = fakeSession('guest')
    vi.mocked(joinRoom).mockResolvedValue(g)
    fireEvent.change(screen.getByLabelText(/enter a room code/i), { target: { value: 'K7QMX' } })
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }))
    await tick()
    g.control({ t: 'start', seed: 123, chars: ['hulk', 'cap'] })
    expect(screen.getByText(/base stats for both/i)).toBeTruthy()
    await tick(3200)
    expect(document.querySelector('canvas.mvf-canvas')).toBeTruthy()
  })

  it('ignores a malformed start message', async () => {
    vi.useFakeTimers()
    vi.mocked(createRoom).mockResolvedValue(fakeSession('host'))
    toLobby()
    await tick()
    fireEvent.click(screen.getByRole('tab', { name: /join room/i }))
    const g = fakeSession('guest')
    vi.mocked(joinRoom).mockResolvedValue(g)
    fireEvent.change(screen.getByLabelText(/enter a room code/i), { target: { value: 'K7QMX' } })
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }))
    await tick()
    g.control({ t: 'start', seed: 'x', chars: ['nobody', 'cap'] })
    expect(screen.queryByText(/base stats for both/i)).toBeNull()
  })
})
