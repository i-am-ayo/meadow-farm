// NFT identifies a unique production asset. TOM is the fungible payment/reward token.
export const CURRENCY=Object.freeze({symbol:'TOM',name:'TOM Token'});
export const nftId=(account,serial)=>`NFT-${account?account+'-':''}${String(serial).padStart(4,'0')}`;
// Keep legacy identities and all ownership references intact; only modernize their labels.
export const displayNftId=id=>String(id).replace(/^NET-/,'NFT-');
