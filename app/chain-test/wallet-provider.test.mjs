import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureSepolia,assertWallet,walletError,SEPOLIA_CHAIN} from '../dist/wallet-provider.mjs';
const address='0x0000000000000000000000000000000000000a11';
test('an already connected Sepolia wallet receives no network-changing requests',async()=>{
  const calls=[],provider={async request(r){calls.push(r.method);return SEPOLIA_CHAIN;}};
  await ensureSepolia(provider,'https://ethereum-sepolia-rpc.publicnode.com');assert.deepEqual(calls,['eth_chainId']);
});
test('switching an unknown network adds only Sepolia with its correct chain and currency',async()=>{
  let chain='0x1';const calls=[],provider={async request(r){calls.push(r);if(r.method==='eth_chainId')return chain;if(r.method==='wallet_switchEthereumChain')throw {code:4902};if(r.method==='wallet_addEthereumChain')chain=r.params[0].chainId;}};
  await ensureSepolia(provider,'https://ethereum-sepolia-rpc.publicnode.com');const added=calls.find(c=>c.method==='wallet_addEthereumChain').params[0];assert.equal(added.chainId,'0xaa36a7');assert.equal(added.nativeCurrency.symbol,'ETH');assert.deepEqual(added.blockExplorerUrls,['https://sepolia.etherscan.io']);
});
test('a rejected switch never silently falls back to another network or adds one',async()=>{
  const calls=[],provider={async request(r){calls.push(r.method);if(r.method==='eth_chainId')return '0x1';throw {code:4001};}};
  await assert.rejects(ensureSepolia(provider,'https://ethereum-sepolia-rpc.publicnode.com'));assert.deepEqual(calls,['eth_chainId','wallet_switchEthereumChain']);
});
test('every transaction guard checks both wallet account and Sepolia, including external switches',async()=>{
  let chain=SEPOLIA_CHAIN,accounts=[address];const provider={async request(r){return r.method==='eth_chainId'?chain:accounts;}};
  await assertWallet(provider,address.toUpperCase());chain='0x1';await assert.rejects(assertWallet(provider,address));chain=SEPOLIA_CHAIN;accounts=[];await assert.rejects(assertWallet(provider,address));
});
test('wallet error messages do not expose raw provider request data',()=>{
  assert.match(walletError({code:4001}),/cancelled/);assert.match(walletError({code:-32002}),/already open/);assert.match(walletError({code:'INSUFFICIENT_FUNDS'}),/Sepolia/);assert.doesNotMatch(walletError({message:'secret signed transaction'}),/secret/);
});
