import {before,beforeEach,after,test} from 'node:test';
import assert from 'node:assert/strict';
import hre from 'hardhat';
import {CATALOG} from '../dist/rules.mjs';
let connection,ethers,game,tom,verifier,alice,bob;
const types={Reward:[{name:'player',type:'address'},{name:'day',type:'uint64'},{name:'stage',type:'uint8'},{name:'nonce',type:'uint64'},{name:'bonusMask',type:'uint8'},{name:'completedAt',type:'uint64'},{name:'roundId',type:'bytes32'},{name:'careerHash',type:'bytes32'}]};
before(async()=>{connection=await hre.network.connect('hardhat');ethers=connection.ethers;[verifier,alice,bob]=await ethers.getSigners();});
beforeEach(async()=>{game=await ethers.deployContract('MeadowFarm',[verifier.address,CATALOG.map(m=>ethers.parseEther(String(m.price)))]);await game.waitForDeployment();tom=await ethers.getContractAt('MeadowTOM',await game.tom());});
after(async()=>{await connection.close();});
async function voucher(who=alice,overrides={}){const a=await game.attempts(who.address),r={player:who.address,day:a.day,stage:a.stage,nonce:a.nonce,bonusMask:0,completedAt:a.startedAt,roundId:a.roundId,careerHash:ethers.id('career'),...overrides};const signature=await verifier.signTypedData({name:'Meadow Farm',version:'1',chainId:31337,verifyingContract:await game.getAddress()},types,r);return {r,signature};}
test('test TOM faucet is once per wallet and no external caller can issue or spend tokens',async()=>{
  await game.connect(alice).faucet();assert.equal(await tom.balanceOf(alice.address),ethers.parseEther('200'));
  await assert.rejects(game.connect(alice).faucet());await assert.rejects(tom.connect(alice).issue(alice.address,1));await assert.rejects(tom.connect(bob).spend(alice.address,1));
});
test('purchasing an NFT burns exactly its TOM catalog price and never spends another account balance',async()=>{
  await game.connect(alice).faucet();const price=ethers.parseEther('28');
  await assert.rejects(game.connect(alice).buyBuilding(0,price-1n));await assert.rejects(game.connect(bob).buyBuilding(0,price));
  await game.connect(alice).buyBuilding(0,price);assert.equal(await game.ownerOf(1),alice.address);assert.equal(await game.modelOf(1),0n);assert.equal(await tom.balanceOf(alice.address),ethers.parseEther('172'));
  const [ids,models]=await game.ownedAssets(alice.address);assert.deepEqual([...ids],[1n]);assert.deepEqual([...models],[0n]);
});
test('market settles TOM atomically to the seller and transfers the exact NFT',async()=>{
  await game.connect(alice).faucet();await game.connect(bob).faucet();await game.connect(alice).buyBuilding(0,ethers.parseEther('28'));
  await game.connect(alice).list(1,ethers.parseEther('50'));await game.connect(bob).buyListing(1,ethers.parseEther('50'));
  assert.equal(await game.ownerOf(1),bob.address);assert.equal(await tom.balanceOf(alice.address),ethers.parseEther('222'));assert.equal(await tom.balanceOf(bob.address),ethers.parseEther('150'));assert.equal(await game.listingPrice(1),0n);
  await assert.rejects(game.connect(bob).buyListing(1,ethers.parseEther('50')));
});
test('ownership, stale prices, self-buy and transferred listings are enforced on-chain',async()=>{
  await game.connect(alice).faucet();await game.connect(bob).faucet();await game.connect(alice).buyBuilding(0,ethers.parseEther('28'));
  await assert.rejects(game.connect(bob).list(1,1));await assert.rejects(game.connect(alice).list(1,1));
  await game.connect(alice).list(1,ethers.parseEther('50'));await assert.rejects(game.connect(alice).buyListing(1,ethers.parseEther('50')));await assert.rejects(game.connect(bob).buyListing(1,ethers.parseEther('49')));
  await game.connect(alice).transferFrom(alice.address,bob.address,1);await game.connect(bob).transferFrom(bob.address,alice.address,1);assert.equal(await game.listingPrice(1),0n);
});
test('metadata is available on-chain without an external metadata server',async()=>{
  await game.connect(alice).faucet();await game.connect(alice).buyBuilding(0,ethers.parseEther('28'));
  const uri=await game.tokenURI(1),metadata=JSON.parse(Buffer.from(uri.split(',')[1],'base64').toString());
  assert.equal(metadata.name,'Meadow Farm Building #1');assert.match(metadata.image,/^data:image\/svg\+xml;base64,/);assert.equal(metadata.attributes[0].value,0);
});
test('a valid verifier voucher pays the exact stage and bonus once only',async()=>{
  await game.connect(alice).beginChallenge(ethers.id('round1'));const {r,signature}=await voucher(alice,{bonusMask:3});
  await game.connect(alice).claimReward(r,signature);assert.equal(await tom.balanceOf(alice.address),ethers.parseEther('44'));assert.equal(await game.claimedStages(alice.address,r.day),1n);assert.equal(await game.claimedQuestMask(alice.address),3n);await assert.rejects(game.connect(alice).claimReward(r,signature));
  await assert.rejects(game.connect(alice).beginChallenge(ethers.id('round1')));
});
test('unsigned client progress, another wallet, wrong domain and modified vouchers cannot mint rewards',async()=>{
  await game.connect(alice).beginChallenge(ethers.id('round1'));const {r,signature}=await voucher();
  await assert.rejects(game.connect(bob).claimReward(r,signature));await assert.rejects(game.connect(alice).claimReward({...r,bonusMask:7},signature));
  const forged=await bob.signTypedData({name:'Meadow Farm',version:'1',chainId:31337,verifyingContract:await game.getAddress()},types,r);
  await assert.rejects(game.connect(alice).claimReward(r,forged));assert.equal(await tom.balanceOf(alice.address),0n);
});
test('retry invalidates old vouchers and a new stage cannot reuse an already settled industry bonus',async()=>{
  await game.connect(alice).beginChallenge(ethers.id('round1'));const old=await voucher();
  await game.connect(alice).beginChallenge(ethers.id('round1'));await assert.rejects(game.connect(alice).claimReward(old.r,old.signature));
  const first=await voucher(alice,{bonusMask:2});await game.connect(alice).claimReward(first.r,first.signature);
  await game.connect(alice).beginChallenge(ethers.id('round2'));const second=await voucher(alice,{bonusMask:2});await assert.rejects(game.connect(alice).claimReward(second.r,second.signature));
  const valid=await voucher(alice);await game.connect(alice).claimReward(valid.r,valid.signature);assert.equal(await tom.balanceOf(alice.address),ethers.parseEther('68'));
});
test('completion timestamps outside the actual attempt and vouchers from yesterday are rejected',async()=>{
  await game.connect(alice).beginChallenge(ethers.id('round1'));const a=await game.attempts(alice.address);
  const early=await voucher(alice,{completedAt:a.startedAt-1n});await assert.rejects(game.connect(alice).claimReward(early.r,early.signature));
  const late=await voucher(alice,{completedAt:a.endsAt+1n});await assert.rejects(game.connect(alice).claimReward(late.r,late.signature));
  const saved=await voucher();await ethers.provider.send('evm_increaseTime',[86400]);await ethers.provider.send('evm_mine',[]);await assert.rejects(game.connect(alice).claimReward(saved.r,saved.signature));
});
