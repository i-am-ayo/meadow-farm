# Meadow Farm · Deployable local edition

This is the complete game, not a student TODO template. The updated website has **not been published**. Ethereum Sepolia contracts were already deployed and are included as public address/ABI configuration.

## Quick start: macOS and Windows

Install Node.js 22.13+ (Node.js 24 LTS also works), unzip this package, open a terminal in this folder, then run:

```sh
npm ci
npm start
```

Open **http://127.0.0.1:4389/**. Keep the terminal running. If port 4389 is occupied, stop the previous local server or change `MEADOW_PORT` in `.env`. A different port has a separate browser save.

You can also double-click `Start-Windows.cmd` or `Start-macOS.command`. The launcher installs dependencies on its first run. If macOS will not launch the command file, use the terminal commands above. Extract the ZIP before running; do not open `index.html` directly.

The compiled application is included, so building is optional for the first run. A network connection is needed to install dependencies and use Sepolia. Core local simulation works after dependencies are installed.

## Modes and MetaMask

- Local demo: existing A/B farms, local TOM/NFT simulation, full construction and production. Original browser saves remain at the same origin/key.
- Sepolia: use the network/wallet button, connect MetaMask, switch to Sepolia, obtain test ETH for gas and claim 200 test TOM once per address. TOM, NFTs and trading use the deployed contracts. Each wallet has a separate browser farm.
- The archive contains **no private keys**. Without the matching server verifier key, a fresh copy supports demo play, wallet connection and normal on-chain asset transactions, but cannot issue verified stage reward vouchers. For those rewards, copy `.env.example` to `.env` and privately configure `MEADOW_REWARD_SIGNER_KEY`; it must match the deployed verifier address. Never share that `.env`. The original development machine keeps its verifier key outside this package.

## Modify, test and rebuild

```sh
npm test
npm run build
npm start
```

Stop the existing server before restarting. Edit `app/dist/` for gameplay/UI, `app/backend/` for reward verification and `contracts/MeadowFarm.sol` for contracts. Rebuild after edits to regenerate `dist/server/index.js`. Do not redeploy existing contracts just to change the UI.

See `READ.md` for the Chinese guide, `app/SEPOLIA.md` for player/contract details and `DEPLOYMENT.md` for future server deployment. Dependencies and source are self-contained; the parent NETPUNKS project is not required.
