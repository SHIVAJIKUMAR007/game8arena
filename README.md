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

The multiplayer games (Mafia Hunt and Undercover) need a small game server, in `server/` (plain Node, no extra packages). On one computer on your Wi-Fi:

```
npm run host      # builds the site and starts the server on port 8787 (PORT=8800 npm run host to change it)
```

It prints an address like `http://192.168.1.20:8787`. Everyone opens that address on their phone or laptop, chooses a multiplayer game, and joins with the room code. While developing with `npm run dev`, also run `npm run server`.
