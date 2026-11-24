# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Multiplayer (Mafia Hunt and Undercover)

On the deployed site (Cloudflare) the host's **browser tab is the server**. "Create a room" runs the room logic (`server/hub.js`) in that tab, and friends connect to it over WebRTC (`src/platform/multiplayer/p2p.js`). The Worker in `worker/` only relays the connection set-up for a room code (one Durable Object per code); no game traffic goes through it. `npm run build` then `npx wrangler deploy` ships both the site and the Worker. To try it locally: `npm run build`, `npx wrangler dev`, and open the printed address in two browsers (or `npm run dev` with `?p2p=1&signal=localhost:8787`).

The same games can also run from a Node server, in `server/` (plain Node, no extra packages), for offline play on one Wi-Fi. On one computer:

```
npm run host      # builds the site and starts the server on port 8787 (PORT=8800 npm run host to change it)
```

It prints an address like `http://192.168.1.20:8787`. Everyone opens that address on their phone or laptop, chooses a multiplayer game, and joins with the room code. While developing with `npm run dev`, also run `npm run server`.
