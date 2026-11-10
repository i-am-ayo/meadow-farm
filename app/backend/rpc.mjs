// Keep public chain reads on the application's own origin. The endpoint never
// accepts signing, transaction submission, or calls to unrelated contracts.
export async function readRpc(request,config,rpcUrl,fetchRpc=fetch){
  const fail=(message,status=400)=>Response.json({jsonrpc:'2.0',id:null,error:{code:-32600,message}},{status});
  if(request.method!=='POST')return fail('POST required.',405);
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return fail('Same-origin request required.',403);
  const raw=await request.text();if(raw.length>16000)return fail('Request too large.',413);
  let body;try{body=JSON.parse(raw);}catch{return fail('Invalid JSON.');}
  if(!body||Array.isArray(body)||body.jsonrpc!=='2.0'||!Array.isArray(body.params))return fail('Invalid RPC request.');
  if(!['eth_chainId','eth_blockNumber','eth_call'].includes(body.method))return fail('Read method not allowed.',403);
  if(body.method==='eth_call'){
    const call=body.params[0],to=typeof call?.to==='string'?call.to.toLowerCase():'';
    if(![config.game.toLowerCase(),config.tom.toLowerCase()].includes(to)||!/^0x[\da-f]*$/i.test(call?.data||''))return fail('Contract read not allowed.',403);
  }
  try{
    const response=await fetchRpc(rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    if(!response.ok)return fail('Sepolia read unavailable.',503);
    const result=await response.json();
    return Response.json(result,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return fail('Sepolia read unavailable.',503);}
}
