# Multiverse Fighter

A one-on-one browser fighting game with twelve fighters from two universes, a computer opponent and online 1v1 over PeerJS.
It lives inside the Game8Arena app as the game id `multiverse` (route `/play/multiverse`).

## Run it

```
npm install
npm run dev        # then open http://localhost:5173/play/multiverse
npm test           # unit and component tests
npm run build      # production build and static prerender
```

PeerJS is the only dependency this game added. It loads lazily, so solo play never downloads it.

## Controls

| Key | Action |
| --- | --- |
| A / D | Move |
| W | Jump (Iron Man hovers if you keep holding it) |
| S | Crouch and block (guards hits from the front) |
| J | Punch |
| I | Heavy punch |
| L | Kick |
| K | Flying kick |
| Space | Special, when the cyan bar is full |
| P or Esc | Pause (against the computer only) |

On a touch screen there is a W/A/S/D circle on the left and L, K, J, I buttons plus a special button on the right.
Every button tracks its own finger, so you can hold several at once. The same controls are shown on desktop.

## Test online play

1. Run `npm run dev` and open `/play/multiverse` in two browser tabs (or on two devices on any network).
2. Tab 1: **Play, Online, Create room**. Copy the 5-character code.
3. Tab 2: **Play, Online, Join room**, type the code, press **Join**.
4. Both players pick a fighter and press **Ready**. The host starts the match; both screens show the VS screen for three seconds, then the fight.
5. Try dropping a player: close tab 2 mid-fight. Tab 1 shows "Opponent disconnected" with a 10-second window, then awards the win.

Rooms use the free PeerJS Cloud server for the introduction only. After that, game traffic goes browser to browser.
Two tabs on one machine always work. Two devices behind strict corporate or mobile networks may need a TURN server (see below).

### Configuration

All networking settings are in one object, `PEER_CONFIG` in `netcode.js`, built from Vite env vars. Set any of these in `.env.local`:

```
VITE_PEER_HOST=peers.example.com
VITE_PEER_PORT=443
VITE_PEER_PATH=/
VITE_PEER_SECURE=true
VITE_PEER_KEY=peerjs
VITE_STUN_URLS=stun:stun.l.google.com:19302
VITE_TURN_URL=turn:turn.example.com:3478
VITE_TURN_USERNAME=user
VITE_TURN_CREDENTIAL=secret
```

With none set it uses the PeerJS Cloud server and public STUN servers.

## How it is built

```
engine/          framework-free; React never sees per-frame state
  sim.js         deterministic 60Hz rules (seeded RNG, no clock). One step() per tick.
  ai.js          computer opponent; reaction time shrinks as player level rises
  render.js      canvas: fake-3D arena, jointed skeleton fighters, special-move effects
  fx.js          hit sparks, damage numbers, screen shake, flashes
  audio.js       Web Audio effects; one AudioContext per game, resumed on first gesture, closed on dispose
  input.js       keyboard and touch bits merged into one bitmask per tick
  game.js        the rAF loop, fixed timestep, interpolation, host/guest modes, ~15Hz HUD push
netcode.js       the only file that imports peerjs: createRoom, joinRoom, sendInput, onSnapshot, onControl, close
roster.js        the twelve fighters, stats, colours, upgrade costs, belts
store.js         saved coins, level, unlocks, upgrades, daily-reward time; sanitised on every load
MultiverseGame.jsx   screen state (menu, select, vs, lobby, fight, result) and rewards
Screens.jsx  FightScreen.jsx  Lobby.jsx  ui.jsx  MultiverseGame.css
```

- **Fixed timestep.** `engine/game.js` runs an accumulator at 60Hz and draws once per frame, interpolating positions between ticks. The canvas is 1280x720 and CSS scales it.
- **Determinism.** `sim.js` never calls `Math.random`, `Date.now` or `performance.now`; a test checks the source. The same seed and inputs always play the same match.
- **Online model.** The room creator is the host and runs the whole simulation. The guest sends only its held-key bitmask plus a sequence number every tick on an unordered `reliable:false` channel. The host sends snapshots at 30Hz on the same kind of channel. The guest draws about 100ms behind, interpolating between snapshots, and predicts only its own movement, reconciling against the host's acknowledged input number.
- **Control channel.** A second, reliable connection carries hello and version check, fighter choice, ready, start (with the seed), rematch, ping and pong every 2 seconds, and leave.
- **Disconnects.** If a link drops, the guest keeps redialling for about 12 seconds and the host keeps listening; a session token proves it is the same guest. After 10 seconds without them the remaining player wins.
- **Fairness online.** Both fighters use base stats, and every fighter is selectable regardless of unlocks.

## Known limits

- Pause is local to the computer mode. It is disabled online.
- KO slow motion runs in the computer mode only. Online, the KO still gets the flash, shake and zoom, but the clock does not slow.
- Guest-side prediction covers walking, jumping, hovering and guarding only. Attacks and hits always come from the host, so the guest sees them after the round trip.
- The fighters are original stylised designs inspired by the characters. The names belong to their owners.
