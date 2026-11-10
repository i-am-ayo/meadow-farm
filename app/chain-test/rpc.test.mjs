import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readRpc} from '../backend/rpc.mjs';
const config={game:'0x1111111111111111111111111111111111111111',tom:'0x2222222222222222222222222222222222222222'};
const request=(body,headers={})=>new Request('http://127.0.0.1:4389/api/rpc',{method:'POST',headers,body:JSON.stringify(body)});
test('same-origin read proxy forwards approved contract calls without a signing key',async()=>{
  let called=false;const body={jsonrpc:'2.0',id:3,method:'eth_call',params:[{to:config.game,data:'0x18160ddd'},'latest']};
  const result=await readRpc(request(body,{origin:'http://127.0.0.1:4389'}),config,'https://example.test',async(url,options)=>{called=true;assert.equal(url,'https://example.test');assert.deepEqual(JSON.parse(options.body),body);return Response.json({jsonrpc:'2.0',id:3,result:'0x01'});});
  assert.equal(called,true);assert.equal((await result.json()).result,'0x01');
});
test('read proxy rejects transaction submission and arbitrary contract targets',async()=>{
  for(const body of [{jsonrpc:'2.0',id:1,method:'eth_sendRawTransaction',params:['0x00']},{jsonrpc:'2.0',id:1,method:'eth_call',params:[{to:'0x3333333333333333333333333333333333333333',data:'0x00'},'latest']}])assert.equal((await readRpc(request(body),config,'unused',()=>assert.fail('Must not forward'))).status,403);
});
test('read proxy rejects cross-origin and malformed requests',async()=>{
  const body={jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]};
  assert.equal((await readRpc(request(body,{origin:'https://other.test'}),config,'unused')).status,403);
  assert.equal((await readRpc(request([body]),config,'unused')).status,400);
});
test('upstream errors expose no RPC credential or provider error',async()=>{
  const result=await readRpc(request({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]}),config,'https://credential.example',()=>{throw Error('private provider detail');});
  assert.equal(result.status,503);assert.doesNotMatch(await result.text(),/credential|private provider/);
});
