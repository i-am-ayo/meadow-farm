import hre from 'hardhat';
import fs from 'node:fs';
import path from 'node:path';

// 22 building catalog prices (in TOM "ether" units) — must match CATALOG in app/dist/rules.mjs
const CATALOG_PRICES = [28,75,180, 36,95,220, 10,35,90, 24,65,48, 26,38,50, 34,78,44, 42,18,32,58];

async function main() {
  const connection = await hre.network.connect(hre.network.name);
  const ethers = connection.ethers;
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);

  const verifierEnv = process.env.VERIFIER_ADDRESS || process.env.MEADOW_REWARD_SIGNER_ADDRESS;
  if (!verifierEnv) {
    console.error('ERROR: Set VERIFIER_ADDRESS or MEADOW_REWARD_SIGNER_ADDRESS in .env');
    process.exit(1);
  }

  console.log('=== MeadowFarm Sepolia Deploy ===');
  console.log('Deployer :', deployerAddress);
  console.log('Balance  :', ethers.formatEther(balance), 'ETH');
  console.log('Verifier :', verifierEnv);
  console.log('Network  :', hre.network.name, '(chainId', (await ethers.provider.getNetwork()).chainId, ')');

  if (balance === 0n) {
    console.error('ERROR: Deployer has 0 ETH. Get test ETH from https://cloud.google.com/application/web3/faucet/ethereum/sepolia');
    process.exit(1);
  }

  console.log('\nDeploying MeadowFarm...');
  const prices = CATALOG_PRICES.map(p => ethers.parseEther(String(p)));
  const game = await ethers.deployContract('MeadowFarm', [verifierEnv, prices]);
  const receipt = await game.deploymentTransaction().wait();
  const gameAddr = await game.getAddress();
  const tomAddr = await game.tom();

  console.log('Game  (MeadowFarm) :', gameAddr);
  console.log('TOM   (MeadowTOM)  :', tomAddr);
  console.log('Block              :', receipt.blockNumber);
  console.log('Deployment tx      :', receipt.hash);
  console.log('Explorer           : https://sepolia.etherscan.io/address/' + gameAddr);

  const deployment = {
    version: 1,
    chainId: 11155111,
    chainName: 'Ethereum Sepolia',
    game: gameAddr,
    tom: tomAddr,
    rewardSigner: verifierEnv,
    deployer: deployerAddress,
    block: receipt.blockNumber,
    transaction: receipt.hash,
    deployedAt: new Date().toISOString(),
    publicRpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.etherscan.io',
    catalogHash: ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(CATALOG_PRICES)))
  };

  const outPath = path.resolve('app/deployment/sepolia.json');
  fs.mkdirSync(path.dirname(outPath), {recursive: true});
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log('\nSaved deployment info to', outPath);
}

main().catch(err => { console.error(err); process.exit(1); });
