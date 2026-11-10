# 云野小镇 · 可部署的本地完整版

这份压缩包包含完整代码、编译好的网页和接口、合约源码、测试与锁定的依赖。不是学生 TODO 版本。此次没有把新版网页部署到服务器；Sepolia 测试网合约已在之前的步骤部署完成。

## 1. 本地运行（Mac / Windows）

先安装 Node.js 22.13 或更新版本，建议 Node.js 24 LTS。解压到普通文件夹，在该文件夹中打开终端：

```sh
npm ci
npm start
```

打开 **http://127.0.0.1:4389/**，保留终端运行。首次需要联网安装依赖。Windows 可双击 `Start-Windows.cmd`，Mac 可双击 `Start-macOS.command`；若系统不允许直接打开脚本，使用上述终端命令即可。不要直接双击 HTML，也不要在 ZIP 内运行。

首次启动不必重新编译。端口 4389 已被旧服务占用时，请先关闭旧服务，或复制 `.env.example` 为 `.env` 后修改 `MEADOW_PORT`。浏览器存档与域名、端口绑定；使用同一浏览器的 `http://127.0.0.1:4389/` 才能继续原有本地农场，不要清除浏览器数据。

## 2. 连接 MetaMask

在装有 MetaMask 的 Chrome / Edge 打开本地网址，点击右上角网络或钱包按钮。连接并切换到 Ethereum Sepolia，准备少量测试 ETH 支付 Gas，即可在钱包窗口领取一次 200 测试 TOM、购买建筑 NFT、挂单和交易。钱包模式按地址使用独立存档；本地 A/B 模拟账户不会变成链上余额。

**压缩包不含任何私钥。** 不配置验证器时，本地经营、钱包连接、链上资产买卖都可以使用；链上挑战领奖需要服务端签名。将 `.env.example` 复制成 `.env`，在自己电脑上私下配置 `MEADOW_REWARD_SIGNER_KEY`；必须与已部署合约的验证器地址匹配。原开发电脑的密钥单独留在本机 `.runtime/meadow-sepolia/reward-signer.key`，不会随压缩包分发。单纯复制代码到另一台电脑不会复制奖励签名权限。

## 3. 代码位置

| 位置 | 内容 |
| --- | --- |
| `app/dist/game.js` | 地图、交互和页面主流程 |
| `app/dist/rules.mjs` | 建造、生产、交易、任务规则 |
| `app/dist/chain-wallet.mjs` | MetaMask、真实 TOM/NFT、链上交易 |
| `app/dist/wallet-provider.mjs` | 钱包发现、网络切换、账户保护 |
| `app/dist/trace.mjs` | 经营操作记录 |
| `app/backend/replay.mjs` | 服务端重放验证，避免直接相信本地余额 |
| `app/backend/worker.mjs` | 静态资源与奖励 API |
| `contracts/MeadowFarm.sol` | TOM ERC-20、建筑 ERC-721、市场、奖励合约 |
| `app/deployment/` | 公开的测试网地址和实测交易记录 |
| `app/test/`、`app/chain-test/` | 经营、钱包、重放、合约测试 |
| `dist/server/index.js` | 可运行、可部署的编译产物 |

## 4. 修改后验证和编译

```sh
npm test
npm run build
npm start
```

`npm test` 先编译合约，再运行 180 项测试。修改代码后执行 build，并停止、重启已有服务。若网页仍显示旧版，刷新页面即可；不需要删除存档。核心生产与限时奖励都有可完成的测试布局。

TOM、NFT 归属和已领取阶段保存在测试链；经营币、地图、库存和报表按钱包保存在当前浏览器，不跨设备同步。链上奖励需要真实倒计时和有效生产记录。进一步的规则与限制见 `app/SEPOLIA.md`。
