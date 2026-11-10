export const SEPOLIA_CHAIN='0xaa36a7';
export function walletError(error){
  const code=error?.code??error?.info?.error?.code;
  if(code===4001||code==='ACTION_REJECTED')return 'Wallet request cancelled.';
  if(code===-32002)return 'A wallet request is already open. Check MetaMask.';
  if(code==='INSUFFICIENT_FUNDS')return 'Sepolia test ETH is needed for gas.';
  return 'The wallet operation did not complete. Check the network and try again.';
}
export async function ensureSepolia(provider,rpcUrl){
  const current=await provider.request({method:'eth_chainId'});if(current===SEPOLIA_CHAIN)return;
  try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:SEPOLIA_CHAIN}]});}
  catch(error){if(Number(error.code)!==4902)throw error;await provider.request({method:'wallet_addEthereumChain',params:[{chainId:SEPOLIA_CHAIN,chainName:'Ethereum Sepolia',nativeCurrency:{name:'Sepolia Ether',symbol:'ETH',decimals:18},rpcUrls:[rpcUrl],blockExplorerUrls:['https://sepolia.etherscan.io']}]});}
  if(await provider.request({method:'eth_chainId'})!==SEPOLIA_CHAIN)throw Error('Wrong network.');
}
export async function assertWallet(provider,address){
  const [chain,accounts]=await Promise.all([provider.request({method:'eth_chainId'}),provider.request({method:'eth_accounts'})]);
  if(chain!==SEPOLIA_CHAIN||accounts?.[0]?.toLowerCase()!==address.toLowerCase())throw Error('Wallet account or network changed. Reconnect before transacting.');
}
export function discoverWallets(surface=window){
  const wallets=new Map();
  const announce=e=>{const detail=e.detail;if(detail?.provider?.request&&typeof detail?.info?.uuid==='string')wallets.set(detail.info.uuid,{provider:detail.provider,name:String(detail.info.name||'Browser wallet').slice(0,60),rdns:detail.info.rdns});};
  surface.addEventListener('eip6963:announceProvider',announce);surface.dispatchEvent(new Event('eip6963:requestProvider'));
  return ()=>{
    const found=[...wallets.values()];if(surface.ethereum?.request&&!found.some(w=>w.provider===surface.ethereum))found.push({provider:surface.ethereum,name:surface.ethereum.isMetaMask?'MetaMask':'Browser wallet',rdns:surface.ethereum.isMetaMask?'io.metamask':''});
    return found.sort((a,b)=>Number(b.rdns==='io.metamask')-Number(a.rdns==='io.metamask'));
  };
}
