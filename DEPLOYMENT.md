# Future deployment

No updated website was published for this delivery. The package runs locally by default.

`npm ci && npm run build` produces the ESM Worker entrypoint `dist/server/index.js` with embedded frontend assets. It exports the standard `fetch(request, env)` handler. `dist/.openai/hosting.json` retains the existing Sites project identity; the contract addresses are in `app/dist/chain-config.mjs`.

A future compatible Worker host must configure `MEADOW_REWARD_SIGNER_KEY` as a server-only secret. Optional `MEADOW_RPC_URL` selects a Sepolia RPC. The key must correspond to the already-deployed contract verifier; a new random key will not work. Configure secrets using the host environment, never Git or frontend assets.

Routes: `GET /api/health` reports public contract configuration and whether a verifier is configured; `POST /api/replay` validates game traces. The local runner binds only to `127.0.0.1`. It is intended for local access; use the Worker entrypoint for future hosting.

Verify the contract addresses and test receipts in `app/deployment/` before publishing. Keep `.env`, private keys, runtime data, `node_modules`, compiler caches and teaching packages out of public archives. Rebuilding this UI does not require deploying new contracts.
