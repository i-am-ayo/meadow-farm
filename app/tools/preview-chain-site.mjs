import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const filename=process.argv[2],port=Number(process.argv[3]||4395),qaAddress=process.argv[4];
const {default:worker}=await import(pathToFileURL(filename));
const key=process.env.MEADOW_REWARD_SIGNER_KEY||(await readFile(new URL('../../.runtime/meadow-sepolia/reward-signer.key',import.meta.url),'utf8').catch(()=>'' )).trim();
const env={MEADOW_REWARD_SIGNER_KEY:key,...(process.env.MEADOW_RPC_URL?{MEADOW_RPC_URL:process.env.MEADOW_RPC_URL}:{})};
const server=http.createServer(async(req,res)=>{
  try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks),url=`http://127.0.0.1:${port}${req.url}`;
    if(qaAddress&&req.url==='/qa-wallet.mjs'){
      res.writeHead(200,{'content-type':'text/javascript'});res.end(`const address=${JSON.stringify(qaAddress)};const provider={on(){},removeListener(){},async request(r){if(['eth_requestAccounts','eth_accounts'].includes(r.method))return [address];if(r.method==='eth_chainId')return '0xaa36a7';if(r.method==='eth_sendTransaction')throw {code:4001};const response=await fetch('/qa-rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(r)}),data=await response.json();if(data.error)throw data.error;return data.result;}};window.ethereum=provider;const announce=()=>window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'59ca0973-39e9-4a1a-8dc9-8d55470412ae',name:'QA Read-only Wallet',rdns:'qa.meadow'},provider}}));window.addEventListener('eip6963:requestProvider',announce);announce();`);return;
    }
    if(qaAddress&&req.url==='/qa-rpc'){
      const input=JSON.parse(body.toString());if(!['eth_blockNumber','eth_getBalance','eth_call','eth_getCode','eth_getTransactionCount','eth_estimateGas','eth_gasPrice','eth_maxPriorityFeePerGas','eth_getBlockByNumber'].includes(input.method)){res.writeHead(400);res.end('{}');return;}
      const rpc=await fetch('https://ethereum-sepolia-rpc.publicnode.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,...input})});res.writeHead(200,{'content-type':'application/json'});res.end(await rpc.text());return;
    }
    const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body}:{} )});
    const result=await worker.fetch(request,env);res.writeHead(result.status,Object.fromEntries(result.headers));
    if(qaAddress&&(req.url==='/'||req.url==='/index.html'))res.end((await result.text()).replace('<head>','<head><script type="module" src="/qa-wallet.mjs"></script>'));
    else res.end(Buffer.from(await result.arrayBuffer()));
  }catch{res.writeHead(500,{'content-type':'text/plain'});res.end('Preview request failed.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}/`));
