import { describe, expect, it, vi } from 'vitest'
import { turnCredentials } from './index.js'

describe('turnCredentials', () => {
  it('answers 404 when the TURN secrets are not set, so clients fall back to STUN', async () => {
    const res = await turnCredentials({}, vi.fn())
    expect(res.status).toBe(404)
  })

  it('asks Cloudflare for ICE servers with the secret token and returns only the server list', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ iceServers: [{ urls: ['turn:x'], username: 'u', credential: 'c' }], extra: 1 })))
    const res = await turnCredentials({ TURN_KEY_ID: 'kid', TURN_KEY_API_TOKEN: 'tok' }, fetchImpl)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toContain('/turn/keys/kid/credentials/generate-ice-servers')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(await res.json()).toEqual({ iceServers: [{ urls: ['turn:x'], username: 'u', credential: 'c' }] })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('reports a bad gateway when Cloudflare refuses', async () => {
    const res = await turnCredentials({ TURN_KEY_ID: 'k', TURN_KEY_API_TOKEN: 't' }, async () => new Response('no', { status: 401 }))
    expect(res.status).toBe(502)
  })
})
