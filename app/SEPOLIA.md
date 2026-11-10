# Meadow Farm · Deployable local edition

Local game: http://127.0.0.1:4389/

The website update has not been published. Sepolia contracts were already deployed and remain available. The distributable contains no private keys.

## 中文：连接与开始

1. 在安装 MetaMask 的 Chrome / Edge 打开本地网址，也可使用 MetaMask 手机应用的浏览器。应用内置预览浏览器通常没有钱包扩展。
2. 点击右上角「连接 MetaMask」，授权地址，并按提示切换到 **Ethereum Sepolia**（chain ID `11155111`）。
3. 使用 [Sepolia 测试 ETH 水龙头](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) 获取少量测试 ETH，用来支付交易 Gas。
4. 打开钱包窗口，点击「领取 200 测试 TOM」，在 MetaMask 确认。每个地址仅可领取一次。
5. 使用 3,000 经营币建设普通设施，或在市场用 TOM 购买建筑 NFT。持有的 NFT 可以免费放置，持有几件只能放几件；挂单中的 NFT 不能生产。
6. 备齐产线后开始限时挑战，并确认开始交易。完成生产、交付和往返目标后点击领奖，服务端验证通过后，在钱包中确认领取交易。

所有链上操作都使用测试资产。普通建设、生产、运输和仓储无需每秒发交易；购买 NFT、挂单、取消、成交、开始挑战和领取奖励需要钱包确认。

## English: connect and play

1. Open the local game in Chrome / Edge with MetaMask installed, or in the MetaMask mobile browser.
2. Select **Connect MetaMask**, authorize your address and switch to **Ethereum Sepolia**, chain ID `11155111`.
3. Obtain a little Sepolia test ETH from a [test faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) for gas.
4. Open the wallet panel and **Claim 200 test TOM**. The faucet is available once per address.
5. Build with 3,000 farm coins, or buy building NFTs with TOM. Owned NFTs can be placed for free. One NFT can occupy only one location; listed NFTs cannot produce.
6. Prepare your production line, confirm the challenge-start transaction, meet the goals, then claim. The server replays your game actions before issuing a voucher for the reward transaction.

Use the language switch in the upper-right corner for the complete English interface.

## Contracts and verification

| Item | Sepolia address |
| --- | --- |
| TOM, ERC-20, 18 decimals | [`0x74a9736006abE045E1cbaa7670E8bf2986Ea433a`](https://sepolia.etherscan.io/address/0x74a9736006abE045E1cbaa7670E8bf2986Ea433a) |
| Game, building ERC-721 and marketplace | [`0x41370b425645c8552D04e19F8Ba003893225D57D`](https://sepolia.etherscan.io/address/0x41370b425645c8552D04e19F8Ba003893225D57D) |
| Reward verifier, public address only | `0x684407Ed0159884BcEB0eD57D0BB946aF153668D` |

Deployment receipt and public configuration: `deployment/sepolia.json`, `dist/chain-config.mjs`. The contract source is `../contracts/MeadowFarm.sol` in the original workspace. Actual test receipts are in `deployment/sepolia-qa.json`.

Stage base rewards are 24 / 32 / 44 / 60 / 80 TOM, once per day per address, resetting at 00:00 Beijing time. Stage windows are 5 / 7 / 9 / 11 / 15 minutes. Each rewarded round can settle only one stage. An unfinished stage can be retried with its current buildings. Start a fresh round to earn the next reward; the previous layout can be repurchased with farm coins.

The server reconstructs a round from 3,000 coins and verifies building purchases, road connections, production inputs, deliveries, NFT ownership, signed career state and elapsed challenge time. The contract verifies the server's EIP-712 voucher, wallet, chain, contract, stage, nonce, day and round, and mints the fixed reward. Editing a displayed balance cannot mint TOM. This is a teaching/public-test verifier, not a production anti-bot or anti-Sybil system.

## Saves and current limits

- TOM, NFT ownership, listings and paid stages are on Sepolia and follow the wallet across devices.
- Map, coins, stock, preferences and reports are saved **in the current browser, separately for each wallet address**. They do not sync across devices. Browser data deletion removes the local farm, but not on-chain holdings. Local A/B demo data uses its original key and remains separate.
- Listed or transferred NFTs are removed from production when the wallet refreshes. Changing ownership of an NFT used by the current reward proof requires a new round before claiming; the last verified career checkpoint is retained.
- Proofs are bounded to 14,000 actions and three hours of simulation per round. Start a fresh round for longer sessions. Production pauses when the page is closed; challenge deadlines keep running.
- The market reads listings across the first 2,000 issued NFT IDs. A future public release should add indexed pagination. Market activity and volume cover only operations initiated and recorded in the current browser; the block explorer has the full chain history.
- Sepolia RPC and faucet availability are external dependencies. Rejected transactions do not deduct local TOM or create local NFTs. Reload or refresh assets after network interruptions.

## Source and operations

Core files: `dist/chain-wallet.mjs` (wallet and ledger), `dist/wallet-provider.mjs` (EIP-1193 / EIP-6963), `dist/trace.mjs` (game action log), `backend/replay.mjs` (deterministic verifier), `backend/worker.mjs` (API and site), `backend/signatures.mjs` (typed data), `tools/build-chain-site.mjs` (Worker bundle).

In the original NET workspace, dependencies come from the existing parent `node_modules`. Run:

```sh
# From NET/
npm run compile
cd town-farm
node --test test/*.test.mjs chain-test/*.test.mjs
node tools/build-chain-site.mjs ../.runtime/meadow-build
node tools/preview-chain-site.mjs ../.runtime/meadow-build/dist/server/index.js 4395
```

The isolated deployable source package contains its own package manifest, contract source and build instructions. Use Node.js 22.13+ and npm on macOS or Windows. The plain local demo still runs with `python3 -m http.server 4389 --bind 127.0.0.1 --directory dist` (Windows: `py -m http.server ...`). It has no reward API; use the bundled local API with the configured verifier key for on-chain rewards.

Production requires `MEADOW_REWARD_SIGNER_KEY` as a **server-only secret**, matching the public verifier address. For local use, set it in the server process environment or a local `.env` file. A different computer can run all demo functions without it; rewards for the existing contracts require the matching verifier key. Never put this key, a wallet private key or a seed phrase into frontend code or Git. Existing deployer credentials and teaching packages are not included in the distributed source.
