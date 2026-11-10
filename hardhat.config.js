import {defineConfig} from 'hardhat/config';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

// Hardhat doesn't auto-load .env — do it manually
try {
  const fs = await import('node:fs');
  const envPath = new URL('./.env', import.meta.url);
  if (fs.existsSync(envPath)) {
    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
} catch (e) { /* ignore */ }
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const DEPLOYER_KEY = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
const VERIFIER_KEY = process.env.MEADOW_REWARD_SIGNER_KEY || process.env.VERIFIER_PRIVATE_KEY;
export default defineConfig({
  plugins:[hardhatEthers],
  solidity:{version:'0.8.37',path:require.resolve('solc/soljson.js'),settings:{optimizer:{enabled:true,runs:200},evmVersion:'cancun'}},
  networks:{
    hardhat:{type:'edr-simulated',chainType:'l1',chainId:31337},
    sepolia:{
      type:'http',
      url:SEPOLIA_RPC,
      accounts:DEPLOYER_KEY?[DEPLOYER_KEY]:[],
      chainId:11155111,
    }
  }
});
