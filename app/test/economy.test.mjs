import test from 'node:test';
import assert from 'node:assert/strict';
import {displayNftId} from '../dist/economy.mjs';
import {normalizeState,purchase,transferListing} from '../dist/rules.mjs';

test('TOM purchase and NFT labels preserve legacy ownership, saved references and settlement',()=>{
 const oldId='NET-A-0001',listedId='NET-B-0001';
 const A=normalizeState({accountId:'A',token:128,nextAsset:2,assets:[{id:oldId,modelId:'well-stone',paid:10,totalProduced:7}],buildings:[{type:'well',x:2,y:7,assetId:oldId}],favorites:[listedId]});
 const B=normalizeState({accountId:'B',token:40,nextAsset:2,assets:[{id:listedId,modelId:'bakery-hearth',paid:36,totalProduced:3,listingPrice:45}],buildings:[]});
 const saved=JSON.parse(JSON.stringify(A));normalizeState(saved);
 assert.equal(saved.assets[0].id,oldId);
 assert.equal(saved.buildings[0].assetId,oldId);
 assert.deepEqual(saved.favorites,[listedId]);
 assert.equal(saved.token,128);
 assert.equal(displayNftId(saved.assets[0].id),'NFT-A-0001');
 const solar=purchase(saved,'solar-garden');
 assert.equal(solar.id,'NFT-A-0002');
 assert.equal(saved.token,104,'purchase debits the existing TOM balance');
 assert.equal(saved.assets[0].totalProduced,7);
 assert.ok(transferListing({A:saved,B},'A','B',listedId,45));
 assert.equal(saved.token,59);assert.equal(B.token,85);
 assert.equal(saved.assets.at(-1).id,listedId,'trade retains the exact legacy NFT identity');
 assert.equal(B.assets.length,0);
 assert.deepEqual(saved.favorites,[listedId]);
});
